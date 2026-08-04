-- ============================================================================
-- 0004_notifications.sql — Wire booking events to the notify-booking Edge
-- Function via pg_net. Ships DARK: the trigger no-ops until the function URL
-- and shared secret are stored in app_config, so applying this migration
-- changes nothing until you flip it on (see the final commented UPDATE).
--
-- Turn it on later (SQL editor), after deploying the function + secrets:
--   update public.app_config set
--     notify_url = 'https://fitzfonhsudxbizikypc.functions.supabase.co/notify-booking',
--     notify_secret = '<same value as the NOTIFY_SECRET function secret>';
-- ============================================================================

create extension if not exists pg_net;

-- Small single-row config table for server-side integration settings.
create table if not exists public.app_config (
  id boolean primary key default true check (id),
  notify_url text,
  notify_secret text
);
insert into public.app_config (id) values (true) on conflict (id) do nothing;

alter table public.app_config enable row level security;
-- Admin-only; the trigger reads it as SECURITY DEFINER regardless of RLS.
create policy app_config_admin on public.app_config
  for all using (public.is_admin()) with check (public.is_admin());

-- Fire an email notification for a booking event (requested/confirmed/cancelled).
create or replace function public.notify_booking_event(p_booking public.bookings, p_event text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  cfg public.app_config;
begin
  select * into cfg from public.app_config limit 1;
  -- Inert until configured.
  if cfg.notify_url is null or cfg.notify_secret is null then
    return;
  end if;
  perform net.http_post(
    url := cfg.notify_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', cfg.notify_secret),
    body := jsonb_build_object(
      'event', p_event,
      'reference', p_booking.reference,
      'guest_name', p_booking.guest_name,
      'guest_email', p_booking.guest_email,
      'guest_phone', p_booking.guest_phone,
      'unit', p_booking.unit,
      'arrive', p_booking.arrive,
      'depart', p_booking.depart,
      'guests', p_booking.guests,
      'total', p_booking.total,
      'deposit_due', p_booking.deposit_due,
      'quote', p_booking.quote));
end $$;

-- New request → notify the owner.
create or replace function public.on_booking_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_booking_event(new, 'requested');
  return new;
end $$;

create trigger bookings_notify_insert
after insert on public.bookings
for each row execute function public.on_booking_insert();

-- Status change to confirmed/cancelled → notify the guest.
create or replace function public.on_booking_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'cancelled') then
    perform public.notify_booking_event(new, new.status);
  end if;
  return new;
end $$;

create trigger bookings_notify_status
after update of status on public.bookings
for each row execute function public.on_booking_status();
