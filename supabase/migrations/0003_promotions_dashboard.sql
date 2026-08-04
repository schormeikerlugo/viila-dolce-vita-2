-- ============================================================================
-- 0003_promotions_dashboard.sql — Owner back-office, phase C.
--
--   promotions        code-based ("DOLCE10") and automatic (no code) offers,
--                     applied server-side inside get_quote as a discount line
--   bookings.promo    the code/offer a booking redeemed (+ usage counting)
--   get_dashboard_stats  one-call aggregates for the admin Overview screen
--
-- get_quote / create_booking_request gain a p_promo_code parameter; the old
-- signatures are dropped (PostgREST would otherwise see ambiguous overloads).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text unique,                       -- null = automatic offer
  name text not null,
  kind text not null check (kind in ('percent','fixed')),
  value numeric not null check (value > 0),
  suite text references public.suites(slug),  -- null = every suite + estate
  stay_start date,                        -- stay window: arrive >= stay_start
  stay_end date,                          -- and depart <= stay_end (check-out)
  book_start date,                        -- booking window (when it can be redeemed)
  book_end date,
  min_nights integer not null default 1 check (min_nights >= 1),
  usage_limit integer,                    -- null = unlimited
  used integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (code is null or code = upper(code)),
  check (stay_start is null or stay_end is null or stay_end > stay_start),
  check (book_start is null or book_end is null or book_end > book_start)
);

alter table public.promotions enable row level security;
create policy promotions_admin on public.promotions
  for all using (public.is_admin()) with check (public.is_admin());
-- No anon policy: guests never enumerate offers; they reach quotes through
-- the SECURITY DEFINER functions below.

alter table public.bookings add column promo_id uuid references public.promotions(id);
alter table public.bookings add column promo_code text;

-- ---------------------------------------------------------------------------
-- Promo resolution
-- ---------------------------------------------------------------------------

-- Does a promo qualify for this stay? (Shared by explicit and automatic paths.)
create or replace function public.promo_qualifies(
  p public.promotions, p_arrive date, p_depart date, p_unit text
) returns boolean language sql immutable as $$
  select p.active
     and (p.usage_limit is null or p.used < p.usage_limit)
     and (p.book_start is null or current_date >= p.book_start)
     and (p.book_end is null or current_date < p.book_end)
     and (p.stay_start is null or p_arrive >= p.stay_start)
     and (p.stay_end is null or p_depart <= p.stay_end)
     and (p_depart - p_arrive) >= p.min_nights
     and (p.suite is null or p.suite = p_unit)
$$;

-- Resolve the promo for a stay. Explicit codes raise guest-readable errors
-- when they don't apply; automatic offers pick the best qualifying discount.
create or replace function public.resolve_promo(
  p_code text, p_arrive date, p_depart date, p_unit text, p_acc_subtotal int
) returns public.promotions
language plpgsql stable security definer set search_path = public as $$
declare
  p public.promotions;
begin
  if p_code is not null and trim(p_code) <> '' then
    select * into p from public.promotions where code = upper(trim(p_code));
    if not found or not p.active then
      raise exception 'That promo code isn''t valid.';
    end if;
    if p.usage_limit is not null and p.used >= p.usage_limit then
      raise exception 'That code has been fully redeemed.';
    end if;
    if (p.book_start is not null and current_date < p.book_start)
       or (p.book_end is not null and current_date >= p.book_end) then
      raise exception 'That promo code isn''t running right now.';
    end if;
    if (p.stay_start is not null and p_arrive < p.stay_start)
       or (p.stay_end is not null and p_depart > p.stay_end) then
      raise exception 'That code doesn''t apply to these dates.';
    end if;
    if (p_depart - p_arrive) < p.min_nights then
      raise exception 'That code needs a stay of at least % nights.', p.min_nights;
    end if;
    if p.suite is not null and p.suite <> p_unit then
      raise exception 'That code doesn''t apply to this suite.';
    end if;
    return p;
  end if;

  -- Best automatic offer (largest discount on this subtotal), if any.
  select * into p
    from public.promotions a
   where a.code is null and public.promo_qualifies(a, p_arrive, p_depart, p_unit)
   order by case when a.kind = 'percent'
                 then round(p_acc_subtotal * a.value / 100.0)
                 else least(a.value, p_acc_subtotal) end desc
   limit 1;
  return p; -- may be null row
end $$;

