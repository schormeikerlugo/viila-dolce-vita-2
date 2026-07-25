/* ==========================================================================
   schema.ts — JSON-LD structured data builders.
   Rendered by BaseLayout; all values come from src/data (nothing invented).
   ========================================================================== */

import { site, contact, social } from "../data/site";
import type { FaqItem } from "../data/faq";

/** The estate as a LodgingBusiness — global card for search engines. */
export function lodgingBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: site.name,
    slogan: site.tagline,
    description: site.description,
    url: site.url,
    email: contact.email,
    telephone: contact.whatsapp,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Podere Seccatoi, 56",
      addressLocality: "Massa Marittima",
      addressRegion: "Tuscany",
      postalCode: "58024",
      addressCountry: "IT",
    },
    sameAs: social.map((s) => s.href),
    petsAllowed: true,
    numberOfRooms: 7,
  };
}

/** FAQPage schema from the shared FAQ data. */
export function faqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Article schema for journal entries. */
export function articleSchema(a: {
  title: string;
  excerpt: string;
  slug: string;
  category: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt,
    articleSection: a.category,
    url: `${site.url}/journal/${a.slug}`,
    publisher: { "@type": "Organization", name: site.name, url: site.url },
  };
}
