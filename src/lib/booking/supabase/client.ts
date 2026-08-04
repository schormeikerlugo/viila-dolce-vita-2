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

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

/** True when the real backend is configured. */
export const hasSupabase = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** The singleton client. Only call when `hasSupabase` is true. */
export function supabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) throw new Error("Supabase env vars are not configured.");
    client = createClient(url, anonKey);
  }
  return client;
}
