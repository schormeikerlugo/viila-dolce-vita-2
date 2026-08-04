/**
 * QuoteSummary — the sticky price rail. Renders whatever the API computed:
 * accommodation lines, extras, total and the deposit due, under the stay
 * dates. The Villa is the only unit, so no suite/guest row is needed.
 */
import type { Quote } from "../../lib/booking/types";
import { longDate, money } from "../../lib/booking/dates";

interface Props {
  arrive: string | null;
  depart: string | null;
  quote: Quote | null;
  /** Inquire-only extras selected (listed without prices). */
  requests: string[];
  loading?: boolean;
  error?: string | null;
}

export default function QuoteSummary({
  arrive,
  depart,
  quote,
  requests,
  loading = false,
  error = null,
}: Props) {
  return (
    <aside className={`bk-quote${loading ? " is-loading" : ""}`} aria-live="polite">
      <p className="bk-quote__eyebrow">Your Stay</p>

      <dl className="bk-quote__meta">
        <div>
          <dt>Arrival</dt>
          <dd>{arrive ? longDate(arrive) : "—"}</dd>
        </div>
        <div>
          <dt>Departure</dt>
          <dd>{depart ? longDate(depart) : "—"}</dd>
        </div>
      </dl>

      {error && <p className="bk-quote__error">{error}</p>}

      {!quote && !error && (
        <p className="bk-quote__hint">
          {arrive && depart ? "Pricing your stay…" : "Select your dates to begin."}
        </p>
      )}

      {quote && (
        <>
          <ul className="bk-quote__lines">
            {[...quote.lines, ...quote.extrasLines, ...(quote.taxLine ? [quote.taxLine] : [])].map((line, i) => (
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
            <span>{money(quote.total)}</span>
          </div>
          <div className="bk-quote__deposit">
            <span>Due at confirmation ({quote.depositPct}%)</span>
            <span>{money(quote.depositDue)}</span>
          </div>

          {requests.length > 0 && (
            <p className="bk-quote__requests">
              Requested with the concierge: {requests.join(", ")}.
            </p>
          )}

          <p className="bk-quote__fine">
            Breakfast and three weekly chef dinners included. Tourist tax as set by the
            municipality. Nothing is charged online today — the concierge confirms your
            request personally.
          </p>
        </>
      )}
    </aside>
  );
}
