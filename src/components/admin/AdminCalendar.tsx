/**
 * AdminCalendar — operational availability calendar for the whole estate.
 *
 * Reads occupancy (getCalendar) + the raw bookings/blocks so it can draw each
 * stay as a continuous bar across the nights it covers, coloured by status,
 * with the guest name (or block reason) on the bar. Two modes:
 *   - View  → click a bar to open its detail panel (contact, total, actions).
 *   - Block → click a start then an end to block a free range in one step.
 *
 * A compact month summary (occupancy, free nights, arrivals/departures,
 * confirmed revenue) sits above the grid. All actions run through adminApi.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "../../lib/booking/api";
import type {
  Booking,
  BookingStatus,
  CalendarBlock,
} from "../../lib/booking/types";
import {
  addDays,
  addMonths,
  fromISO,
  longDate,
  monthGrid,
  monthLabel,
  monthStart,
  money,
  todayISO,
} from "../../lib/booking/dates";
import type { SuiteMeta } from "./AdminApp";
import CopyButton from "./CopyButton";

interface Props {
  suites: SuiteMeta[];
}

type Mode = "view" | "block";
type Filter = "all" | "pending" | "confirmed" | "blocks";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const BOOKING_ACTIVE: BookingStatus[] = ["requested", "hold", "confirmed", "completed"];

/** A continuous occupancy span across the calendar. */
interface Span {
  id: string;
  kind: "booking" | "block";
  status?: BookingStatus;
  label: string; // guest name or block reason
  start: string; // first night (inclusive)
  endExclusive: string; // checkout day (exclusive)
  booking?: Booking;
  block?: CalendarBlock;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "Requested",
  hold: "On hold",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export default function AdminCalendar(_props: Props) {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => monthStart(today));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("view");
  const [filter, setFilter] = useState<Filter>("all");

