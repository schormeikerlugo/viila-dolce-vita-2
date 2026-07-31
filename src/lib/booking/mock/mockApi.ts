/* ==========================================================================
   booking/mock/mockApi.ts — In-memory backend with the real API's shape.

   Behaviour it simulates faithfully (same rules planned for Supabase):
   - deterministic seeded occupancy so the calendar looks alive;
   - a suite booked on a night blocks the estate buyout, and vice versa;
   - quotes computed API-side (seasonal rates, extra guests, extras,
     tourist tax, deposit) — the UI only displays them;
   - min-nights per season, capacity and availability validation;
   - created bookings persist in localStorage so a demo feels real.
   ========================================================================== */

import type { BookingApi } from "../api";
import type {
  AvailabilityMap,
  Booking,
  BookingRequest,
  Extra,
  Quote,
  QuoteLine,
  StayRequest,
  SuiteSlug,
} from "../types";
import { ESTATE } from "../types";
import {
  allSuiteSlugs,
  estateRules,
  extras as extrasCatalog,
  paymentRules,
  rateSuites,
  seasonFor,
  taxRules,
} from "./data";

/* ---- Date helpers (ISO YYYY-MM-DD, UTC-safe) ------------------------------ */

const DAY = 86_400_000;

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fromISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
function addDays(iso: string, days: number): string {
  return toISO(new Date(fromISO(iso).getTime() + days * DAY));
}
function nightsBetween(arrive: string, depart: string): number {
  return Math.round((fromISO(depart).getTime() - fromISO(arrive).getTime()) / DAY);
}
function todayISO(): string {
  return toISO(new Date());
}
/** Every night of `[arrive, depart)`. */
function eachNight(arrive: string, depart: string): string[] {
  const out: string[] = [];
  for (let d = arrive; d < depart; d = addDays(d, 1)) out.push(d);
  return out;
}

/* ---- Deterministic PRNG (seeded occupancy) -------------------------------- */

/** FNV-1a hash → [0, 1). Stable across sessions: the calendar never flickers. */
function rand(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

/* ---- Seeded occupancy ------------------------------------------------------
   Per suite, per week: a hash decides whether that week holds a stay, where
   it starts and how long it runs. Contiguous spans → realistic calendar. */

function weekIndex(iso: string): number {
  return Math.floor(fromISO(iso).getTime() / DAY / 7);
}

/** Nights occupied by the seed for one suite inside `[start, end)`. */
function seededNights(suite: SuiteSlug, start: string, end: string): Set<string> {
  const nights = new Set<string>();
  const firstWeek = weekIndex(start) - 1; // stays can spill in from the previous week
  const lastWeek = weekIndex(end);
  for (let w = firstWeek; w <= lastWeek; w++) {
    const weekStart = toISO(new Date((w * 7 + 4) * DAY)); // epoch was a Thursday
    const season = seasonFor(weekStart);
    if (rand(`${suite}:${w}:has`) >= season.mockOccupancy) continue;
    const offset = Math.floor(rand(`${suite}:${w}:off`) * 5); // start day 0–4
    const len = 2 + Math.floor(rand(`${suite}:${w}:len`) * 4); // 2–5 nights
    let night = addDays(weekStart, offset);
    for (let i = 0; i < len; i++, night = addDays(night, 1)) {
      if (night >= start && night < end) nights.add(night);
    }
  }
  return nights;
}

/** A seeded estate-wide block (wedding weekend ~75 days out). */
function weddingBlock(): { start: string; end: string } {
  let d = addDays(todayISO(), 75);
  while (fromISO(d).getUTCDay() !== 5) d = addDays(d, 1); // next Friday
  return { start: d, end: addDays(d, 3) }; // Fri–Sun nights
}

/* ---- Guest-created bookings (localStorage) -------------------------------- */

const LS_KEY = "vdv-mock-bookings";

function storedBookings(): Booking[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as Booking[];
  } catch {
    return [];
  }
}
function storeBooking(b: Booking): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify([...storedBookings(), b]));
}

/* ---- Availability ---------------------------------------------------------- */

