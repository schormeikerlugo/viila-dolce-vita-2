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
} from "../../lib/booking/types";
import { ESTATE } from "../../lib/booking/types";
import { longDate, money } from "../../lib/booking/dates";
import AvailabilityCalendar from "./AvailabilityCalendar";
import GuestDetailsForm from "./GuestDetailsForm";
import QuoteSummary from "./QuoteSummary";
import type { ExteriorPhoto } from "../../lib/booking/types";

/* Everything the guest is renting — the whole estate, at a glance. Grouped so
   the copy panel can lay them out across three columns. */
const VILLA_FEATURES: { title: string; items: string[] }[] = [
  {
    title: "The Estate",
    items: [
      "Five en-suite bedrooms · sleeps 15",
      "Two stone houses, fully private",
      "50 acres of gardens & olive groves",
      "Panoramic valley, sea & island views",
      "Full villa exclusivity — no other guests",
    ],
  },
  {
    title: "Dining & Service",
    items: [
      "Private in-house chef",
      "Breakfast daily + three dinners a week",
      "On-site concierge, living on the hill",
      "Fully fitted kitchens in every suite",
      "Chauffeured transfers on request",
    ],
  },
  {
    title: "Wellness & Grounds",
    items: [
      "Heated pool with panoramic terrace",
      "Handcrafted barrel sauna",
      "Open-air gym & boxing area",
      "Golden-hour happy hour & lounges",
      "Working animal sanctuary on the estate",
    ],
  },
] as const;

interface Props {
  suites: SuiteCardData[];
  /** Optimized exterior photos for the header mosaic (resolved in book.astro). */
  exterior: ExteriorPhoto[];
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

export default function BookApp({ exterior }: Props) {
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
      .getQuote(stay, [])
      .then((q) => alive && setQuote(q))
      .catch((err) => {
        if (!alive) return;
        const message = err instanceof Error ? err.message : "Could not price this stay.";
        setQuote(null);
        setQuoteError(message);
      })
      .finally(() => alive && setQuoteLoading(false));
    return () => {
      alive = false;
    };
  }, [arrive, depart]);

  /* ---- Guest & submission ---- */
  const [guest, setGuest] = useState<GuestDetails>({
    name: "",
    email: "",
    phone: "",
    notes: "",
    // Consent checkbox removed from the UI; kept true so the backend RPC
    // (which still requires it) accepts the request.
    acceptsAnimals: true,
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

  const detailsValid = guest.name.trim().length > 0 && guest.email.includes("@");
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
            with the concierge. We confirm personally, by WhatsApp or email.
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
      <VillaHeader exterior={exterior} />

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

/* ---- Villa header: exterior mosaic (lightbox) + full estate details ---- */

function VillaHeader({ exterior }: { exterior: ExteriorPhoto[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const close = useCallback(() => setLightbox(null), []);
  const step = useCallback(
    (dir: 1 | -1) =>
      setLightbox((i) => (i === null ? null : (i + dir + exterior.length) % exterior.length)),
    [exterior.length],
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, close, step]);

  return (
    <header className="bk-villahead">
      <div className="bk-villahead__media" aria-label="Photographs of the villa exterior">
        {exterior.map((p, i) => (
          <button
            key={p.src}
            type="button"
            className={`bk-villahead__tile bk-villahead__tile--${i + 1}`}
            onClick={() => setLightbox(i)}
            aria-label={`View photo: ${p.alt}`}
          >
            <img src={p.src} alt={p.alt} loading={i < 2 ? "eager" : "lazy"} />
          </button>
        ))}
      </div>

      <div className="bk-villahead__body">
        <span className="bk-villahead__eyebrow">Five suites · Sleeps 15 · The whole estate</span>
        <h2 className="bk-villahead__name">The Entire Villa</h2>
        <p className="bk-villahead__note">
          Take the hilltop entirely — a private 50-acre estate that is yours alone for the stay.
          All five en-suite bedrooms, the heated pool and every terrace, garden and grove. Your
          days come with a private chef (breakfast each morning and three dinners a week), a barrel
          sauna and open-air gym, and a concierge who lives on the hill. Minimum 3 nights.
        </p>

        <div className="bk-villahead__features">
          {VILLA_FEATURES.map((group) => (
            <div key={group.title} className="bk-villahead__featgroup">
              <h3 className="bk-villahead__feattitle">{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bk-villahead__price">
          <span className="bk-villahead__price-muted">Select your dates below</span>
        </div>
      </div>

      {lightbox !== null && (
        <div className="bk-lightbox" role="dialog" aria-modal="true" aria-label="Villa photo">
          <button type="button" className="bk-lightbox__backdrop" aria-label="Close" onClick={close} />
          <button type="button" className="bk-lightbox__close" aria-label="Close" onClick={close}>
            ✕
          </button>
          <button
            type="button"
            className="bk-lightbox__nav bk-lightbox__nav--prev"
            aria-label="Previous photo"
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <figure className="bk-lightbox__figure">
            <img src={exterior[lightbox].src} alt={exterior[lightbox].alt} />
            <figcaption>{exterior[lightbox].alt}</figcaption>
          </figure>
          <button
            type="button"
            className="bk-lightbox__nav bk-lightbox__nav--next"
            aria-label="Next photo"
            onClick={() => step(1)}
          >
            ›
          </button>
        </div>
      )}
    </header>
  );
}
