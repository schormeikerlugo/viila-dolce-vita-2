/* ==========================================================================
   booking/mock/mockApi.ts — In-memory backend with the real API's shape.

   Behaviour it simulates faithfully (same rules planned for Supabase):
   - deterministic seeded occupancy so the calendar looks alive;
   - a suite booked on a night blocks the estate buyout, and vice versa;
   - quotes computed API-side (seasonal rates, extra guests, extras,
     tourist tax, deposit) — the UI only displays them;
   - min-nights per season, capacity and availability validation;
   - owner-editable rates/blocks/booking statuses via the admin API;
   - everything persists in localStorage so a demo feels real
     (with an in-memory fallback for SSR/tests).
   ========================================================================== */

import type { AdminBookingApi, BookingApi } from "../api";
import type {
  AdminCalendar,
  AvailabilityMap,
  Booking,
  CalendarBlock,
  CalendarCell,
  DashboardStats,
  Extra,
  LeadCapture,
  Promotion,
  Quote,
  QuoteLine,
  RatesConfig,
  StayRequest,
  SuiteSlug,
  UnitId,
} from "../types";
import { ESTATE } from "../types";
import {
  allSuiteSlugs,
  estateRules,
  extras as extrasCatalog,
  paymentRules,
  rateSuites,
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
/** Half-open date ranges [aStart, aEnd) and [bStart, bEnd) overlap. */
function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
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

/* ---- Tiny persistent stores (localStorage with in-memory fallback) -------- */

function makeStore<T>(key: string, seed: () => T) {
  let memory: T | null = null;
  const read = (): T => {
    if (typeof localStorage === "undefined") return (memory ??= seed());
    const raw = localStorage.getItem(key);
    if (raw === null) {
      const value = seed();
      localStorage.setItem(key, JSON.stringify(value));
      return value;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return seed();
    }
  };
  const write = (value: T): void => {
    if (typeof localStorage === "undefined") {
      memory = value;
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  };
  const clear = (): void => {
    memory = null;
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  };
  return { read, write, clear };
}

/* ---- Rates config (seed defaults + owner edits from the admin) ------------ */

function defaultRates(): RatesConfig {
  return {
    suites: rateSuites.map((s) => ({ ...s })),
    extras: extrasCatalog.map((e) => ({ ...e })),
    depositPct: paymentRules.depositPct,
    weekdayRates: { monThu: 3000, fri: 4250, sat: 4750, sun: 3750 },
    villaMinNights: estateRules.minNights,
    villaSleeps: estateRules.sleeps,
  };
}

const ratesStore = makeStore<RatesConfig>("vdv-mock-rates", defaultRates);

/** The Villa's rate for a night, by its check-in weekday. */
function nightRate(cfg: RatesConfig, iso: string): number {
  const dow = fromISO(iso).getUTCDay(); // 0=Sun … 6=Sat
  const w = cfg.weekdayRates;
  if (dow === 5) return w.fri;
  if (dow === 6) return w.sat;
  if (dow === 0) return w.sun;
  return w.monThu;
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

/* ---- Blocks (owner-created only) ------------------------------------------- */

const blocksStore = makeStore<CalendarBlock[]>("vdv-mock-blocks", () => []);

/* ---- Guest-created bookings -------------------------------------------------- */

const bookingsStore = makeStore<Booking[]>("vdv-mock-bookings", () => []);

const leadsStore = makeStore<LeadCapture[]>("vdv-mock-leads", () => []);

/* ---- Promotions (seeded with the demo code) -------------------------------- */

const promosStore = makeStore<Promotion[]>("vdv-mock-promos", () => [
  {
    id: "promo-dolce10",
    code: "DOLCE10",
    name: "Welcome Offer",
    kind: "percent",
    value: 10,
    suite: null,
    stayStart: null,
    stayEnd: null,
    bookStart: null,
    bookEnd: null,
    minNights: 1,
    usageLimit: null,
    used: 0,
    active: true,
  },
]);

function promoQualifies(p: Promotion, stay: StayRequest, nights: number): boolean {
  const today = todayISO();
  return (
    p.active &&
    (p.usageLimit === null || p.used < p.usageLimit) &&
    (!p.bookStart || today >= p.bookStart) &&
    (!p.bookEnd || today < p.bookEnd) &&
    (!p.stayStart || stay.arrive >= p.stayStart) &&
    (!p.stayEnd || stay.depart <= p.stayEnd) &&
    nights >= p.minNights &&
    (p.suite === null || p.suite === stay.unit)
  );
}

/** Same rules and messages as the SQL resolve_promo. */
function resolvePromo(
  code: string | undefined,
  stay: StayRequest,
  nights: number,
): Promotion | null {
  const promos = promosStore.read();
  if (code && code.trim()) {
    const p = promos.find((x) => x.code === code.trim().toUpperCase());
    if (!p || !p.active) throw new Error("That promo code isn't valid.");
    if (p.usageLimit !== null && p.used >= p.usageLimit)
      throw new Error("That code has been fully redeemed.");
    const today = todayISO();
    if ((p.bookStart && today < p.bookStart) || (p.bookEnd && today >= p.bookEnd))
      throw new Error("That promo code isn't running right now.");
    if ((p.stayStart && stay.arrive < p.stayStart) || (p.stayEnd && stay.depart > p.stayEnd))
      throw new Error("That code doesn't apply to these dates.");
    if (nights < p.minNights)
      throw new Error(`That code needs a stay of at least ${p.minNights} nights.`);
    if (p.suite !== null && p.suite !== stay.unit)
      throw new Error("That code doesn't apply to this suite.");
    return p;
  }
  const auto = promos
    .filter((p) => p.code === null && promoQualifies(p, stay, nights))
    .sort((a, b) => b.value - a.value);
  return auto[0] ?? null;
}

// Only confirmed/completed bookings block the calendar now — a guest request is
// non-binding and never takes a date off the public availability map. Overlapping
// requests coexist until the concierge confirms one.
const CALENDAR_ACTIVE: Booking["status"][] = ["confirmed", "completed"];

function bookingSuites(unit: UnitId): SuiteSlug[] {
  return unit === ESTATE ? allSuiteSlugs : [unit];
}

/* ---- Availability ------------------------------------------------------------- */

function occupancy(start: string, end: string): AvailabilityMap {
  const cfg = ratesStore.read();
  const map: AvailabilityMap = {};
  // Seed every night with its weekday price.
  for (const night of eachNight(start, end)) {
    map[night] = { price: nightRate(cfg, night) };
  }
  const take = (night: string, suite: SuiteSlug) => {
    if (!map[night]) return;
    const list = (map[night].suites ??= []);
    if (!list.includes(suite)) list.push(suite);
  };

  // Manual blocks (suite-level or estate-wide).
  for (const block of blocksStore.read()) {
    for (const night of eachNight(block.start, block.end)) {
      for (const suite of block.suite ? [block.suite] : allSuiteSlugs) take(night, suite);
    }
  }
  // Bookings created in this browser (demo persistence).
  for (const b of bookingsStore.read()) {
    if (!CALENDAR_ACTIVE.includes(b.status)) continue;
    for (const night of eachNight(b.request.stay.arrive, b.request.stay.depart)) {
      for (const suite of bookingSuites(b.request.stay.unit)) take(night, suite);
    }
  }
  return map;
}

function unitFreeForStay(stay: StayRequest, occ: AvailabilityMap): boolean {
  for (const night of eachNight(stay.arrive, stay.depart)) {
    const busy = occ[night]?.suites ?? [];
    if (stay.unit === ESTATE ? busy.length > 0 : busy.includes(stay.unit as SuiteSlug))
      return false;
  }
  return true;
}

/* ---- Quote ----------------------------------------------------------------------- */

const eur = Math.round;

/** The Villa is the only unit: sum of each night's weekday rate. */
function accommodationLines(cfg: RatesConfig, stay: StayRequest, nights: number): QuoteLine[] {
  const rates = new Set<number>();
  let gross = 0;
  for (const night of eachNight(stay.arrive, stay.depart)) {
    const r = nightRate(cfg, night);
    rates.add(r);
    gross += r;
  }
  const rateText =
    rates.size === 1
      ? `× €${[...rates][0]}`
      : `· €${Math.min(...rates)}–€${Math.max(...rates)}/night`;
  return [
    {
      label: "The Entire Villa",
      detail: `${nights} ${nights === 1 ? "night" : "nights"} ${rateText}`,
      amount: gross,
    },
  ];
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

function computeQuote(stay: StayRequest, extraIds: string[], promoCode?: string): Quote {
  const cfg = ratesStore.read();
  // The Villa is the only bookable unit — force it regardless of input.
  const villaStay: StayRequest = { ...stay, unit: ESTATE };
  const nights = nightsBetween(villaStay.arrive, villaStay.depart);
  if (!(nights > 0)) throw new Error("Departure must be after arrival.");
  if (villaStay.arrive < todayISO()) throw new Error("Arrival cannot be in the past.");

  if (villaStay.guests > cfg.villaSleeps)
    throw new Error(`The Villa sleeps up to ${cfg.villaSleeps} guests.`);

  const minNights = cfg.villaMinNights;
  if (nights < minNights)
    throw new Error(`The Villa is booked for a minimum of ${minNights} nights.`);

  if (!unitFreeForStay(villaStay, occupancy(villaStay.arrive, villaStay.depart)))
    throw new Error("Those dates are no longer available.");

  const lines = accommodationLines(cfg, villaStay, nights);

  // Promotion (explicit code or best automatic offer) on accommodation only.
  const accSubtotal = lines.reduce((t, l) => t + l.amount, 0);
  const promo = resolvePromo(promoCode, villaStay, nights);
  let promoInfo: Quote["promo"];
  if (promo) {
    const discount =
      promo.kind === "percent"
        ? eur((accSubtotal * promo.value) / 100)
        : Math.min(promo.value, accSubtotal);
    if (discount > 0) {
      lines.push({
        label: promo.name + (promo.code ? ` (${promo.code})` : ""),
        detail: promo.kind === "percent" ? `−${promo.value}% on accommodation` : "Offer applied",
        amount: -discount,
      });
      promoInfo = { id: promo.id, name: promo.name, code: promo.code };
    }
  }

  const extrasLines = extraIds
    .map((id) => cfg.extras.find((e) => e.id === id))
    .filter((e): e is Extra => Boolean(e))
    .map((e) => extraLine(e, villaStay, nights))
    .filter((l): l is QuoteLine => Boolean(l));

  // No tourist tax online — handled by the concierge. No floor (weekday
  // rates × 3-night minimum already exceed the old €3,000 minimum).
  const total =
    lines.reduce((t, l) => t + l.amount, 0) +
    extrasLines.reduce((t, l) => t + l.amount, 0);

  return {
    currency: "EUR",
    nights,
    minNights,
    lines,
    extrasLines,
    taxLine: null,
    total,
    depositDue: eur((total * cfg.depositPct) / 100),
    depositPct: cfg.depositPct,
    ...(promoInfo ? { promo: promoInfo } : {}),
  };
}

/* ---- Misc ---------------------------------------------------------------------------- */

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

/* ---- The guest API --------------------------------------------------------------------- */

export const mockApi: BookingApi = {
  async getAvailability(startISO, endISO) {
    return delay(occupancy(startISO, endISO), 250);
  },

  async getExtras() {
    return delay(ratesStore.read().extras, 200);
  },

  async getStayOptions(stay) {
    // The Villa is the only bookable unit. Return the REAL total (floor
    // applied) so the card matches the quote exactly.
    try {
      const quote = computeQuote({ ...stay, unit: ESTATE }, []);
      return delay(
        [{ unit: ESTATE, available: true, total: quote.total, nightly: eur(quote.total / quote.nights) }],
        350,
      );
    } catch (err) {
      return delay(
        [{ unit: ESTATE, available: false, reason: err instanceof Error ? err.message : "Unavailable" }],
        350,
      );
    }
  },

  async getQuote(stay, extraIds, promoCode) {
    // Compute first so validation errors reject immediately with a message.
    const quote = computeQuote(stay, extraIds, promoCode);
    return delay(quote, 300);
  },

  async createBooking(req) {
    const quote = computeQuote(req.stay, req.extras, req.promoCode);
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
    bookingsStore.write([...bookingsStore.read(), booking]);
    if (quote.promo) {
      promosStore.write(
        promosStore.read().map((p) => (p.id === quote.promo!.id ? { ...p, used: p.used + 1 } : p)),
      );
    }
    // Convert any matching incomplete lead.
    const email = req.guest.email.toLowerCase();
    leadsStore.write(
      leadsStore.read().map((l) =>
        l.email === email && l.status === "incomplete"
          ? { ...l, status: "converted", reference: booking.reference, updatedAt: booking.createdAt }
          : l,
      ),
    );
    return delay(booking, 600);
  },

  async captureLead(lead) {
    const email = lead.email.trim().toLowerCase();
    if (!email.includes("@")) return;
    const now = new Date().toISOString();
    const leads = leadsStore.read();
    const existing = leads.find((l) => l.email === email && l.status === "incomplete");
    if (existing) {
      leadsStore.write(
        leads.map((l) =>
          l.id === existing.id
            ? {
                ...l,
                name: lead.name?.trim() || l.name,
                phone: lead.phone?.trim() || l.phone,
                arrive: lead.arrive ?? l.arrive,
                depart: lead.depart ?? l.depart,
                guests: lead.guests ?? l.guests,
                updatedAt: now,
              }
            : l,
        ),
      );
    } else {
      leadsStore.write([
        ...leads,
        {
          id: `lead-${Date.now().toString(36)}`,
          name: lead.name?.trim() || null,
          email,
          phone: lead.phone?.trim() || null,
          arrive: lead.arrive ?? null,
          depart: lead.depart ?? null,
          guests: lead.guests ?? null,
          status: "incomplete",
          reference: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
  },
};

/* ---- The admin API ------------------------------------------------------------------------ */

export const mockAdminApi: AdminBookingApi = {
  async listLeads() {
    return delay(
      [...leadsStore.read()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      200,
    );
  },

  async getDashboardStats() {
    const today = todayISO();
    const monthStart = `${today.slice(0, 7)}-01`;
    const nextMonth = addDays(monthStart, 32).slice(0, 7) + "-01";
    const daysInMonth = nightsBetween(monthStart, nextMonth);
    const bookings = bookingsStore.read();
    const won = bookings.filter((b) => b.status === "confirmed" || b.status === "completed");
    const requested = bookings.filter((b) => b.status === "requested");
    const occ = occupancy(monthStart, nextMonth);
    const occupiedNights = Object.values(occ).reduce((t, n) => t + (n.suites?.length ?? 0), 0);
    const move = (list: Booking[], key: "arrive" | "depart"): DashboardStats["arrivals"] =>
      list
        .filter((b) => b.request.stay[key] >= today && b.request.stay[key] < addDays(today, 14))
        .sort((a, b) => a.request.stay[key].localeCompare(b.request.stay[key]))
        .map((b) => ({
          date: b.request.stay[key],
          reference: b.reference,
          guest: b.request.guest.name,
          unit: b.request.stay.unit,
          guests: b.request.stay.guests,
          phone: b.request.guest.phone ?? null,
        }));
    const stats: DashboardStats = {
      monthStart,
      pendingRequests: requested.length,
      arrivalsNext7: won.filter(
        (b) => b.request.stay.arrive >= today && b.request.stay.arrive < addDays(today, 7),
      ).length,
      occupancyMonthPct: Math.round((100 * occupiedNights) / (allSuiteSlugs.length * daysInMonth)),
      revenueMonth: won
        .filter((b) => b.request.stay.arrive >= monthStart && b.request.stay.arrive < nextMonth)
        .reduce((t, b) => t + b.quote.total, 0),
      pipelineValue: requested.reduce((t, b) => t + b.quote.total, 0),
      avgBookingValue: won.length
        ? Math.round(won.reduce((t, b) => t + b.quote.total, 0) / won.length)
        : 0,
      needsAttention: requested.map((b) => ({
        reference: b.reference,
        guest: b.request.guest.name,
        email: b.request.guest.email,
        phone: b.request.guest.phone ?? null,
        unit: b.request.stay.unit,
        arrive: b.request.stay.arrive,
        depart: b.request.stay.depart,
        guests: b.request.stay.guests,
        total: b.quote.total,
        createdAt: b.createdAt,
      })),
      arrivals: move(won, "arrive"),
      departures: move(won, "depart"),
    };
    return delay(stats, 300);
  },

  async listPromotions() {
    return delay([...promosStore.read()], 200);
  },

  async createPromotion(input) {
    const promo: Promotion = {
      ...input,
      code: input.code ? input.code.trim().toUpperCase() : null,
      id: `promo-${Date.now().toString(36)}`,
      used: 0,
    };
    promosStore.write([...promosStore.read(), promo]);
    return delay(promo, 250);
  },

  async updatePromotion(id, patch) {
    const promos = promosStore.read();
    const promo = promos.find((p) => p.id === id);
    if (!promo) throw new Error("Promotion not found.");
    const next: Promotion = {
      ...promo,
      ...patch,
      code:
        patch.code !== undefined
          ? patch.code
            ? patch.code.trim().toUpperCase()
            : null
          : promo.code,
    };
    promosStore.write(promos.map((p) => (p.id === id ? next : p)));
    return delay(next, 250);
  },

  async deletePromotion(id) {
    promosStore.write(promosStore.read().filter((p) => p.id !== id));
    return delay(undefined, 200);
  },

  async listBookings() {
    return delay([...bookingsStore.read()].reverse(), 300);
  },

  async setBookingStatus(reference, status) {
    const all = bookingsStore.read();
    const booking = all.find((b) => b.reference === reference);
    if (!booking) throw new Error(`Booking ${reference} not found.`);
    // Confirming locks the date: refuse if a different confirmed stay overlaps.
    if (status === "confirmed" || status === "completed") {
      const clash = all.find(
        (b) =>
          b.reference !== reference &&
          (b.status === "confirmed" || b.status === "completed") &&
          rangesOverlap(
            b.request.stay.arrive,
            b.request.stay.depart,
            booking.request.stay.arrive,
            booking.request.stay.depart,
          ),
      );
      if (clash) throw new Error("Those dates overlap another confirmed stay — pick different dates.");
    }
    booking.status = status;
    bookingsStore.write(all);
    return delay({ ...booking }, 250);
  },

  async rescheduleBooking(reference, arriveISO, departISO) {
    const all = bookingsStore.read();
    const booking = all.find((b) => b.reference === reference);
    if (!booking) throw new Error(`Booking ${reference} not found.`);
    if (booking.status === "cancelled" || booking.status === "expired")
      throw new Error(`Cannot reschedule a ${booking.status} booking.`);
    if (departISO <= arriveISO) throw new Error("Departure must be after arrival.");
    // A confirmed booking can't be moved onto another confirmed stay.
    if (booking.status === "confirmed" || booking.status === "completed") {
      const clash = all.find(
        (b) =>
          b.reference !== reference &&
          (b.status === "confirmed" || b.status === "completed") &&
          rangesOverlap(b.request.stay.arrive, b.request.stay.depart, arriveISO, departISO),
      );
      if (clash) throw new Error("Those dates overlap another confirmed stay — pick different dates.");
    }
    const movedStay: StayRequest = { ...booking.request.stay, arrive: arriveISO, depart: departISO };
    const quote = computeQuote(movedStay, booking.request.extras, booking.request.promoCode);
    booking.request = { ...booking.request, stay: movedStay };
    booking.quote = quote;
    bookingsStore.write(all);
    return delay({ ...booking }, 300);
  },

  async overlappingRequests(reference) {
    const all = bookingsStore.read();
    const booking = all.find((b) => b.reference === reference);
    if (!booking) throw new Error(`Booking ${reference} not found.`);
    const overlaps = all
      .filter(
        (b) =>
          b.reference !== reference &&
          (b.status === "requested" || b.status === "hold") &&
          rangesOverlap(
            b.request.stay.arrive,
            b.request.stay.depart,
            booking.request.stay.arrive,
            booking.request.stay.depart,
          ),
      )
      .map((b) => ({
        reference: b.reference,
        guestName: b.request.guest.name,
        status: b.status,
        arrive: b.request.stay.arrive,
        depart: b.request.stay.depart,
      }));
    return delay(overlaps, 250);
  },

  async getCalendar(startISO, endISO) {
    const cal: AdminCalendar = {};
    // First write wins → priority: bookings, then blocks, then seeded stays.
    const put = (date: string, suite: SuiteSlug, cell: CalendarCell) => {
      if (date < startISO || date >= endISO) return;
      const day = (cal[date] ??= {});
      day[suite] ??= cell;
    };

    for (const b of bookingsStore.read()) {
      if (!CALENDAR_ACTIVE.includes(b.status)) continue;
      const cell: CalendarCell = {
        kind: "booking",
        label: `${b.request.guest.name} (${b.status})`,
        reference: b.reference,
      };
      for (const night of eachNight(b.request.stay.arrive, b.request.stay.depart)) {
        for (const suite of bookingSuites(b.request.stay.unit)) put(night, suite, cell);
      }
    }
    for (const block of blocksStore.read()) {
      const cell: CalendarCell = { kind: "block", label: block.reason, blockId: block.id };
      for (const night of eachNight(block.start, block.end)) {
        for (const suite of block.suite ? [block.suite] : allSuiteSlugs) put(night, suite, cell);
      }
    }
    return delay(cal, 300);
  },

  async listBlocks() {
    return delay([...blocksStore.read()], 200);
  },

  async createBlock(input) {
    if (!(input.start < input.end)) throw new Error("The block must end after it starts.");
    if (!input.reason.trim()) throw new Error("Give the block a reason.");
    const block: CalendarBlock = { ...input, id: `blk-${Date.now().toString(36)}` };
    blocksStore.write([...blocksStore.read(), block]);
    return delay(block, 250);
  },

  async deleteBlock(id) {
    blocksStore.write(blocksStore.read().filter((b) => b.id !== id));
    return delay(undefined, 200);
  },

  async getRates() {
    return delay(ratesStore.read(), 200);
  },

  async saveRates(config) {
    ratesStore.write(config);
    return delay(config, 300);
  },

  async resetRates() {
    ratesStore.clear();
    return delay(ratesStore.read(), 200);
  },
};
