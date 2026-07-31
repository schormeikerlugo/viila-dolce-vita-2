/* ==========================================================================
   booking/api.ts — The single seam between the booking UI and its backend.

   The UI only ever imports `api` from this file. Today it's the in-memory
   mock; when Supabase is configured, implement `supabaseApi` with the same
   interface and swap the export — no UI changes required.
   (See Docs/booking-system-plan.md.)
   ========================================================================== */

import type {
  AvailabilityMap,
  Booking,
  BookingRequest,
  Extra,
  Quote,
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
   * Price a stay (+ selected extras). Always computed API-side.
   * Rejects with a message when the stay is invalid (capacity, min nights,
   * unavailable dates).
   */
  getQuote(stay: StayRequest, extraIds: string[]): Promise<Quote>;

  /** Submit a booking request. Returns the stored booking with reference. */
  createBooking(req: BookingRequest): Promise<Booking>;
}

import { mockApi } from "./mock/mockApi";

/** The active backend. Swap to `supabaseApi` when it exists. */
export const api: BookingApi = mockApi;
