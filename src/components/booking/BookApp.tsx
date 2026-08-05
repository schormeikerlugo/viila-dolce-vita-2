/**
 * BookApp — the booking island (/book), a single-view flow.
 *
 * The whole Villa is the only unit, so there are no steps: a fixed Villa
 * header with the live price, the availability calendar (per-day prices),
 * and — right below — the guest's details. One "Send Booking Request" and
 * a confirmation screen. All data/money flow through `api`
 * (src/lib/booking/api.ts): today the mock, tomorrow Supabase.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/booking/api";
import type {
  AvailabilityMap,
  Booking,
  GuestDetails,
  Quote,
  SuiteCardData,
  UnitId,
  UnitOption,
} from "../../lib/booking/types";
import { ESTATE } from "../../lib/booking/types";
import { longDate, money, nightsBetween } from "../../lib/booking/dates";
import AvailabilityCalendar from "./AvailabilityCalendar";
import GuestDetailsForm from "./GuestDetailsForm";
import QuoteSummary from "./QuoteSummary";

interface Props {
  suites: SuiteCardData[];
}

/** Read prefill params from the URL (?arrive=&depart=). */
function readPrefill() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date().toISOString().slice(0, 10);
  const a = p.get("arrive");
  const d = p.get("depart");
  const arrive = a && iso.test(a) && a >= today ? a : null;
  const depart = d && iso.test(d) && arrive && d > arrive ? d : null;
  return { arrive, depart };
}

