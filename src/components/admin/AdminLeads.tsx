/**
 * AdminLeads — incomplete submissions: guests who gave their contact details
 * on the booking flow but didn't finish. Lets the owner follow up (WhatsApp /
 * email) so abandoned bookings aren't lost. Converted leads are shown too,
 * for reference, but the default view is the ones still open.
 */
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../../lib/booking/api";
import type { LeadCapture } from "../../lib/booking/types";
import { longDate } from "../../lib/booking/dates";

const FILTERS = ["incomplete", "converted", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminLeads() {
  const [leads, setLeads] = useState<LeadCapture[]>([]);
  const [filter, setFilter] = useState<Filter>("incomplete");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listLeads()
      .then(setLeads)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load leads."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const visible = leads.filter((l) => filter === "all" || l.status === filter);

  const waHref = (l: LeadCapture) =>
    l.phone
      ? `https://wa.me/${l.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
          `Hello${l.name ? " " + l.name.split(" ")[0] : ""}, this is Villa Dolce Vita — we saw you were looking at dates and wanted to help you finish your booking.`,
        )}`
      : null;
  const mailHref = (l: LeadCapture) =>
    `mailto:${l.email}?subject=${encodeURIComponent("Your Villa Dolce Vita enquiry")}`;

  const dates = (l: LeadCapture) =>
    l.arrive && l.depart ? `${longDate(l.arrive)} → ${longDate(l.depart)}` : "—";

  return (
    <section className="adm-leads" aria-label="Leads">
      <div className="adm-toolbar">
        <p className="adm-leads__intro">
          Contact details captured before a booking was completed — follow up before they slip
          away.
        </p>
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
          {filter === "incomplete"
            ? "No incomplete submissions — everyone who started finished, or none have started yet."
            : `No ${filter} leads.`}
        </p>
      ) : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Contact</th>
                <th>Dates</th>
                <th>Captured</th>
                <th>Status</th>
                <th>Follow up</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id}>
                  <td className="adm-table__ref">{l.name ?? "—"}</td>
                  <td>
                    {l.email}
                    {l.phone && <em>{l.phone}</em>}
                  </td>
                  <td>{dates(l)}</td>
                  <td>
                    {longDate(l.updatedAt.slice(0, 10))}
                  </td>
                  <td>
                    <span
                      className={`adm-status adm-status--${
                        l.status === "converted" ? "confirmed" : "requested"
                      }`}
                    >
                      {l.status === "converted" ? `booked · ${l.reference ?? ""}` : "incomplete"}
                    </span>
                  </td>
                  <td>
                    <div className="adm-table__actions">
                      {waHref(l) && (
                        <a className="adm-mini" href={waHref(l)!} target="_blank" rel="noopener">
                          WhatsApp
                        </a>
                      )}
                      <a className="adm-mini" href={mailHref(l)}>
                        Email
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
