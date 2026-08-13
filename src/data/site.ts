/* ==========================================================================
   site.ts — Global site metadata, navigation and contact details.
   Single source of truth for anything that appears in more than one place.
   ========================================================================== */

export const site = {
  name: "Villa Dolce Vita",
  tagline: "Under the Tuscan Stars",
  location: "Massa Marittima, Tuscany",
  description:
    "A private hilltop estate fifteen minutes from Massa Marittima, Tuscany — five suites, a working animal sanctuary, wellness, and views to Elba and Corsica.",
  url: "https://villadolcevita.eu",
} as const;

export const contact = {
  whatsapp: "+39 331 633 1248",
  whatsappHref: "https://wa.me/393316331248",
  email: "hello@villadolcevita.eu",
  address: "SP441, 56, 58024 Massa Marittima GR, Italy",
  instagram: "https://www.instagram.com/villadolcevitatoscana/",
  instagramHandle: "@villadolcevitatoscana",
  // Real booking engine — swap the mock CTA to this when ready (see Docs).
  bookingEngine: "https://bookings.villadolcevita.eu/hotel/villa-dolce-vita",
} as const;

/**
 * Social profiles. Some accounts are still being set up, so each carries a
 * `live` flag: only `live` profiles show in the footer and in structured data.
 * Flip a profile's `live` to true once its account is ready.
 */
export const social = [
  { label: "Instagram", href: "https://www.instagram.com/villadolcevitatoscana/", live: true },
  { label: "Pinterest", href: "https://www.pinterest.com/villadolcevitatoscana/", live: false },
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61592923647481", live: false },
] as const;

/** The subset of profiles that are live and safe to link. */
export const socialVisible = social.filter((s) => s.live);

/** True when at least one social profile is live (drives footer visibility). */
export const socialLive = socialVisible.length > 0;

/**
 * The "Check Availability" CTA target — the in-house booking engine at /book.
 * (Was a WhatsApp mock; now every CTA across the site flows to the wizard.)
 */
export const bookingHref = "/book";

/**
 * Deep-link the booking wizard to a specific suite, e.g. /book?suite=roma.
 * `slug` is a suite slug ("roma", "napoli", …); omit for the open wizard.
 */
export function bookingSuiteHref(slug?: string): string {
  return slug ? `/book?suite=${encodeURIComponent(slug)}` : "/book";
}

/**
 * Build a WhatsApp enquiry URL with a pre-filled message. Kept for the
 * Contact page and any "talk to the concierge" affordance — the primary
 * booking path is now /book.
 */
export function bookingMessageHref(opts: {
  arrive?: string;
  depart?: string;
  guests?: string | number;
  suite?: string;
} = {}): string {
  const parts: string[] = ["Hello Villa Dolce Vita!"];
  if (opts.suite) parts.push(`I'm interested in the ${opts.suite}.`);
  if (opts.arrive && opts.depart) {
    parts.push(`I'd like to check availability from ${opts.arrive} to ${opts.depart}`);
  } else {
    parts.push("I'd like to check availability for a stay");
  }
  if (opts.guests) parts.push(`for ${opts.guests} ${Number(opts.guests) === 1 ? "guest" : "guests"}`);
  const text = parts.join(" ").replace(/\s+/g, " ").trim() + ".";
  return `${contact.whatsappHref}?text=${encodeURIComponent(text)}`;
}

export type NavItem = { label: string; href: string };

/**
 * Flat navigation list — the canonical map of top-level pages.
 * Consumed by the Footer (via nav.filter) and kept as a stable source of
 * truth for SEO/sitemap. Do NOT restructure this; the Nav uses `navGroups`.
 */
export const nav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "The Property", href: "/the-property" },
  { label: "Suites", href: "/suites" },
  { label: "Experience", href: "/experiences" },
  { label: "Weddings & Events", href: "/weddings-events" },
  { label: "Gallery", href: "/gallery" },
  { label: "Journal", href: "/journal" },
  { label: "Contact Us", href: "/contact" },
];

/**
 * Grouped navigation — the shape the Nav renders. Simple links stay flat;
 * groups carry `children` and open a dropdown. A group may also have its own
 * `href` (e.g. "Experiences" links to /experiences AND opens its dropdown).
 */
export type NavNode =
  | { label: string; href: string }
  | { label: string; href?: string; children: NavItem[] };

export const navGroups: NavNode[] = [
  { label: "Home", href: "/" },
  { label: "The Property", href: "/the-property" },
  { label: "Experience", href: "/experiences" },
  { label: "Weddings & Events", href: "/weddings-events" },
  { label: "Journal", href: "/journal" },
  { label: "Contact Us", href: "/contact" },
];

/** Legal / recurring footer notices (identical wording to content.md). */
export const notices = {
  alcohol:
    "Due to current Italian law, the sale and consumption of alcohol is temporarily prohibited. We are complying fully with this regulation until further notice. Thank you for your understanding.",
  animals:
    "Our villa is also a sanctuary for rescued animals who roam freely across the property. They add to the charm and tranquility of the Tuscan countryside, and many guests find their presence a joyful part of the stay. If you choose to stay with us, we kindly ask that you're comfortable sharing the space with these gentle animals.",
} as const;
