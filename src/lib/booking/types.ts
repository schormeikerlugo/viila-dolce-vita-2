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
  /** Accommodation lines (nightly rate, extra guests, estate discount, promo…). */
  lines: QuoteLine[];
  /** Selected extras (inquire-only ones never appear here). */
  extrasLines: QuoteLine[];
  /** Tourist tax line, or null when not charged online (handled by concierge). */
  taxLine: QuoteLine | null;
  total: number;
  /** Payable at confirmation (deposit percentage of total). */
  depositDue: number;
  depositPct: number;
  /** The promotion applied, when one qualified (code or automatic). */
  promo?: { id: string; name: string; code: string | null };
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
  /** Optional promo code typed by the guest. */
  promoCode?: string;
}

export interface Booking {
  reference: string;
  status: BookingStatus;
  createdAt: string;
  request: BookingRequest;
  quote: Quote;
}

/** A captured lead (contact given before the booking completed). */
export interface LeadCapture {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  arrive: string | null;
  depart: string | null;
  guests: number | null;
  status: "incomplete" | "converted";
  reference: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload to capture/refresh a lead (best-effort, keyed by email). */
export interface LeadInput {
  name?: string;
  email: string;
  phone?: string;
  arrive?: string | null;
  depart?: string | null;
  guests?: number | null;
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

/* ---- Admin ---------------------------------------------------------------- */

/** A season row as the admin edits it (mirrors `rate_periods`). */
export interface SeasonSetting {
  id: string;
  name: string;
  /** "MM-DD" boundaries, inclusive; may wrap the year end. */
  from: string;
  to: string;
  multiplier: number;
  minNights: number;
}

/** Everything money-related the owners can edit from the admin. */
export interface RatesConfig {
  /** The suites are "included" in the Villa now — kept for reference/labels. */
  suites: RateSuite[];
  seasons: SeasonSetting[];
  extras: Extra[];
  depositPct: number;
  /** Tassa di soggiorno, EUR per person per night. */
  touristTaxPerPersonNight: number;
  touristTaxMaxNights: number;
  /** Whole-Villa flat nightly rate (× the night's season multiplier). */
  villaNightlyRate: number;
  /** Minimum stay for the Villa (nights). */
  villaMinNights: number;
  /** Floor on the whole booking total. */
  minBookingTotal: number;
  /** The Villa's capacity. */
  villaSleeps: number;
}

/** A promotion — mirrors the `promotions` table. */
export interface Promotion {
  id: string;
  /** Uppercase redeem code, or null for an automatic offer. */
  code: string | null;
  name: string;
  kind: "percent" | "fixed";
  value: number;
  /** null = every suite + the estate. */
  suite: SuiteSlug | null;
  /** Stay window (arrive ≥ start, depart ≤ end). Null = always. */
  stayStart: string | null;
  stayEnd: string | null;
  /** Booking window (when it can be redeemed). Null = always. */
  bookStart: string | null;
  bookEnd: string | null;
  minNights: number;
  usageLimit: number | null;
  used: number;
  active: boolean;
}

/** Payload for creating a promotion (server assigns id/used). */
export type PromotionInput = Omit<Promotion, "id" | "used">;

/* ---- Dashboard ------------------------------------------------------------ */

export interface AttentionBooking {
  reference: string;
  guest: string;
  email: string;
  phone: string | null;
  unit: string;
  arrive: string;
  depart: string;
  guests: number;
  total: number;
  createdAt: string;
}

export interface MovementRow {
  date: string;
  reference: string;
  guest: string;
  unit: string;
  guests: number;
  phone: string | null;
}

/** One-call aggregates behind the admin Overview screen. */
export interface DashboardStats {
  monthStart: string;
  pendingRequests: number;
  arrivalsNext7: number;
  occupancyMonthPct: number;
  revenueMonth: number;
  pipelineValue: number;
  avgBookingValue: number;
  needsAttention: AttentionBooking[];
  arrivals: MovementRow[];
  departures: MovementRow[];
}

export type CalendarCellKind = "booking" | "block" | "external";

/** One suite-night on the admin calendar (absent = free). */
export interface CalendarCell {
  kind: CalendarCellKind;
  /** Guest name, block reason, or "Imported stay". */
  label: string;
  /** Present for bookings created in this system. */
  reference?: string;
  /** Present for manual blocks (deletable). */
  blockId?: string;
}

/** date → suite → cell. Missing entries are free nights. */
export type AdminCalendar = Record<string, Partial<Record<SuiteSlug, CalendarCell>>>;

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
