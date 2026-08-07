/**
 * AdminCalendar — a simple two-month availability calendar for the whole
 * estate (the single bookable unit), styled like the guest booking calendar.
 *
 * Fast operation:
 *  - Free nights: click a start, click an end → block/occupy the range in one
 *    step (with a quick reason). A single click blocks that one night.
 *  - Blocked nights: click to open the panel and free them (delete the block).
 *  - Booked nights: click for quick confirm/cancel actions.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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
  monthGrid,
  monthLabel,
  monthStart,
  todayISO,
} from "../../lib/booking/dates";
import type { SuiteMeta } from "./AdminApp";

interface Props {
  suites: SuiteMeta[];
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Range selection for blocking free nights.
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // A single occupied night the admin tapped (to free / manage).
  const [selCellDate, setSelCellDate] = useState<string | null>(null);

  const suiteSlugs = suites.map((s) => s.slug as SuiteSlug);

  // Load a wide window covering both visible months.
  const windowStart = cursor;
  const windowEnd = addMonths(cursor, 2);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getCalendar(windowStart, windowEnd)
      .then(setCal)
      .finally(() => setLoading(false));
  }, [windowStart, windowEnd]);

  useEffect(() => {
    load();
    setRangeStart(null);
    setRangeEnd(null);
    setSelCellDate(null);
    setError(null);
  }, [load]);

  /** The most meaningful cell for a night (booking > block > external). */
  const villaCell = useCallback(
    (date: string): CalendarCell | undefined => {
      const day = cal[date];
      if (!day) return undefined;
      const cells = suiteSlugs.map((s) => day[s]).filter(Boolean) as CalendarCell[];
      return (
        cells.find((c) => c.kind === "booking") ??
        cells.find((c) => c.kind === "block") ??
        cells.find((c) => c.kind === "external") ??
        cells[0]
      );
    },
    [cal, suiteSlugs],
  );

  const isOccupied = (d: string) => Boolean(villaCell(d));

  const run = (op: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    op()
      .then(() => {
        setRangeStart(null);
        setRangeEnd(null);
        setSelCellDate(null);
        setReason("");
        load();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setBusy(false));
  };

  /** Any occupied night inside [a, b)? (can't block across a real booking) */
  const occupiedIn = (a: string, b: string): string[] => {
    const out: string[] = [];
    for (let d = a; d < b; d = addDays(d, 1)) if (isOccupied(d)) out.push(d);
    return out;
  };

  const pick = (day: string) => {
    if (day < today) return;
    setError(null);

    const cell = villaCell(day);
    if (cell) {
      // Occupied night → open the manage panel (free block / booking actions).
      setRangeStart(null);
      setRangeEnd(null);
      setSelCellDate(day);
      return;
    }

    // Free night → range selection to block.
    setSelCellDate(null);
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
      return;
    }
    // Clicking the same start again clears it.
    if (day === rangeStart) {
      setRangeStart(null);
      return;
    }
    if (day > rangeStart) {
      // End (check-out) is exclusive; block [start, day].
      const crossed = occupiedIn(rangeStart, addDays(day, 1));
      if (crossed.length) {
        setError(`That range hits an occupied night (${longDate(crossed[0])}). Pick a clear range.`);
        return;
      }
      setRangeEnd(day);
      return;
    }
    // Earlier day → restart selection here.
    setRangeStart(day);
    setRangeEnd(null);
  };

  // Preview the tentative range while hovering.
  const previewEnd = useMemo(() => {
    if (!rangeStart || rangeEnd || !hover || hover <= rangeStart) return null;
    return occupiedIn(rangeStart, addDays(hover, 1)).length === 0 ? hover : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd, hover, cal]);

  const inRange = (d: string) => {
    const end = rangeEnd ?? previewEnd;
    return Boolean(rangeStart && end && d >= rangeStart && d <= end);
  };

  const selCell = selCellDate ? villaCell(selCellDate) : undefined;

  // Submit a block for the chosen range (end is exclusive = day after last).
  const blockRange = () => {
    if (!rangeStart) return;
    const lastNight = rangeEnd ?? rangeStart;
    run(() =>
      adminApi.createBlock({
        suite: null, // whole estate
        start: rangeStart,
        end: addDays(lastNight, 1),
        reason: reason.trim() || "Blocked by owner",
      }),
    );
  };

  const months = [cursor, addMonths(cursor, 1)];
  const canGoBack = cursor > monthStart(today);

  return (
    <section className="adm-simplecal" aria-label="Villa availability calendar">
      <div className={`bk-cal${loading ? " is-loading" : ""}`}>
        <div className="bk-cal__nav">
          <button
            type="button"
            className="bk-cal__navbtn"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            disabled={!canGoBack}
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            type="button"
            className="bk-cal__navbtn"
            onClick={() => setCursor(monthStart(today))}
            aria-label="Jump to today"
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

        <div className="bk-cal__months">
          {months.map((m) => (
            <div className="bk-cal__month" key={m}>
              <p className="bk-cal__label">{monthLabel(m)}</p>
              <div className="bk-cal__grid" role="grid" onMouseLeave={() => setHover(null)}>
                {WEEKDAYS.map((w) => (
                  <span key={w} className="bk-cal__wd" aria-hidden="true">
                    {w}
                  </span>
                ))}
                {monthGrid(m).map((d, i) => {
                  if (d === null)
                    return <span key={`${m}-pad-${i}`} className="bk-cal__pad" aria-hidden="true" />;
                  const cell = d >= today ? villaCell(d) : undefined;
                  const kind = cell?.kind;
                  const selected = d === selCellDate;
                  const isStart = d === rangeStart;
                  const isEnd = d === (rangeEnd ?? previewEnd);
                  return (
                    <button
                      key={d}
                      type="button"
                      className={[
                        "bk-cal__day",
                        d < today && "is-past",
                        kind === "booking" && "is-full",
                        kind === "block" && "is-block",
                        kind === "external" && "is-full",
                        isStart && "is-arrive",
                        isEnd && "is-depart",
                        inRange(d) && "is-inrange",
                        selected && "is-selected",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={d < today}
                      aria-label={cell ? `${longDate(d)} — ${cell.label}` : longDate(d)}
                      title={cell ? cell.label : `Free · €${nightPrice(d).toLocaleString()}`}
                      onClick={() => pick(d)}
                      onMouseEnter={() => setHover(d)}
                      onFocus={() => setHover(d)}
                    >
                      <span className="bk-cal__daynum">{Number(d.slice(8))}</span>
                      {d >= today && !cell && (
                        <span className="bk-cal__price">{compactPrice(nightPrice(d))}</span>
                      )}
                      {cell && (
                        <span className="bk-cal__bubble" role="tooltip">
                          {kind === "booking" ? "Booked" : kind === "block" ? "Blocked" : "Busy"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="bk-cal__legend">
          <span className="bk-cal__key bk-cal__key--free">Free</span>
          <span className="bk-cal__key bk-cal__key--full">Booked</span>
          <span className="bk-cal__key bk-cal__key--block">Blocked</span>
        </div>
      </div>

      {error && <p className="bk-error adm-simplecal__error">{error}</p>}

      {/* ---- Action panel: block a range, or manage an occupied night ---- */}
      {rangeStart && !selCell && (
        <div className="adm-panel">
          <div className="adm-panel__head">
            <p className="adm-panel__title">
              Block {longDate(rangeStart)}
              {rangeEnd && rangeEnd !== rangeStart ? ` → ${longDate(rangeEnd)}` : ""}
            </p>
            <button
              type="button"
              className="adm-panel__close"
              onClick={() => {
                setRangeStart(null);
                setRangeEnd(null);
              }}
            >
              Close
            </button>
          </div>
          <p className="adm-panel__hint">
            {rangeEnd
              ? "These nights will be removed from the guest calendar instantly."
              : "Pick an end date to block a range, or block just this night below."}
          </p>
          <form
            className="adm-panel__form"
            onSubmit={(e) => {
              e.preventDefault();
              blockRange();
            }}
          >
            <label className="bk-field">
              <span className="bk-field__label">Reason</span>
              <input
                type="text"
                className="bk-field__input"
                placeholder="Maintenance, owner stay, wedding…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button type="submit" className="bk-btn" disabled={busy}>
              {busy
                ? "Blocking…"
                : rangeEnd && rangeEnd !== rangeStart
                  ? "Block These Dates"
                  : "Block This Night"}
            </button>
          </form>
        </div>
      )}

      {selCell && selCellDate && (
        <div className="adm-panel">
          <div className="adm-panel__head">
            <p className="adm-panel__title">{longDate(selCellDate)} — {selCell.label}</p>
            <button type="button" className="adm-panel__close" onClick={() => setSelCellDate(null)}>
              Close
            </button>
          </div>

          {selCell.kind === "block" && (
            <div className="adm-panel__body">
              <p className="adm-panel__hint">
                Blocked — <strong>{selCell.label}</strong>. Freeing it reopens every night the
                block covers.
              </p>
              <button
                type="button"
                className="bk-btn"
                disabled={busy}
                onClick={() => run(() => adminApi.deleteBlock(selCell.blockId!))}
              >
                {busy ? "Freeing…" : "Free These Dates"}
              </button>
            </div>
          )}

          {selCell.kind === "booking" && (
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

          {selCell.kind === "external" && (
            <p className="adm-panel__hint">
              Imported stay (channel/iCal sync). These are read-only here.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