-- ---------------------------------------------------------------------------
-- get_quote v2 (promo-aware) — drop v1 first to avoid overload ambiguity.
-- ---------------------------------------------------------------------------

drop function if exists public.get_stay_options(date, date, int);
drop function if exists public.create_booking_request(date, date, int, text, text[], text, text, text, text, boolean);
drop function if exists public.get_quote(date, date, int, text, text[]);

create or replace function public.get_quote(
  p_arrive date, p_depart date, p_guests int, p_unit text,
  p_extras text[] default '{}', p_promo_code text default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cfg public.settings;
  nights int := p_depart - p_arrive;
  min_nights int;
  cap int;
  lines jsonb := '[]'::jsonb;
  extras_lines jsonb := '[]'::jsonb;
  tax_line jsonb;
  night date;
  season public.seasons;
  suite public.suites;
  sum_base int;
  gross int := 0;
  rate int;
  rate_min int; rate_max int;
  extra_guests int;
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

  -- Capacity.
  if p_unit = 'estate' then
    cap := cfg.estate_sleeps;
    if p_guests > cap then raise exception 'The estate sleeps up to % guests.', cap; end if;
  else
    select * into suite from public.suites where slug = p_unit and active;
    if not found then raise exception 'Unknown suite.'; end if;
    if p_guests > suite.sleeps then
      raise exception 'The % sleeps up to % guests.', suite.name, suite.sleeps;
    end if;
  end if;

  -- Season minimum stay (strictest season touched).
  select max(s.min_nights) into min_nights
    from generate_series(p_arrive, p_depart - 1, interval '1 day') d
    cross join lateral public.season_for(d::date) s;
  if nights < min_nights then
    raise exception 'These dates require a minimum stay of % nights.', min_nights;
  end if;

  -- Availability.
  if exists (
    select 1 from public.occupied_nights(p_arrive, p_depart) o
    where p_unit = 'estate' or o.suite = p_unit
  ) then
    raise exception 'Those dates are no longer available for this selection.';
  end if;

  -- Accommodation lines.
  if p_unit = 'estate' then
    select sum(base_rate)::int into sum_base from public.suites where active;
    for night in select generate_series(p_arrive, p_depart - 1, interval '1 day')::date loop
      season := public.season_for(night);
      gross := gross + round(sum_base * season.multiplier)::int;
    end loop;
    lines := lines || jsonb_build_object(
      'label', 'Entire Estate — five suites',
      'detail', nights || case when nights = 1 then ' night' else ' nights' end || ', all suites & grounds',
      'amount', gross);
    lines := lines || jsonb_build_object(
      'label', 'Full-buyout rate (−' || cfg.estate_discount_pct || '%)',
      'amount', -round(gross * cfg.estate_discount_pct / 100.0)::int);
    extra_guests := greatest(0, p_guests - cfg.estate_base_occupancy);
    if extra_guests > 0 then
      lines := lines || jsonb_build_object(
        'label', 'Additional guests',
        'detail', extra_guests || ' × €' || cfg.estate_extra_guest_rate || ' × ' || nights || ' nights',
        'amount', extra_guests * cfg.estate_extra_guest_rate * nights);
    end if;
  else
    rate_min := null; rate_max := null; gross := 0;
    for night in select generate_series(p_arrive, p_depart - 1, interval '1 day')::date loop
      season := public.season_for(night);
      rate := round(suite.base_rate * season.multiplier)::int;
      gross := gross + rate;
      rate_min := least(coalesce(rate_min, rate), rate);
      rate_max := greatest(coalesce(rate_max, rate), rate);
    end loop;
    lines := lines || jsonb_build_object(
      'label', suite.name,
      'detail', nights || case when nights = 1 then ' night' else ' nights' end || ' × ' ||
                case when rate_min = rate_max then '€' || rate_min
                     else '€' || rate_min || '–€' || rate_max end,
      'amount', gross);
    extra_guests := greatest(0, p_guests - suite.base_occupancy);
    if extra_guests > 0 then
      lines := lines || jsonb_build_object(
        'label', 'Additional guests',
        'detail', extra_guests || ' × €' || suite.extra_guest_rate || ' × ' || nights || ' nights',
        'amount', extra_guests * suite.extra_guest_rate * nights);
    end if;
  end if;

  -- Promotion (explicit code or best automatic offer) on the accommodation
  -- subtotal — never on extras or tax.
  select coalesce(sum((l->>'amount')::int), 0) into acc_subtotal
    from jsonb_array_elements(lines) l;
  promo := public.resolve_promo(p_promo_code, p_arrive, p_depart, p_unit, acc_subtotal);
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
-- get_stay_options v2 (automatic offers show in the per-unit pricing)
-- ---------------------------------------------------------------------------

create or replace function public.get_stay_options(p_arrive date, p_depart date, p_guests int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb := '[]'::jsonb;
  u text;
  q jsonb;
  acc int;
begin
  for u in (select slug from public.suites where active order by rank) union all (select 'estate') loop
    begin
      q := public.get_quote(p_arrive, p_depart, p_guests, u, '{}', null);
      select coalesce(sum((l->>'amount')::int), 0) into acc from jsonb_array_elements(q->'lines') l;
      result := result || jsonb_build_object(
        'unit', u, 'available', true, 'total', acc,
        'nightly', round(acc::numeric / (q->>'nights')::int)::int);
    exception when others then
      result := result || jsonb_build_object('unit', u, 'available', false, 'reason', sqlerrm);
    end;
  end loop;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- create_booking_request v2 (records + counts the redeemed promo)
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

  q := public.get_quote(p_arrive, p_depart, p_guests, p_unit, p_extras, p_promo_code);
  v_promo_id := (q->'promo'->>'id')::uuid;
  v_promo_code := q->'promo'->>'code';

  select 'VDV-' || string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
    into ref from generate_series(1, 6);

  insert into public.bookings
    (reference, unit, arrive, depart, guests, guest_name, guest_email, guest_phone,
     guest_notes, accepts_animals, extra_ids, quote, total, deposit_due, promo_id, promo_code)
  values
    (ref, p_unit, p_arrive, p_depart, p_guests, trim(p_name), trim(p_email),
     nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_notes, '')), ''),
     p_accepts, coalesce(p_extras, '{}'), q, (q->>'total')::int, (q->>'depositDue')::int,
     v_promo_id, v_promo_code)
  returning id into b_id;

  if v_promo_id is not null then
    update public.promotions set used = used + 1 where id = v_promo_id;
  end if;

  for s in
    select slug from public.suites where active and (p_unit = 'estate' or slug = p_unit)
  loop
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
-- Dashboard aggregates (one call for the Overview screen; staff only)
-- ---------------------------------------------------------------------------