function occupancy(start: string, end: string): AvailabilityMap {
  const map: AvailabilityMap = {};
  const take = (night: string, suite: SuiteSlug) => {
    if (night < start || night >= end) return;
    (map[night] ??= []).includes(suite) || map[night].push(suite);
  };

  // Seeded stays per suite.
  for (const suite of allSuiteSlugs) {
    for (const night of seededNights(suite, start, end)) take(night, suite);
  }
  // Seeded estate-wide wedding block.
  const wedding = weddingBlock();
  for (const night of eachNight(wedding.start, wedding.end)) {
    for (const suite of allSuiteSlugs) take(night, suite);
  }
  // Bookings created in this browser (demo persistence).
  for (const b of storedBookings()) {
    if (b.status === "cancelled" || b.status === "expired") continue;
    const suites =
      b.request.stay.unit === ESTATE ? allSuiteSlugs : [b.request.stay.unit as SuiteSlug];
    for (const night of eachNight(b.request.stay.arrive, b.request.stay.depart)) {
      for (const suite of suites) take(night, suite);
    }
  }
  return map;
}

function unitFreeForStay(stay: StayRequest, occ: AvailabilityMap): boolean {
  for (const night of eachNight(stay.arrive, stay.depart)) {
    const busy = occ[night] ?? [];
    if (stay.unit === ESTATE ? busy.length > 0 : busy.includes(stay.unit as SuiteSlug))
      return false;
  }
  return true;
}

/* ---- Quote ------------------------------------------------------------------ */

const eur = Math.round;

function accommodationLines(stay: StayRequest, nights: number): QuoteLine[] {
  const lines: QuoteLine[] = [];
  const nightly = (base: number, night: string) => eur(base * seasonFor(night).multiplier);

  if (stay.unit === ESTATE) {
    const sumBase = rateSuites.reduce((t, s) => t + s.baseRate, 0);
    let gross = 0;
    for (const night of eachNight(stay.arrive, stay.depart)) gross += nightly(sumBase, night);
    const discount = eur((gross * estateRules.discountPct) / 100);
    lines.push({
      label: "Entire Estate — five suites",
      detail: `${nights} ${nights === 1 ? "night" : "nights"}, all suites & grounds`,
      amount: gross,
    });
    lines.push({
      label: `Full-buyout rate (−${estateRules.discountPct}%)`,
      amount: -discount,
    });
    const extraGuests = Math.max(0, stay.guests - estateRules.baseOccupancy);
    if (extraGuests > 0) {
      lines.push({
        label: "Additional guests",
        detail: `${extraGuests} × €${estateRules.extraGuestRate} × ${nights} nights`,
        amount: extraGuests * estateRules.extraGuestRate * nights,
      });
    }
    return lines;
  }

  const suite = rateSuites.find((s) => s.slug === stay.unit);
  if (!suite) throw new Error("Unknown suite.");
  let sum = 0;
  const rates = new Set<number>();
  for (const night of eachNight(stay.arrive, stay.depart)) {
    const r = nightly(suite.baseRate, night);
    rates.add(r);
    sum += r;
  }
  const rateText =
    rates.size === 1
      ? `€${[...rates][0]}`
      : `€${Math.min(...rates)}–€${Math.max(...rates)}`;
  lines.push({
    label: `${cap(suite.slug)} Suite`,
    detail: `${nights} ${nights === 1 ? "night" : "nights"} × ${rateText}`,
    amount: sum,
  });
  const extraGuests = Math.max(0, stay.guests - suite.baseOccupancy);
  if (extraGuests > 0) {
    lines.push({
      label: "Additional guests",
      detail: `${extraGuests} × €${suite.extraGuestRate} × ${nights} nights`,
      amount: extraGuests * suite.extraGuestRate * nights,
    });
  }
  return lines;
}

function extraLine(extra: Extra, stay: StayRequest, nights: number): QuoteLine | null {
  if (extra.inquireOnly) return null;
  const qty =
    extra.priceType === "per_stay"
      ? 1
      : extra.priceType === "per_night"
        ? nights
        : extra.priceType === "per_person"
          ? stay.guests
          : stay.guests * nights; // per_person_night
  const detail =
    extra.priceType === "per_stay"
      ? undefined
      : extra.priceType === "per_night"
        ? `${nights} nights × €${extra.price}`
        : extra.priceType === "per_person"
          ? `${stay.guests} guests × €${extra.price}`
          : `${stay.guests} guests × ${nights} nights × €${extra.price}`;
  return { label: extra.name, detail, amount: extra.price * qty };
}

