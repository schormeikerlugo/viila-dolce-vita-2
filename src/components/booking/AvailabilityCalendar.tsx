/**
 * AvailabilityCalendar — two-month range picker in the site's editorial
 * language. Day states come from the AvailabilityMap: a night with all five
 * suites busy is "fully booked" (can't be part of a stay); a night with some
 * suites busy shows a dot. Hovering a day reveals a bubble with its status,
 * and choosing a range that would cross a fully-booked night is prevented AND
 * explained (bubble on the blocking day + a note under the calendar), so the
 * guest is never left guessing why a selection "won't take".
 */
import { useEffect, useMemo, useState } from "react";
import type { AvailabilityMap } from "../../lib/booking/types";
import {
  addDays,
  addMonths,
  longDate,
  monthGrid,
  monthLabel,
  monthStart,
  todayISO,
} from "../../lib/booking/dates";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Minimalist per-day price: €3,000 → "€3k", €4,250 → "€4.25k". */
function compactPrice(n: number): string {
  const k = n / 1000;
  const s = Number.isInteger(k) ? `${k}` : k.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `€${s}k`;
}

interface Props {
  occ: AvailabilityMap;
  arrive: string | null;
  depart: string | null;
  onChange(arrive: string | null, depart: string | null): void;
  /** Called whenever the visible window changes, so the parent can fetch. */
  onVisibleRange(startISO: string, endISO: string): void;
  loading?: boolean;
}

export default function AvailabilityCalendar({
  occ,
  arrive,
  depart,
  onChange,
  onVisibleRange,
  loading = false,
}: Props) {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => monthStart(today));
  const [hover, setHover] = useState<string | null>(null);
  // Blocked nights from the last invalid tap (for touch, where there's no
  // hover). Cleared on the next successful pick.
  const [tappedBlocked, setTappedBlocked] = useState<string[]>([]);

  useEffect(() => {
    onVisibleRange(cursor, addMonths(cursor, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  // The Villa is the only unit: a night is "full" (unavailable) if ANY suite
  // is occupied that night, since booking takes the whole estate.
  const isFull = (d: string) => (occ[d]?.suites?.length ?? 0) > 0;
  /** The Villa's price for a night (weekday rate), if known. */
  const priceOf = (d: string) => occ[d]?.price ?? null;

  /** Fully-booked nights inside `[a, b)` — the ones that block the stay. */
  const blockedNightsIn = (a: string, b: string): string[] => {
    const out: string[] = [];
    for (let d = a; d < b; d = addDays(d, 1)) if (isFull(d)) out.push(d);
    return out;
  };
  const rangeClear = (a: string, b: string) => blockedNightsIn(a, b).length === 0;

  const pick = (day: string) => {
    if (day < today) return;

    // Clicking a selected endpoint clears the selection — no dead-ends.
    if (day === arrive || day === depart) {
      setTappedBlocked([]);
      onChange(null, null);
      return;
    }

    if (!arrive || (arrive && depart)) {
      if (isFull(day)) return; // can't arrive on a fully booked night
      setTappedBlocked([]);
      onChange(day, null);
      return;
    }
    if (day > arrive && rangeClear(arrive, day)) {
      setTappedBlocked([]);
      onChange(arrive, day);
      return;
    }
    // A later day that crosses blocked night(s): don't silently restart —
    // surface which nights are the problem (works on touch, no hover).
    if (day > arrive) {
      const blocked = blockedNightsIn(arrive, day);
      if (blocked.length) {
        setTappedBlocked(blocked);
        return;
      }
    }
    // An earlier day (or same) → restart from here if it's bookable.
    if (!isFull(day)) {
      setTappedBlocked([]);
      onChange(day, null);
    }
  };

  // Preview range while choosing the departure.
  const previewEnd = useMemo(() => {
    if (!arrive || depart || !hover || hover <= arrive) return null;
    return rangeClear(arrive, hover) ? hover : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrive, depart, hover, occ]);

  const inRange = (d: string) => {
    const end = depart ?? previewEnd;
    return Boolean(arrive && end && d > arrive && d < end);
  };

  /**
   * While choosing a departure, if the hovered day sits *beyond* a blocked
   * night, collect those blocked nights so we can flag them (bubble + note).
   */
  const blockedInHover = useMemo(() => {
    if (!arrive || depart || !hover || hover <= arrive) return [];
    return blockedNightsIn(arrive, hover);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrive, depart, hover, occ]);

  // The nights to flag: whatever the hover would cross, else the last tap.
  const flaggedBlocked = blockedInHover.length ? blockedInHover : tappedBlocked;

  // Clear a stale tap-warning once dates change or a departure is set.
  useEffect(() => {
    setTappedBlocked([]);
  }, [arrive, depart]);

  /** Per-day bubble label (only for booked days). */
  const bubbleFor = (d: string): string | null => {
    if (d < today) return null;
    if (isFull(d)) return "Booked";
    return null;
  };

  const months = [cursor, addMonths(cursor, 1)];
  const canGoBack = cursor > monthStart(today);

  return (
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
                  return (
                    <span key={`${m}-pad-${i}`} className="bk-cal__pad" aria-hidden="true" />
                  );
                const full = d >= today && isFull(d);
                // A blocked night the tentative range would cross.
                const blocksHover = flaggedBlocked.includes(d);
                const bubble = bubbleFor(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className={[
                      "bk-cal__day",
                      d < today && "is-past",
                      full && "is-full",
                      blocksHover && "is-blocking",
                      d === arrive && "is-arrive",
                      d === (depart ?? previewEnd) && "is-depart",
                      inRange(d) && "is-inrange",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={d < today}
                    aria-pressed={d === arrive || d === depart}
                    aria-label={
                      bubble ? `${longDate(d)} — ${bubble}` : longDate(d)
                    }
                    onClick={() => pick(d)}
                    onMouseEnter={() => setHover(d)}
                    onFocus={() => setHover(d)}
                  >
                    <span className="bk-cal__daynum">{Number(d.slice(8))}</span>
                    {d >= today && !full && priceOf(d) != null && (
                      <span className="bk-cal__price">{compactPrice(priceOf(d)!)}</span>
                    )}
                    {bubble && (
                      <span className="bk-cal__bubble" role="tooltip">
                        {bubble}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Range warning: the tentative stay crosses fully-booked night(s). */}
      {flaggedBlocked.length > 0 && (
        <p className="bk-cal__warn" role="status">
          {flaggedBlocked.length === 1
            ? `${longDate(flaggedBlocked[0])} is fully booked — choose an end date before it, or a start after it.`
            : `${flaggedBlocked.length} nights in that range are fully booked (from ${longDate(
                flaggedBlocked[0],
              )}). Pick a range without them.`}
        </p>
      )}

      <div className="bk-cal__legend">
        <span className="bk-cal__key bk-cal__key--free">Available</span>
        <span className="bk-cal__key bk-cal__key--full">Booked</span>
      </div>
    </div>
  );
}
