/* ==========================================================================
   suites.ts — The five suites. Copy lifted from content.md (Rooms page).
   ========================================================================== */

import { suitePhotos } from "./media";
import type { ImageMetadata } from "astro";

export interface Suite {
  slug: string;
  name: string;
  tagline: string;
  sleeps: number;
  badge?: string;
  intro: string;
  features: string[];
  /** Ordered gallery of real room photos; [0] is the card/lead image. */
  images: ImageMetadata[];
  imageAlt: string;
  /** Editorial rank, 1 = flagship. Drives the "Suite 01…05" order on the page. */
  rank: number;
  /** Signature attribute shown in place of a nightly rate. */
  highlight: string;
}

export const suites: Suite[] = [
  {
    slug: "napoli",
    name: "Napoli Suite",
    tagline: "Panoramic Views & Timeless Comfort",
    sleeps: 6,
    intro:
      "A beautifully renovated two-bedroom retreat combining classic elegance with modern amenities, ideal for families, couples, or small groups.",
    features: [
      "A serene primary bedroom with a king-size bed (190×203 cm)",
      "A cozy second bedroom with a queen-size bed (180×200 cm)",
      "A full bathroom with marble-look tiling and heated flooring",
      "A living room with a large TV and a comfortable pull-out sofa",
      "A private outdoor patio with panoramic Tuscan countryside views",
    ],
    images: suitePhotos.napoli,
    imageAlt: "The Napoli Suite — a bright, two-bedroom retreat with panoramic Tuscan views",
    rank: 2,
    highlight: "Two bedrooms",
  },
  {
    slug: "roma",
    name: "Roma Suite",
    tagline: "Honeymoon Hideaway",
    sleeps: 4,
    badge: "Honeymoon Suite",
    intro:
      "A romantic one-bedroom escape for couples seeking a honeymoon, an anniversary, or simply a peaceful getaway for two.",
    features: [
      "A king-size bed (190×203 cm) with a Juliet balcony opening onto the Tuscan trees",
      "A cozy living area with a TV and pull-out sofa",
      "A full bathroom with marble-inspired finishes and heated flooring",
      "A private patio steps from a mini plunge pool overlooking the hills",
    ],
    images: suitePhotos.roma,
    imageAlt: "The Roma Suite — a romantic honeymoon hideaway with a private plunge pool",
    rank: 1,
    highlight: "Private plunge pool",
  },
  {
    slug: "capri",
    name: "Capri Suite",
    tagline: "Private Apartment with Wraparound Views",
    sleeps: 4,
    intro:
      "A private one-bedroom apartment with its own entrance, ideal for couples, solo travelers, or small families.",
    features: [
      "A king-size bed (190×203 cm)",
      "A living area with a pull-out sofa",
      "A modern bathroom with heated flooring",
      "A wraparound balcony and patio over the rolling hills",
    ],
    images: suitePhotos.capri,
    imageAlt: "The Capri Suite — a private apartment with wraparound views of the valley",
    rank: 3,
    highlight: "Private entrance & wraparound terrace",
  },
  {
    slug: "positano",
    name: "Positano Suite",
    tagline: "Cozy Tuscan Escape",
    sleeps: 4,
    intro:
      "An intimate one-bedroom hideaway for couples or small groups, simple and no less charming for it.",
    features: [
      "A queen-size bed with hillside views",
      "A pull-out couch, comfortably sleeping up to 4",
      "A full bathroom with marble-style finishes and heated flooring",
      "A cozy living space with a TV",
    ],
    images: suitePhotos.positano,
    imageAlt: "The Positano Suite — a cozy, intimate Tuscan hideaway with hillside views",
    rank: 5,
    highlight: "Intimate hideaway",
  },
  {
    slug: "milano",
    name: "Milano Suite",
    tagline: "Refined Elegance, Effortless Comfort",
    sleeps: 2,
    intro:
      "A stylish one-bedroom suite dressed in warm, contemporary tones — an intimate base for couples who love sleek design and quiet luxury.",
    features: [
      "A king-size bed (190×203 cm) with premium linens",
      "A refined sitting area with a smart TV",
      "A modern bathroom with marble-look finishes and heated flooring",
      "A private balcony framing the Tuscan hills",
    ],
    images: suitePhotos.milano,
    imageAlt: "The Milano Suite — a refined, contemporary one-bedroom retreat",
    rank: 4,
    highlight: "Contemporary design suite",
  },
];

/** Intro paragraph for the Rooms page (from content.md). */
export const roomsIntro =
  "Discover sophisticated comfort and genuine charm, where every element has been curated for real rest. New bedding, king- and queen-size beds with adjustable pillows, and considerate extras like honey, olives, and citrus straight from the farm. A WhatsApp concierge is on hand throughout your stay, and an optional butler service is available for an added cost.";
