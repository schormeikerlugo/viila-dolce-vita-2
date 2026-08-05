/* ==========================================================================
   booking/supabase/supabaseAdminApi.ts — The real owner backend.

   Requires a signed-in staff user (Supabase Auth + `admins` allow-list):
   RLS rejects every table below for anonymous/non-staff sessions, and the
   admin RPCs raise "Staff only." on their own.
   ========================================================================== */

import type { AdminBookingApi } from "../api";
import type {
  AdminCalendar,
  Booking,
  CalendarBlock,
  DashboardStats,
  LeadCapture,
  Extra,
  Promotion,
  PromotionInput,
  Quote,
  RatesConfig,
  SuiteSlug,
} from "../types";
import { supabase } from "./client";

function fail(error: { message: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

/* ---- Row mappers ---- */

interface BookingRow {
  reference: string;
  status: Booking["status"];
  unit: string;
  arrive: string;
  depart: string;
  guests: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_notes: string | null;
  accepts_animals: boolean;
  extra_ids: string[];
  quote: Quote;
  created_at: string;
}

function toBooking(row: BookingRow): Booking {
  return {
    reference: row.reference,
    status: row.status,
    createdAt: row.created_at,
    request: {
      stay: {
        arrive: row.arrive,
        depart: row.depart,
        guests: row.guests,
        unit: row.unit as Booking["request"]["stay"]["unit"],
      },
      extras: row.extra_ids ?? [],
      guest: {
        name: row.guest_name,
        email: row.guest_email,
        phone: row.guest_phone ?? undefined,
        notes: row.guest_notes ?? undefined,
        acceptsAnimals: row.accepts_animals,
      },
    },
    quote: row.quote,
  };
}

const BOOKING_COLS =
  "reference, status, unit, arrive, depart, guests, guest_name, guest_email, guest_phone, guest_notes, accepts_animals, extra_ids, quote, created_at";

interface PromotionRow {
  id: string;
  code: string | null;
  name: string;
  kind: "percent" | "fixed";
  value: number;
  suite: string | null;
  stay_start: string | null;
  stay_end: string | null;
  book_start: string | null;
  book_end: string | null;
  min_nights: number;
  usage_limit: number | null;
  used: number;
  active: boolean;
}

function toPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    value: Number(row.value),
    suite: (row.suite as SuiteSlug) ?? null,
    stayStart: row.stay_start,
    stayEnd: row.stay_end,
    bookStart: row.book_start,
    bookEnd: row.book_end,
    minNights: row.min_nights,
    usageLimit: row.usage_limit,
    used: row.used,
    active: row.active,
  };
}

function promoPatch(input: Partial<PromotionInput>) {
  const row: Record<string, unknown> = {};
  if (input.code !== undefined) row.code = input.code ? input.code.trim().toUpperCase() : null;
  if (input.name !== undefined) row.name = input.name;
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.value !== undefined) row.value = input.value;
  if (input.suite !== undefined) row.suite = input.suite;
  if (input.stayStart !== undefined) row.stay_start = input.stayStart;
  if (input.stayEnd !== undefined) row.stay_end = input.stayEnd;
  if (input.bookStart !== undefined) row.book_start = input.bookStart;
  if (input.bookEnd !== undefined) row.book_end = input.bookEnd;
  if (input.minNights !== undefined) row.min_nights = input.minNights;
  if (input.usageLimit !== undefined) row.usage_limit = input.usageLimit;
  if (input.active !== undefined) row.active = input.active;
  return row;
}

const PROMO_COLS =
  "id, code, name, kind, value, suite, stay_start, stay_end, book_start, book_end, min_nights, usage_limit, used, active";

