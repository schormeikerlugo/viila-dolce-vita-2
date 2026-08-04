/**
 * AdminPromotions — code-based offers ("DOLCE10") and automatic ones
 * (no code: they apply by themselves when a stay qualifies). Discounts hit
 * the accommodation subtotal only, computed server-side inside the quote.
 */
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../../lib/booking/api";
import type { Promotion, PromotionInput, SuiteSlug } from "../../lib/booking/types";
import { longDate, money } from "../../lib/booking/dates";
import type { SuiteMeta } from "./AdminApp";

interface Props {
  suites: SuiteMeta[];
}

const EMPTY: PromotionInput = {
  code: null,
  name: "",
  kind: "percent",
  value: 10,
  suite: null,
  stayStart: null,
  stayEnd: null,
  bookStart: null,
  bookEnd: null,
  minNights: 1,
  usageLimit: null,
  active: true,
};

export default function AdminPromotions({ suites }: Props) {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PromotionInput>(EMPTY);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listPromotions()
      .then(setPromos)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const run = (op: () => Promise<unknown>, id: string | null = null) => {
    setBusyId(id ?? "form");
    setError(null);
    op()
      .then(() => {
        setCreating(false);
        setForm(EMPTY);
        load();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setBusyId(null));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Give the offer a name.");
      return;
    }
    run(() => adminApi.createPromotion(form));
  };

  const suiteName = (slug: SuiteSlug | null) =>
    slug === null ? "All suites & estate" : (suites.find((s) => s.slug === slug)?.name ?? slug);

  const windowText = (start: string | null, end: string | null) =>
    !start && !end
      ? "Always"
      : `${start ? longDate(start) : "…"} → ${end ? longDate(end) : "…"}`;

  return (
    <section className="adm-promos" aria-label="Promotions">
      <div className="adm-cal__bar">
        <h2 className="adm-cal__title">Promotions</h2>
        <button
          type="button"
          className="bk-btn"
          onClick={() => {
            setCreating((c) => !c);
            setError(null);
          }}
        >
          {creating ? "Close" : "New Promotion"}
        </button>
      </div>

      {error && <p className="bk-error">{error}</p>}

      {/* ---- Create form ---- */}
      {creating && (
        <form className="adm-promoform" onSubmit={submit}>
          <div className="adm-promoform__grid">
            <label className="bk-field">
              <span className="bk-field__label">Name *</span>
              <input
                type="text"
                className="bk-field__input"
                placeholder="Autumn Escape"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="bk-field">
              <span className="bk-field__label">Code (blank = automatic)</span>
              <input
                type="text"
                className="bk-field__input"
                placeholder="DOLCE10"
                value={form.code ?? ""}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() || null })}
              />
            </label>
            <label className="bk-field">
              <span className="bk-field__label">Discount</span>
              <div className="adm-promoform__pair">
                <input
                  type="number"
                  min={1}
                  className="bk-field__input"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: Math.max(1, Number(e.target.value) || 1) })}
                />
                <select
                  className="bk-field__input"
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as "percent" | "fixed" })}
                >
                  <option value="percent">% off</option>
                  <option value="fixed">€ off</option>
                </select>
              </div>
            </label>
            <label className="bk-field">
              <span className="bk-field__label">Applies to</span>
              <select
                className="bk-field__input"
                value={form.suite ?? ""}
                onChange={(e) => setForm({ ...form, suite: (e.target.value || null) as SuiteSlug | null })}
              >
                <option value="">All suites & estate</option>
                {suites.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="bk-field">
              <span className="bk-field__label">Stay from</span>
              <input
                type="date"
                className="bk-field__input"
                value={form.stayStart ?? ""}
                onChange={(e) => setForm({ ...form, stayStart: e.target.value || null })}
              />
            </label>
            <label className="bk-field">
              <span className="bk-field__label">Stay until (check-out)</span>
              <input
                type="date"
                className="bk-field__input"
                value={form.stayEnd ?? ""}
                onChange={(e) => setForm({ ...form, stayEnd: e.target.value || null })}
              />
            </label>
            <label className="bk-field">
              <span className="bk-field__label">Min. nights</span>
              <input
                type="number"
                min={1}
                className="bk-field__input"
                value={form.minNights}
                onChange={(e) =>
                  setForm({ ...form, minNights: Math.max(1, Math.round(Number(e.target.value) || 1)) })
                }
              />
            </label>
            <label className="bk-field">
              <span className="bk-field__label">Usage limit (blank = unlimited)</span>
              <input
                type="number"
                min={1}
                className="bk-field__input"
                value={form.usageLimit ?? ""}
                onChange={(e) =>
                  setForm({ ...form, usageLimit: e.target.value ? Math.max(1, Number(e.target.value)) : null })
                }
              />
            </label>
          </div>
          <p className="adm-panel__hint">
            The discount applies to accommodation only (never extras or tax). Without a code the
            offer applies automatically to every qualifying stay; with one, guests type it at
            checkout.
          </p>
          <button type="submit" className="bk-btn" disabled={busyId === "form"}>
            {busyId === "form" ? "Creating…" : "Create Promotion"}
          </button>
        </form>
      )}

      {/* ---- List ---- */}
      {loading ? (
        <p className="adm-empty">Loading…</p>
      ) : promos.length === 0 ? (
        <p className="adm-empty">No promotions yet — create the first offer above.</p>
      ) : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Offer</th>
                <th>Code</th>
                <th className="is-num">Discount</th>
                <th>Applies to</th>
                <th>Stay window</th>
                <th className="is-num">Min. nights</th>
                <th className="is-num">Used</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className={p.active ? "" : "adm-promo--off"}>
                  <td className="adm-table__ref">{p.name}</td>
                  <td>{p.code ?? <em>Automatic</em>}</td>
                  <td className="is-num">
                    {p.kind === "percent" ? `−${p.value}%` : `−${money(p.value)}`}
                  </td>
                  <td>{suiteName(p.suite)}</td>
                  <td>{windowText(p.stayStart, p.stayEnd)}</td>
                  <td className="is-num">{p.minNights}</td>
                  <td className="is-num">
                    {p.used}
                    {p.usageLimit !== null ? ` / ${p.usageLimit}` : ""}
                  </td>
                  <td>
                    <span className={`adm-status ${p.active ? "adm-status--confirmed" : ""}`}>
                      {p.active ? "active" : "paused"}
                    </span>
                  </td>
                  <td>
                    <div className="adm-table__actions">
                      <button
                        type="button"
                        className="adm-mini"
                        disabled={busyId === p.id}
                        onClick={() =>
                          run(() => adminApi.updatePromotion(p.id, { active: !p.active }), p.id)
                        }
                      >
                        {p.active ? "Pause" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className="adm-mini"
                        disabled={busyId === p.id}
                        onClick={() => run(() => adminApi.deletePromotion(p.id), p.id)}
                      >
                        Delete
                      </button>
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
