/* ==========================================================================
   booking/supabase/client.ts — The shared Supabase browser client.

   Env vars (PUBLIC_ = exposed to the client, safe by design: the anon key
   only reaches data through RLS policies and SECURITY DEFINER RPCs):
     PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY
   Set them in `.env` locally and in Vercel → Environment Variables.

   When they're absent the app falls back to the mock backend (see api.ts),
   so local development keeps working offline.
   ========================================================================== */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Clean an env value: strip whitespace/newlines and any wrapping quotes that
 * sneak in when pasting into a dashboard (a common cause of "Invalid
 * supabaseUrl"). Returns undefined for empty strings.
 */
function clean(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim().replace(/^['"]|['"]$/g, "").trim();
  return s || undefined;
}

/** Validate the Supabase URL is a real http(s) URL, and normalise it. */
function validUrl(v: string | undefined): string | undefined {
  if (!v) return undefined;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    // Drop any trailing slash — supabase-js wants the bare origin.
    return u.origin;
  } catch {
    return undefined;
  }
}

const rawUrl = clean(import.meta.env.PUBLIC_SUPABASE_URL as string | undefined);
const url = validUrl(rawUrl);
const anonKey = clean(import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined);

// Loud, actionable warning when the URL is present but malformed — the most
// common deploy mistake (stray quotes/space, missing https://).
if (rawUrl && !url && typeof console !== "undefined") {
  console.error(
    `[booking] PUBLIC_SUPABASE_URL is not a valid http(s) URL (got: ${JSON.stringify(
      rawUrl,
    )}). Falling back to the mock backend. Fix it in Vercel → Settings → Environment Variables, then redeploy.`,
  );
}

/**
 * True when a *valid* backend is configured. A malformed URL falls back to
 * the mock instead of crashing the whole page (the old behaviour threw
 * "Invalid supabaseUrl" and blanked /admin and /book).
 */
export const hasSupabase = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** The singleton client. Only call when `hasSupabase` is true. */
export function supabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) throw new Error("Supabase env vars are not configured or invalid.");
    client = createClient(url, anonKey);
  }
  return client;
}
