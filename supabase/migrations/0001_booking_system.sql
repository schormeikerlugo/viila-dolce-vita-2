-- ============================================================================
-- 0001_booking_system.sql — Villa Dolce Vita booking backend (phase 1).
--
-- Model (mirrors src/lib/booking/types.ts):
--   suites, seasons (evergreen MM-DD), extras, settings  → owner-editable catalog
--   bookings + booking_units (EXCLUDE gist → no double booking) + booking_extras
--   blocks (manual calendar blocks), admins (staff allow-list)
--
-- All guest-facing logic is SECURITY DEFINER RPCs: availability (no personal
-- data leaves the DB), quoting (money is computed here, never in the client)
-- and booking creation (atomic, validated). Admin ops go through RLS keyed
-- on the admins table.
-- ============================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.suites (
  slug text primary key,
  name text not null,
  base_rate integer not null check (base_rate >= 0),
  extra_guest_rate integer not null check (extra_guest_rate >= 0),
  base_occupancy integer not null check (base_occupancy >= 1),
  sleeps integer not null check (sleeps >= 1),
  active boolean not null default true,
  rank integer not null default 99
);

create table public.seasons (
  id text primary key,
  name text not null,
  from_md text not null check (from_md ~ '^\d{2}-\d{2}$'),
  to_md text not null check (to_md ~ '^\d{2}-\d{2}$'),
  multiplier numeric not null check (multiplier >= 0),
  min_nights integer not null check (min_nights >= 1),
  priority integer not null -- first match wins (lower = first)
);

create table public.extras (
  id text primary key,
  name text not null,
  description text not null,
  category text not null check (category in ('food','wellness','service','wine')),
  price_type text not null check (price_type in ('per_stay','per_night','per_person','per_person_night')),
  price integer not null default 0 check (price >= 0),
  inquire_only boolean not null default false,
  sort integer not null default 99
);

-- Single-row config (deposit, tourist tax, estate buyout rules).
create table public.settings (
  id boolean primary key default true check (id),
  deposit_pct integer not null check (deposit_pct between 0 and 100),
  tourist_tax numeric not null check (tourist_tax >= 0),
  tourist_tax_max_nights integer not null check (tourist_tax_max_nights >= 1),
  estate_discount_pct integer not null check (estate_discount_pct between 0 and 100),
  estate_base_occupancy integer not null,
  estate_extra_guest_rate integer not null,
  estate_sleeps integer not null
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  status text not null default 'requested'
    check (status in ('requested','hold','confirmed','completed','cancelled','expired')),
  unit text not null, -- suite slug or 'estate'
  arrive date not null,
  depart date not null,
  guests integer not null check (guests >= 1),
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  guest_notes text,
  accepts_animals boolean not null,
  extra_ids text[] not null default '{}',
  quote jsonb not null,
  total integer not null,
  deposit_due integer not null,
  created_at timestamptz not null default now(),
  check (depart > arrive)
);

-- One row per suite per booking; the estate buyout writes all five.
-- The partial EXCLUDE constraint makes overlapping active stays impossible.
create table public.booking_units (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  suite text not null references public.suites(slug),
  stay daterange not null,
  active boolean not null default true,
  constraint booking_units_no_overlap
    exclude using gist (suite with =, stay with &&) where (active)
);

create index booking_units_booking_idx on public.booking_units (booking_id);

create table public.booking_extras (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  extra_id text not null references public.extras(id),
  amount integer not null default 0,
  primary key (booking_id, extra_id)
);

-- Cancelled/expired bookings release their nights automatically.
create or replace function public.sync_booking_units_active()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.booking_units
     set active = (new.status in ('requested','hold','confirmed','completed'))
   where booking_id = new.id;
  return new;
end $$;

create trigger bookings_status_sync
after update of status on public.bookings
for each row execute function public.sync_booking_units_active();

