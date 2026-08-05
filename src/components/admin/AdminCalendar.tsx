/**
 * AdminCalendar — one month, a single "The Entire Villa" row (the whole
 * estate is the bookable unit). Each night is coloured by source (booking /
 * block / imported stay). Click a night to inspect it: free nights offer a
 * block form, booked nights offer status actions, blocks can be deleted.
 */
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../../lib/booking/api";
import type {
  AdminCalendar as CalData,
  BookingStatus,
  CalendarCell,
  SuiteSlug,
} from "../../lib/booking/types";
import {
  addDays,
  addMonths,
  fromISO,
  longDate,
  monthLabel,
  monthStart,
  todayISO,
} from "../../lib/booking/dates";
import type { SuiteMeta } from "./AdminApp";

interface Props {
  suites: SuiteMeta[];
}

/** Weekday nightly rates (default catalogue). */
const WEEKDAY_RATES = { monThu: 3000, fri: 4250, sat: 4750, sun: 3750 };
function nightPrice(iso: string): number {
  const dow = fromISO(iso).getUTCDay();
  if (dow === 5) return WEEKDAY_RATES.fri;
  if (dow === 6) return WEEKDAY_RATES.sat;
  if (dow === 0) return WEEKDAY_RATES.sun;
  return WEEKDAY_RATES.monThu;
}
function compactPrice(n: number): string {
  const k = n / 1000;
  const s = Number.isInteger(k) ? `${k}` : k.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `€${s}k`;
}