create or replace function public.get_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m_start date := date_trunc('month', current_date)::date;
  m_end date := (date_trunc('month', current_date) + interval '1 month')::date;
  suite_count int;
  occupied_count int;
begin
  if not public.is_admin() then raise exception 'Staff only.'; end if;

  select count(*) into suite_count from public.suites where active;
  select count(*) into occupied_count
    from (select distinct night, suite from public.occupied_nights(m_start, m_end)) t;

  return jsonb_build_object(
    'monthStart', m_start,
    'pendingRequests', (select count(*) from public.bookings where status = 'requested'),
    'arrivalsNext7', (
      select count(*) from public.bookings
      where status = 'confirmed' and arrive >= current_date and arrive < current_date + 7),
    'occupancyMonthPct', round(100.0 * occupied_count / nullif(suite_count * (m_end - m_start), 0)),
    'revenueMonth', coalesce((
      select sum(total) from public.bookings
      where status in ('confirmed','completed') and arrive >= m_start and arrive < m_end), 0),
    'pipelineValue', coalesce((
      select sum(total) from public.bookings where status = 'requested'), 0),
    'avgBookingValue', coalesce((
      select round(avg(total)) from public.bookings
      where status in ('confirmed','completed')), 0),
    'needsAttention', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reference', reference, 'guest', guest_name, 'email', guest_email,
        'phone', guest_phone, 'unit', unit, 'arrive', arrive, 'depart', depart,
        'guests', guests, 'total', total, 'createdAt', created_at) order by created_at)
      from public.bookings where status = 'requested'), '[]'::jsonb),
    'arrivals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', arrive, 'reference', reference, 'guest', guest_name,
        'unit', unit, 'guests', guests, 'phone', guest_phone) order by arrive)
      from public.bookings
      where status = 'confirmed' and arrive >= current_date and arrive < current_date + 14), '[]'::jsonb),
    'departures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', depart, 'reference', reference, 'guest', guest_name,
        'unit', unit, 'guests', guests, 'phone', guest_phone) order by depart)
      from public.bookings
      where status in ('confirmed','completed') and depart >= current_date and depart < current_date + 14), '[]'::jsonb));
end $$;
