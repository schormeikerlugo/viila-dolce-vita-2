-- ============================================================================
-- 0005_estate_only.sql — Business model change: the whole Villa only.
--
-- Guests no longer book individual suites — the bookable unit is the entire
-- Villa (all five suites included). Pricing is a single Villa nightly rate
-- × nights × season multiplier, with a 3-night minimum and a €3,000 minimum
-- booking total. Each extra night adds proportionally (rate × the night's
-- season). Extras (step 3) are unchanged.
--
-- Backwards note: `unit` stays 'estate' throughout (the schema/constraints
-- already model a full buyout as all-five-suites), so booking_units and the
-- EXCLUDE anti-double-booking constraint keep working untouched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Settings: add Villa nightly rate, min nights, min booking total.
-- ---------------------------------------------------------------------------

alter table public.settings
  add column if not exists estate_nightly_rate integer not null default 1000
    check (estate_nightly_rate >= 0),
  add column if not exists estate_min_nights integer not null default 3
    check (estate_min_nights >= 1),
  add column if not exists min_booking_total integer not null default 3000
    check (min_booking_total >= 0);

update public.settings
  set estate_nightly_rate = 1000, estate_min_nights = 3, min_booking_total = 3000
  where id = true;

-- ---------------------------------------------------------------------------
-- get_quote v3 — Villa only. Rejects individual-suite requests, enforces the
-- 3-night and €3,000 minimums, prices the Villa as one clean line.
-- ---------------------------------------------------------------------------

