/* ==========================================================================
   journal.ts — Journal articles. Each post renders as a real editorial page:
   a full-bleed hero, an "On this page" table of contents built from the
   section headings, section bodies (each with an optional inset image),
   a closing FAQ and a tag list. `journalTeasers` powers the homepage +
   index cards (thinner surface).
   ========================================================================== */

import { photos } from "./media";
import type { ImageMetadata } from "astro";
import type { FaqItem } from "./faq";

/** A section = one H2 heading, its paragraphs, and an optional inset image. */
export interface JournalSection {
  /** Heading text (rendered as an H2). */
  heading: string;
  /** URL-safe anchor id — must be unique within the article (feeds the TOC). */
  slug: string;
  /** Body paragraphs, in order. */
  body: string[];
  /** Optional inset image beneath the heading. */
  image?: ImageMetadata;
  imageAlt?: string;
}

export interface JournalArticle {
  slug: string;
  title: string;
  category: "Things To Do" | "Restaurant Spotlight" | "Estate Diary" | "Wine & Vineyards";
  /** Short standfirst shown under the title in the hero + on index cards. */
  excerpt: string;
  /** Byline + date for the hero meta row. */
  author: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Lead image — hero background + index/card image. */
  image: ImageMetadata;
  imageAlt: string;
  /** The article body, split into anchored sections. */
  sections: JournalSection[];
  /** Closing questions. */
  faqs: FaqItem[];
  /** Lowercase topical tags (rendered as #chips). */
  tags: string[];
}

