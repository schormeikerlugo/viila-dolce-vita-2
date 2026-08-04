/**
 * BookApp — the booking wizard island (/book).
 *
 * Four steps — Dates → Suite → Extras → Details — with a sticky quote rail.
 * All data and money flow through `api` (src/lib/booking/api.ts): today the
 * mock, tomorrow Supabase, zero changes here.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/booking/api";
import type {
  AvailabilityMap,
  Booking,
  Extra,
  GuestDetails,
  Quote,
  SuiteCardData,
  UnitId,
  UnitOption,
} from "../../lib/booking/types";
import { ESTATE } from "../../lib/booking/types";
import { longDate, money, nightsBetween } from "../../lib/booking/dates";
import AvailabilityCalendar from "./AvailabilityCalendar";
import ExtrasPicker from "./ExtrasPicker";
import GuestDetailsForm from "./GuestDetailsForm";
import QuoteSummary from "./QuoteSummary";

const STEPS = ["Dates", "Extras", "Details"] as const;
const STEP_META = [
  { title: "When would you like to stay?", copy: "The whole Villa is yours — pick your dates and party size, and we'll price the stay for you." },
  { title: "Shape your stay", copy: "Add anything that makes it yours — or continue with what's included." },
  { title: "Almost there", copy: "A few details and your request is on its way to the concierge." },
] as const;
const MAX_GUESTS = 15;
/** Index of the confirmation screen (one past the last real step). */
const DONE_STEP = STEPS.length; // 3

interface Props {
  suites: SuiteCardData[];
}

/** Read prefill params from the URL (?suite=&arrive=&depart=&guests=). */
function readPrefill(suites: SuiteCardData[]) {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date().toISOString().slice(0, 10);
  const suiteParam = p.get("suite");
  const validSuite =
    suiteParam && (suiteParam === ESTATE || suites.some((s) => s.slug === suiteParam))
      ? (suiteParam as UnitId)
      : null;
  const a = p.get("arrive");
  const d = p.get("depart");
  const g = Number(p.get("guests"));
  const arrive = a && iso.test(a) && a >= today ? a : null;
  const depart = d && iso.test(d) && arrive && d > arrive ? d : null;
  return {
    suite: validSuite,
    arrive,
    depart,
    guests: Number.isInteger(g) && g >= 1 && g <= MAX_GUESTS ? g : undefined,
  };
}

