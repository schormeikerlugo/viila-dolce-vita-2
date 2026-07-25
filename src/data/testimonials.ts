/* ==========================================================================
   testimonials.ts — Guest reviews.
   The first three are from content.md; the rest are real reviews pulled from
   the live site to fill the carousel (all authentic).
   ========================================================================== */

export interface Testimonial {
  quote: string;
  author: string;
  /** Guest home country / region shown beneath the author. */
  location?: string;
  /** Star rating out of 5. Defaults to 5 when omitted. */
  rating?: number;
  meta?: string;
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "This is the perfect place to relax and enjoy the views of Tuscany with the rolling hills of vineyards and olive groves. You can also see the sea off in the distance.",
    author: "Google review",
    location: "United Kingdom",
    rating: 5,
    meta: "September 2025",
  },
  {
    quote:
      "Upon arrival we were warmly welcomed with a chilled bottle of Prosecco, personally selected by the owners. The outdoor gym was fully equipped, and the sauna afterward was a perfect way to unwind.",
    author: "Google review",
    location: "Germany",
    rating: 5,
  },
  {
    quote:
      "Our hosts, Linda and Frank, were extremely friendly and accommodating. If you're looking for a quiet, relaxing getaway in the Tuscan countryside, this is the place for you.",
    author: "Melinda Schiano di Cola",
    location: "Italy",
    rating: 5,
  },
  {
    quote:
      "Absolutely stunning villa! From the moment we arrived, everything felt like a dream — the views, the peaceful surroundings, and the charm of the property were beyond anything we imagined. This is the place where I want to renew my vows. It's that special.",
    author: "Jacqueline Spackman",
    location: "United States",
    rating: 5,
    meta: "a month ago",
  },
  {
    quote:
      "Stayed 4 nights with my wife and son in the Positano suite. Nice waking up with beautiful arched French doors and sweeping views. I recommend touring the area — some lovely towns to explore and eat local food and wine.",
    author: "David Castiglione",
    location: "Australia",
    rating: 5,
    meta: "2 months ago",
  },
  {
    quote:
      "One of the most memorable aspects of our stay was meeting the rescue animals on the property, who are clearly loved. Villa Dolce Vita is a true gem for anyone seeking comfort, beauty, and authenticity in the heart of Tuscany.",
    author: "Lisa Marra",
    location: "Canada",
    rating: 5,
    meta: "a month ago",
  },
];