  // Block-mode range selection.
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // View-mode selection.
  const [selBooking, setSelBooking] = useState<Booking | null>(null);
  const [selBlock, setSelBlock] = useState<CalendarBlock | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([adminApi.listBookings(), adminApi.listBlocks()])
      .then(([bk, bl]) => {
        setBookings(bk);
        setBlocks(bl);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the calendar."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Clear transient selection when the month changes.
  useEffect(() => {
    setRangeStart(null);
    setRangeEnd(null);
    setSelBooking(null);
    setSelBlock(null);
  }, [cursor, mode]);

  /* ---- Build spans from bookings + blocks ---- */
  const spans: Span[] = useMemo(() => {
    const out: Span[] = [];
    for (const b of bookings) {
      if (!BOOKING_ACTIVE.includes(b.status)) continue;
      out.push({
        id: `bk-${b.reference}`,
        kind: "booking",
        status: b.status,
        label: b.request.guest.name,
        start: b.request.stay.arrive,
        endExclusive: b.request.stay.depart,
        booking: b,
      });
    }
    for (const bl of blocks) {
      out.push({
        id: `bl-${bl.id}`,
        kind: "block",
        label: bl.reason,
        start: bl.start,
        endExclusive: bl.end,
        block: bl,
      });
    }
    return out;
  }, [bookings, blocks]);

  // Occupancy lookup for a given night (used by block-mode range checks + free cells).
  const occupiedAt = useCallback(
    (d: string): Span | undefined =>
      spans.find((s) => d >= s.start && d < s.endExclusive),
    [spans],
  );

  const spanMatchesFilter = (s: Span): boolean => {
    if (filter === "all") return true;
    if (filter === "blocks") return s.kind === "block";
    if (filter === "pending") return s.kind === "booking" && (s.status === "requested" || s.status === "hold");
    if (filter === "confirmed") return s.kind === "booking" && (s.status === "confirmed" || s.status === "completed");
    return true;
  };

  /* ---- Month summary ---- */
  const monthDays = useMemo(
    () => monthGrid(cursor).filter((d): d is string => d !== null),
    [cursor],
  );
  const summary = useMemo(() => {
    const total = monthDays.length;
    let occupied = 0;
    let arrivals = 0;
    let departures = 0;
    let revenue = 0;
    const monthEndExcl = addDays(monthDays[monthDays.length - 1], 1);
    for (const d of monthDays) if (occupiedAt(d)) occupied++;
    for (const s of spans) {
      if (s.start >= monthDays[0] && s.start < monthEndExcl) arrivals++;
      if (s.endExclusive > monthDays[0] && s.endExclusive <= monthEndExcl && s.kind === "booking")
        departures++;
    }
    for (const b of bookings) {
      if (b.status !== "confirmed" && b.status !== "completed") continue;
      if (b.request.stay.arrive >= monthDays[0] && b.request.stay.arrive < monthEndExcl)
        revenue += b.quote.total;
    }
    const occPct = total ? Math.round((occupied / total) * 100) : 0;
    return { occPct, free: total - occupied, arrivals, departures, revenue };
  }, [monthDays, spans, occupiedAt, bookings]);

  /* ---- Actions ---- */
  const run = (op: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    op()
      .then(() => {
        setRangeStart(null);
        setRangeEnd(null);
        setSelBooking(null);
        setSelBlock(null);
        setReason("");
        load();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setBusy(false));
  };

  const occupiedIn = (a: string, bExcl: string): string[] => {
    const out: string[] = [];
    for (let d = a; d < bExcl; d = addDays(d, 1)) if (occupiedAt(d)) out.push(d);
    return out;
  };

  const pickDay = (day: string, span: Span | undefined) => {
    if (day < today) return;
    setError(null);

    if (mode === "view") {
      if (span?.kind === "booking" && span.booking) {
        setSelBlock(null);
        setSelBooking(span.booking);
      } else if (span?.kind === "block" && span.block) {
        setSelBooking(null);
        setSelBlock(span.block);
      }
      return;
    }

    // Block mode — can't start on an occupied night.
    if (span) {
      setError("That night is already occupied. Free it first, or pick an empty range.");
      return;
    }
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
      return;
    }
    if (day === rangeStart) {
      setRangeStart(null);
      return;
    }
    if (day > rangeStart) {
      const crossed = occupiedIn(rangeStart, addDays(day, 1));
      if (crossed.length) {
        setError(`That range hits an occupied night (${longDate(crossed[0])}). Pick a clear range.`);
        return;
      }
      setRangeEnd(day);
      return;
    }
    setRangeStart(day);
    setRangeEnd(null);
  };

  const previewEnd = useMemo(() => {
    if (mode !== "block" || !rangeStart || rangeEnd || !hover || hover <= rangeStart) return null;
    return occupiedIn(rangeStart, addDays(hover, 1)).length === 0 ? hover : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rangeStart, rangeEnd, hover, spans]);

  const inRange = (d: string) => {
    const end = rangeEnd ?? previewEnd;
    return Boolean(rangeStart && end && d >= rangeStart && d <= end);
  };

  const blockRange = () => {
    if (!rangeStart) return;
    const lastNight = rangeEnd ?? rangeStart;
    run(() =>
      adminApi.createBlock({
        suite: null,
        start: rangeStart,
        end: addDays(lastNight, 1),
        reason: reason.trim() || "Blocked by owner",
      }),
    );
  };

  /* ---- Week rows (grid + overlaid bars) ---- */
  const weeks = useMemo(() => {
    const grid = monthGrid(cursor);
    const rows: (string | null)[][] = [];
    for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));
    return rows;
  }, [cursor]);


  const canGoBack = cursor > monthStart(today);
  const showPanel =
    selBooking || selBlock || (mode === "block" && rangeStart);

  return (
    <section className={`adm-cal2${loading ? " is-loading" : ""}`} aria-label="Villa availability">
      {/* ---- Toolbar ---- */}
      <div className="adm-cal2__toolbar">
        <div className="adm-cal2__month">
          <h2 className="adm-cal2__title">{monthLabel(cursor)}</h2>
          <div className="adm-cal2__nav">
            <button
              type="button"
              className="adm-cal2__navbtn"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              disabled={!canGoBack}
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              type="button"
              className="adm-cal2__navbtn"
              onClick={() => setCursor(monthStart(today))}
            >
              Today
            </button>
            <button
              type="button"
              className="adm-cal2__navbtn"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Next month"
            >
              →
            </button>
          </div>
        </div>

        <div
          className="adm-cal2__modes"
          role="tablist"
          aria-label="Calendar mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "view"}
            className={`adm-seg${mode === "view" ? " is-active" : ""}`}
            onClick={() => setMode("view")}
          >
            View
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "block"}
            className={`adm-seg${mode === "block" ? " is-active" : ""}`}
            onClick={() => setMode("block")}
          >
            Block dates
          </button>
        </div>
      </div>

