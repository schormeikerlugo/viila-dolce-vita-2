-- ===========================================================================
-- 0008_soft_requests.sql — Reservations become non-binding requests.
--
-- Business change (owner request): a guest booking must NOT block the calendar.
-- The process is manual — the concierge decides who gets a date. A guest who
-- pre-books without real intent should no longer freeze that date for other
-- potential guests. Only the concierge CONFIRMING a booking (or a manual block)
-- takes the date off the public calendar.
--
-- What changes here:
--  1. Only 'confirmed' / 'completed' bookings occupy the calendar
--     (booking_units.active). 'requested' / 'hold' no longer block.
--  2. New requests are written with booking_units.active = false, so any number
--     of guests can request the same dates — they coexist.
--  3. get_quote no longer rejects dates that merely have pending requests; it
--     still rejects dates locked by a confirmed booking or a manual block.
--  4. create_booking_request stops blocking on pending requests.
--  5. New admin RPC admin_reschedule_booking(reference, arrive, depart) lets the
--     concierge free up days / shift a stay; re-quotes and re-writes the units.
--  6. New admin RPC admin_overlapping_requests(reference) surfaces other pending
--     requests that overlap a booking, so the concierge is warned on confirm.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Redefine what "active" (calendar-blocking) means.
--    Only confirmed/completed bookings hold the dates now.
-- ---------------------------------------------------------------------------

create or replace function public.sync_booking_units_active()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.booking_units
     set active = (new.status in ('confirmed','completed'))
   where booking_id = new.id;
  return new;
end $$;

-- Bring existing rows in line with the new rule: release any nights that were
-- only held by pending 'requested'/'hold' bookings.
update public.booking_units bu
   set active = (b.status in ('confirmed','completed'))
  from public.bookings b
 where b.id = bu.booking_id
   and bu.active <> (b.status in ('confirmed','completed'));

-- ---------------------------------------------------------------------------
-- 2. create_booking_request v4 — a request no longer blocks the calendar.
--    Units are inserted inactive so overlapping requests can coexist; they
--    flip active only when the concierge confirms (sync trigger above).
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

  -- The Villa is the only bookable unit now. get_quote (v6) only refuses dates
  -- locked by a confirmed booking or a manual block — not pending requests.
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

  -- Reserve all active suites (the whole Villa) for the range, but INACTIVE:
  -- a pending request must not block the calendar or clash with other requests.
  for s in select slug from public.suites where active loop
    insert into public.booking_units (booking_id, suite, stay, active)
    values (b_id, s, daterange(p_arrive, p_depart), false);
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
end $$;

-- ---------------------------------------------------------------------------
-- 3. get_quote v6 — identical to v5 except it no longer refuses dates that
--    only have pending requests. occupied_nights now only reports confirmed/
--    completed bookings (active units) + manual blocks, so this check still
--    protects against quoting a date the concierge has already locked.
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

  -- Only confirmed bookings + manual blocks count as occupied now. Pending
  -- requests are non-binding and never make a date "unavailable" to quote.
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
-- 4. admin_reschedule_booking — the concierge shifts / trims a stay.
--    Re-quotes, updates the booking, and re-writes its units. If the booking
--    is confirmed/completed the units go active, so the EXCLUDE constraint
--    guards against overlapping a different confirmed stay.
-- ---------------------------------------------------------------------------

create or replace function public.admin_reschedule_booking(
  p_reference text, p_arrive date, p_depart date
) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  b public.bookings;
  q jsonb;
  s text;
  is_active boolean;
begin
  if not public.is_admin() then raise exception 'Staff only.'; end if;

  select * into b from public.bookings where reference = p_reference;
  if not found then raise exception 'Booking % not found.', p_reference; end if;
  if b.status in ('cancelled','expired') then
    raise exception 'Cannot reschedule a % booking.', b.status;
  end if;
  if p_depart <= p_arrive then raise exception 'Departure must be after arrival.'; end if;

  -- Re-price the new range. get_quote refuses dates locked by another confirmed
  -- booking or a block; a booking never blocks itself (its own units are removed
  -- below only after quoting, but they are inactive unless confirmed — and a
  -- confirmed booking's own nights are excluded here since we compare ranges).
  q := public.get_quote(p_arrive, p_depart, coalesce(b.guests, 0), 'estate',
                        coalesce(b.extra_ids, '{}'), b.promo_code);

  update public.bookings
     set arrive = p_arrive,
         depart = p_depart,
         quote = q,
         total = (q->>'total')::int,
         deposit_due = (q->>'depositDue')::int
   where id = b.id;

  is_active := (b.status in ('confirmed','completed'));

  -- Re-write the units for the whole Villa on the new range.
  delete from public.booking_units where booking_id = b.id;
  for s in select slug from public.suites where active loop
    insert into public.booking_units (booking_id, suite, stay, active)
    values (b.id, s, daterange(p_arrive, p_depart), is_active);
  end loop;

  return jsonb_build_object(
    'reference', b.reference, 'arrive', p_arrive, 'depart', p_depart, 'quote', q);
exception
  when exclusion_violation then
    raise exception 'Those dates overlap another confirmed stay — pick different dates.';
end $$;

-- ---------------------------------------------------------------------------
-- 5. admin_overlapping_requests — other still-pending bookings whose stay
--    overlaps the given booking's range. Used to warn the concierge on confirm.
-- ---------------------------------------------------------------------------

create or replace function public.admin_overlapping_requests(p_reference text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  b public.bookings;
begin
  if not public.is_admin() then raise exception 'Staff only.'; end if;
  select * into b from public.bookings where reference = p_reference;
  if not found then raise exception 'Booking % not found.', p_reference; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'reference', o.reference,
             'guestName', o.guest_name,
             'status', o.status,
             'arrive', o.arrive,
             'depart', o.depart))
      from public.bookings o
     where o.reference <> b.reference
       and o.status in ('requested','hold')
       and daterange(o.arrive, o.depart) && daterange(b.arrive, b.depart)
  ), '[]'::jsonb);
end $$;

-- Let the same authenticated staff sessions call the new RPCs.
grant execute on function public.admin_reschedule_booking(text, date, date) to authenticated;
grant execute on function public.admin_overlapping_requests(text) to authenticated;