export default function BookApp({ suites }: Props) {
  const prefill = useRef(readPrefill(suites)).current;
  const rootRef = useRef<HTMLDivElement>(null);

  /* ---- Wizard position ---- */
  const [step, setStep] = useState(0); // 0..2, 3 = confirmation

  /* ---- Stay (URL-prefilled where valid) ---- */
  // The whole Villa is the only bookable unit, so `unit` is always ESTATE.
  const [arrive, setArrive] = useState<string | null>(prefill.arrive ?? null);
  const [depart, setDepart] = useState<string | null>(prefill.depart ?? null);
  const [guests, setGuests] = useState(prefill.guests ?? 2);
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
        // Never let a failed availability fetch wedge the calendar: on error
        // we simply treat the window as fully free (days stay clickable) and
        // allow a retry next time it's requested.
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
  }, [arrive, depart, guests]);

  /* ---- Extras catalog ---- */
  const [extras, setExtras] = useState<Extra[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  useEffect(() => {
    api.getExtras().then(setExtras);
  }, []);
  const toggleExtra = (id: string) =>
    setSelectedExtras((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const requestNames = selectedExtras
    .map((id) => extras.find((e) => e.id === id))
    .filter((e): e is Extra => Boolean(e?.inquireOnly))
    .map((e) => e.name);

  /* ---- Promo code ---- */
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null); // applied
  const [promoError, setPromoError] = useState<string | null>(null);

  /* ---- Quote (recomputed by the API on every relevant change) ---- */
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  useEffect(() => {
    if (!arrive || !depart || !unit) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let alive = true;
    setQuoteLoading(true);
    setQuoteError(null);
    const stay = { arrive, depart, guests, unit };
    api
      .getQuote(stay, selectedExtras, promoCode ?? undefined)
      .then((q) => alive && setQuote(q))
      .catch(async (err) => {
        if (!alive) return;
        const message = err instanceof Error ? err.message : "Could not price this stay.";
        // An invalid code shouldn't kill the whole quote: retry without it
        // and surface the message on the promo field instead.
        if (promoCode) {
          setPromoCode(null);
          setPromoError(message);
          return; // effect re-runs without the code
        }
        setQuote(null);
        setQuoteError(message);
      })
      .finally(() => alive && setQuoteLoading(false));
    return () => {
      alive = false;
    };
  }, [arrive, depart, guests, unit, selectedExtras, promoCode]);

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

  const submit = () => {
    if (!arrive || !depart || !unit) return;
    setSubmitting(true);
    setSubmitError(null);
    api
      .createBooking({
        stay: { arrive, depart, guests, unit },
        extras: selectedExtras,
        guest,
        promoCode: promoCode ?? undefined,
      })
      .then((b) => {
        setBooking(b);
        setStep(DONE_STEP);
        scrollToWizardTop();
      })
      .catch((err) =>
        setSubmitError(err instanceof Error ? err.message : "Something went wrong."),
      )
      .finally(() => setSubmitting(false));
  };

  /* ---- Derived ---- */
  const villaAvailable = villaOption?.available ?? false;

  /* ---- Step gating ---- */
  // Step 0 = Dates (needs a valid, priced, available Villa stay);
  // Step 1 = Extras (always continuable); Step 2 = Details (submits).
  const nights = arrive && depart ? nightsBetween(arrive, depart) : 0;
  const canContinue =
    step === 0
      ? Boolean(arrive && depart && quote)
      : step === 1
        ? Boolean(quote)
        : false;

  /**
   * Scroll back to the top of the wizard on step change. The site runs Lenis
   * (smooth-scroll), which owns the scroll position and ignores the native
   * window.scrollTo — so we use the Lenis-aware helper, with a small offset
   * so the stepper isn't jammed under the fixed nav. Falls back to native.
   */
  const scrollToWizardTop = () => {
    const doScroll = () => {
      const el = rootRef.current;
      if (typeof window !== "undefined" && window.__lenisScrollTo && el) {
        window.__lenisScrollTo(el, { offset: -96, duration: 0.8 });
      } else if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: y, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    // Two frames: the first lets React commit the new (shorter/taller) step to
    // the DOM, the second lets the browser lay it out — so Lenis measures the
    // final document height before scrolling. A single rAF fires too early for
    // the short Extras step, which is why step 3 didn't settle at the top.
    requestAnimationFrame(() => requestAnimationFrame(doScroll));
  };

  const goto = (target: number) => {
    if (target < step) {
      setStep(target);
      scrollToWizardTop();
    }
  };
  const next = () => {
    if (canContinue && step < STEPS.length - 1) {
      setStep(step + 1);
      scrollToWizardTop();
    }
  };

  /* ---- Confirmation screen ---- */
  if (step === DONE_STEP && booking) {
    return (
      <div className="bk-app" ref={rootRef}>
        <div className="bk-done">
          <p className="bk-done__eyebrow">Request Received</p>
          <p className="bk-done__ref">{booking.reference}</p>
          <h2 className="bk-done__title">The Hill Is Holding Your Dates</h2>
          <p className="bk-done__copy">
            Your request for{" "}
            <strong>
              {booking.request.stay.unit === ESTATE
                ? "the entire Villa"
                : suites.find((s) => s.slug === booking.request.stay.unit)?.name}
            </strong>{" "}
            — {longDate(booking.request.stay.arrive)} to {longDate(booking.request.stay.depart)},{" "}
            {booking.request.stay.guests} {booking.request.stay.guests === 1 ? "guest" : "guests"}{" "}
            — is with the concierge. We confirm personally, by WhatsApp or email, usually within
            the hour. Nothing has been charged.
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
      {/* Step rail — numbered circles joined by a progress line. */}
      <ol
        className="bk-steps"
        style={{ "--bk-progress": step / (STEPS.length - 1) } as React.CSSProperties}
      >
        {STEPS.map((label, i) => {
          const state = i < step ? "is-done" : i === step ? "is-current" : "is-todo";
          return (
            <li key={label} className={`bk-steps__item ${state}`}>
              <button
                type="button"
                onClick={() => goto(i)}
                disabled={i >= step}
                aria-current={i === step ? "step" : undefined}
              >
                <span className="bk-steps__dot" aria-hidden="true">
                  {i < step ? (
                    <svg viewBox="0 0 24 24" className="bk-steps__check" fill="none">
                      <path
                        d="M5 12.5l4.5 4.5L19 7"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span className="bk-steps__num">{i + 1}</span>
                  )}
                </span>
                <span className="bk-steps__label">
                  <span className="bk-steps__eyebrow">
                    {i < step ? "Done" : i === step ? "Step " + (i + 1) : "Step " + (i + 1)}
                  </span>
                  <span className="bk-steps__name">{label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="bk-layout">
        <div className="bk-main">
          {step < DONE_STEP && (
            <header className="bk-stephead" key={step}>
              <p className="bk-stephead__eyebrow">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="bk-stephead__title">{STEP_META[step].title}</h2>
              <p className="bk-stephead__copy">{STEP_META[step].copy}</p>
            </header>
          )}

          {step === 0 && (
            <section aria-label="Choose your dates">
              <div className="bk-guestrow">
                <p className="bk-guestrow__label">Guests</p>
                <div className="bk-stepper">
                  <button
                    type="button"
                    onClick={() => setGuests((g) => Math.max(1, g - 1))}
                    aria-label="Fewer guests"
                    disabled={guests <= 1}
                  >
                    −
                  </button>
                  <span aria-live="polite">{guests}</span>
                  <button
                    type="button"
                    onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))}
                    aria-label="More guests"
                    disabled={guests >= MAX_GUESTS}
                  >
                    +
                  </button>
                </div>
              </div>

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

              {/* The whole Villa, priced for the chosen dates. */}
              {arrive && depart && (
                <div className="bk-villa" aria-live="polite">
                  <div className="bk-villa__body">
                    <span className="bk-villa__eyebrow">Five suites · Sleeps 15 · The whole estate</span>
                    <h3 className="bk-villa__name">The Entire Villa</h3>
                    <p className="bk-villa__sub">
                      {longDate(arrive)} → {longDate(depart)} · {nights}{" "}
                      {nights === 1 ? "night" : "nights"} · {guests}{" "}
                      {guests === 1 ? "guest" : "guests"}
                    </p>

                    {optionsLoading ? (
                      <p className="bk-villa__price bk-villa__price--muted">Checking availability…</p>
                    ) : villaAvailable && villaOption?.nightly != null && villaOption?.total != null ? (
                      <p className="bk-villa__price">
                        {money(villaOption.nightly)} <em>/ night</em>
                        <span className="bk-villa__total">
                          {money(villaOption.total)} · {nights} {nights === 1 ? "night" : "nights"}
                        </span>
                      </p>
                    ) : (
                      <p className="bk-villa__price bk-villa__price--off">
                        {villaOption?.reason ?? "Unavailable for these dates"}
                      </p>
                    )}

                    <p className="bk-villa__note">
                      Minimum 3 nights · from €3,000. Breakfast and three chef-cooked dinners a
                      week are included; add anything else in the next step.
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {step === 1 && (
            <section aria-label="Add to your stay">
              <ExtrasPicker extras={extras} selected={selectedExtras} onToggle={toggleExtra} />
            </section>
          )}

          {step === 2 && (
            <section aria-label="Your details">
              <GuestDetailsForm value={guest} onChange={setGuest} disabled={submitting} />

              {/* Promo code — validated by the API; the discount lands in
                  the quote rail as its own line. */}
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
            </section>
          )}

          {/* Footer nav */}
          <div className="bk-nav">
            {step > 0 ? (
              <button type="button" className="bk-btn bk-btn--ghost" onClick={() => goto(step - 1)}>
                ← Back
              </button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="bk-btn" onClick={next} disabled={!canContinue}>
                Continue →
              </button>
            ) : (
              <button
                type="button"
                className="bk-btn"
                onClick={submit}
                disabled={submitting || !quote}
              >
                {submitting ? "Sending…" : "Send Booking Request"}
              </button>
            )}
          </div>
        </div>

        <QuoteSummary
          arrive={arrive}
          depart={depart}
          guests={guests}
          unit={unit}
          suites={suites}
          quote={quote}
          requests={requestNames}
          loading={quoteLoading}
          error={quoteError}
        />
      </div>
    </div>
  );
}
