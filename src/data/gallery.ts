/* ==========================================================================
   gallery.ts — Visual archive data for the /gallery page.

   Every image lives in src/assets/images/gallery/ named `NNN-slug.jpg`.
   The glob below picks them up automatically; `meta` adds the category and
   alt text, keyed by slug. Adding a photo = drop the file + add one entry.
   ========================================================================== */

import type { ImageMetadata } from "astro";

/** Filter categories, in display order. */
export const galleryCategories = [
  { id: "villa", label: "The Villa" },
  { id: "landscape", label: "Landscape" },
  { id: "experiences", label: "Experiences" },
  { id: "village", label: "Village Life" },
  { id: "tuscany", label: "Around Tuscany" },
  { id: "food", label: "Food & Wine" },
  { id: "celebrations", label: "Celebrations" },
] as const;

export type GalleryCategory = (typeof galleryCategories)[number]["id"];

type Meta = { cat: GalleryCategory; alt: string };

/** Per-image metadata, keyed by the file's slug (name without `NNN-`/`.jpg`). */
const meta: Record<string, Meta> = {
  "village-lane-bicycle": { cat: "village", alt: "A bicycle rests against a stone doorway in a quiet village lane" },
  "massa-marittima-piazza": { cat: "tuscany", alt: "The cathedral square of Massa Marittima under a summer sky" },
  "hilltown-tower-valley": { cat: "tuscany", alt: "A medieval tower rising over rooftops, the valley far below" },
  "wedding-embrace": { cat: "celebrations", alt: "A couple holds each other close after the ceremony" },
  "vineyard-wine-sunset": { cat: "food", alt: "Wine and grapes on an old barrel as the sun drops behind the vines" },
  "wine-cellar-barrels": { cat: "food", alt: "Oak barrels resting in the warm light of the cellar" },
  "estate-vineyards-aerial": { cat: "landscape", alt: "The estate and its vineyards seen from above" },
  "hills-pink-dawn": { cat: "landscape", alt: "Pink dawn light over the Tuscan hills" },
  "cypress-road-hills": { cat: "landscape", alt: "A white road winding between cypresses and green hills" },
  "terrace-table-view": { cat: "villa", alt: "The loggia terrace with sun loungers, the hills opening out beyond" },
  "pergola-long-table": { cat: "villa", alt: "The villa and its pool glimpsed through the surrounding trees" },
  "street-cafe-menu": { cat: "food", alt: "A hand-written menu on a checked tablecloth in town" },
  "florence-duomo": { cat: "tuscany", alt: "The Duomo of Florence at golden hour" },
  "montepulciano-view": { cat: "tuscany", alt: "Rooftops and hills seen from the old town walls" },
  "valdorcia-mist": { cat: "landscape", alt: "Morning mist settling into the folds of the Val d'Orcia" },
  "horseman": { cat: "experiences", alt: "A buttero and his horse in the morning field" },
  "pool-afternoon": { cat: "villa", alt: "The villa with its pool and lawn on a bright afternoon" },
  "hills-ridge": { cat: "landscape", alt: "The ridge line running green to the horizon" },
  "cypress-alley": { cat: "landscape", alt: "Cypress trees flanking the white gravel road" },
  "green-hills": { cat: "landscape", alt: "Green hills rolling away from the estate" },
  "cathedral-strollers": { cat: "tuscany", alt: "An evening stroll across the cathedral square" },
  "lake-ruins": { cat: "landscape", alt: "Etruscan stones resting by the lake shore" },
  "white-horses-ride": { cat: "experiences", alt: "Riders leading white horses through tall grass" },
  "saddle-leather": { cat: "experiences", alt: "Worn leather and brass — a saddle up close" },
  "saddling-up": { cat: "experiences", alt: "Saddling up before the morning ride" },
  "saddle-detail": { cat: "experiences", alt: "The quiet ritual of tacking up" },
  "olive-grove-work": { cat: "experiences", alt: "Tending the olive trees in spring" },
  "olive-grove-walk": { cat: "experiences", alt: "A slow walk through the olive grove" },
  "olive-blossom": { cat: "experiences", alt: "Olive blossom held up to the light" },
  "olive-branch": { cat: "experiences", alt: "A young olive branch between careful fingers" },
  "beekeeper": { cat: "experiences", alt: "The beekeeper lifts a frame heavy with honey" },
  "thermal-springs": { cat: "experiences", alt: "Steam rising off the thermal terraces" },
  "viewpoint-couple": { cat: "experiences", alt: "A pause at the viewpoint, wine in hand" },
  "cave-walk": { cat: "experiences", alt: "Stepping into the cool of the old cave" },
  "night-valley": { cat: "landscape", alt: "Night settling over the valley below the villa" },
  "poppy-hillside": { cat: "landscape", alt: "Poppies scattered across the spring hillside" },
  "market-morning": { cat: "village", alt: "Morning shopping at the town market" },
  "market-stall": { cat: "village", alt: "Greens and radishes piled high at the stall" },
  "first-light-hills": { cat: "landscape", alt: "First light catching the mist and the poppies" },
  "piazza-dinner": { cat: "village", alt: "Dinner tables filling the piazza at dusk" },
  "night-piazza-cathedral": { cat: "village", alt: "The cathedral square at night, tables full" },
  "piazza-dusk": { cat: "village", alt: "Blue hour settling over the square" },
  "square-dinner-service": { cat: "village", alt: "Dinner service in the old stone square" },
  "enoteca-doorway": { cat: "village", alt: "Pausing at the enoteca door" },
  "night-cafes": { cat: "village", alt: "Café tables spilling into the night street" },
  "cathedral-blue-hour": { cat: "village", alt: "The cathedral facade at blue hour" },
  "evening-passeggiata": { cat: "village", alt: "The evening passeggiata through town" },
  "night-street-cafes": { cat: "village", alt: "Lamplight and conversation in the narrow street" },
  "long-table-toast": { cat: "celebrations", alt: "A toast down the length of the table" },
  "alley-diners": { cat: "village", alt: "Dinner for two in the lamplit alley" },
  "seaside-promenade": { cat: "tuscany", alt: "The seaside promenade on a warm evening" },
  "alley-night-walk": { cat: "village", alt: "A walk home through the old town" },
  "stringlight-toast": { cat: "celebrations", alt: "Glasses raised under the string lights" },
  "toast-close": { cat: "celebrations", alt: "The moment the glasses meet" },
  "bluehour-alley-tables": { cat: "village", alt: "Tables set in the blue-hour alley" },
  "lamplit-street": { cat: "village", alt: "A lamplit street winding uphill" },
  "wine-bar": { cat: "food", alt: "Inside the wine bar, bottles to the ceiling" },
  "night-piazza-tall": { cat: "village", alt: "The piazza after dark" },
  "night-market-square": { cat: "village", alt: "The night market in the main square" },
  "night-square-people": { cat: "village", alt: "An evening gathering in the square" },
  "couple-alley-walk": { cat: "village", alt: "Wandering the alleys after dinner" },
  "harbor-town-street": { cat: "tuscany", alt: "A busy street in the harbour town" },
  "ruins-tour": { cat: "experiences", alt: "Walking the Etruscan ruins with a guide" },
  "bar-bicycles": { cat: "village", alt: "Bicycles parked outside the bar" },
  "lounge-party": { cat: "celebrations", alt: "An evening reception in the lounge" },
  "sunset-gathering-cliff": { cat: "celebrations", alt: "A sunset gathering above the sea" },
  "sunset-sea-crowd": { cat: "celebrations", alt: "Watching the sun go down over the water" },
  "night-party": { cat: "celebrations", alt: "The celebration carries on into the night" },
  "golf-by-the-sea": { cat: "experiences", alt: "Tee time under the umbrella pines, sea beyond" },
  "sailing": { cat: "experiences", alt: "Out on the water under sail" },
  "horseback-hills": { cat: "experiences", alt: "Riding out across the hills" },
  "riders-trail": { cat: "experiences", alt: "Single file down the trail" },
  "medieval-festival": { cat: "village", alt: "Festival day in the old town" },
  "festival-cathedral": { cat: "village", alt: "Banners and crowds by the cathedral" },
  "cathedral-town-aerial": { cat: "tuscany", alt: "Massa Marittima from above" },
  "heart-lake": { cat: "landscape", alt: "A heart-shaped lake ringed by green" },
  "turquoise-cove": { cat: "tuscany", alt: "A turquoise cove on the Maremma coast" },
  "harbor-village-aerial": { cat: "tuscany", alt: "The harbour village from the air" },
  "hilltop-fortress-aerial": { cat: "tuscany", alt: "A fortress town crowning its hill" },
  "marina-peninsula": { cat: "tuscany", alt: "The marina and the pine-covered peninsula" },
  "cathedral-piazza-i": { cat: "tuscany", alt: "The cathedral of San Cerbone, Massa Marittima" },
  "cathedral-piazza-ii": { cat: "tuscany", alt: "Piazza Garibaldi under a clear sky" },
  "cathedral-piazza-iii": { cat: "tuscany", alt: "The travertine steps of the cathedral" },
  "cathedral-piazza-iv": { cat: "tuscany", alt: "Massa Marittima's cathedral square at noon" },
  "cathedral-rooftops-i": { cat: "tuscany", alt: "Cathedral and rooftops from the tower" },
  "cathedral-rooftops-ii": { cat: "tuscany", alt: "The bell tower over the old town" },
  "cathedral-aerial-i": { cat: "tuscany", alt: "The cathedral quarter from above" },
  "cathedral-aerial-ii": { cat: "tuscany", alt: "Red rooftops gathered around the cathedral" },
  "cathedral-aerial-iii": { cat: "tuscany", alt: "The square and its long shadows, from the air" },
  "cathedral-aerial-iv": { cat: "tuscany", alt: "Massa Marittima's skyline from a drone" },
  "cathedral-aerial-v": { cat: "tuscany", alt: "The cathedral and the hills beyond" },
  "cathedral-aerial-vi": { cat: "tuscany", alt: "Cathedral, tower and town in one frame" },
  "cathedral-panorama": { cat: "tuscany", alt: "A wide look across the piazza" },
  "town-square-aerial": { cat: "tuscany", alt: "The town square from directly above" },
  "castle-hill": { cat: "tuscany", alt: "A castle keep on its wooded hill" },
  "tower-ruins-i": { cat: "tuscany", alt: "The old watchtower against the valley" },
  "tower-ruins-ii": { cat: "tuscany", alt: "Ruined walls catching the afternoon light" },
  "fortress-ruins-i": { cat: "tuscany", alt: "The fortress ruins from the air" },
  "fortress-ruins-ii": { cat: "tuscany", alt: "Stone ramparts above the woods" },
  "fortress-stairs": { cat: "tuscany", alt: "The stair climbing the fortress wall" },
  "fortress-aerial": { cat: "tuscany", alt: "The fortress and its green surroundings" },
  "castle-silhouette": { cat: "tuscany", alt: "The castle against a deep blue sky" },
  "village-fortress-aerial": { cat: "tuscany", alt: "Village and fortress sharing the hilltop" },
  "tower-gate": { cat: "tuscany", alt: "The tower gate, sea haze on the horizon" },
  "balcony-sunset": { cat: "villa", alt: "The yellow villa framed by olive branches on the hillside" },
  "arch-aperitivo": { cat: "villa", alt: "The arched loggia and terrace, loungers set out in the sun" },
  "villa-aerial-day": { cat: "villa", alt: "The villa, pool and gardens from above" },
  "villa-aerial-grounds": { cat: "villa", alt: "The hilltop estate and its pool seen from the air" },
  "villa-aerial-dusk": { cat: "villa", alt: "The villa, pool and terrace with the valley beyond" },
  "villa-aerial-golden": { cat: "villa", alt: "The villa's honey-coloured facade above its gravel drive" },
  "outdoor-gym-canopy": { cat: "experiences", alt: "The open-air gym under its canopy, hills stretching beyond" },
  "outdoor-gym-sail": { cat: "experiences", alt: "Training deck shaded by a sail, set among the trees" },
  "outdoor-gym-deck": { cat: "experiences", alt: "The wooden fitness deck looking out over the countryside" },
  "gym-weights-detail": { cat: "experiences", alt: "Dumbbells and a bench on the open-air training deck" },
  "barrel-sauna-garden": { cat: "experiences", alt: "A wooden barrel sauna tucked into the garden" },
};

export type GalleryItem = {
  slug: string;
  image: ImageMetadata;
  cat: GalleryCategory;
  alt: string;
};

const files = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/images/gallery/*.jpg",
  { eager: true },
);

/** All gallery items, in filename (curated) order. */
export const galleryItems: GalleryItem[] = Object.keys(files)
  .sort()
  .map((path) => {
    const slug = path
      .split("/")
      .pop()!
      .replace(/^\d+-/, "")
      .replace(/\.jpg$/, "");
    const m = meta[slug];
    if (!m) throw new Error(`gallery.ts: missing metadata for "${slug}"`);
    return { slug, image: files[path].default, cat: m.cat, alt: m.alt };
  });