function computeQuote(stay: StayRequest, extraIds: string[]): Quote {
  const nights = nightsBetween(stay.arrive, stay.depart);
  if (!(nights > 0)) throw new Error("Departure must be after arrival.");
  if (stay.arrive < todayISO()) throw new Error("Arrival cannot be in the past.");

  const capacity =
    stay.unit === ESTATE
      ? estateRules.sleeps
      : (rateSuites.find((s) => s.slug === stay.unit)?.sleeps ?? 0);
  if (stay.guests < 1) throw new Error("At least one guest.");
  if (stay.guests > capacity)
    throw new Error(
      `${stay.unit === ESTATE ? "The estate" : `The ${cap(stay.unit)} Suite`} sleeps up to ${capacity} guests.`,
    );

  const minNights = Math.max(
    ...eachNight(stay.arrive, stay.depart).map((n) => seasonFor(n).minNights),
  );
  if (nights < minNights)
    throw new Error(`These dates require a minimum stay of ${minNights} nights.`);

  if (!unitFreeForStay(stay, occupancy(stay.arrive, stay.depart)))
    throw new Error("Those dates are no longer available for this selection.");

  const lines = accommodationLines(stay, nights);
  const extrasLines = extraIds
    .map((id) => extrasCatalog.find((e) => e.id === id))
    .filter((e): e is Extra => Boolean(e))
    .map((e) => extraLine(e, stay, nights))
    .filter((l): l is QuoteLine => Boolean(l));

  const taxNights = Math.min(nights, taxRules.touristTaxMaxNights);
  const taxLine: QuoteLine = {
    label: "Tourist tax (tassa di soggiorno)",
    detail: `€${taxRules.touristTaxPerPersonNight} × ${stay.guests} guests × ${taxNights} nights`,
    amount: taxRules.touristTaxPerPersonNight * stay.guests * taxNights,
  };

  const total =
    lines.reduce((t, l) => t + l.amount, 0) +
    extrasLines.reduce((t, l) => t + l.amount, 0) +
    taxLine.amount;

  return {
    currency: "EUR",
    nights,
    minNights,
    lines,
    extrasLines,
    taxLine,
    total,
    depositDue: eur((total * paymentRules.depositPct) / 100),
    depositPct: paymentRules.depositPct,
  };
}

/* ---- Misc ------------------------------------------------------------------- */

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function makeReference(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `VDV-${code}`;
}

/** Simulated network latency so the UI's loading states are honest. */
function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/* ---- The API ------------------------------------------------------------------ */

export const mockApi: BookingApi = {
  async getAvailability(startISO, endISO) {
    return delay(occupancy(startISO, endISO), 250);
  },

  async getExtras() {
    return delay(extrasCatalog, 200);
  },

  async getStayOptions(stay) {
    const units: import("../types").UnitId[] = [...allSuiteSlugs, ESTATE];
    const options = units.map((unit) => {
      try {
        // Capacity errors should read as "not for this party size", while
        // date conflicts read as "booked" — computeQuote's message carries it.
        const quote = computeQuote({ ...stay, unit }, []);
        const total = quote.lines.reduce((t, l) => t + l.amount, 0);
        return {
          unit,
          available: true,
          total,
          nightly: eur(total / quote.nights),
        };
      } catch (err) {
        return {
          unit,
          available: false,
          reason: err instanceof Error ? err.message : "Unavailable",
        };
      }
    });
    return delay(options, 350);
  },

  async getQuote(stay, extraIds) {
    // Compute first so validation errors reject immediately with a message.
    const quote = computeQuote(stay, extraIds);
    return delay(quote, 300);
  },

  async createBooking(req) {
    const quote = computeQuote(req.stay, req.extras);
    if (!req.guest.name.trim() || !req.guest.email.includes("@"))
      throw new Error("Please provide your name and a valid email.");
    if (!req.guest.acceptsAnimals)
      throw new Error("Please confirm you are comfortable with our free-roaming rescued animals.");
    const booking: Booking = {
      reference: makeReference(),
      status: "requested",
      createdAt: new Date().toISOString(),
      request: req,
      quote,
    };
    storeBooking(booking);
    return delay(booking, 600);
  },
};
