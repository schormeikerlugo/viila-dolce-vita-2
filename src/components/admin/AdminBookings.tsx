/**
 * AdminBookings — every request made through /book, newest first, with a
 * status filter, free-text search and one-click transitions. Clicking a row
 * opens a detail drawer: the full quote breakdown, extras, notes and direct
 * contact actions (WhatsApp deep-link, email). Cancelling frees the nights
 * on both calendars immediately.
 */
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../../lib/booking/api";
import type { Booking, BookingStatus } from "../../lib/booking/types";
import { ESTATE } from "../../lib/booking/types";
import { longDate, money } from "../../lib/booking/dates";
import type { SuiteMeta } from "./AdminApp";

const FILTERS: (BookingStatus | "all")[] = [
  "all",
  "requested",
  "confirmed",
  "completed",
  "cancelled",
];

/** Allowed transitions per current status. */
const ACTIONS: Partial<Record<BookingStatus, { to: BookingStatus; label: string }[]>> = {
  requested: [
    { to: "confirmed", label: "Confirm" },
    { to: "cancelled", label: "Cancel" },
  ],
  hold: [
    { to: "confirmed", label: "Confirm" },
    { to: "cancelled", label: "Cancel" },
  ],
  confirmed: [
    { to: "completed", label: "Complete" },
    { to: "cancelled", label: "Cancel" },
  ],
};

interface Props {
  suites: SuiteMeta[];
}