-- ---------------------------------------------------------------------------
-- Blocks & staff
-- ---------------------------------------------------------------------------

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  suite text references public.suites(slug), -- null = whole estate
  start_date date not null,
  end_date date not null,
  reason text not null,
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.suites enable row level security;
alter table public.seasons enable row level security;
alter table public.extras enable row level security;
alter table public.settings enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_units enable row level security;
alter table public.booking_extras enable row level security;
alter table public.blocks enable row level security;
alter table public.admins enable row level security;

-- Catalog: anyone reads, staff writes.
create policy suites_read on public.suites for select using (true);
create policy suites_write on public.suites for all using (public.is_admin()) with check (public.is_admin());
create policy seasons_read on public.seasons for select using (true);
create policy seasons_write on public.seasons for all using (public.is_admin()) with check (public.is_admin());
create policy extras_read on public.extras for select using (true);
create policy extras_write on public.extras for all using (public.is_admin()) with check (public.is_admin());
create policy settings_read on public.settings for select using (true);
create policy settings_write on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- Bookings hold personal data: staff only. Guests write via the RPC below.
create policy bookings_admin on public.bookings for all using (public.is_admin()) with check (public.is_admin());
create policy booking_units_admin on public.booking_units for select using (public.is_admin());
create policy booking_extras_admin on public.booking_extras for select using (public.is_admin());
create policy blocks_admin on public.blocks for all using (public.is_admin()) with check (public.is_admin());
create policy admins_self on public.admins for select using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- Pricing helpers
-- ---------------------------------------------------------------------------

create or replace function public.season_for(d date)
returns public.seasons language sql stable set search_path = public as $$
  select s.* from public.seasons s
  where case when s.from_md > s.to_md
        then to_char(d, 'MM-DD') >= s.from_md or to_char(d, 'MM-DD') <= s.to_md
        else to_char(d, 'MM-DD') between s.from_md and s.to_md end
  order by s.priority
  limit 1
$$;

-- Every occupied (suite, night) inside [p_start, p_end): active bookings + blocks.
create or replace function public.occupied_nights(p_start date, p_end date)
returns table (night date, suite text)
language sql stable security definer set search_path = public as $$
  select d::date, bu.suite
    from public.booking_units bu
    cross join lateral generate_series(
      greatest(lower(bu.stay), p_start),
      least(upper(bu.stay), p_end) - 1,
      interval '1 day') d
   where bu.active and bu.stay && daterange(p_start, p_end)
  union
  select d::date, s.slug
    from public.blocks b
    join public.suites s on (b.suite is null or b.suite = s.slug)
    cross join lateral generate_series(
      greatest(b.start_date, p_start),
      least(b.end_date, p_end) - 1,
      interval '1 day') d
   where b.start_date < p_end and b.end_date > p_start
$$;

-- ---------------------------------------------------------------------------
-- Guest RPCs
-- ---------------------------------------------------------------------------

-- { "YYYY-MM-DD": ["roma", ...], ... } — occupied suites per night. No names,
-- no references: nothing personal leaves the database.
create or replace function public.get_availability(p_start date, p_end date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(night, suites), '{}'::jsonb)
  from (
    select night, jsonb_agg(distinct suite) as suites
    from public.occupied_nights(p_start, p_end)
    group by night
  ) t
$$;

-- Full price breakdown for a stay. Raises with a guest-readable message when
-- the stay is invalid. Shape matches the TS `Quote` type (camelCase keys).
create or replace function public.get_quote(
  p_arrive date, p_depart date, p_guests int, p_unit text, p_extras text[] default '{}'
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
    'depositPct', cfg.deposit_pct);
end $$;

-- The six bookable options priced for a stay (drives the suite picker).
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
      q := public.get_quote(p_arrive, p_depart, p_guests, u, '{}');
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

