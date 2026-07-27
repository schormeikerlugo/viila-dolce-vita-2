/* ==========================================================================
   experiences.ts — The single Experiences page, its anchored sections, and
   the "Beyond the Villa" link set shown on the homepage.
   All copy from content.md (Experiences page).
   ========================================================================== */

import { photos } from "./media";
import type { ImageMetadata } from "astro";

/** Homepage "Beyond the Villa" links — anchor into the Experiences page. */
export const experienceLinks = [
  { label: "Day Trips & Tours", href: "/experiences#day-trips" },
  { label: "Wellness Area", href: "/experiences#wellness-area" },
  { label: "Animal Sanctuary", href: "/experiences#animal-sanctuary" },
  { label: "Private Workshops", href: "/experiences#workshops" },
];

export interface WellnessItem {
  title: string;
  copy: string;
  soon?: boolean;
}

export const wellness: WellnessItem[] = [
  {
    title: "Pool with Terrace",
    copy: "Panoramic views over the valley, the sea, and the islands. A floating ping pong table, a butler on hand for refreshments, and Dolce & Gabbana-inspired poolside towels on comfortable loungers. A playful yet luxurious oasis for body and mind alike.",
  },
  {
    title: "Barrel Sauna",
    copy: "A handcrafted barrel sauna overlooking the olive orchards and vineyards. Heat, silence, and nature working together, enhanced by the Tuscan landscape, for a session that leaves you relaxed, revitalized, and fully immersed.",
  },
  {
    title: "Outdoor Gym & Boxing Area",
    copy: "Weights suitable for all levels, a stationary bike, and boxing gear, all under open skies. A balance of physical challenge and natural serenity.",
  },
  {
    title: "Golden Hour / Happy Hour",
    copy: "Soft music, cocktails, and locally inspired snacks, with foosball, a kick-about on the grass, or hammocks in the pine tree orchard as the sun goes down. A cherished daily ritual of play, relaxation, and natural beauty.",
  },
  {
    title: "Steam Room & Indoor Lounge",
    copy: "A steam room paired with a sophisticated lounge, Tuscan leather reclining chairs, a whiskey bar, and curated wine tastings from an extensive vintage collection.",
    soon: true,
  },
];

export interface WorkshopGroup {
  title: string;
  items: string[];
}

export const workshops: WorkshopGroup[] = [
  {
    title: "Culinary",
    items: [
      "Hands-on pasta-making: pici, pappardelle, tortelli maremmani",
      "Wood-fired pizza and bread baking",
      "The parmigiano-wheel flambé spaghetti, taught as a live class",
      "Olive oil pressing and tasting, timed to harvest season",
      "Truffle hunting with a local trifolau and dog, followed by a cooking class",
    ],
  },
  {
    title: "Wine & Spirits",
    items: [
      "Blend-your-own wine workshop using regional grapes",
      "A guided vertical tasting through our own cellar",
      "Limoncello or amaro-making with a Tuscan digestivo expert",
    ],
  },
  {
    title: "Wellness & Movement",
    items: [
      "Sunrise yoga on the hilltop terrace, facing the sea",
      "Multi-day wellness retreats combining sauna, pool, and guided hikes",
      "Boxing or fitness intensives using the outdoor gym",
    ],
  },
  {
    title: "Arts & Craft",
    items: [
      "Plein-air painting or photography workshops built around the sea and island view",
      "Floral design, using flowers arranged on the estate daily",
      "Leatherwork or ceramics, both classic Tuscan trades",
    ],
  },
  {
    title: "Nature & Animals",
    items: [
      "A hands-on morning with the rescue animals and the sanctuary's story",
      "A horsemanship clinic with the nearby riding center",
      "Foraging walks for wild herbs and mushrooms with a local guide",
    ],
  },
  {
    title: "Private Groups",
    items: [
      "Executive off-sites and strategy retreats using the villa as a private base",
      "Small-group writers' or creative retreats, quiet and view-driven",
    ],
  },
];

export interface DayTrip {
  title: string;
  copy: string;
  image?: ImageMetadata;
}

