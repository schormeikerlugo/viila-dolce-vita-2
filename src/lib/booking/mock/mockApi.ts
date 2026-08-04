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
  Promotion,
  Quote,
  QuoteLine,
  RatesConfig,
  SeasonSetting,
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
  seasonFor,
  seasonTemplates,
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
    seasons: seasonTemplates.map(({ mockOccupancy: _occ, ...season }) => ({ ...season })),
    extras: extrasCatalog.map((e) => ({ ...e })),
    depositPct: paymentRules.depositPct,
    touristTaxPerPersonNight: taxRules.touristTaxPerPersonNight,
    touristTaxMaxNights: taxRules.touristTaxMaxNights,
  };
}

const ratesStore = makeStore<RatesConfig>("vdv-mock-rates", defaultRates);

/** The season a night falls in, using the owner-edited settings. */
function seasonOf(cfg: RatesConfig, iso: string): SeasonSetting {
  const md = iso.slice(5); // "MM-DD"
  for (const s of cfg.seasons) {
    const wraps = s.from > s.to;
    const hit = wraps ? md >= s.from || md <= s.to : md >= s.from && md <= s.to;
    if (hit) return s;
  }
  return cfg.seasons[cfg.seasons.length - 1];
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
   it starts and how long it runs. Contiguous spans → realistic calendar.
   (Always uses the static seed templates — seeding isn't owner-editable.) */

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

/* ---- Blocks (seeded wedding weekend + owner-created) ----------------------- */

function defaultBlocks(): CalendarBlock[] {
  // A wedding buyout ~75 days out, Friday to Monday.
  let d = addDays(todayISO(), 75);
  while (fromISO(d).getUTCDay() !== 5) d = addDays(d, 1);
  return [
    { id: "seed-wedding", suite: null, start: d, end: addDays(d, 3), reason: "Wedding — full estate" },
  ];
}

const blocksStore = makeStore<CalendarBlock[]>("vdv-mock-blocks", defaultBlocks);

/* ---- Guest-created bookings -------------------------------------------------- */

const bookingsStore = makeStore<Booking[]>("vdv-mock-bookings", () => []);

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

const CALENDAR_ACTIVE: Booking["status"][] = ["requested", "hold", "confirmed", "completed"];

function bookingSuites(unit: UnitId): SuiteSlug[] {
  return unit === ESTATE ? allSuiteSlugs : [unit];
}

/* ---- Availability ------------------------------------------------------------- */

function occupancy(start: string, end: string): AvailabilityMap {
  const map: AvailabilityMap = {};
  const take = (night: string, suite: SuiteSlug) => {
    if (night < start || night >= end) return;
    const list = (map[night] ??= []);
    if (!list.includes(suite)) list.push(suite);
  };

  // Seeded stays per suite.
  for (const suite of allSuiteSlugs) {
    for (const night of seededNights(suite, start, end)) take(night, suite);
  }
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
    const busy = occ[night] ?? [];
    if (stay.unit === ESTATE ? busy.length > 0 : busy.includes(stay.unit as SuiteSlug))
      return false;
  }
  return true;
}

/* ---- Quote ----------------------------------------------------------------------- */

const eur = Math.round;

function accommodationLines(cfg: RatesConfig, stay: StayRequest, nights: number): QuoteLine[] {
  const lines: QuoteLine[] = [];
  const nightly = (base: number, night: string) => eur(base * seasonOf(cfg, night).multiplier);

  if (stay.unit === ESTATE) {
    const sumBase = cfg.suites.reduce((t, s) => t + s.baseRate, 0);
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

  const suite = cfg.suites.find((s) => s.slug === stay.unit);
  if (!suite) throw new Error("Unknown suite.");
  let sum = 0;
  const rates = new Set<number>();
  for (const night of eachNight(stay.arrive, stay.depart)) {
    const r = nightly(suite.baseRate, night);
    rates.add(r);
    sum += r;
  }
  const rateText =
    rates.size === 1 ? `€${[...rates][0]}` : `€${Math.min(...rates)}–€${Math.max(...rates)}`;
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

function computeQuote(stay: StayRequest, extraIds: string[], promoCode?: string): Quote {
  const cfg = ratesStore.read();
  const nights = nightsBetween(stay.arrive, stay.depart);
  if (!(nights > 0)) throw new Error("Departure must be after arrival.");
  if (stay.arrive < todayISO()) throw new Error("Arrival cannot be in the past.");

  const capacity =
    stay.unit === ESTATE
      ? estateRules.sleeps
      : (cfg.suites.find((s) => s.slug === stay.unit)?.sleeps ?? 0);
  if (stay.guests < 1) throw new Error("At least one guest.");
  if (stay.guests > capacity)
    throw new Error(
      `${stay.unit === ESTATE ? "The estate" : `The ${cap(stay.unit)} Suite`} sleeps up to ${capacity} guests.`,
    );

  const minNights = Math.max(
    ...eachNight(stay.arrive, stay.depart).map((n) => seasonOf(cfg, n).minNights),
  );
  if (nights < minNights)
    throw new Error(`These dates require a minimum stay of ${minNights} nights.`);

  if (!unitFreeForStay(stay, occupancy(stay.arrive, stay.depart)))
    throw new Error("Those dates are no longer available for this selection.");

  const lines = accommodationLines(cfg, stay, nights);

  // Promotion (explicit code or best automatic offer) on accommodation only.
  const accSubtotal = lines.reduce((t, l) => t + l.amount, 0);
  const promo = resolvePromo(promoCode, stay, nights);
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
    .map((e) => extraLine(e, stay, nights))
    .filter((l): l is QuoteLine => Boolean(l));

  const taxNights = Math.min(nights, cfg.touristTaxMaxNights);
  const taxLine: QuoteLine = {
    label: "Tourist tax (tassa di soggiorno)",
    detail: `€${cfg.touristTaxPerPersonNight} × ${stay.guests} guests × ${taxNights} nights`,
    amount: cfg.touristTaxPerPersonNight * stay.guests * taxNights,
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
    const units: UnitId[] = [...allSuiteSlugs, ESTATE];
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
    return delay(booking, 600);
  },
};

/* ---- The admin API ------------------------------------------------------------------------ */

export const mockAdminApi: AdminBookingApi = {
  async getDashboardStats() {
    const today = todayISO();
    const monthStart = `${today.slice(0, 7)}-01`;
    const nextMonth = addDays(monthStart, 32).slice(0, 7) + "-01";
    const daysInMonth = nightsBetween(monthStart, nextMonth);
    const bookings = bookingsStore.read();
    const won = bookings.filter((b) => b.status === "confirmed" || b.status === "completed");
    const requested = bookings.filter((b) => b.status === "requested");
    const occ = occupancy(monthStart, nextMonth);
    const occupiedNights = Object.values(occ).reduce((t, suites) => t + suites.length, 0);
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
    booking.status = status;
    bookingsStore.write(all);
    return delay({ ...booking }, 250);
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
    for (const suite of allSuiteSlugs) {
      for (const night of seededNights(suite, startISO, endISO)) {
        put(night, suite, { kind: "external", label: "Imported stay" });
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
