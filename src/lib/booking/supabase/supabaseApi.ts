/* ==========================================================================
   booking/supabase/supabaseApi.ts — The real guest backend.

   Same interface the mock implements (BookingApi): the wizard doesn't know
   which one it's talking to. All money/validation happens in Postgres
   SECURITY DEFINER RPCs (see supabase/migrations/0001_booking_system.sql);
   this file only maps rows/JSON to the shared types.
   ========================================================================== */

import type { BookingApi } from "../api";
import type {
  AvailabilityMap,
  Booking,
  Extra,
  Quote,
  UnitOption,
} from "../types";
import { supabase } from "./client";

/** PostgREST errors carry the `raise exception` message — surface it as-is. */
function fail(error: { message: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

export const supabaseApi: BookingApi = {
  async getAvailability(startISO, endISO) {
    const { data, error } = await supabase().rpc("get_availability", {
      p_start: startISO,
      p_end: endISO,
    });
    if (error) fail(error, "Could not load availability.");
    return (data ?? {}) as AvailabilityMap;
  },

  async getExtras() {
    const { data, error } = await supabase()
      .from("extras")
      .select("id, name, description, category, price_type, price, inquire_only")
      .order("sort");
    if (error) fail(error, "Could not load extras.");
    return (data ?? []).map(
      (row): Extra => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        priceType: row.price_type,
        price: row.price,
        inquireOnly: row.inquire_only || undefined,
      }),
    );
  },

  async getStayOptions(stay) {
    const { data, error } = await supabase().rpc("get_stay_options", {
      p_arrive: stay.arrive,
      p_depart: stay.depart,
      p_guests: stay.guests,
    });
    if (error) fail(error, "Could not load options.");
    return (data ?? []) as UnitOption[];
  },

  async getQuote(stay, extraIds, promoCode) {
    const { data, error } = await supabase().rpc("get_quote", {
      p_arrive: stay.arrive,
      p_depart: stay.depart,
      p_guests: stay.guests,
      p_unit: stay.unit,
      p_extras: extraIds,
      p_promo_code: promoCode?.trim() || null,
    });
    if (error) fail(error, "Could not price this stay.");
    return data as Quote;
  },

  async captureLead(lead) {
    // Fire-and-forget: swallow errors so it never blocks the guest.
    try {
      await supabase().rpc("capture_lead", {
        p_name: lead.name ?? "",
        p_email: lead.email,
        p_phone: lead.phone ?? "",
        p_arrive: lead.arrive ?? null,
        p_depart: lead.depart ?? null,
        p_guests: lead.guests ?? null,
      });
    } catch {
      /* best-effort */
    }
  },

  async createBooking(req) {
    const { data, error } = await supabase().rpc("create_booking_request", {
      p_arrive: req.stay.arrive,
      p_depart: req.stay.depart,
      p_guests: req.stay.guests,
      p_unit: req.stay.unit,
      p_extras: req.extras,
      p_name: req.guest.name,
      p_email: req.guest.email,
      p_phone: req.guest.phone ?? "",
      p_notes: req.guest.notes ?? "",
      p_accepts: req.guest.acceptsAnimals,
      p_promo_code: req.promoCode?.trim() || null,
    });
    if (error) fail(error, "Could not send your request.");
    const result = data as { reference: string; status: Booking["status"]; createdAt: string; quote: Quote };
    return {
      reference: result.reference,
      status: result.status,
      createdAt: result.createdAt,
      request: req,
      quote: result.quote,
    };
  },
};