export const dayTrips: DayTrip[] = [
  {
    title: "Wine Tasting & Vineyards",
    copy: "You're already inside the Monteregio di Massa Marittima DOC, so this starts at the doorstep. Podere La Pace and Cantina Morisfarms are minutes away; for something more architectural, Rocca di Frassinello (designed by Renzo Piano) is worth the extra drive. Ask about helicopter wine tours linking Chianti and Maremma cellars.",
    image: photos.wineCellar,
  },
  {
    title: "Horseback Riding",
    copy: "Centro Ippico Cavallo Maremma rides through olive groves and vineyards near Lake Accesa, suitable for complete beginners. Maremma is the home of the butteri, Tuscany's working cowboys, who still herd cattle on horseback across this land.",
    image: photos.butteriRider,
  },
  {
    title: "Yacht Charters & Sailing",
    copy: "Marina di Punta Ala and Castiglione della Pescaia, both around forty minutes away, offer everything from bareboat sailboats to skippered motor yachts, and day trips out to Elba, Giglio, and the wider Tuscan Archipelago.",
    image: photos.hillsPinkDawn,
  },
  {
    title: "Medieval Towns & Villages",
    copy: "Massa Marittima is the headline act, with the Cathedral of San Cerbone and the twice-yearly Balestro del Girifalco crossbow tournament. Populonia, Vetulonia, and Scarlino each offer Etruscan history and coastal views.",
    image: photos.monteriggioni,
  },
  {
    title: "Mountain Biking",
    copy: "Massa Marittima is a genuine mountain-biking destination, with hundreds of kilometers of singletrack, all part of the UNESCO Colline Metallifere Geopark. A 90-kilometer ring route opened in 2024, with guided e-bike itineraries down to the beach at Cala Violina.",
    image: photos.cypressRoad,
  },
  {
    title: "Hiking & Nature",
    copy: "Lago dell'Accesa is a turquoise lake ten minutes away with easy trails and swimming. The Colline Metallifere Geopark offers hiking through old mines and geothermal features, and the Via Francigena pilgrim route passes through the area.",
    image: photos.valdorciaMist,
  },
];

/** Self-guided city guides (Florence, Siena) condensed from content.md. */
export const selfGuided = [
  {
    city: "Florence",
    visit: ["Uffizi Gallery (€25)", "Villa Bardini (€10)", "Galleria dell'Accademia (€16)", "Duomo (free)"],
    architecture: ["Piazza della Repubblica", "Ponte Vecchio", "Piazza della Signoria"],
    eat: ["Ditta Artigianale Neri", "All'Antico Vinaio", "Trattoria Sergio Gozzi", "Gelateria del Nero"],
  },
  {
    city: "Siena",
    visit: ["Torre del Mangia", "Civic Museum", "Santa Maria della Scala (€20 combined)"],
    architecture: ["Piazza del Campo", "Piazza del Duomo"],
    eat: ["Torrefazione Fiorella", "Osteria degli Svitati"],
  },
];

/** Chauffeured transfer pricing (content.md). */
export const transfers = [
  { route: "Roma / Aeroporto Fiumicino", price: "€725,00" },
  { route: "Firenze / Aeroporto Amerigo Vespucci (FLR)", price: "€562,50" },
  { route: "Pisa / Aeroporto Galileo Galilei (PSA)", price: "€437,00" },
  { route: "Porto di Livorno", price: "€435,00" },
  { route: "Siena", price: "€375,00" },
];

/** Curated private chauffeured tours (content.md). Prices are for 2 people. */
export const privateTours = [
  {
    title: "Luxury Private Tour",
    duration: "8–9 hours",
    price: "€3,100",
    items: [
      "Rocca di Frassinello — tour and premium tasting",
      "Antinori Cellar visit in Florence",
      "Chianti tour",
      "Gourmet lunch at Ristorante La Villa, L'Andana (wine excluded)",
      "Free exploration of Castiglione della Pescaia",
    ],
  },
  {
    title: "Brolio · Monte Oliveto · Siena",
    duration: "Full day",
    price: "€2,500",
    items: [
      "Brolio Castle — guided tour and wine tasting",
      "Monte Oliveto Abbey — cloister and abbey entry",
      "Lunch in Siena at a high-range restaurant (beverages excluded)",
    ],
  },
  {
    title: "San Gimignano + Michelin-Star Dinner",
    duration: "8–9 hours",
    price: "€3,250",
    items: [
      "Full-day chauffeur",
      "Free exploration of San Gimignano and Siena",
      "Dinner at Saporium, tasting menu (beverages excluded)",
    ],
  },
  {
    title: "Brunello Tour",
    duration: "8–9 hours",
    price: "€2,800",
    items: [
      "Castello Banfi — guided tour and wine tasting",
      "Maserati panoramic tour",
      "Free exploration of Montalcino",
      "Luxury two-course lunch (beverages excluded)",
    ],
  },
  {
    title: "Maserati Scenic Drive",
    duration: "7–8 hours",
    price: "€1,800",
    items: [
      "Panoramic stops at Baratti, Populonia, Castiglione della Pescaia",
    ],
  },
];

/** Sanctuary "a few things to know" list. */
export const sanctuaryNotes = [
  "The animals move freely around the property",
  "They are part of the natural rhythm of life at the villa",
  "Respecting their space and well-being is part of our shared commitment to compassion",
];
