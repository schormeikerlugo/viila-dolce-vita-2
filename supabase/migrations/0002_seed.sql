-- ============================================================================
-- 0002_seed.sql — Launch catalog. PLACEHOLDER prices confirmed as "edit from
-- the admin"; same values the mock shipped with. Real occupancy starts empty.
-- ============================================================================

insert into public.suites (slug, name, base_rate, extra_guest_rate, base_occupancy, sleeps, active, rank) values
  ('roma',     'Roma Suite',     275, 30, 2, 4, true, 1),
  ('napoli',   'Napoli Suite',   295, 30, 4, 6, true, 2),
  ('capri',    'Capri Suite',    225, 30, 2, 4, true, 3),
  ('milano',   'Milano Suite',   175, 30, 2, 2, true, 4),
  ('positano', 'Positano Suite', 195, 30, 2, 4, true, 5);

insert into public.seasons (id, name, from_md, to_md, multiplier, min_nights, priority) values
  ('festive', 'Festive',     '12-20', '01-06', 1.2,  3, 1),
  ('summer',  'High Summer', '06-01', '09-30', 1.25, 3, 2),
  ('spring',  'Spring',      '04-01', '05-31', 1.0,  2, 3),
  ('autumn',  'Autumn',      '10-01', '10-31', 1.0,  2, 4),
  ('winter',  'Winter',      '11-01', '03-31', 0.85, 2, 5);

insert into public.extras (id, name, description, category, price_type, price, inquire_only, sort) values
  ('private-dinner', 'Private Tuscan Dinner',
   'A chef-cooked dinner beyond the three weekly ones included — served on your terrace or under the arch at sunset.',
   'food', 'per_person', 85, false, 1),
  ('welcome-hamper', 'Extended Welcome Hamper',
   'Tuscan salumi, pecorino, olives from the grove, fig jam and farm honey waiting in your suite.',
   'food', 'per_stay', 65, false, 2),
  ('grocery-prestock', 'Grocery Pre-Stocking',
   'Send us your list — the kitchen is full before you arrive. Service fee; groceries billed at cost.',
   'food', 'per_stay', 40, false, 3),
  ('yoga-session', 'Private Yoga Session',
   'An instructor on the platform at sunrise, mats and props provided.',
   'wellness', 'per_person', 45, false, 4),
  ('massage', 'In-Suite Massage',
   'A licensed therapist comes up the hill — 60 minutes, oils and table included.',
   'wellness', 'per_person', 110, false, 5),
  ('butler', 'Butler Service',
   'A dedicated butler through your stay — unpacking, table service, small errands.',
   'service', 'per_night', 120, false, 6),
  ('transfer-pisa', 'Private Transfer — Pisa',
   'Door-to-door car from Pisa airport or station, one way.',
   'service', 'per_stay', 180, false, 7),
  ('transfer-rome', 'Private Transfer — Rome',
   'Door-to-door car from Rome airports, one way.',
   'service', 'per_stay', 320, false, 8),
  ('late-checkout', 'Late Check-Out',
   'Keep the suite until 15:00 on departure day, subject to the calendar.',
   'service', 'per_stay', 60, false, 9),
  ('cellar-selection', 'Cellar Selection',
   'Maremma DOC bottles chosen with the concierge for your dates. Due to current Italian law this is arranged on request only.',
   'wine', 'per_stay', 0, true, 10);

insert into public.settings
  (deposit_pct, tourist_tax, tourist_tax_max_nights, estate_discount_pct,
   estate_base_occupancy, estate_extra_guest_rate, estate_sleeps)
values (30, 2, 7, 10, 10, 30, 15);