export const journal: JournalArticle[] = [
  {
    slug: "lago-dell-accesa",
    title: "10 Things to Do in Tuscany",
    category: "Things To Do",
    excerpt:
      "Ten minutes from the villa there's a lake called Lago dell'Accesa — turquoise, spring-fed, and cold enough to make you gasp the first time you get in.",
    author: "Villa Dolce Vita",
    date: "2026-05-18",
    image: photos.valdorciaMist,
    imageAlt: "Misty Tuscan hills at dawn near Lago dell'Accesa",
    sections: [
      {
        heading: "Skip the Coast, Find the Lake",
        slug: "skip-the-coast",
        body: [
          "Every guidebook wants to send you to the coast for a swim. Skip it. Ten minutes from the villa there's a lake called Lago dell'Accesa, turquoise, spring-fed, and cold enough to make you gasp the first time you get in, which is exactly the point.",
          "It used to be mined. Etruscans worked this ground for copper long before anyone thought to swim in it, and there's a small archaeological park at the edge of the water if you want the history along with your tan. Most people don't bother. Most people just walk out onto one of the wooden platforms, jump in, and lie there afterward not thinking about anything in particular.",
        ],
        image: photos.hillsPinkDawn,
        imageAlt: "Soft pink dawn over the Tuscan hills",
      },
      {
        heading: "No Beach Club, No Spritz",
        slug: "no-beach-club",
        body: [
          "There's no beach club. No music. A gravel parking area a couple hundred meters back, some shade if you find the right tree, and water so clear you can watch your own feet disappear into it. Bring your own towel. Bring your own snacks. This is not a place that's going to sell you a fourteen-euro spritz, and that's precisely why it's worth the drive.",
          "Go before ten in the morning if you want the water to yourself. After that, you'll be sharing it with everyone else who eventually figures this place out.",
        ],
      },
      {
        heading: "Making a Day of It",
        slug: "making-a-day-of-it",
        body: [
          "Pair the lake with a slow lunch in Massa Marittima on the way back, or push on to one of the smaller vineyards that dot the road home. The point of a day out here is not to fit ten things in — it's to do one thing properly and let the afternoon go where it wants.",
          "Ask us at the villa and we'll pack the towels, point you to the quiet platform, and have something cold waiting when you get back.",
        ],
        image: photos.cypressRoad,
        imageAlt: "A cypress-lined road winding through Tuscan countryside",
      },
    ],
    faqs: [
      {
        q: "How far is Lago dell'Accesa from the villa?",
        a: "About ten minutes by car. There's a gravel parking area a couple hundred meters back from the water, and wooden platforms out over the lake for swimming.",
      },
      {
        q: "Is there anywhere to buy food or drinks at the lake?",
        a: "No — there's no beach club or bar. Bring your own towel, snacks and water. That's part of the appeal. We're happy to pack a basket for you before you leave.",
      },
      {
        q: "When is the best time to go?",
        a: "Before ten in the morning if you want the water mostly to yourself. Later in the day it fills up with everyone else who's discovered it.",
      },
    ],
    tags: ["lakes", "swimming", "maremma", "day trips", "off the beaten path"],
  },
  {
    slug: "la-tana-dei-brilli",
    title: "Best Restaurants in Follonica",
    category: "Restaurant Spotlight",
    excerpt:
      "La Tana dei Brilli seats maybe twelve people, total. It calls itself the smallest osteria in Italy. Nobody has seriously challenged the claim.",
    author: "Villa Dolce Vita",
    date: "2026-04-29",
    image: photos.romeStreetCafe,
    imageAlt: "A small osteria table in a narrow medieval alley",
    sections: [
      {
        heading: "The Smallest Osteria in Italy",
        slug: "smallest-osteria",
        body: [
          "La Tana dei Brilli seats maybe twelve people, total, and that's being generous about the outdoor tables crammed into the alley next to it. It calls itself the smallest osteria in Italy. Nobody has seriously challenged the claim.",
          "None of this is a design choice meant to feel exclusive. It's just a small restaurant in a medieval town that was built before anyone anticipated crowds.",
        ],
        image: photos.restaurantStreet,
        imageAlt: "A narrow restaurant-lined street in a Tuscan town",
      },
      {
        heading: "A Short Menu, Done Right",
        slug: "short-menu",
        body: [
          "The menu is short because the kitchen is smaller than the menu would need to be to justify a long one. Pappardelle with wild boar. Tortelli stuffed with whatever the region felt like producing that week. A wine list that leans hard into Maremma without apologizing for skipping the famous stuff.",
          "You will wait. You will probably wait outside, in the alley, next to whoever is already eating. The food is better than the wait deserves, which is really all you can ask of a place like this.",
        ],
      },
      {
        heading: "Getting a Table",
        slug: "getting-a-table",
        body: [
          "Fifteen minutes from the villa. Book ahead if you're capable of that kind of planning. If not, show up anyway and take your chances in the alley — the concierge can call ahead and try to save you the wait.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do I need to book ahead?",
        a: "Strongly recommended — the room seats around twelve. We can call ahead from the villa to try to secure a table, but walk-ins take their chances in the alley.",
      },
      {
        q: "What should I order?",
        a: "The pappardelle with wild boar and whatever tortelli they're stuffing that week. The wine list leans into the Maremma, so ask for a local pour.",
      },
      {
        q: "How far is it from the villa?",
        a: "About fifteen minutes by car, in the medieval town near Follonica.",
      },
    ],
    tags: ["dining", "osteria", "follonica", "local food", "maremma"],
  },
  {
    slug: "capri-and-santo",
    title: "Our Favorite Cafe in Massa Marittima",
    category: "Estate Diary",
    excerpt:
      "Every villa has a mascot. Villa Dolce Vita has two, and neither of them signed up for the job.",
    author: "Villa Dolce Vita",
    date: "2026-04-11",
    image: photos.butteriFoal,
    imageAlt: "A rescued animal roaming the estate grounds",
    sections: [
      {
        heading: "Two Mascots Who Never Applied",
        slug: "two-mascots",
        body: [
          "Every villa has a mascot. Villa Dolce Vita has two, and neither of them signed up for the job.",
          "Capri and Santo are the resident dogs, part of a small rescue operation that shares the property with paying guests, olive groves, and a fairly involved wine list. They did not choose to be Instagram-famous. It happened anyway. Ask anyone who has stayed here in the last two years what they remember most, and there's a real chance the answer is not the pool.",
        ],
        image: photos.butteriRider,
        imageAlt: "A rider crossing the open Maremma landscape",
      },
      {
        heading: "A Sanctuary, Not a Petting Zoo",
        slug: "a-sanctuary",
        body: [
          "Most of the animals came from somewhere harder than this. A stray population is not unusual in rural Tuscany, and not every farmhouse decides to do something about it. This one did, and the result is a property where cats sunbathe on the terrace stones and dogs consider every guest a personal responsibility.",
          "Nobody is forcing an interaction. The pool chairs work fine without a dog lying under them. But by the second day, most guests have stopped asking whether the animals are friendly and started asking whether they can bring one home.",
        ],
      },
      {
        heading: "The Answer Is Still No",
        slug: "the-answer-is-no",
        body: [
          "The answer to that, for the record, is no. Everyone asks. The answer stays no.",
        ],
      },
    ],
    faqs: [
      {
        q: "Are the animals friendly with guests?",
        a: "Very. Three dogs and seven cats roam the property freely. Nobody forces an interaction, but most guests are won over by the second day.",
      },
      {
        q: "What if I'd rather not share the space with animals?",
        a: "That's fine to raise before you book. The animals roam freely across the estate, so we ask that guests are comfortable sharing the space with them.",
      },
      {
        q: "Can I adopt one?",
        a: "No. Everyone asks. The answer stays no.",
      },
    ],
    tags: ["estate life", "rescue animals", "sanctuary", "dogs", "behind the scenes"],
  },
  {
    slug: "best-tuscan-vineyards",
    title: "5 Best Tuscan Vineyards",
    category: "Wine & Vineyards",
    excerpt:
      "From Montalcino's Brunello to the coastal Super Tuscans of Bolgheri, five estates within an easy drive of the villa that are worth the detour and the tasting.",
    author: "Villa Dolce Vita",
    date: "2026-03-22",
    image: photos.cypressRoad,
    imageAlt: "A cypress-lined road winding through Tuscan vineyard country",
    sections: [
      {
        heading: "Too Many Vineyards, One Afternoon",
        slug: "too-many-vineyards",
        body: [
          "Tuscany doesn't have a shortage of vineyards. It has the opposite problem. Every hillside within an hour of the villa seems to grow something worth bottling, and deciding where to spend an afternoon is harder than it sounds. These are the five we send guests to first.",
        ],
        image: photos.wineCellar,
        imageAlt: "Rows of aging barrels in a Tuscan wine cellar",
      },
      {
        heading: "Start with Montalcino",
        slug: "start-with-montalcino",
        body: [
          "Start with Montalcino if you only have one day. Brunello is the region's serious wine, aged long and priced accordingly, and the drive up to the town alone is worth the trip. Book a tasting at one of the smaller family estates rather than the big names — the pours are more generous and the conversation is better.",
        ],
      },
      {
        heading: "The Coast and Bolgheri",
        slug: "coast-and-bolgheri",
        body: [
          "Closer to the coast, Bolgheri makes the Super Tuscans that put the region on the international map. The cypress-lined avenue into town is the one from the postcards. The wines are bold, cabernet-driven, and nothing like the Sangiovese you'll taste inland.",
        ],
        image: photos.valdorciaGolden,
        imageAlt: "Golden Tuscan vineyard country at the end of the day",
      },
      {
        heading: "Quiet Producers Close to Home",
        slug: "quiet-producers",
        body: [
          "For something quieter, the small producers around Massa Marittima and the Maremma pour Vermentino and Ciliegiolo that rarely leave the region. No crowds, no tasting-room theatre, just a farmer, a few bottles, and a view. Ask us and we'll make the call for you.",
        ],
      },
    ],
    faqs: [
      {
        q: "Which vineyard should I visit if I only have one day?",
        a: "Montalcino, for Brunello. Book a tasting at a smaller family estate rather than a big name — the pours are more generous and the conversation is better.",
      },
      {
        q: "What's the difference between the inland and coastal wines?",
        a: "Inland you'll find Sangiovese-based reds like Brunello. On the coast, Bolgheri makes bold, cabernet-driven Super Tuscans — a completely different style.",
      },
      {
        q: "Can the villa arrange the tastings?",
        a: "Yes. Tell us what you like and we'll make the calls, from the famous names to the small Maremma producers whose wine rarely leaves the region.",
      },
    ],
    tags: ["wine", "vineyards", "brunello", "bolgheri", "tastings", "maremma"],
  },
];

/** Teasers for homepage + journal index (same objects, thinner surface). */
export const journalTeasers = journal.map(
  ({ slug, title, category, image, imageAlt, excerpt }) => ({
    slug,
    title,
    category,
    image,
    imageAlt,
    excerpt,
  }),
);

export const journalIntro =
  "A running local guide, not a press release: things to do nearby, restaurant spotlights, and life at the estate. Updated as often as there's something worth writing about.";