      {/* ---- Month summary ---- */}
      <div className="adm-cal2__summary">
        <div className="adm-cal2__kpi">
          <span className="adm-cal2__kpival">{summary.occPct}%</span>
          <span className="adm-cal2__kpilbl">Occupancy</span>
        </div>
        <div className="adm-cal2__kpi">
          <span className="adm-cal2__kpival">{summary.free}</span>
          <span className="adm-cal2__kpilbl">Free nights</span>
        </div>
        <div className="adm-cal2__kpi">
          <span className="adm-cal2__kpival">{summary.arrivals}</span>
          <span className="adm-cal2__kpilbl">Arrivals</span>
        </div>
        <div className="adm-cal2__kpi">
          <span className="adm-cal2__kpival">{summary.departures}</span>
          <span className="adm-cal2__kpilbl">Departures</span>
        </div>
        <div className="adm-cal2__kpi">
          <span className="adm-cal2__kpival">{money(summary.revenue)}</span>
          <span className="adm-cal2__kpilbl">Confirmed revenue</span>
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="adm-cal2__filters" role="group" aria-label="Filter stays">
        {(
          [
            ["all", "All"],
            ["pending", "Pending"],
            ["confirmed", "Confirmed"],
            ["blocks", "Blocks"],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`adm-chip${filter === id ? " is-active" : ""}`}
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "block" && (
        <p className="adm-cal2__hint">
          {rangeStart
            ? "Pick an end date to block a range, or block just this night in the panel."
            : "Click a free night to start a block."}
        </p>
      )}

      {/* ---- Calendar grid ---- */}
      <div className="adm-cal2__grid">
        <div className="adm-cal2__wds">
          {WEEKDAYS.map((w) => (
            <span key={w} className="adm-cal2__wd">
              {w}
            </span>
          ))}
        </div>

        {weeks.map((week, wi) => {
          return (
            <div className="adm-cal2__week" key={wi} onMouseLeave={() => setHover(null)}>
              {/* day cells — each occupied day paints its whole cell */}
              <div className="adm-cal2__days">
                {week.map((d, di) => {
                  if (d === null)
                    return <span key={`pad-${wi}-${di}`} className="adm-cal2__cell is-pad" />;
                  const past = d < today;
                  const isToday = d === today;
                  const start = d === rangeStart;
                  const end = d === (rangeEnd ?? previewEnd);
                  const range = inRange(d);
                  const occ = occupiedAt(d);
                  const occKind = occ ? (occ.kind === "block" ? "block" : occ.status) : null;
                  const occDim = occ ? !spanMatchesFilter(occ) : false;
                  // The stay's real check-in shows the guest/reason label.
                  const isSpanStart = occ ? d === occ.start : false;
                  const active =
                    occ &&
                    ((selBooking && occ.booking && selBooking.reference === occ.booking.reference) ||
                      (selBlock && occ.block && selBlock.id === occ.block.id));
                  return (
                    <button
                      key={d}
                      type="button"
                      className={[
                        "adm-cal2__cell",
                        past && "is-past",
                        isToday && "is-today",
                        mode === "block" && !occ && !past && "is-blockable",
                        start && "is-rangestart",
                        end && "is-rangeend",
                        range && "is-inrange",
                        occ && `is-occ is-${occKind}`,
                        occ && isSpanStart && "is-spanstart",
                        occ && d === addDays(occ.endExclusive, -1) && "is-spanend",
                        occDim && "is-dim",
                        active && "is-selected",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={past}
                      onClick={() => pickDay(d, occ)}
                      onMouseEnter={() => setHover(d)}
                      onFocus={() => setHover(d)}
                      aria-label={occ ? `${longDate(d)} — ${occ.label}` : longDate(d)}
                      title={occ ? `${occ.label}${occ.status ? ` · ${STATUS_LABEL[occ.status]}` : ""}` : undefined}
                    >
                      <span className="adm-cal2__daynum">{Number(d.slice(8))}</span>
                      {occ && isSpanStart && (
                        <span className="adm-cal2__celllabel">{occ.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Legend ---- */}
      <div className="adm-cal2__legend">
        <span className="adm-cal2__lg is-requested">Requested</span>
        <span className="adm-cal2__lg is-hold">On hold</span>
        <span className="adm-cal2__lg is-confirmed">Confirmed</span>
        <span className="adm-cal2__lg is-block">Blocked</span>
        <span className="adm-cal2__lg is-free">Free</span>
      </div>

      {error && <p className="bk-error adm-cal2__error">{error}</p>}

      {/* ---- Detail / action panel ---- */}
      {showPanel && (
        <div className="adm-panel adm-cal2__panel">
          {/* Booking detail */}
          {selBooking && (
            <>
              <div className="adm-panel__head">
                <p className="adm-panel__title">
                  {selBooking.request.guest.name}
                  <span className={`adm-cal2__status is-${selBooking.status}`}>
                    {STATUS_LABEL[selBooking.status]}
                  </span>
                </p>
                <button type="button" className="adm-panel__close" onClick={() => setSelBooking(null)}>
                  Close
                </button>
              </div>

              <dl className="adm-cal2__facts">
                <div>
                  <dt>Stay</dt>
                  <dd>
                    {longDate(selBooking.request.stay.arrive)} → {longDate(selBooking.request.stay.depart)}
                    <em>{selBooking.quote.nights} nights · {selBooking.request.stay.guests} guests</em>
                  </dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd className="adm-copyable">
                    {selBooking.reference}
                    <CopyButton value={selBooking.reference} label="Copy reference" />
                  </dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd className="adm-copyable">
                    {selBooking.request.guest.email}
                    <CopyButton value={selBooking.request.guest.email} label="Copy email" />
                  </dd>
                </div>
                {selBooking.request.guest.phone && (
                  <div>
                    <dt>Phone</dt>
                    <dd className="adm-copyable">
                      {selBooking.request.guest.phone}
                      <CopyButton value={selBooking.request.guest.phone} label="Copy phone" />
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Total</dt>
                  <dd>
                    {money(selBooking.quote.total)}
                    <em>Deposit {money(selBooking.quote.depositDue)}</em>
                  </dd>
                </div>
              </dl>

              {selBooking.request.guest.notes && (
                <p className="adm-cal2__notes">“{selBooking.request.guest.notes}”</p>
              )}

              <div className="adm-panel__actions">
                {selBooking.status !== "confirmed" && (
                  <button
                    type="button"
                    className="bk-btn"
                    disabled={busy}
                    onClick={() => run(() => adminApi.setBookingStatus(selBooking.reference, "confirmed"))}
                  >
                    {busy ? "…" : "Confirm"}
                  </button>
                )}
                {selBooking.status === "requested" && (
                  <button
                    type="button"
                    className="bk-btn bk-btn--ghost"
                    disabled={busy}
                    onClick={() => run(() => adminApi.setBookingStatus(selBooking.reference, "hold"))}
                  >
                    Hold
                  </button>
                )}
                <button
                  type="button"
                  className="bk-btn bk-btn--ghost"
                  disabled={busy}
                  onClick={() => run(() => adminApi.setBookingStatus(selBooking.reference, "cancelled"))}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Block detail */}
          {selBlock && (
            <>
              <div className="adm-panel__head">
                <p className="adm-panel__title">
                  Blocked
                  <span className="adm-cal2__status is-block">Owner block</span>
                </p>
                <button type="button" className="adm-panel__close" onClick={() => setSelBlock(null)}>
                  Close
                </button>
              </div>
              <dl className="adm-cal2__facts">
                <div>
                  <dt>Dates</dt>
                  <dd>
                    {longDate(selBlock.start)} → {longDate(addDays(selBlock.end, -1))}
                    <em>{selBlock.reason}</em>
                  </dd>
                </div>
              </dl>
              <div className="adm-panel__actions">
                <button
                  type="button"
                  className="bk-btn"
                  disabled={busy}
                  onClick={() => run(() => adminApi.deleteBlock(selBlock.id))}
                >
                  {busy ? "Freeing…" : "Free these dates"}
                </button>
              </div>
            </>
          )}

          {/* Block-mode range form */}
          {!selBooking && !selBlock && mode === "block" && rangeStart && (
            <>
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
                  ? "These nights leave the guest calendar instantly."
                  : "Pick an end date for a range, or block just this night below."}
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
                      ? "Block these dates"
                      : "Block this night"}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </section>
  );
}
