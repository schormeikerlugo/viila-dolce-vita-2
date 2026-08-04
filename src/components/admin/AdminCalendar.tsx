/**
 * AdminCalendar — the panel's home screen: one month, five suites as rows,
 * every night colored by source (booking / block / imported stay). Click a
 * cell to inspect it: free nights offer a block form, bookings offer status
 * actions, blocks can be deleted.
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

interface Selection {
  suite: SuiteSlug;
  date: string;
}

export default function AdminCalendar({ suites }: Props) {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => monthStart(today));
  const [cal, setCal] = useState<CalData>({});
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Block form (prefilled from the selected cell).
  const [blockEnd, setBlockEnd] = useState("");
  const [blockScope, setBlockScope] = useState<"suite" | "estate">("estate");
  const [blockReason, setBlockReason] = useState("");

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

  const cellOf = (date: string, suite: SuiteSlug) => cal[date]?.[suite];

  const select = (suite: SuiteSlug, date: string) => {
    setSel({ suite, date });
    setError(null);
    setBlockEnd(addDays(date, 1));
    setBlockScope("estate");
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

  const selCell = sel ? cellOf(sel.date, sel.suite) : undefined;
  const selSuiteName = sel ? suites.find((s) => s.slug === sel.suite)?.name : "";

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

          {suites.map((suite) => (
            <SuiteRow
              key={suite.slug}
              suite={suite}
              days={daysInMonth}
              today={today}
              isWeekend={isWeekend}
              cellOf={cellOf}
              sel={sel}
              onSelect={select}
            />
          ))}
        </div>
      </div>

      <div className="adm-cal__legend">
        <span className="adm-key adm-key--booking">Booking</span>
        <span className="adm-key adm-key--block">Blocked</span>
        <span className="adm-key adm-key--external">Imported stay</span>
        <span className="adm-key adm-key--free">Free</span>
      </div>

      {/* ---- Detail / action panel ---- */}
      {sel && (
        <div className="adm-panel">
          <div className="adm-panel__head">
            <p className="adm-panel__title">
              {selSuiteName} — {longDate(sel.date)}
            </p>
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
                    suite: blockScope === "estate" ? null : sel.suite,
                    start: sel.date,
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
                  <input type="date" className="bk-field__input" value={sel.date} readOnly />
                </label>
                <label className="bk-field">
                  <span className="bk-field__label">Until (check-out)</span>
                  <input
                    type="date"
                    className="bk-field__input"
                    value={blockEnd}
                    min={addDays(sel.date, 1)}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    required
                  />
                </label>
                <label className="bk-field">
                  <span className="bk-field__label">Scope</span>
                  <select
                    className="bk-field__input"
                    value={blockScope}
                    onChange={(e) => setBlockScope(e.target.value as "suite" | "estate")}
                  >
                    <option value="estate">Entire Villa</option>
                    <option value="suite">{selSuiteName} only</option>
                  </select>
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

/* ---- One suite row ---- */

function SuiteRow({
  suite,
  days,
  today,
  isWeekend,
  cellOf,
  sel,
  onSelect,
}: {
  suite: SuiteMeta;
  days: string[];
  today: string;
  isWeekend(iso: string): boolean;
  cellOf(date: string, suite: SuiteSlug): CalendarCell | undefined;
  sel: Selection | null;
  onSelect(suite: SuiteSlug, date: string): void;
}) {
  return (
    <>
      <span className="adm-cal__suite">
        {suite.name}
        <em>sleeps {suite.sleeps}</em>
      </span>
      {days.map((d) => {
        const cell = cellOf(d, suite.slug);
        const selected = sel?.suite === suite.slug && sel?.date === d;
        return (
          <button
            key={`${suite.slug}-${d}`}
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
            title={cell ? `${cell.label}` : "Free"}
            aria-label={`${suite.name} ${d}: ${cell ? cell.label : "free"}`}
            onClick={() => onSelect(suite.slug, d)}
          />
        );
      })}
    </>
  );
}
