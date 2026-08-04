/**
 * AdminRates — the money screen: nightly rates per suite, season
 * multipliers and minimum stays, extra prices, deposit and tourist tax.
 * Edits persist through the admin API (mock: localStorage; real: Supabase)
 * and reprice the guest flow instantly.
 */
import { useEffect, useState } from "react";
import { adminApi } from "../../lib/booking/api";
import type { RatesConfig } from "../../lib/booking/types";

export default function AdminRates() {
  const [cfg, setCfg] = useState<RatesConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getRates().then(setCfg);
  }, []);

  if (!cfg) return <p className="adm-empty">Loading…</p>;

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const save = () => {
    setSaving(true);
    setFlash(null);
    adminApi
      .saveRates(cfg)
      .then((saved) => {
        setCfg(saved);
        setFlash("Saved — the guest flow now prices with these values.");
      })
      .finally(() => setSaving(false));
  };

  const reset = () => {
    setSaving(true);
    setFlash(null);
    adminApi
      .resetRates()
      .then((fresh) => {
        setCfg(fresh);
        setFlash("Back to the seed defaults.");
      })
      .finally(() => setSaving(false));
  };

  return (
    <section className="adm-rates" aria-label="Rates and extras">
      <div className="adm-cal__bar">
        <h2 className="adm-cal__title">Rates & Extras</h2>
        <div className="adm-rates__actions">
          <button type="button" className="bk-btn bk-btn--ghost" onClick={reset} disabled={saving}>
            Reset to Defaults
          </button>
          <button type="button" className="bk-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {flash && <p className="adm-flash">{flash}</p>}

      {/* ---- The Villa ---- */}
      <h3 className="adm-rates__sub">The Villa</h3>
      <div className="adm-rates__pair">
        <label className="bk-field">
          <span className="bk-field__label">Nightly rate (€)</span>
          <input
            type="number"
            min={0}
            className="bk-field__input"
            value={cfg.villaNightlyRate}
            onChange={(e) =>
              setCfg({ ...cfg, villaNightlyRate: num(e.target.value, cfg.villaNightlyRate) })
            }
          />
        </label>
        <label className="bk-field">
          <span className="bk-field__label">Minimum nights</span>
          <input
            type="number"
            min={1}
            className="bk-field__input"
            value={cfg.villaMinNights}
            onChange={(e) =>
              setCfg({
                ...cfg,
                villaMinNights: Math.max(1, Math.round(num(e.target.value, cfg.villaMinNights))),
              })
            }
          />
        </label>
        <label className="bk-field">
          <span className="bk-field__label">Minimum booking total (€)</span>
          <input
            type="number"
            min={0}
            className="bk-field__input"
            value={cfg.minBookingTotal}
            onChange={(e) =>
              setCfg({ ...cfg, minBookingTotal: num(e.target.value, cfg.minBookingTotal) })
            }
          />
        </label>
      </div>
      <p className="adm-rates__hint">
        The whole Villa is the only bookable unit — the five suites below are included. The
        nightly rate is multiplied by each night's season; stays are floored to the minimum
        booking total.
      </p>
      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Included suite</th>
              <th className="is-num">Sleeps</th>
            </tr>
          </thead>
          <tbody>
            {cfg.suites.map((s) => (
              <tr key={s.slug}>
                <td className="adm-table__ref">{s.slug}</td>
                <td className="is-num">{s.sleeps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- Seasons ---- */}
      <h3 className="adm-rates__sub">Seasons</h3>
      <div className="adm-tablewrap">
        <table className="adm-table adm-table--edit">
          <thead>
            <tr>
              <th>Season</th>
              <th>Dates</th>
              <th className="is-num">Rate multiplier</th>
              <th className="is-num">Minimum nights</th>
            </tr>
          </thead>
          <tbody>
            {cfg.seasons.map((s, i) => (
              <tr key={s.id}>
                <td className="adm-table__ref">{s.name}</td>
                <td>
                  {s.from} → {s.to}
                </td>
                <td className="is-num">
                  <input
                    type="number"
                    min={0}
                    step={0.05}
                    value={s.multiplier}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        seasons: cfg.seasons.map((x, j) =>
                          j === i ? { ...x, multiplier: num(e.target.value, x.multiplier) } : x,
                        ),
                      })
                    }
                  />
                </td>
                <td className="is-num">
                  <input
                    type="number"
                    min={1}
                    value={s.minNights}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        seasons: cfg.seasons.map((x, j) =>
                          j === i
                            ? { ...x, minNights: Math.max(1, Math.round(num(e.target.value, x.minNights))) }
                            : x,
                        ),
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- Extras ---- */}
      <h3 className="adm-rates__sub">Extras</h3>
      <div className="adm-tablewrap">
        <table className="adm-table adm-table--edit">
          <thead>
            <tr>
              <th>Extra</th>
              <th>Charged</th>
              <th className="is-num">Price (€)</th>
            </tr>
          </thead>
          <tbody>
            {cfg.extras.map((x, i) => (
              <tr key={x.id}>
                <td className="adm-table__ref">{x.name}</td>
                <td>{x.inquireOnly ? "on request" : x.priceType.replaceAll("_", " ")}</td>
                <td className="is-num">
                  {x.inquireOnly ? (
                    "—"
                  ) : (
                    <input
                      type="number"
                      min={0}
                      value={x.price}
                      onChange={(e) =>
                        setCfg({
                          ...cfg,
                          extras: cfg.extras.map((y, j) =>
                            j === i ? { ...y, price: num(e.target.value, y.price) } : y,
                          ),
                        })
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- Payment & tax ---- */}
      <h3 className="adm-rates__sub">Payment & tax</h3>
      <div className="adm-rates__pair">
        <label className="bk-field">
          <span className="bk-field__label">Deposit at confirmation (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            className="bk-field__input"
            value={cfg.depositPct}
            onChange={(e) => setCfg({ ...cfg, depositPct: num(e.target.value, cfg.depositPct) })}
          />
        </label>
        <label className="bk-field">
          <span className="bk-field__label">Tourist tax (€ / person / night)</span>
          <input
            type="number"
            min={0}
            step={0.5}
            className="bk-field__input"
            value={cfg.touristTaxPerPersonNight}
            onChange={(e) =>
              setCfg({
                ...cfg,
                touristTaxPerPersonNight: num(e.target.value, cfg.touristTaxPerPersonNight),
              })
            }
          />
        </label>
        <label className="bk-field">
          <span className="bk-field__label">Tax capped after (nights)</span>
          <input
            type="number"
            min={1}
            className="bk-field__input"
            value={cfg.touristTaxMaxNights}
            onChange={(e) =>
              setCfg({
                ...cfg,
                touristTaxMaxNights: Math.max(
                  1,
                  Math.round(num(e.target.value, cfg.touristTaxMaxNights)),
                ),
              })
            }
          />
        </label>
      </div>
    </section>
  );
}
