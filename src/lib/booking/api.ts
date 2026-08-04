/* ==========================================================================
   booking/api.ts — The single seam between the booking UI and its backend.

   The UI only ever imports `api` from this file. Today it's the in-memory
   mock; when Supabase is configured, implement `supabaseApi` with the same
   interface and swap the export — no UI changes required.
   (See Docs/booking-system-plan.md.)
   ========================================================================== */

import type {
  AdminCalendar,
  AvailabilityMap,
  Booking,
  BookingRequest,
  BookingStatus,
  CalendarBlock,
  DashboardStats,
  Extra,
  Promotion,
  PromotionInput,
  Quote,
  RatesConfig,
  StayRequest,
  UnitOption,
} from "./types";

export interface BookingApi {
  /**
   * Occupancy for the window `[startISO, endISO)`.
   * Returns, per date, the suites NOT available that night.
   */
  getAvailability(startISO: string, endISO: string): Promise<AvailabilityMap>;

  /** The extras catalog (owner-editable once the backend exists). */
  getExtras(): Promise<Extra[]>;

  /**
   * Every bookable unit (5 suites + estate) priced for a concrete stay,
   * flagged available or not. Powers the suite-selection step.
   */
  getStayOptions(stay: Omit<StayRequest, "unit">): Promise<UnitOption[]>;

  /**
   * Price a stay (+ selected extras, + optional promo code). Always computed
   * API-side. Rejects with a message when the stay is invalid (capacity,
   * min nights, unavailable dates) or the code doesn't apply.
   */
  getQuote(stay: StayRequest, extraIds: string[], promoCode?: string): Promise<Quote>;

  /** Submit a booking request. Returns the stored booking with reference. */
  createBooking(req: BookingRequest): Promise<Booking>;
}

/**
 * Owner-facing operations behind the /admin gate. In the real backend these
 * run through Supabase Auth + RLS/Edge Functions with a staff role.
 */
export interface AdminBookingApi {
  /** One-call aggregates for the Overview screen. */
  getDashboardStats(): Promise<DashboardStats>;

  /** Bookings created in this system (newest first). */
  listBookings(): Promise<Booking[]>;
  setBookingStatus(reference: string, status: BookingStatus): Promise<Booking>;

  /** Promotions (code-based and automatic offers). */
  listPromotions(): Promise<Promotion[]>;
  createPromotion(input: PromotionInput): Promise<Promotion>;
  updatePromotion(id: string, patch: Partial<PromotionInput>): Promise<Promotion>;
  deletePromotion(id: string): Promise<void>;

  /** Suite-per-night occupancy with sources, for the calendar screen. */
  getCalendar(startISO: string, endISO: string): Promise<AdminCalendar>;

  listBlocks(): Promise<CalendarBlock[]>;
  createBlock(block: Omit<CalendarBlock, "id">): Promise<CalendarBlock>;
  deleteBlock(id: string): Promise<void>;

  /** The editable money config (rates, seasons, extras, tax, deposit). */
  getRates(): Promise<RatesConfig>;
  saveRates(config: RatesConfig): Promise<RatesConfig>;
  /** Discard local edits and return to the seed defaults. */
  resetRates(): Promise<RatesConfig>;
}

import { mockAdminApi, mockApi } from "./mock/mockApi";
import { hasSupabase } from "./supabase/client";
import { supabaseApi } from "./supabase/supabaseApi";
import { supabaseAdminApi } from "./supabase/supabaseAdminApi";

/**
 * The active backend: Supabase when PUBLIC_SUPABASE_* env vars are set at
 * build time, otherwise the in-browser mock (offline development).
 */
export const api: BookingApi = hasSupabase ? supabaseApi : mockApi;

/** The active admin backend. Swaps alongside `api`. */
export const adminApi: AdminBookingApi = hasSupabase ? supabaseAdminApi : mockAdminApi;

/** True when running against the real backend (used by the admin login). */
export const isLiveBackend = hasSupabase;