create or replace function public.get_quote(
  p_arrive date, p_depart date, p_guests int, p_unit text,
  p_extras text[] default '{}', p_promo_code text default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cfg public.settings;
  nights int := p_depart - p_arrive;
  min_nights int;
  lines jsonb := '[]'::jsonb;
  extras_lines jsonb := '[]'::jsonb;
  tax_line jsonb;
  night date;
  season public.seasons;
  gross int := 0;
  rate int;
  rate_min int; rate_max int;
  x public.extras;
  qty int; amount int; detail text;
  tax_nights int;
  total int;
  acc_subtotal int;
  promo public.promotions;
  promo_discount int := 0;
  promo_json jsonb := null;
begin
  select * into cfg from public.settings limit 1;
  if nights <= 0 then raise exception 'Departure must be after arrival.'; end if;
  if p_arrive < current_date then raise exception 'Arrival cannot be in the past.'; end if;
  if p_guests < 1 then raise exception 'At least one guest.'; end if;
  if p_guests > cfg.estate_sleeps then
    raise exception 'The Villa sleeps up to % guests.', cfg.estate_sleeps;
  end if;

  -- Minimum stay: the greater of the Villa minimum and any season minimum.
  select coalesce(max(s.min_nights), 1) into min_nights
    from generate_series(p_arrive, p_depart - 1, interval '1 day') d
    cross join lateral public.season_for(d::date) s;
  min_nights := greatest(min_nights, cfg.estate_min_nights);
  if nights < min_nights then
    raise exception 'The Villa is booked for a minimum of % nights.', min_nights;
  end if;

  -- Availability: the Villa is free on a night iff no suite is occupied.
  if exists (select 1 from public.occupied_nights(p_arrive, p_depart)) then
    raise exception 'Those dates are no longer available.';
  end if;

  -- Accommodation: Villa nightly rate × each night's season multiplier.
  rate_min := null; rate_max := null;
  for night in select generate_series(p_arrive, p_depart - 1, interval '1 day')::date loop
    season := public.season_for(night);
    rate := round(cfg.estate_nightly_rate * season.multiplier)::int;
    gross := gross + rate;
    rate_min := least(coalesce(rate_min, rate), rate);
    rate_max := greatest(coalesce(rate_max, rate), rate);
  end loop;
  lines := lines || jsonb_build_object(
    'label', 'The Entire Villa',
    'detail', nights || case when nights = 1 then ' night' else ' nights' end || ' × ' ||
              case when rate_min = rate_max then '€' || rate_min
                   else '€' || rate_min || '–€' || rate_max end,
    'amount', gross);

  -- Promotion on the accommodation subtotal (never extras/tax).
  acc_subtotal := gross;
  promo := public.resolve_promo(p_promo_code, p_arrive, p_depart, 'estate', acc_subtotal);
  if promo.id is not null then
    promo_discount := case when promo.kind = 'percent'
      then round(acc_subtotal * promo.value / 100.0)::int
      else least(promo.value, acc_subtotal)::int end;
    if promo_discount > 0 then
      lines := lines || jsonb_build_object(
        'label', promo.name || case when promo.code is not null then ' (' || promo.code || ')' else '' end,
        'detail', case when promo.kind = 'percent'
                       then '−' || promo.value || '% on accommodation'
                       else 'Offer applied' end,
        'amount', -promo_discount);
      promo_json := jsonb_build_object('id', promo.id, 'name', promo.name, 'code', promo.code);
    end if;
  end if;

  -- Extras (inquire-only ones carry no price and are skipped here).
  for x in select * from public.extras where id = any(p_extras) and not inquire_only loop
    qty := case x.price_type
      when 'per_stay' then 1
      when 'per_night' then nights
      when 'per_person' then p_guests
      else p_guests * nights end;
    detail := case x.price_type
      when 'per_stay' then null
      when 'per_night' then nights || ' nights × €' || x.price
      when 'per_person' then p_guests || ' guests × €' || x.price
      else p_guests || ' guests × ' || nights || ' nights × €' || x.price end;
    amount := x.price * qty;
    extras_lines := extras_lines ||
      (jsonb_build_object('label', x.name, 'amount', amount)
       || case when detail is null then '{}'::jsonb else jsonb_build_object('detail', detail) end);
  end loop;

  -- Tourist tax.
  tax_nights := least(nights, cfg.tourist_tax_max_nights);
  tax_line := jsonb_build_object(
    'label', 'Tourist tax (tassa di soggiorno)',
    'detail', '€' || cfg.tourist_tax || ' × ' || p_guests || ' guests × ' || tax_nights || ' nights',
    'amount', round(cfg.tourist_tax * p_guests * tax_nights)::int);

  select coalesce(sum((l->>'amount')::int), 0) into total
    from jsonb_array_elements(lines || extras_lines || jsonb_build_array(tax_line)) l;

  -- Minimum booking value is a floor: if the computed total falls below it
  -- (e.g. a low-season 3-night stay), top it up to the minimum with a
  -- transparent adjustment line so 3 nights is always €3,000+.
  if total < cfg.min_booking_total then
    lines := lines || jsonb_build_object(
      'label', 'Minimum stay adjustment',
      'detail', 'to reach the €' || cfg.min_booking_total || ' minimum',
      'amount', cfg.min_booking_total - total);
    total := cfg.min_booking_total;
  end if;

  return jsonb_build_object(
    'currency', 'EUR',
    'nights', nights,
    'minNights', min_nights,
    'lines', lines,
    'extrasLines', extras_lines,
    'taxLine', tax_line,
    'total', total,
    'depositDue', round(total * cfg.deposit_pct / 100.0)::int,
    'depositPct', cfg.deposit_pct)
    || case when promo_json is null then '{}'::jsonb
            else jsonb_build_object('promo', promo_json) end;
end $$;

-- ---------------------------------------------------------------------------
-- get_stay_options v3 — a single 'villa' option (the only bookable unit).
-- Kept for API-shape compatibility with the wizard's availability panel.
-- ---------------------------------------------------------------------------

create or replace function public.get_stay_options(p_arrive date, p_depart date, p_guests int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q jsonb;
  acc int;
begin
  begin
    q := public.get_quote(p_arrive, p_depart, p_guests, 'estate', '{}', null);
    select coalesce(sum((l->>'amount')::int), 0) into acc from jsonb_array_elements(q->'lines') l;
    return jsonb_build_array(jsonb_build_object(
      'unit', 'estate', 'available', true, 'total', acc,
      'nightly', round(acc::numeric / (q->>'nights')::int)::int));
  exception when others then
    return jsonb_build_array(jsonb_build_object(
      'unit', 'estate', 'available', false, 'reason', sqlerrm));
  end;
end $$;

-- ---------------------------------------------------------------------------
-- create_booking_request v3 — forces the whole-Villa unit.
-- ---------------------------------------------------------------------------

create or replace function public.create_booking_request(
  p_arrive date, p_depart date, p_guests int, p_unit text, p_extras text[],
  p_name text, p_email text, p_phone text, p_notes text, p_accepts boolean,
  p_promo_code text default null
) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  q jsonb;
  ref text;
  b_id uuid;
  s text;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  x public.extras;
  qty int;
  nights int := p_depart - p_arrive;
  v_promo_id uuid;
  v_promo_code text;
begin
  if coalesce(trim(p_name), '') = '' or position('@' in coalesce(p_email, '')) = 0 then
    raise exception 'Please provide your name and a valid email.';
  end if;
  if not p_accepts then
    raise exception 'Please confirm you are comfortable with our free-roaming rescued animals.';
  end if;

  -- The Villa is the only bookable unit now.
  q := public.get_quote(p_arrive, p_depart, p_guests, 'estate', p_extras, p_promo_code);
  v_promo_id := (q->'promo'->>'id')::uuid;
  v_promo_code := q->'promo'->>'code';

  select 'VDV-' || string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
    into ref from generate_series(1, 6);

  insert into public.bookings
    (reference, unit, arrive, depart, guests, guest_name, guest_email, guest_phone,
     guest_notes, accepts_animals, extra_ids, quote, total, deposit_due, promo_id, promo_code)
  values
    (ref, 'estate', p_arrive, p_depart, p_guests, trim(p_name), trim(p_email),
     nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_notes, '')), ''),
     p_accepts, coalesce(p_extras, '{}'), q, (q->>'total')::int, (q->>'depositDue')::int,
     v_promo_id, v_promo_code)
  returning id into b_id;

  if v_promo_id is not null then
    update public.promotions set used = used + 1 where id = v_promo_id;
  end if;

  -- Book all active suites (the whole Villa) for the range.
  for s in select slug from public.suites where active loop
    insert into public.booking_units (booking_id, suite, stay)
    values (b_id, s, daterange(p_arrive, p_depart));
  end loop;

  for x in select * from public.extras where id = any(p_extras) loop
    qty := case when x.inquire_only then 0
      else case x.price_type
        when 'per_stay' then 1
        when 'per_night' then nights
        when 'per_person' then p_guests
        else p_guests * nights end end;
    insert into public.booking_extras (booking_id, extra_id, amount)
    values (b_id, x.id, x.price * qty);
  end loop;

  return jsonb_build_object(
    'reference', ref, 'status', 'requested',
    'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'quote', q);
exception
  when exclusion_violation then
    raise exception 'Those dates were just taken — please pick different dates.';
end $$;

-- ---------------------------------------------------------------------------
-- reset_rates — include the new Villa settings in the defaults.
-- ---------------------------------------------------------------------------

create or replace function public.reset_rates()
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Staff only.'; end if;
  update public.seasons s set multiplier = d.multiplier, min_nights = d.min_nights
    from (values
      ('festive', 1.2, 3), ('summer', 1.25, 3), ('spring', 1.0, 3),
      ('autumn', 1.0, 3), ('winter', 0.85, 3)
    ) as d(id, multiplier, min_nights) where s.id = d.id;
  update public.extras e set price = d.price
    from (values
      ('private-dinner', 85), ('welcome-hamper', 65), ('grocery-prestock', 40),
      ('yoga-session', 45), ('massage', 110), ('butler', 120),
      ('transfer-pisa', 180), ('transfer-rome', 320), ('late-checkout', 60),
      ('cellar-selection', 0)
    ) as d(id, price) where e.id = d.id;
  update public.settings set deposit_pct = 30, tourist_tax = 2,
    tourist_tax_max_nights = 7, estate_discount_pct = 0,
    estate_base_occupancy = 15, estate_extra_guest_rate = 0, estate_sleeps = 15,
    estate_nightly_rate = 1000, estate_min_nights = 3, min_booking_total = 3000
    where id = true;
end $$;
