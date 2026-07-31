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
import SuitePicker from "./SuitePicker";
import ExtrasPicker from "./ExtrasPicker";
import GuestDetailsForm from "./GuestDetailsForm";
import QuoteSummary from "./QuoteSummary";

const STEPS = ["Dates", "Suite", "Extras", "Details"] as const;
const MAX_GUESTS = 15;

interface Props {
  suites: SuiteCardData[];
}

export default function BookApp({ suites }: Props) {
  /* ---- Wizard position ---- */
  const [step, setStep] = useState(0); // 0..3, 4 = confirmation

  /* ---- Stay ---- */
  const [arrive, setArrive] = useState<string | null>(null);
  const [depart, setDepart] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [unit, setUnit] = useState<UnitId | null>(null);

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
      .finally(() => setOccLoading(false));
  }, []);

  /* ---- Options for the chosen dates ---- */
  const [options, setOptions] = useState<UnitOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  useEffect(() => {
    if (!arrive || !depart) return;
    let alive = true;
    setOptionsLoading(true);
    api
      .getStayOptions({ arrive, depart, guests })
      .then((opts) => {
        if (!alive) return;
        setOptions(opts);
        // Drop the selection if it became unavailable (dates/guests changed).
        setUnit((u) => (u && !opts.find((o) => o.unit === u)?.available ? null : u));
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
    api
      .getQuote({ arrive, depart, guests, unit }, selectedExtras)
      .then((q) => alive && setQuote(q))
      .catch((err) => {
        if (!alive) return;
        setQuote(null);
        setQuoteError(err instanceof Error ? err.message : "Could not price this stay.");
      })
      .finally(() => alive && setQuoteLoading(false));
    return () => {
      alive = false;
    };
  }, [arrive, depart, guests, unit, selectedExtras]);

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
      })
      .then((b) => {
        setBooking(b);
        setStep(4);
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch((err) =>
        setSubmitError(err instanceof Error ? err.message : "Something went wrong."),
      )
      .finally(() => setSubmitting(false));
  };

  /* ---- Step gating ---- */
  const nights = arrive && depart ? nightsBetween(arrive, depart) : 0;
  const canContinue =
    step === 0
      ? Boolean(arrive && depart)
      : step === 1
        ? Boolean(unit && quote)
        : step === 2
          ? Boolean(quote)
          : false;

  const goto = (target: number) => {
    if (target < step) setStep(target);
  };
  const next = () => {
    if (canContinue && step < 3) setStep(step + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---- Confirmation screen ---- */
  if (step === 4 && booking) {
    return (
      <div className="bk-app">
        <div className="bk-done">
          <p className="bk-done__eyebrow">Request Received</p>
          <p className="bk-done__ref">{booking.reference}</p>
          <h2 className="bk-done__title">The Hill Is Holding Your Dates</h2>
          <p className="bk-done__copy">
            Your request for{" "}
            <strong>
              {booking.request.stay.unit === ESTATE
                ? "the entire estate"
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
    <div className="bk-app">
      {/* Step rail */}
      <ol className="bk-steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={[
              "bk-steps__item",
              i === step && "is-current",
              i < step && "is-done",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button type="button" onClick={() => goto(i)} disabled={i >= step}>
              <span className="bk-steps__num">{String(i + 1).padStart(2, "0")}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="bk-layout">
        <div className="bk-main">
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
                  setUnit(null);
                }}
                onVisibleRange={loadRange}
                loading={occLoading}
              />
            </section>
          )}

          {step === 1 && (
            <section aria-label="Choose your suite">
              <SuitePicker
                suites={suites}
                options={options}
                selected={unit}
                nights={nights}
                onSelect={setUnit}
                loading={optionsLoading}
              />
            </section>
          )}

          {step === 2 && (
            <section aria-label="Add to your stay">
              <ExtrasPicker extras={extras} selected={selectedExtras} onToggle={toggleExtra} />
            </section>
          )}

          {step === 3 && (
            <section aria-label="Your details">
              <GuestDetailsForm value={guest} onChange={setGuest} disabled={submitting} />
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
            {step < 3 ? (
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