export default function AdminCalendar({ suites }: Props) {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => monthStart(today));
  const [cal, setCal] = useState<CalData>({});
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<string | null>(null); // selected date
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Block form (prefilled from the selected cell).
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // All active suite slugs (order from the AdminApp meta).
  const suiteSlugs = suites.map((s) => s.slug);

  const monthEnd = addMonths(cursor, 1);
  const daysInMonth = Array.from(
    { length: Math.round((fromISO(monthEnd).getTime() - fromISO(cursor).getTime()) / 86_400_000) },
    (_, i) => addDays(cursor, i),
  );

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getCalendar(cursor, monthEnd)
      .then(setCal)
      .finally(() => setLoading(false));
  }, [cursor, monthEnd]);

  useEffect(() => {
    load();
    setSel(null);
  }, [load]);

  /**
   * The Villa is booked/blocked on a night if ANY suite is occupied. Pick the
   * most meaningful cell (booking > block > imported) to represent the night.
   */
  const villaCell = (date: string): CalendarCell | undefined => {
    const day = cal[date];
    if (!day) return undefined;
    const cells = suiteSlugs.map((s) => day[s]).filter(Boolean) as CalendarCell[];
    return (
      cells.find((c) => c.kind === "booking") ??
      cells.find((c) => c.kind === "block") ??
      cells.find((c) => c.kind === "external") ??
      cells[0]
    );
  };

  const select = (date: string) => {
    setSel(date);
    setError(null);
    setBlockEnd(addDays(date, 1));
    setBlockReason("");
  };

  const run = (op: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    op()
      .then(() => {
        setSel(null);
        load();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setBusy(false));
  };

  const selCell = sel ? villaCell(sel) : undefined;

  const weekdayLetter = (iso: string) =>
    ["S", "M", "T", "W", "T", "F", "S"][fromISO(iso).getUTCDay()];
  const isWeekend = (iso: string) => [0, 6].includes(fromISO(iso).getUTCDay());

  return (
    <section className={`adm-cal${loading ? " is-loading" : ""}`} aria-label="Occupancy calendar">
      <div className="adm-cal__bar">
        <h2 className="adm-cal__title">{monthLabel(cursor)}</h2>
        <div className="adm-cal__nav">
          <button
            type="button"
            className="bk-cal__navbtn"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            type="button"
            className="bk-cal__navbtn"
            onClick={() => setCursor(monthStart(today))}
          >
            Today
          </button>
          <button
            type="button"
            className="bk-cal__navbtn"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div className="adm-cal__scroll">
        <div
          className="adm-cal__grid"
          style={{ gridTemplateColumns: `minmax(9rem, 12rem) repeat(${daysInMonth.length}, 1fr)` }}
        >
          <span className="adm-cal__corner" />
          {daysInMonth.map((d) => (
            <span
              key={`h-${d}`}
              className={[
                "adm-cal__dayhead",
                isWeekend(d) && "is-weekend",
                d === today && "is-today",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <em>{weekdayLetter(d)}</em>
              {Number(d.slice(8))}
            </span>
          ))}

          {/* Single Villa row — the whole estate is the bookable unit. */}
          <span className="adm-cal__suite">
            The Entire Villa
            <em>Five suites · Sleeps 15</em>
          </span>
          {daysInMonth.map((d) => {
            const cell = villaCell(d);
            const selected = sel === d;
            return (
              <button
                key={d}
                type="button"
                className={[
                  "adm-cal__cell",
                  cell && `is-${cell.kind}`,
                  isWeekend(d) && "is-weekend",
                  d < today && "is-past",
                  selected && "is-selected",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={cell ? cell.label : `Free · €${nightPrice(d).toLocaleString()}`}
                aria-label={`${d}: ${cell ? cell.label : "free"}`}
                onClick={() => select(d)}
              >
                {!cell && <span className="adm-cal__cellprice">{compactPrice(nightPrice(d))}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="adm-cal__legend">
        <span className="adm-key adm-key--booking">Booking</span>
        <span className="adm-key adm-key--block">Blocked</span>
        <span className="adm-key adm-key--free">Free</span>
      </div>

      {/* ---- Detail / action panel ---- */}
      {sel && (
        <div className="adm-panel">
          <div className="adm-panel__head">
            <p className="adm-panel__title">The Entire Villa — {longDate(sel)}</p>
            <button type="button" className="adm-panel__close" onClick={() => setSel(null)}>
              Close
            </button>
          </div>

          {error && <p className="bk-error">{error}</p>}

          {!selCell && (
            <form
              className="adm-panel__form"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  adminApi.createBlock({
                    suite: null, // the whole Villa
                    start: sel,
                    end: blockEnd,
                    reason: blockReason,
                  }),
                );
              }}
            >
              <p className="adm-panel__hint">
                Free night. Block it for maintenance, owner use or an event — blocked dates
                disappear from the guest calendar instantly.
              </p>
              <div className="adm-panel__row">
                <label className="bk-field">
                  <span className="bk-field__label">From</span>
                  <input type="date" className="bk-field__input" value={sel} readOnly />
                </label>
                <label className="bk-field">
                  <span className="bk-field__label">Until (check-out)</span>
                  <input
                    type="date"
                    className="bk-field__input"
                    value={blockEnd}
                    min={addDays(sel, 1)}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label className="bk-field">
                <span className="bk-field__label">Reason</span>
                <input
                  type="text"
                  className="bk-field__input"
                  placeholder="Maintenance, owner stay, wedding…"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="bk-btn" disabled={busy}>
                {busy ? "Blocking…" : "Block Dates"}
              </button>
            </form>
          )}

          {selCell?.kind === "block" && (
            <div className="adm-panel__body">
              <p className="adm-panel__hint">
                Blocked — <strong>{selCell.label}</strong>. Deleting the block reopens every
                night it covers.
              </p>
              <button
                type="button"
                className="bk-btn bk-btn--ghost"
                disabled={busy}
                onClick={() => run(() => adminApi.deleteBlock(selCell.blockId!))}
              >
                {busy ? "Removing…" : "Remove Block"}
              </button>
            </div>
          )}

          {selCell?.kind === "booking" && (
            <div className="adm-panel__body">
              <p className="adm-panel__hint">
                Booking <strong>{selCell.reference}</strong> — {selCell.label}. Manage the full
                record in the Bookings tab; quick actions:
              </p>
              <div className="adm-panel__actions">
                {(["confirmed", "cancelled"] as BookingStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`bk-btn${status === "cancelled" ? " bk-btn--ghost" : ""}`}
                    disabled={busy}
                    onClick={() => run(() => adminApi.setBookingStatus(selCell.reference!, status))}
                  >
                    {status === "confirmed" ? "Confirm" : "Cancel Booking"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selCell?.kind === "external" && (
            <p className="adm-panel__hint">
              Imported stay (seeded demo occupancy). With the real backend these come from the
              channel/iCal sync and are read-only here.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
