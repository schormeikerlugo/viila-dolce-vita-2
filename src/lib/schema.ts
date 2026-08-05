/* ==========================================================================
   schema.ts — JSON-LD structured data builders.
   Rendered by BaseLayout; all values come from src/data (nothing invented).
   ========================================================================== */

import { site, contact, social } from "../data/site";
import type { FaqItem } from "../data/faq";
import type { ImageMetadata } from "astro";
import { photos } from "../data/media";

/** The estate as a LodgingBusiness — global card for search engines. */
export function lodgingBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: site.name,
    slogan: site.tagline,
    description: site.description,
    url: site.url,
    image: `${site.url}${photos.houseTerraceView.src}`,
    email: contact.email,
    telephone: contact.whatsapp,
    address: {
      "@type": "PostalAddress",
      streetAddress: "SP441, 56",
      addressLocality: "Massa Marittima",
      addressRegion: "Tuscany",
      postalCode: "58024",
      addressCountry: "IT",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 43.08421,
      longitude: 10.9671672,
    },
    hasMap: "https://maps.google.com/?q=SP441+56+58024+Massa+Marittima+GR+Italy",
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
  author?: string;
  date?: string;
  image?: ImageMetadata;
  tags?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt,
    articleSection: a.category,
    url: `${site.url}/journal/${a.slug}`,
    ...(a.image ? { image: `${site.url}${a.image.src}` } : {}),
    ...(a.date ? { datePublished: a.date, dateModified: a.date } : {}),
    ...(a.tags?.length ? { keywords: a.tags.join(", ") } : {}),
    author: { "@type": "Organization", name: a.author ?? site.name },
    publisher: { "@type": "Organization", name: site.name, url: site.url },
  };
}
