-- ============================================================================
-- 0006_client_feedback.sql — Round of client-requested changes.
--
--   1. Pricing fix: get_quote no longer adds tourist tax (handled by the
--      concierge; the guest count field is being removed), and get_stay_options
--      returns the SAME total the guest will actually pay (with the €3,000
--      floor applied), so the Villa card and the quote never disagree.
--   2. Lead capture: a lead_captures table + capture_lead() RPC records a
--      guest's name/email/phone as soon as they give it (contact step), so
--      abandoned bookings are still reachable. Marked converted on booking.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The guest-count field is removed from the UI (flat Villa price), so bookings
-- may arrive with guests = 0. Relax the constraint.
-- ---------------------------------------------------------------------------

alter table public.bookings drop constraint if exists bookings_guests_check;
alter table public.bookings alter column guests drop not null;
alter table public.bookings add constraint bookings_guests_check
  check (guests is null or guests >= 0);

-- ---------------------------------------------------------------------------
-- get_quote v4 — no tourist-tax line; the floor is the last thing applied so
-- the returned total is exactly what gets charged.
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
  season public.seasons;
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

  -- Promotion on the accommodation subtotal (never extras).
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

  -- Running total (accommodation + extras). No tourist tax online.
  select coalesce(sum((l->>'amount')::int), 0) into total
    from jsonb_array_elements(lines || extras_lines) l;

  -- Minimum booking floor: top up transparently so a low-season 3-night stay
  -- is always at least the minimum.
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
    'taxLine', null,
    'total', total,
    'depositDue', round(total * cfg.deposit_pct / 100.0)::int,
    'depositPct', cfg.deposit_pct)
    || case when promo_json is null then '{}'::jsonb
            else jsonb_build_object('promo', promo_json) end;
end $$;

-- ---------------------------------------------------------------------------
-- get_stay_options v4 — return the REAL total (floor applied) and a coherent
-- nightly figure, so the Villa card matches the quote exactly.
-- ---------------------------------------------------------------------------

create or replace function public.get_stay_options(p_arrive date, p_depart date, p_guests int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q jsonb;
  total int;
  nights int;
begin
  begin
    q := public.get_quote(p_arrive, p_depart, p_guests, 'estate', '{}', null);
    total := (q->>'total')::int;      -- accommodation total WITH the floor
    nights := (q->>'nights')::int;
    return jsonb_build_array(jsonb_build_object(
      'unit', 'estate', 'available', true, 'total', total,
      'nightly', round(total::numeric / nights)::int));
  exception when others then
    return jsonb_build_array(jsonb_build_object(
      'unit', 'estate', 'available', false, 'reason', sqlerrm));
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Lead capture — record contact details before the booking is completed.
-- ---------------------------------------------------------------------------

create table if not exists public.lead_captures (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  phone text,
  arrive date,
  depart date,
  guests integer,
  status text not null default 'incomplete'
    check (status in ('incomplete','converted')),
  reference text,               -- set when it converts to a booking
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_captures_status_idx on public.lead_captures (status, created_at desc);

alter table public.lead_captures enable row level security;
-- Staff-only reads (personal data). Guests write only via the RPC below.
create policy lead_captures_admin on public.lead_captures
  for all using (public.is_admin()) with check (public.is_admin());

-- Public RPC: upsert a lead by email (latest details win). Never throws on
-- bad input — lead capture is best-effort and must not block the guest.
create or replace function public.capture_lead(
  p_name text, p_email text, p_phone text,
  p_arrive date, p_depart date, p_guests int
) returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  existing uuid;
begin
  if position('@' in v_email) = 0 then return; end if;  -- need a plausible email
  select id into existing
    from public.lead_captures
    where email = v_email and status = 'incomplete'
    order by created_at desc limit 1;
  if existing is null then
    insert into public.lead_captures (name, email, phone, arrive, depart, guests)
    values (nullif(trim(coalesce(p_name,'')),''), v_email,
            nullif(trim(coalesce(p_phone,'')),''), p_arrive, p_depart, p_guests);
  else
    update public.lead_captures set
      name = coalesce(nullif(trim(coalesce(p_name,'')),''), name),
      phone = coalesce(nullif(trim(coalesce(p_phone,'')),''), phone),
      arrive = coalesce(p_arrive, arrive),
      depart = coalesce(p_depart, depart),
      guests = coalesce(p_guests, guests),
      updated_at = now()
    where id = existing;
  end if;
end $$;

-- When a booking is created, mark any matching incomplete lead as converted.
create or replace function public.mark_lead_converted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.lead_captures
     set status = 'converted', reference = new.reference, updated_at = now()
   where email = lower(new.guest_email) and status = 'incomplete';
  return new;
end $$;

drop trigger if exists bookings_mark_lead on public.bookings;
create trigger bookings_mark_lead
after insert on public.bookings
for each row execute function public.mark_lead_converted();
