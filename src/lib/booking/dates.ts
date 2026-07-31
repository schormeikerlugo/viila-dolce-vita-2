/* ==========================================================================
   booking/dates.ts — Tiny ISO-date helpers shared by the booking UI.
   All dates are `YYYY-MM-DD` strings, handled in UTC to avoid TZ drift.
   ========================================================================== */

const DAY = 86_400_000;

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, days: number): string {
  return toISO(new Date(fromISO(iso).getTime() + days * DAY));
}

export function nightsBetween(arrive: string, depart: string): number {
  return Math.round((fromISO(depart).getTime() - fromISO(arrive).getTime()) / DAY);
}

/** Every night of `[arrive, depart)`. */
export function eachNight(arrive: string, depart: string): string[] {
  const out: string[] = [];
  for (let d = arrive; d < depart; d = addDays(d, 1)) out.push(d);
  return out;
}

/** First day of the month containing `iso`. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(monthISO: string, months: number): string {
  const d = fromISO(monthStart(monthISO));
  d.setUTCMonth(d.getUTCMonth() + months);
  return toISO(d);
}

export function monthLabel(monthISO: string): string {
  return fromISO(monthISO).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Long human date: "28 August 2026". */
export function longDate(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The 42 cells (6 weeks, Monday-first) of a month grid.
 * Cells outside the month are `null`.
 */
export function monthGrid(monthISO: string): (string | null)[] {
  const first = fromISO(monthStart(monthISO));
  const daysInMonth = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 0; d < daysInMonth; d++) cells.push(addDays(monthStart(monthISO), d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** €1,234 — whole euros, English formatting (site language). */
export function money(amount: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}