export default function AdminBookings({ suites }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null); // reference in the drawer
  const [loading, setLoading] = useState(true);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listBookings()
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const move = (reference: string, to: BookingStatus) => {
    setBusyRef(reference);
    setError(null);
    adminApi
      .setBookingStatus(reference, to)
      .then(load)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setBusyRef(null));
  };

  const unitName = (unit: string) =>
    unit === ESTATE ? "Entire Villa" : (suites.find((s) => s.slug === unit)?.name ?? unit);

  const q = search.trim().toLowerCase();
  const visible = bookings.filter((b) => {
    if (filter !== "all" && b.status !== filter) return false;
    if (!q) return true;
    return [b.reference, b.request.guest.name, b.request.guest.email, b.request.guest.phone ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const detail = open ? bookings.find((b) => b.reference === open) : null;

  return (
    <section className="adm-bookings" aria-label="Bookings">
      <div className="adm-toolbar">
        <input
          type="search"
          className="adm-search"
          placeholder="Search name, email, reference…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search bookings"
        />
        <div className="adm-filter">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`adm-filter__opt${filter === f ? " is-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="bk-error">{error}</p>}

      {loading ? (
        <p className="adm-empty">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="adm-empty">
          {q
            ? "Nothing matches that search."
            : filter === "all"
              ? "No booking requests yet. Guests create them at /book."
              : `No ${filter} bookings.`}
        </p>
      ) : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Guest</th>
                <th>Stay</th>
                <th>Unit</th>
                <th className="is-num">Guests</th>
                <th className="is-num">Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr
                  key={b.reference}
                  className="adm-table__row"
                  onClick={() => setOpen(b.reference)}
                >
                  <td className="adm-table__ref">{b.reference}</td>
                  <td>
                    {b.request.guest.name}
                    <em>{b.request.guest.email}</em>
                  </td>
                  <td>
                    {longDate(b.request.stay.arrive)} → {longDate(b.request.stay.depart)}
                    <em>{b.quote.nights} nights</em>
                  </td>
                  <td>{unitName(b.request.stay.unit)}</td>
                  <td className="is-num">{b.request.stay.guests}</td>
                  <td className="is-num">{money(b.quote.total)}</td>
                  <td>
                    <span className={`adm-status adm-status--${b.status}`}>{b.status}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="adm-table__actions">
                      {(ACTIONS[b.status] ?? []).map((a) => (
                        <button
                          key={a.to}
                          type="button"
                          className="adm-mini"
                          disabled={busyRef === b.reference}
                          onClick={() => move(b.reference, a.to)}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Detail drawer ---- */}
      {detail && (
        <BookingDrawer
          booking={detail}
          unitName={unitName}
          busy={busyRef === detail.reference}
          onMove={move}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

/* ---- Drawer ---- */

function BookingDrawer({
  booking: b,
  unitName,
  busy,
  onMove,
  onClose,
}: {
  booking: Booking;
  unitName(unit: string): string;
  busy: boolean;
  onMove(reference: string, to: BookingStatus): void;
  onClose(): void;
}) {
  const g = b.request.guest;
  const waText = encodeURIComponent(
    `Hello ${g.name.split(" ")[0]}, this is Villa Dolce Vita about your booking request ${b.reference} (${longDate(
      b.request.stay.arrive,
    )} → ${longDate(b.request.stay.depart)}).`,
  );
  const waHref = g.phone ? `https://wa.me/${g.phone.replace(/\D/g, "")}?text=${waText}` : null;
  const mailHref = `mailto:${g.email}?subject=${encodeURIComponent(
    `Villa Dolce Vita — your booking request ${b.reference}`,
  )}`;

  return (
    <>
      <div className="adm-drawer__scrim" onClick={onClose} aria-hidden="true" />
      <aside className="adm-drawer" role="dialog" aria-label={`Booking ${b.reference}`}>
        <header className="adm-drawer__head">
          <div>
            <p className="adm-drawer__ref">{b.reference}</p>
            <span className={`adm-status adm-status--${b.status}`}>{b.status}</span>
          </div>
          <button type="button" className="adm-panel__close" onClick={onClose}>
            Close
          </button>
        </header>

        <h3 className="adm-drawer__guest">{g.name}</h3>
        <p className="adm-drawer__contact">
          {g.email}
          {g.phone ? ` · ${g.phone}` : ""}
        </p>

        <div className="adm-drawer__contactbtns">
          {waHref && (
            <a className="bk-btn adm-drawer__wa" href={waHref} target="_blank" rel="noopener">
              WhatsApp the Guest
            </a>
          )}
          <a className="bk-btn bk-btn--ghost" href={mailHref}>
            Email
          </a>
        </div>

        <dl className="bk-quote__meta adm-drawer__meta">
          <div>
            <dt>Arrival</dt>
            <dd>{longDate(b.request.stay.arrive)}</dd>
          </div>
          <div>
            <dt>Departure</dt>
            <dd>{longDate(b.request.stay.depart)}</dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>{unitName(b.request.stay.unit)}</dd>
          </div>
          <div>
            <dt>Guests</dt>
            <dd>{b.request.stay.guests}</dd>
          </div>
        </dl>

        <ul className="bk-quote__lines">
          {[...b.quote.lines, ...b.quote.extrasLines, ...(b.quote.taxLine ? [b.quote.taxLine] : [])].map((line, i) => (
            <li key={`${line.label}-${i}`} className="bk-quote__line">
              <span className="bk-quote__linelabel">
                {line.label}
                {line.detail && <em>{line.detail}</em>}
              </span>
              <span className="bk-quote__amount">
                {line.amount < 0 ? `−${money(-line.amount)}` : money(line.amount)}
              </span>
            </li>
          ))}
        </ul>
        <div className="bk-quote__total">
          <span>Total</span>
          <span>{money(b.quote.total)}</span>
        </div>
        <div className="bk-quote__deposit">
          <span>Deposit ({b.quote.depositPct}%)</span>
          <span>{money(b.quote.depositDue)}</span>
        </div>

        {g.notes && (
          <p className="adm-drawer__notes">
            <strong>Guest notes</strong>
            {g.notes}
          </p>
        )}
        <p className="adm-drawer__fine">
          Requested {longDate(b.createdAt.slice(0, 10))} · animal notice{" "}
          {g.acceptsAnimals ? "accepted" : "NOT accepted"}
          {b.request.extras.length > 0 && <> · extras: {b.request.extras.join(", ")}</>}
        </p>

        {(ACTIONS[b.status] ?? []).length > 0 && (
          <div className="adm-drawer__actions">
            {(ACTIONS[b.status] ?? []).map((a) => (
              <button
                key={a.to}
                type="button"
                className={`bk-btn${a.to === "cancelled" ? " bk-btn--ghost" : ""}`}
                disabled={busy}
                onClick={() => onMove(b.reference, a.to)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
