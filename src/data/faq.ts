/* ==========================================================================
   faq.ts — Guest questions, answered.
   Content derived from the existing copy: site notices, amenities, dining,
   packages and experiences. No new facts introduced.
   ========================================================================== */

export interface FaqItem {
  q: string;
  a: string;
}

export const faqs: FaqItem[] = [
  {
    q: "Where exactly is the villa?",
    a: "Villa Dolce Vita sits on a private 50-acre hilltop estate in the Maremma — Podere Seccatoi 56, Massa Marittima, Tuscany. The medieval town is a fifteen-minute drive; on clear days the view reaches the sea, Elba and Corsica.",
  },
  {
    q: "How many guests can the estate host?",
    a: "Two stone houses hold five large suites — seven bedrooms in all — sleeping up to 15 guests. Suites can be booked individually, or the estate reserved in full for complete privacy.",
  },
  {
    q: "Is dining included in the stay?",
    a: "Daily breakfast is served on the estate, with three chef-cooked dinners per week and food and grocery delivery available. Private dinners and welcome baskets can be arranged through the concierge.",
  },
  {
    q: "Are there animals on the property?",
    a: "Yes — the villa is also a sanctuary for rescued animals (three dogs and seven cats) who roam freely across the property. Many guests find their presence a joyful part of the stay; we kindly ask that you're comfortable sharing the space with them.",
  },
  {
    q: "Is there reliable internet on the hill?",
    a: "The estate runs on Starlink satellite internet, with five big-screen TVs carrying Netflix and Amazon Prime across the suites.",
  },
  {
    q: "What wellness facilities are available?",
    a: "An outdoor pool with a panoramic terrace, a four-person outdoor barrel sauna, a fully equipped outdoor gym and a shaded yoga platform — all set into the hillside.",
  },
  {
    q: "Can we hold a wedding or event at the villa?",
    a: "Yes — ceremonies take place on the marble hilltop terrace, with receptions for up to 100 guests across three wedding tiers. See Weddings & Events for details.",
  },
  {
    q: "How do we get there from the airport?",
    a: "Chauffeured transfers can be arranged from Rome, Florence and Pisa, along with private luxury tours and day trips. The concierge handles every booking on site.",
  },
];

/** Compact selection for the home page. */
export const homeFaqs: FaqItem[] = faqs.slice(0, 6);