export default function BookApp({ suites }: Props) {
  const prefill = useRef(readPrefill()).current;
  const rootRef = useRef<HTMLDivElement>(null);

  /* ---- Stay (Villa only; guest count removed → 0) ---- */
  const [arrive, setArrive] = useState<string | null>(prefill.arrive ?? null);
  const [depart, setDepart] = useState<string | null>(prefill.depart ?? null);
  const guests = 0;
  const unit: UnitId = ESTATE;

  /* ---- Availability (merged windows, cached per month) ---- */
  const [occ, setOcc] = useState<AvailabilityMap>({});
  const [occLoading, setOccLoading] = useState(false);
  const fetchedWindows = useRef(new Set<string>());
  const loadRange = useCallback((start: string, end: string) => {
    const key = `${start}:${end}`;
    if (fetchedWindows.current.has(key)) return;
    fetchedWindows.current.add(key);
    setOccLoading(true);
    api
      .getAvailability(start, end)
      .then((map) => setOcc((prev) => ({ ...prev, ...map })))
      .catch((err) => {
        fetchedWindows.current.delete(key);
        console.warn("Availability fetch failed:", err);
      })
      .finally(() => setOccLoading(false));
  }, []);

  /* ---- The Villa priced for the chosen dates ---- */
  const [villaOption, setVillaOption] = useState<UnitOption | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  useEffect(() => {
    if (!arrive || !depart) {
      setVillaOption(null);
      return;
    }
    let alive = true;
    setOptionsLoading(true);
    api
      .getStayOptions({ arrive, depart, guests })
      .then((opts) => {
        if (!alive) return;
        setVillaOption(opts.find((o) => o.unit === ESTATE) ?? opts[0] ?? null);
      })
      .finally(() => alive && setOptionsLoading(false));
    return () => {
      alive = false;
    };
  }, [arrive, depart]);

  /* ---- Promo code ---- */
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null); // applied
  const [promoError, setPromoError] = useState<string | null>(null);

  /* ---- Quote (recomputed by the API on every relevant change) ---- */
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  useEffect(() => {
    if (!arrive || !depart) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let alive = true;
    setQuoteLoading(true);
    setQuoteError(null);
    const stay = { arrive, depart, guests, unit };
    api
      .getQuote(stay, [], promoCode ?? undefined)
      .then((q) => alive && setQuote(q))
      .catch((err) => {
        if (!alive) return;
        const message = err instanceof Error ? err.message : "Could not price this stay.";
        if (promoCode) {
          setPromoCode(null);
          setPromoError(message);
          return;
        }
        setQuote(null);
        setQuoteError(message);
      })
      .finally(() => alive && setQuoteLoading(false));
    return () => {
      alive = false;
    };
  }, [arrive, depart, promoCode]);

  /* ---- Guest & submission ---- */
  const [guest, setGuest] = useState<GuestDetails>({
    name: "",
    email: "",
    phone: "",
    notes: "",
    acceptsAnimals: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  // Capture the lead as soon as we have a plausible email (debounced), so an
  // abandoned booking stays reachable.
  const lastLead = useRef<string>("");
  useEffect(() => {
    const email = guest.email.trim().toLowerCase();
    if (!email.includes("@")) return;
    const t = window.setTimeout(() => {
      const sig = `${email}|${guest.name}|${guest.phone}|${arrive}|${depart}`;
      if (sig === lastLead.current) return;
      lastLead.current = sig;
      void api.captureLead({
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        arrive,
        depart,
      });
    }, 900);
    return () => window.clearTimeout(t);
  }, [guest.email, guest.name, guest.phone, arrive, depart]);

  const nights = arrive && depart ? nightsBetween(arrive, depart) : 0;
  const villaAvailable = villaOption?.available ?? false;
  const detailsValid =
    guest.name.trim().length > 0 && guest.email.includes("@") && guest.acceptsAnimals;
  const canSubmit = Boolean(arrive && depart && quote) && detailsValid && !submitting;

  const submit = () => {
    if (!arrive || !depart || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    api
      .createBooking({
        stay: { arrive, depart, guests, unit },
        extras: [],
        guest,
        promoCode: promoCode ?? undefined,
      })
      .then((b) => {
        setBooking(b);
        if (typeof window !== "undefined") {
          if (window.__lenisScrollTo && rootRef.current) {
            window.__lenisScrollTo(rootRef.current, { offset: -96, duration: 0.8 });
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }
      })
      .catch((err) => setSubmitError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setSubmitting(false));
  };

  /* ---- Confirmation screen ---- */
  if (booking) {
    return (
      <div className="bk-app" ref={rootRef}>
        <div className="bk-done">
          <p className="bk-done__eyebrow">Request Received</p>
          <p className="bk-done__ref">{booking.reference}</p>
          <h2 className="bk-done__title">The Hill Is Holding Your Dates</h2>
          <p className="bk-done__copy">
            Your request for <strong>the entire Villa</strong> —{" "}
            {longDate(booking.request.stay.arrive)} to {longDate(booking.request.stay.depart)} — is
            with the concierge. We confirm personally, by WhatsApp or email, usually within the
            hour. Nothing has been charged.
          </p>
          <dl className="bk-done__meta">
            <div>
              <dt>Total</dt>
              <dd>{money(booking.quote.total)}</dd>
            </div>
            <div>
              <dt>Due at confirmation</dt>
              <dd>{money(booking.quote.depositDue)}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{booking.reference}</dd>
            </div>
          </dl>
          <div className="bk-done__actions">
            <a className="bk-btn" href="/">
              Return to the Villa
            </a>
            <button
              type="button"
              className="bk-btn bk-btn--ghost"
              onClick={() => window.location.reload()}
            >
              Make Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bk-app" ref={rootRef}>
      <VillaHeader
        suites={suites}
        arrive={arrive}
        depart={depart}
        nights={nights}
        option={villaOption}
        loading={optionsLoading}
        available={villaAvailable}
      />

      <div className="bk-layout">
        <div className="bk-main">
          {/* 1 · Dates */}
          <section className="bk-section" aria-label="Choose your dates">
            <h2 className="bk-section__title">
              <span className="bk-section__num">1</span> Choose your dates
            </h2>
            <AvailabilityCalendar
              occ={occ}
              arrive={arrive}
              depart={depart}
              onChange={(a, d) => {
                setArrive(a);
                setDepart(d);
              }}
              onVisibleRange={loadRange}
              loading={occLoading}
            />
          </section>

          {/* 2 · Your details (right below the calendar) */}
          <section className="bk-section" aria-label="Your details">
            <h2 className="bk-section__title">
              <span className="bk-section__num">2</span> Your details
            </h2>
            <GuestDetailsForm value={guest} onChange={setGuest} disabled={submitting} />

            {/* Promo code */}
            <div className="bk-promo">
              <label className="bk-field bk-promo__field">
                <span className="bk-field__label">Promo code</span>
                <input
                  type="text"
                  className="bk-field__input"
                  placeholder="DOLCE10"
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value.toUpperCase());
                    setPromoError(null);
                  }}
                  disabled={submitting || Boolean(quote?.promo?.code)}
                />
              </label>
              {quote?.promo?.code ? (
                <button
                  type="button"
                  className="bk-btn bk-btn--ghost"
                  onClick={() => {
                    setPromoCode(null);
                    setPromoInput("");
                    setPromoError(null);
                  }}
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  className="bk-btn bk-btn--ghost"
                  disabled={!promoInput.trim() || quoteLoading || submitting}
                  onClick={() => {
                    setPromoError(null);
                    setPromoCode(promoInput.trim());
                  }}
                >
                  Apply
                </button>
              )}
            </div>
            {quote?.promo?.code && (
              <p className="bk-promo__ok">
                {quote.promo.name} applied — the discount is in your summary.
              </p>
            )}
            {promoError && <p className="bk-error">{promoError}</p>}
            {submitError && <p className="bk-error">{submitError}</p>}

            <div className="bk-nav bk-nav--end">
              <button type="button" className="bk-btn" onClick={submit} disabled={!canSubmit}>
                {submitting ? "Sending…" : "Send Booking Request"}
              </button>
            </div>
          </section>
        </div>

        <QuoteSummary
          arrive={arrive}
          depart={depart}
          quote={quote}
          requests={[]}
          loading={quoteLoading}
          error={quoteError}
        />
      </div>
    </div>
  );
}

/* ---- Fixed Villa header: one image left, details + live price right ---- */

function VillaHeader({
  suites,
  arrive,
  depart,
  nights,
  option,
  loading,
  available,
}: {
  suites: SuiteCardData[];
  arrive: string | null;
  depart: string | null;
  nights: number;
  option: UnitOption | null;
  loading: boolean;
  available: boolean;
}) {
  const hero = [...suites].sort((a, b) => a.rank - b.rank)[0];

  return (
    <header className="bk-villahead">
      <div className="bk-villahead__media">
        {hero && <img src={hero.image} alt={hero.imageAlt} className="bk-villahead__hero" />}
      </div>

      <div className="bk-villahead__body">
        <span className="bk-villahead__eyebrow">Five suites · Sleeps 15 · The whole estate</span>
        <h2 className="bk-villahead__name">The Entire Villa</h2>
        <p className="bk-villahead__note">
          The hilltop entirely yours — all five suites, the pool and the grounds. Breakfast and
          three chef-cooked dinners a week included. Minimum 3 nights.
        </p>

        <div className="bk-villahead__price">
          {!arrive || !depart ? (
            <span className="bk-villahead__price-muted">Select your dates below</span>
          ) : loading ? (
            <span className="bk-villahead__price-muted">Checking availability…</span>
          ) : available && option?.total != null ? (
            <>
              <span className="bk-villahead__amount">{money(option.total)}</span>
              <span className="bk-villahead__total">
                {nights} {nights === 1 ? "night" : "nights"} · from {money(option.nightly ?? 0)}/night
              </span>
            </>
          ) : (
            <span className="bk-villahead__price-off">
              {option?.reason ?? "Unavailable for these dates"}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
