/**
 * AvailabilityCalendar — two-month range picker drawn in the site's
 * editorial language (hairlines, uppercase labels, no rounded corners).
 *
 * Day states come from the AvailabilityMap: a night with all five suites
 * busy is "fully booked" (crossed out); a night with some suites busy shows
 * a small dot ("limited"). Selection picks arrival, then departure; nights
 * in between must not be fully booked.
 */
import { useEffect, useMemo, useState } from "react";
import type { AvailabilityMap } from "../../lib/booking/types";
import {
  addDays,
  addMonths,
  monthGrid,
  monthLabel,
  monthStart,
  todayISO,
} from "../../lib/booking/dates";

const SUITE_COUNT = 5;
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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

  useEffect(() => {
    onVisibleRange(cursor, addMonths(cursor, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const busyCount = (d: string) => occ[d]?.length ?? 0;
  const isFull = (d: string) => busyCount(d) >= SUITE_COUNT;

  /** Can [a, b) be a stay? No fully-booked night inside. */
  const rangeClear = (a: string, b: string) => {
    for (let d = a; d < b; d = addDays(d, 1)) if (isFull(d)) return false;
    return true;
  };

  const pick = (day: string) => {
    if (day < today) return;
    if (!arrive || (arrive && depart)) {
      if (isFull(day)) return; // can't arrive on a fully booked night
      onChange(day, null);
      return;
    }
    if (day > arrive && rangeClear(arrive, day)) {
      onChange(arrive, day);
      return;
    }
    if (!isFull(day)) onChange(day, null);
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
              {monthGrid(m).map((d, i) =>
                d === null ? (
                  <span key={`${m}-pad-${i}`} className="bk-cal__pad" aria-hidden="true" />
                ) : (
                  <button
                    key={d}
                    type="button"
                    className={[
                      "bk-cal__day",
                      d < today && "is-past",
                      d >= today && isFull(d) && "is-full",
                      d >= today && !isFull(d) && busyCount(d) > 0 && "is-limited",
                      d === arrive && "is-arrive",
                      d === (depart ?? previewEnd) && "is-depart",
                      inRange(d) && "is-inrange",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={d < today}
                    aria-pressed={d === arrive || d === depart}
                    aria-label={d}
                    onClick={() => pick(d)}
                    onMouseEnter={() => setHover(d)}
                    onFocus={() => setHover(d)}
                  >
                    {Number(d.slice(8))}
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bk-cal__legend">
        <span className="bk-cal__key bk-cal__key--free">Available</span>
        <span className="bk-cal__key bk-cal__key--limited">Some suites taken</span>
        <span className="bk-cal__key bk-cal__key--full">Fully booked</span>
      </div>
    </div>
  );
}
