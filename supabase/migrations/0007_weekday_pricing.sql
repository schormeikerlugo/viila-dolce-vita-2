-- ============================================================================
-- 0007_weekday_pricing.sql — Per-weekday Villa pricing.
--
-- A night is priced by its check-in weekday:
--   Mon–Thu €3,000 · Fri €4,250 · Sat €4,750 · Sun €3,750
--
-- This replaces the flat nightly rate + season multiplier + €3,000 floor
-- (3 nights already clears €3,000, and season multipliers no longer apply).
-- Minimum stay stays at 3 nights.
-- ============================================================================

-- Per-weekday rates on settings (Postgres dow: 0=Sun … 6=Sat).
alter table public.settings
  add column if not exists rate_mon_thu integer not null default 3000 check (rate_mon_thu >= 0),
  add column if not exists rate_fri integer not null default 4250 check (rate_fri >= 0),
  add column if not exists rate_sat integer not null default 4750 check (rate_sat >= 0),
  add column if not exists rate_sun integer not null default 3750 check (rate_sun >= 0);

update public.settings
  set rate_mon_thu = 3000, rate_fri = 4250, rate_sat = 4750, rate_sun = 3750,
      min_booking_total = 0            -- floor no longer needed
  where id = true;

-- Rate for a single night, by its date's weekday.
create or replace function public.night_rate(cfg public.settings, d date)
returns integer language sql immutable as $$
  select case extract(dow from d)::int
    when 5 then cfg.rate_fri   -- Friday
    when 6 then cfg.rate_sat   -- Saturday
    when 0 then cfg.rate_sun   -- Sunday
    else cfg.rate_mon_thu      -- Mon–Thu
  end
$$;

-- ---------------------------------------------------------------------------
-- get_quote v5 — sum per-weekday night rates; itemise so the summary can show
-- the breakdown; no season multiplier, no floor, no tourist tax online.
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
  night date;
  gross int := 0;
  rate int;
  rate_min int; rate_max int;
  x public.extras;
  qty int; amount int; detail text;
  total int;
  acc_subtotal int;
  promo public.promotions;
  promo_discount int := 0;
  promo_json jsonb := null;
begin
  select * into cfg from public.settings limit 1;
  if nights <= 0 then raise exception 'Departure must be after arrival.'; end if;
  if p_arrive < current_date then raise exception 'Arrival cannot be in the past.'; end if;

  min_nights := cfg.estate_min_nights;
  if nights < min_nights then
    raise exception 'The Villa is booked for a minimum of % nights.', min_nights;
  end if;

  if exists (select 1 from public.occupied_nights(p_arrive, p_depart)) then
    raise exception 'Those dates are no longer available.';
  end if;

  -- Accommodation: sum of each night's weekday rate.
  rate_min := null; rate_max := null;
  for night in select generate_series(p_arrive, p_depart - 1, interval '1 day')::date loop
    rate := public.night_rate(cfg, night);
    gross := gross + rate;
    rate_min := least(coalesce(rate_min, rate), rate);
    rate_max := greatest(coalesce(rate_max, rate), rate);
  end loop;
  lines := lines || jsonb_build_object(
    'label', 'The Entire Villa',
    'detail', nights || case when nights = 1 then ' night' else ' nights' end ||
              case when rate_min = rate_max then ' × €' || rate_min
                   else ' · €' || rate_min || '–€' || rate_max || '/night' end,
    'amount', gross);

  -- Promotion on the accommodation subtotal.
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

  -- Extras.
  for x in select * from public.extras where id = any(p_extras) and not inquire_only loop
    qty := case x.price_type
      when 'per_stay' then 1
      when 'per_night' then nights
      when 'per_person' then greatest(p_guests, 1)
      else greatest(p_guests, 1) * nights end;
    detail := case x.price_type
      when 'per_stay' then null
      when 'per_night' then nights || ' nights × €' || x.price
      else null end;
    amount := x.price * qty;
    extras_lines := extras_lines ||
      (jsonb_build_object('label', x.name, 'amount', amount)
       || case when detail is null then '{}'::jsonb else jsonb_build_object('detail', detail) end);
  end loop;

  select coalesce(sum((l->>'amount')::int), 0) into total
    from jsonb_array_elements(lines || extras_lines) l;

  return jsonb_build_object(
    'currency', 'EUR',
    'nights', nights,
    'minNights', min_nights,
    'lines', lines,
    'extrasLines', extras_lines,
    'taxLine', null,
    'total', total,
    'depositDue', round(total * cfg.deposit_pct / 100.0)::int,
    'depositPct', cfg.deposit_pct)
    || case when promo_json is null then '{}'::jsonb
            else jsonb_build_object('promo', promo_json) end;
end $$;

-- ---------------------------------------------------------------------------
-- get_availability v2 — return, per night in the window, its per-weekday
-- price plus the list of occupied suites (for the calendar's per-day price).
-- Shape: { "YYYY-MM-DD": { "price": 3000, "suites": ["roma", ...] }, ... }
-- Missing suites key = all free.
-- ---------------------------------------------------------------------------

create or replace function public.get_availability(p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cfg public.settings;
  result jsonb := '{}'::jsonb;
  d date;
  occ jsonb;
begin
  select * into cfg from public.settings limit 1;
  -- occupied suites per night
  select coalesce(jsonb_object_agg(night, suites), '{}'::jsonb) into occ
  from (
    select night, jsonb_agg(distinct suite) as suites
    from public.occupied_nights(p_start, p_end)
    group by night
  ) t;

  for d in select generate_series(p_start, p_end - 1, interval '1 day')::date loop
    result := result || jsonb_build_object(
      to_char(d, 'YYYY-MM-DD'),
      jsonb_build_object('price', public.night_rate(cfg, d))
        || case when occ ? to_char(d, 'YYYY-MM-DD')
                then jsonb_build_object('suites', occ -> to_char(d, 'YYYY-MM-DD'))
                else '{}'::jsonb end);
  end loop;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- reset_rates — weekday defaults.
-- ---------------------------------------------------------------------------

create or replace function public.reset_rates()
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Staff only.'; end if;
  update public.extras e set price = d.price
    from (values
      ('private-dinner', 85), ('welcome-hamper', 65), ('grocery-prestock', 40),
      ('yoga-session', 45), ('massage', 110), ('butler', 120),
      ('transfer-pisa', 180), ('transfer-rome', 320), ('late-checkout', 60),
      ('cellar-selection', 0)
    ) as d(id, price) where e.id = d.id;
  update public.settings set deposit_pct = 30,
    estate_min_nights = 3, min_booking_total = 0,
    rate_mon_thu = 3000, rate_fri = 4250, rate_sat = 4750, rate_sun = 3750
    where id = true;
end $$;
