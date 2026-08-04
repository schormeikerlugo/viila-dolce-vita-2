/**
 * AdminOverview — the panel's landing screen: what needs attention today.
 * A row of KPIs (didone figures over hairlines), the pending-request queue
 * with one-click confirm/cancel, and the next fortnight of arrivals and
 * departures. One RPC call (`get_dashboard_stats`) feeds everything.
 */
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../../lib/booking/api";
import type { DashboardStats } from "../../lib/booking/types";
import { longDate, money } from "../../lib/booking/dates";
import type { SuiteMeta } from "./AdminApp";
import CopyButton from "./CopyButton";

interface Props {
  suites: SuiteMeta[];
}

export default function AdminOverview({ suites }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi
      .getDashboardStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load."));
  }, []);

  useEffect(load, [load]);

  const unitName = (unit: string) =>
    unit === "estate" ? "Entire Villa" : (suites.find((s) => s.slug === unit)?.name ?? unit);

  const decide = (reference: string, status: "confirmed" | "cancelled") => {
    setBusyRef(reference);
    setError(null);
    adminApi
      .setBookingStatus(reference, status)
      .then(load)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setBusyRef(null));
  };

  if (error && !stats) return <p className="bk-error">{error}</p>;
  if (!stats) return <p className="adm-empty">Loading…</p>;

  const monthName = new Date(`${stats.monthStart}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    timeZone: "UTC",
  });

  const kpis = [
    { label: "Pending requests", value: String(stats.pendingRequests), accent: stats.pendingRequests > 0 },
    { label: "Arrivals · next 7 days", value: String(stats.arrivalsNext7) },
    { label: `Occupancy · ${monthName}`, value: `${stats.occupancyMonthPct}%` },
    { label: `Revenue · ${monthName}`, value: money(stats.revenueMonth) },
    { label: "Pipeline (requested)", value: money(stats.pipelineValue) },
    { label: "Avg. booking value", value: money(stats.avgBookingValue) },
  ];

  return (
    <section className="adm-over" aria-label="Overview">
      {/* ---- KPIs ---- */}
      <div className="adm-kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`adm-kpi${k.accent ? " is-accent" : ""}`}>
            <span className="adm-kpi__value">{k.value}</span>
            <span className="adm-kpi__label">{k.label}</span>
          </div>
        ))}
      </div>

      {error && <p className="bk-error">{error}</p>}

      {/* ---- Needs attention ---- */}
      <div className="adm-block">
        <h3 className="adm-sectiontitle">Needs attention</h3>
        {stats.needsAttention.length === 0 ? (
          <p className="adm-empty">Nothing waiting — every request is answered.</p>
        ) : (
          <ul className="adm-queue">
          {stats.needsAttention.map((b) => (
            <li key={b.reference} className="adm-queue__item">
              <div className="adm-queue__who">
                <strong>{b.guest}</strong>
                <span className="adm-queue__contact">
                  <span className="adm-copyable">
                    {b.reference}
                    <CopyButton value={b.reference} label="Copy reference" />
                  </span>
                  <span className="adm-copyable">
                    {b.email}
                    <CopyButton value={b.email} label="Copy email" />
                  </span>
                  {b.phone && (
                    <span className="adm-copyable">
                      {b.phone}
                      <CopyButton value={b.phone} label="Copy phone" />
                    </span>
                  )}
                </span>
              </div>
              <div className="adm-queue__stay">
                {unitName(b.unit)}
                <em>
                  {longDate(b.arrive)} → {longDate(b.depart)}
                </em>
              </div>
              <span className="adm-queue__total">{money(b.total)}</span>
              <div className="adm-queue__actions">
                <button
                  type="button"
                  className="adm-mini"
                  disabled={busyRef === b.reference}
                  onClick={() => decide(b.reference, "confirmed")}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="adm-mini"
                  disabled={busyRef === b.reference}
                  onClick={() => decide(b.reference, "cancelled")}
                >
                  Cancel
                </button>
              </div>
            </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- Arrivals & departures ---- */}
      <div className="adm-move">
        <div className="adm-block">
          <h3 className="adm-sectiontitle">Arrivals · next 14 days</h3>
          <MovementList rows={stats.arrivals} unitName={unitName} empty="No arrivals scheduled." />
        </div>
        <div className="adm-block">
          <h3 className="adm-sectiontitle">Departures · next 14 days</h3>
          <MovementList
            rows={stats.departures}
            unitName={unitName}
            empty="No departures scheduled."
          />
        </div>
      </div>
    </section>
  );
}

function MovementList({
  rows,
  unitName,
  empty,
}: {
  rows: DashboardStats["arrivals"];
  unitName(unit: string): string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="adm-empty">{empty}</p>;
  return (
    <div className="adm-movecard">
      <ul className="adm-movelist">
        {rows.map((r) => (
          <li key={`${r.reference}-${r.date}`}>
            <span className="adm-movelist__date">{longDate(r.date)}</span>
            <span className="adm-movelist__who">
              {r.guest}
              <em>
                {unitName(r.unit)} · {r.guests} {r.guests === 1 ? "guest" : "guests"}
                {r.phone ? ` · ${r.phone}` : ""}
              </em>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
