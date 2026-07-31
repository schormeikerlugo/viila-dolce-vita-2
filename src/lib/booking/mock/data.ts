/* ==========================================================================
   booking/mock/data.ts — Seed data for the mock backend.

   IMPORTANT: every number here is a PLACEHOLDER with the exact shape of the
   future Supabase tables. Once the backend exists the owners edit all of it
   from the admin (rates, seasons, extras, tax, deposit) — nothing in the UI
   components references these values directly.
   ========================================================================== */

import type { Extra, RateSuite, SuiteSlug } from "../types";

/* ---- `suites` table ------------------------------------------------------ */

export const rateSuites: RateSuite[] = [
  { slug: "roma", baseRate: 275, extraGuestRate: 30, baseOccupancy: 2, sleeps: 4, active: true },
  { slug: "napoli", baseRate: 295, extraGuestRate: 30, baseOccupancy: 4, sleeps: 6, active: true },
  { slug: "capri", baseRate: 225, extraGuestRate: 30, baseOccupancy: 2, sleeps: 4, active: true },
  { slug: "positano", baseRate: 195, extraGuestRate: 30, baseOccupancy: 2, sleeps: 4, active: true },
  { slug: "milano", baseRate: 175, extraGuestRate: 30, baseOccupancy: 2, sleeps: 2, active: true },
];

export const allSuiteSlugs: SuiteSlug[] = rateSuites.map((s) => s.slug);

/* ---- Estate buyout rules ------------------------------------------------- */

export const estateRules = {
  /** Whole-estate nightly = sum of suite rates × (1 − discount). */
  discountPct: 10,
  baseOccupancy: 10,
  extraGuestRate: 30,
  sleeps: 15,
} as const;

/* ---- `rate_periods` — evergreen season templates -------------------------
   Stored as month-day boundaries so the mock works in any year. In Supabase
   these become concrete daterange rows the owners manage per year. */

export interface SeasonTemplate {
  id: string;
  name: string;
  /** "MM-DD", inclusive. */
  from: string;
  /** "MM-DD", inclusive. Ranges may wrap the year end (festive). */
  to: string;
  multiplier: number;
  minNights: number;
  /** Chance a given week holds a seeded booking (mock occupancy only). */
  mockOccupancy: number;
}

export const seasonTemplates: SeasonTemplate[] = [
  // Order matters: first match wins (festive overlaps winter).
  { id: "festive", name: "Festive", from: "12-20", to: "01-06", multiplier: 1.2, minNights: 3, mockOccupancy: 0.55 },
  { id: "summer", name: "High Summer", from: "06-01", to: "09-30", multiplier: 1.25, minNights: 3, mockOccupancy: 0.5 },
  { id: "spring", name: "Spring", from: "04-01", to: "05-31", multiplier: 1.0, minNights: 2, mockOccupancy: 0.35 },
  { id: "autumn", name: "Autumn", from: "10-01", to: "10-31", multiplier: 1.0, minNights: 2, mockOccupancy: 0.35 },
  { id: "winter", name: "Winter", from: "11-01", to: "03-31", multiplier: 0.85, minNights: 2, mockOccupancy: 0.2 },
];

/** Resolve the season for an ISO date (first matching template). */
export function seasonFor(iso: string): SeasonTemplate {
  const md = iso.slice(5); // "MM-DD"
  for (const s of seasonTemplates) {
    const wraps = s.from > s.to;
    const hit = wraps ? md >= s.from || md <= s.to : md >= s.from && md <= s.to;
    if (hit) return s;
  }
  return seasonTemplates[seasonTemplates.length - 1];
}

/* ---- Taxes & payment ------------------------------------------------------ */

export const taxRules = {
  /** Tassa di soggiorno — EUR per person per night, city-set. */
  touristTaxPerPersonNight: 2,
  /** Italian municipalities cap the tax after N nights. */
  touristTaxMaxNights: 7,
} as const;

export const paymentRules = {
  /** Deposit payable at confirmation (rest at the villa / before arrival). */
  depositPct: 30,
} as const;

/* ---- `extras` table ------------------------------------------------------- */

export const extras: Extra[] = [
  {
    id: "private-dinner",
    name: "Private Tuscan Dinner",
    description:
      "A chef-cooked dinner beyond the three weekly ones included — served on your terrace or under the arch at sunset.",
    category: "food",
    priceType: "per_person",
    price: 85,
  },
  {
    id: "welcome-hamper",
    name: "Extended Welcome Hamper",
    description:
      "Tuscan salumi, pecorino, olives from the grove, fig jam and farm honey waiting in your suite.",
    category: "food",
    priceType: "per_stay",
    price: 65,
  },
  {
    id: "grocery-prestock",
    name: "Grocery Pre-Stocking",
    description:
      "Send us your list — the kitchen is full before you arrive. Service fee; groceries billed at cost.",
    category: "food",
    priceType: "per_stay",
    price: 40,
  },
  {
    id: "yoga-session",
    name: "Private Yoga Session",
    description: "An instructor on the platform at sunrise, mats and props provided.",
    category: "wellness",
    priceType: "per_person",
    price: 45,
  },
  {
    id: "massage",
    name: "In-Suite Massage",
    description: "A licensed therapist comes up the hill — 60 minutes, oils and table included.",
    category: "wellness",
    priceType: "per_person",
    price: 110,
  },
  {
    id: "butler",
    name: "Butler Service",
    description: "A dedicated butler through your stay — unpacking, table service, small errands.",
    category: "service",
    priceType: "per_night",
    price: 120,
  },
  {
    id: "transfer-pisa",
    name: "Private Transfer — Pisa",
    description: "Door-to-door car from Pisa airport or station, one way.",
    category: "service",
    priceType: "per_stay",
    price: 180,
  },
  {
    id: "transfer-rome",
    name: "Private Transfer — Rome",
    description: "Door-to-door car from Rome airports, one way.",
    category: "service",
    priceType: "per_stay",
    price: 320,
  },
  {
    id: "late-checkout",
    name: "Late Check-Out",
    description: "Keep the suite until 15:00 on departure day, subject to the calendar.",
    category: "service",
    priceType: "per_stay",
    price: 60,
  },
  {
    id: "cellar-selection",
    name: "Cellar Selection",
    description:
      "Maremma DOC bottles chosen with the concierge for your dates. Due to current Italian law this is arranged on request only.",
    category: "wine",
    priceType: "per_stay",
    price: 0,
    inquireOnly: true,
  },
];