export const supabaseAdminApi: AdminBookingApi = {
  async getDashboardStats() {
    const { data, error } = await supabase().rpc("get_dashboard_stats");
    if (error) fail(error, "Could not load the dashboard.");
    return data as DashboardStats;
  },

  async listLeads() {
    const { data, error } = await supabase()
      .from("lead_captures")
      .select("id, name, email, phone, arrive, depart, guests, status, reference, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) fail(error, "Could not load leads.");
    return (data ?? []).map(
      (r): LeadCapture => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        arrive: r.arrive,
        depart: r.depart,
        guests: r.guests,
        status: r.status,
        reference: r.reference,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }),
    );
  },

  async listPromotions() {
    const { data, error } = await supabase()
      .from("promotions")
      .select(PROMO_COLS)
      .order("created_at", { ascending: false });
    if (error) fail(error, "Could not load promotions.");
    return ((data ?? []) as unknown as PromotionRow[]).map(toPromotion);
  },

  async createPromotion(input) {
    const { data, error } = await supabase()
      .from("promotions")
      .insert(promoPatch(input))
      .select(PROMO_COLS)
      .single();
    if (error) fail(error, "Could not create the promotion.");
    return toPromotion(data as unknown as PromotionRow);
  },

  async updatePromotion(id, patch) {
    const { data, error } = await supabase()
      .from("promotions")
      .update(promoPatch(patch))
      .eq("id", id)
      .select(PROMO_COLS)
      .single();
    if (error) fail(error, "Could not update the promotion.");
    return toPromotion(data as unknown as PromotionRow);
  },

  async deletePromotion(id) {
    const { error } = await supabase().from("promotions").delete().eq("id", id);
    if (error) fail(error, "Could not delete the promotion.");
  },

  async listBookings() {
    const { data, error } = await supabase()
      .from("bookings")
      .select(BOOKING_COLS)
      .order("created_at", { ascending: false });
    if (error) fail(error, "Could not load bookings.");
    return ((data ?? []) as unknown as BookingRow[]).map(toBooking);
  },

  async setBookingStatus(reference, status) {
    const { data, error } = await supabase()
      .from("bookings")
      .update({ status })
      .eq("reference", reference)
      .select(BOOKING_COLS)
      .single();
    if (error) fail(error, `Could not update ${reference}.`);
    return toBooking(data as unknown as BookingRow);
  },

  async getCalendar(startISO, endISO) {
    const { data, error } = await supabase().rpc("get_admin_calendar", {
      p_start: startISO,
      p_end: endISO,
    });
    if (error) fail(error, "Could not load the calendar.");
    return (data ?? {}) as AdminCalendar;
  },

  async listBlocks() {
    const { data, error } = await supabase()
      .from("blocks")
      .select("id, suite, start_date, end_date, reason")
      .order("start_date");
    if (error) fail(error, "Could not load blocks.");
    return (data ?? []).map(
      (row): CalendarBlock => ({
        id: row.id,
        suite: (row.suite as SuiteSlug) ?? null,
        start: row.start_date,
        end: row.end_date,
        reason: row.reason,
      }),
    );
  },

  async createBlock(block) {
    const { data, error } = await supabase()
      .from("blocks")
      .insert({
        suite: block.suite,
        start_date: block.start,
        end_date: block.end,
        reason: block.reason,
      })
      .select("id, suite, start_date, end_date, reason")
      .single();
    if (error) fail(error, "Could not create the block.");
    return {
      id: data.id,
      suite: (data.suite as SuiteSlug) ?? null,
      start: data.start_date,
      end: data.end_date,
      reason: data.reason,
    };
  },

  async deleteBlock(id) {
    const { error } = await supabase().from("blocks").delete().eq("id", id);
    if (error) fail(error, "Could not remove the block.");
  },

  async getRates() {
    const sb = supabase();
    const [suites, extras, settings] = await Promise.all([
      sb.from("suites").select("*").order("rank"),
      sb.from("extras").select("*").order("sort"),
      sb.from("settings").select("*").single(),
    ]);
    const err = suites.error ?? extras.error ?? settings.error;
    if (err) fail(err, "Could not load rates.");
    return {
      suites: (suites.data ?? []).map((s) => ({
        slug: s.slug,
        baseRate: s.base_rate,
        extraGuestRate: s.extra_guest_rate,
        baseOccupancy: s.base_occupancy,
        sleeps: s.sleeps,
        active: s.active,
      })),
      extras: (extras.data ?? []).map(
        (x): Extra => ({
          id: x.id,
          name: x.name,
          description: x.description,
          category: x.category,
          priceType: x.price_type,
          price: x.price,
          inquireOnly: x.inquire_only || undefined,
        }),
      ),
      depositPct: settings.data.deposit_pct,
      weekdayRates: {
        monThu: settings.data.rate_mon_thu,
        fri: settings.data.rate_fri,
        sat: settings.data.rate_sat,
        sun: settings.data.rate_sun,
      },
      villaMinNights: settings.data.estate_min_nights,
      villaSleeps: settings.data.estate_sleeps,
    } satisfies RatesConfig;
  },

  async saveRates(config) {
    const sb = supabase();
    const results = await Promise.all([
      ...config.extras
        .filter((x) => !x.inquireOnly)
        .map((x) => sb.from("extras").update({ price: x.price }).eq("id", x.id)),
      sb
        .from("settings")
        .update({
          deposit_pct: config.depositPct,
          estate_min_nights: config.villaMinNights,
          rate_mon_thu: config.weekdayRates.monThu,
          rate_fri: config.weekdayRates.fri,
          rate_sat: config.weekdayRates.sat,
          rate_sun: config.weekdayRates.sun,
        })
        .eq("id", true),
    ]);
    const err = results.find((r) => r.error)?.error ?? null;
    if (err) fail(err, "Could not save rates.");
    return this.getRates();
  },

  async resetRates() {
    const { error } = await supabase().rpc("reset_rates");
    if (error) fail(error, "Could not reset rates.");
    return this.getRates();
  },
};
