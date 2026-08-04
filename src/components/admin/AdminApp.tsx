/**
 * AdminApp — the owner panel island (/admin).
 *
 * Three screens — Calendar, Bookings, Rates — behind an auth gate:
 * - live backend → Supabase Auth (email/password, staff allow-list via the
 *   `admins` table + RLS);
 * - mock backend → a demo gate in localStorage, so the panel still works
 *   offline in development.
 * Everything else talks to `adminApi` (src/lib/booking/api.ts).
 */
import { useEffect, useState } from "react";
import { isLiveBackend } from "../../lib/booking/api";
import { hasSupabase, supabase } from "../../lib/booking/supabase/client";
import type { SuiteSlug } from "../../lib/booking/types";
import AdminOverview from "./AdminOverview";
import AdminCalendar from "./AdminCalendar";
import AdminBookings from "./AdminBookings";
import AdminPromotions from "./AdminPromotions";
import AdminRates from "./AdminRates";

export interface SuiteMeta {
  slug: SuiteSlug;
  name: string;
  sleeps: number;
}

const DEMO_AUTH_KEY = "vdv-admin-auth";
const TABS = [
  { id: "overview", label: "Overview", hint: "Today at a glance" },
  { id: "calendar", label: "Calendar", hint: "Occupancy by suite" },
  { id: "bookings", label: "Bookings", hint: "Requests & guests" },
  { id: "promotions", label: "Promotions", hint: "Offers & codes" },
  { id: "rates", label: "Rates & Extras", hint: "Pricing" },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface Props {
  suites: SuiteMeta[];
}

export default function AdminApp({ suites }: Props) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>("overview");

  useEffect(() => {
    if (!hasSupabase) {
      setAuthed(localStorage.getItem(DEMO_AUTH_KEY) === "1");
      return;
    }
    supabase()
      .auth.getSession()
      .then(({ data }) => setAuthed(Boolean(data.session)));
    const { data: sub } = supabase().auth.onAuthStateChange((_event, session) =>
      setAuthed(Boolean(session)),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = () => {
    if (hasSupabase) {
      void supabase().auth.signOut();
    } else {
      localStorage.removeItem(DEMO_AUTH_KEY);
      setAuthed(false);
    }
  };

  if (authed === null) return null;

  if (!authed) {
    return (
      <Login
        onDemoLogin={() => {
          localStorage.setItem(DEMO_AUTH_KEY, "1");
          setAuthed(true);
        }}
      />
    );
  }

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-side__brand">
          <p className="adm-side__mark">
            Villa <em>Dolce Vita</em>
          </p>
          <p className="adm-side__desk">Concierge Desk</p>
        </div>

        <nav className="adm-side__nav" aria-label="Admin sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`adm-navitem${tab === t.id ? " is-active" : ""}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <span className="adm-navitem__label">{t.label}</span>
              <span className="adm-navitem__hint">{t.hint}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="adm-side__out" onClick={signOut}>
          Sign Out
        </button>
      </aside>

      <main className="adm-main">
        <header className="adm-main__head">
          <div>
            <h1 className="adm-main__title">{current.label}</h1>
            <p className="adm-main__hint">{current.hint}</p>
          </div>
          {!isLiveBackend && (
            <span className="adm-main__demo">Demo workspace — data stays in this browser</span>
          )}
        </header>

        {tab === "overview" && <AdminOverview suites={suites} />}
        {tab === "calendar" && <AdminCalendar suites={suites} />}
        {tab === "bookings" && <AdminBookings suites={suites} />}
        {tab === "promotions" && <AdminPromotions suites={suites} />}
        {tab === "rates" && <AdminRates />}
      </main>
    </div>
  );
}

/* ---- Login gate: Supabase Auth (live) or demo flag (mock) ---- */

function Login({ onDemoLogin }: { onDemoLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasSupabase) {
      if (!email.includes("@") || password.length < 4) {
        setError("Enter your email and a password of at least 4 characters.");
        return;
      }
      onDemoLogin();
      return;
    }

    setBusy(true);
    const { error: authError } = await supabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Wrong email or password."
          : authError.message,
      );
    }
    // Success flows through onAuthStateChange in the parent.
  };

  return (
    <div className="adm-login">
      <form className="adm-login__card" onSubmit={submit}>
        <p className="adm-login__brand">
          Villa <em>Dolce Vita</em>
        </p>
        <p className="adm-login__sub">Concierge Desk</p>

        <label className="bk-field">
          <span className="bk-field__label">Email</span>
          <input
            type="email"
            className="bk-field__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="bk-field">
          <span className="bk-field__label">Password</span>
          <input
            type="password"
            className="bk-field__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="bk-error">{error}</p>}

        <button type="submit" className="bk-btn adm-login__btn" disabled={busy}>
          {busy ? "Signing in…" : "Enter"}
        </button>

        {!hasSupabase && (
          <p className="adm-login__note">
            Demo access — any credentials work until Supabase Auth is connected.
          </p>
        )}
      </form>
    </div>
  );
}