-- Atomic booking request: re-validates, re-prices, writes booking + units
-- (+extras). The EXCLUDE constraint is the last line of defence against
-- double booking under concurrency.
create or replace function public.create_booking_request(
  p_arrive date, p_depart date, p_guests int, p_unit text, p_extras text[],
  p_name text, p_email text, p_phone text, p_notes text, p_accepts boolean
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
begin
  if coalesce(trim(p_name), '') = '' or position('@' in coalesce(p_email, '')) = 0 then
    raise exception 'Please provide your name and a valid email.';
  end if;
  if not p_accepts then
    raise exception 'Please confirm you are comfortable with our free-roaming rescued animals.';
  end if;

  q := public.get_quote(p_arrive, p_depart, p_guests, p_unit, p_extras);

  select 'VDV-' || string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
    into ref from generate_series(1, 6);

  insert into public.bookings
    (reference, unit, arrive, depart, guests, guest_name, guest_email, guest_phone,
     guest_notes, accepts_animals, extra_ids, quote, total, deposit_due)
  values
    (ref, p_unit, p_arrive, p_depart, p_guests, trim(p_name), trim(p_email),
     nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_notes, '')), ''),
     p_accepts, coalesce(p_extras, '{}'), q, (q->>'total')::int, (q->>'depositDue')::int)
  returning id into b_id;

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
-- Admin RPCs
-- ---------------------------------------------------------------------------

-- { "YYYY-MM-DD": { "roma": { kind, label, reference?, blockId? }, ... } }
create or replace function public.get_admin_calendar(p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Staff only.'; end if;
  return coalesce((
    select jsonb_object_agg(night, cells) from (
      select night, jsonb_object_agg(suite, cell) as cells from (
        -- one cell per (night, suite); bookings win over blocks on display
        select distinct on (night, suite) night, suite, cell from (
          select d::date as night, bu.suite,
                 jsonb_build_object('kind', 'booking',
                   'label', b.guest_name || ' (' || b.status || ')',
                   'reference', b.reference) as cell,
                 1 as prio
            from public.booking_units bu
            join public.bookings b on b.id = bu.booking_id
            cross join lateral generate_series(
              greatest(lower(bu.stay), p_start), least(upper(bu.stay), p_end) - 1,
              interval '1 day') d
           where bu.active and bu.stay && daterange(p_start, p_end)
          union all
          select d::date, s.slug,
                 jsonb_build_object('kind', 'block', 'label', bl.reason, 'blockId', bl.id),
                 2
            from public.blocks bl
            join public.suites s on (bl.suite is null or bl.suite = s.slug)
            cross join lateral generate_series(
              greatest(bl.start_date, p_start), least(bl.end_date, p_end) - 1,
              interval '1 day') d
           where bl.start_date < p_end and bl.end_date > p_start
        ) raw
        order by night, suite, prio
      ) dedup
      group by night
    ) days
  ), '{}'::jsonb);
end $$;

-- Reset rates/seasons/extras/settings to the launch defaults (admin only).
create or replace function public.reset_rates()
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Staff only.'; end if;
  update public.suites s set base_rate = d.base_rate, extra_guest_rate = d.extra_guest_rate
    from (values
      ('roma', 275, 30), ('napoli', 295, 30), ('capri', 225, 30),
      ('positano', 195, 30), ('milano', 175, 30)
    ) as d(slug, base_rate, extra_guest_rate) where s.slug = d.slug;
  update public.seasons s set multiplier = d.multiplier, min_nights = d.min_nights
    from (values
      ('festive', 1.2, 3), ('summer', 1.25, 3), ('spring', 1.0, 2),
      ('autumn', 1.0, 2), ('winter', 0.85, 2)
    ) as d(id, multiplier, min_nights) where s.id = d.id;
  update public.extras e set price = d.price
    from (values
      ('private-dinner', 85), ('welcome-hamper', 65), ('grocery-prestock', 40),
      ('yoga-session', 45), ('massage', 110), ('butler', 120),
      ('transfer-pisa', 180), ('transfer-rome', 320), ('late-checkout', 60),
      ('cellar-selection', 0)
    ) as d(id, price) where e.id = d.id;
  update public.settings set deposit_pct = 30, tourist_tax = 2,
    tourist_tax_max_nights = 7, estate_discount_pct = 10,
    estate_base_occupancy = 10, estate_extra_guest_rate = 30, estate_sleeps = 15
    where id = true;
end $$;
