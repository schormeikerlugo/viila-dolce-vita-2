/* ==========================================================================
   packages.ts — Wedding tiers (shown without fixed pricing).
   Nightly rates and priced experience packages were removed site-wide:
   Villa Dolce Vita is positioned without published prices.
   ========================================================================== */

export interface WeddingTier {
  tier: string;
  guests: string;
  includes: string;
}

export const weddingTiers: WeddingTier[] = [
  {
    tier: "Essenziale",
    guests: "Up to 50",
    includes:
      "Hilltop ceremony, reception under string lights, house wine, estate-cooked menu",
  },
  {
    tier: "Signature",
    guests: "Up to 75",
    includes:
      "Essenziale plus welcome cocktail hour timed to sunset, upgraded wine list, live music",
  },
  {
    tier: "Grand",
    guests: "Up to 100",
    includes:
      "Signature plus multi-course dinner, premium wine pairing, extended reception hours",
  },
];

export const weddingTiersNote =
  "Wedding tiers are shown without fixed per-guest totals since catering and beverage choices vary widely. Request a quote for pricing tailored to your celebration.";
