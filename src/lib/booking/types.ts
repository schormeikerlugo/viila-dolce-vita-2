/* ==========================================================================
   booking/types.ts — Shared types for the booking system.

   These mirror the planned Supabase schema 1:1 (see Docs/booking-system-plan.md)
   so the UI built against the mock swaps to the real backend without changes:

     RateSuite      → `suites` table
     RatePeriod     → `rate_periods` table
     Extra          → `extras` table
     Booking        → `bookings` (+ `booking_units`, `booking_extras`)
     CalendarBlock  → `blocks` table

   All dates are ISO `YYYY-MM-DD` strings. All money is in EUR cents-free
   integers (whole euros) — placeholder rates the owners will edit from the
   admin once the backend exists.
   ========================================================================== */

export type SuiteSlug = "roma" | "napoli" | "capri" | "milano" | "positano";

/** Bookable unit: a single suite, or the whole estate (full buyout). */
export const ESTATE = "estate" as const;
export type UnitId = SuiteSlug | typeof ESTATE;

/* ---- Catalog (mirrors DB tables; owner-editable from the admin) ---------- */

/** Pricing/capacity row per suite — mirrors the `suites` table. */
export interface RateSuite {
  slug: SuiteSlug;
  /** Nightly base rate in EUR for `baseOccupancy` guests. */
  baseRate: number;
  /** Nightly surcharge in EUR per guest above `baseOccupancy`. */
  extraGuestRate: number;
  /** Guests included in the base rate. */
  baseOccupancy: number;
  /** Hard capacity. */
  sleeps: number;
  active: boolean;
}

/** Season — mirrors the `rate_periods` table. */
export interface RatePeriod {
  id: string;
  name: string;
  /** Inclusive start, exclusive end (like a Postgres daterange `[)`). */
  start: string;
  end: string;
  /** Multiplier applied to each suite's base rate. */
  multiplier: number;
  minNights: number;
}

export type ExtraCategory = "food" | "wellness" | "service" | "wine";
export type ExtraPriceType = "per_stay" | "per_night" | "per_person" | "per_person_night";

/** Add-on — mirrors the `extras` table. */
export interface Extra {
  id: string;
  name: string;
  description: string;
  category: ExtraCategory;
  priceType: ExtraPriceType;
  /** EUR. Ignored when `inquireOnly` (no price shown). */
  price: number;
  /** Alcohol notice: shown without a price, requested via the concierge. */
  inquireOnly?: boolean;
}

/* ---- Availability -------------------------------------------------------- */

/**
 * Occupancy map for a date window: for each ISO date, the suites that are
 * NOT available that night (booked or blocked). A missing date = all free.
 * The estate buyout is available on a night iff this array is empty.
 */
export type AvailabilityMap = Record<string, SuiteSlug[]>;

/* ---- Quote --------------------------------------------------------------- */

/** A guest's requested stay. `depart` is exclusive (check-out day). */
export interface StayRequest {
  arrive: string;
  depart: string;
  guests: number;
  unit: UnitId;
}

export interface QuoteLine {
  label: string;
  /** Small print under the label, e.g. "7 nights × €275". */
  detail?: string;
  amount: number;
}

/** Always computed by the API (server-side once real) — never by the UI. */
export interface Quote {
  currency: "EUR";
  nights: number;
  minNights: number;
  /** Accommodation lines (nightly rate, extra guests, estate discount…). */
  lines: QuoteLine[];
  /** Selected extras (inquire-only ones never appear here). */
  extrasLines: QuoteLine[];
  /** Tassa di soggiorno (per person per night, city-set). */
  taxLine: QuoteLine;
  total: number;
  /** Payable at confirmation (deposit percentage of total). */
  depositDue: number;
  depositPct: number;
}

/**
 * One bookable option (suite or estate) priced for a concrete stay.
 * Returned by the API so the UI never computes money itself.
 */
export interface UnitOption {
  unit: UnitId;
  available: boolean;
  /** Total accommodation for the stay (no extras/tax) when available. */
  total?: number;
  /** Average nightly rate for the stay, for the card label. */
  nightly?: number;
  /** Why it can't be booked ("Booked for these dates", capacity…). */
  reason?: string;
}

/* ---- Bookings ------------------------------------------------------------ */

export type BookingStatus =
  | "requested" // sent by the guest, awaiting owner confirmation
  | "hold" // calendar hold pending payment (future: Stripe)
  | "confirmed"
  | "completed"
  | "cancelled"
  | "expired";

export interface GuestDetails {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  /** The animal-sanctuary notice must be accepted to book. */
  acceptsAnimals: boolean;
}

export interface BookingRequest {
  stay: StayRequest;
  /** Extra ids from the catalog. */
  extras: string[];
  guest: GuestDetails;
}

export interface Booking {
  reference: string;
  status: BookingStatus;
  createdAt: string;
  request: BookingRequest;
  quote: Quote;
}

/** Manual calendar block — mirrors the `blocks` table. */
export interface CalendarBlock {
  id: string;
  /** null = whole estate. */
  suite: SuiteSlug | null;
  start: string;
  end: string;
  reason: string;
}

/* ---- Presentation-only (passed from Astro to the islands) ---------------- */

/** Static suite card data, resolved at build time (images optimized). */
export interface SuiteCardData {
  slug: SuiteSlug;
  name: string;
  tagline: string;
  sleeps: number;
  highlight: string;
  /** Optimized image URL (not ImageMetadata — islands get plain strings). */
  image: string;
  imageAlt: string;
  rank: number;
}
