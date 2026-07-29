/* ==========================================================================
   gallery.ts — Visual archive data for the /gallery page.

   Every image lives in src/assets/images/gallery/ named `NNN-slug.{jpg,png}`.
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

/** Per-image metadata, keyed by the file's slug (name without `NNN-`/ext). */
const meta: Record<string, Meta> = {
  "window-sunset-couple": { cat: "experiences", alt: "A couple watches the sunset from the window of their suite" },
  "villa-aerial-night": { cat: "villa", alt: "The villa and its pool aglow from above after dark" },
  "arch-aperitivo-couple": { cat: "experiences", alt: "Aperitivo for two under the arch as the sun goes down" },
  "olive-branch-hand": { cat: "food", alt: "A hand cradles an olive branch in the estate grove" },
  "pool-guest-afternoon": { cat: "villa", alt: "A guest relaxes in the pool on a sunlit afternoon" },
  "garden-party-sunset": { cat: "celebrations", alt: "Guests gather on the lawn for a party at golden hour" },
  "villa-aerial-day": { cat: "villa", alt: "The villa, pool and gardens seen from above by day" },
  "hoopoe-meadow": { cat: "experiences", alt: "A hoopoe pauses in the meadow grass" },
  "pines-valley-deer": { cat: "landscape", alt: "Stone pines over the valley, a deer grazing below" },
  "roe-deer-lavender": { cat: "experiences", alt: "A roe deer among the lavender on the hillside" },
  "olive-harvest-basket": { cat: "food", alt: "Hand-picking olives into a wicker basket in the grove" },
  "pool-terrace-above": { cat: "villa", alt: "The pool and sun terrace seen from above" },
  "stone-pine-hills": { cat: "landscape", alt: "A great stone pine over the rolling Tuscan hills" },
  "gym-sails-wide": { cat: "experiences", alt: "The open-air gym under its sails, set among the trees" },
  "barrel-sauna-garden": { cat: "experiences", alt: "The wooden barrel sauna tucked into the garden" },
  "lavender-rail-valley": { cat: "landscape", alt: "Lavender on the terrace rail, the valley and a lone pine beyond" },
  "gym-weights-deck": { cat: "experiences", alt: "Dumbbells and a bench on the open-air training deck" },
  "stone-pine-sunset": { cat: "landscape", alt: "A lone stone pine against the sky at sunset" },
  "villa-lavender-path": { cat: "villa", alt: "The villa in the distance above a path lined with lavender" },
  "lavender-gravel-drive": { cat: "villa", alt: "The gravel drive winding up between rows of lavender to the villa" },
  "barrel-sauna-trees": { cat: "experiences", alt: "The barrel sauna set among the trees" },
  "villa-pool-day": { cat: "villa", alt: "The yellow villa and its pool on a clear summer day" },
  "outdoor-dinner-tables": { cat: "celebrations", alt: "Tables set for an outdoor dinner under the canopy" },
  "citrus-blossom": { cat: "food", alt: "Citrus blossom in the estate orchard" },
  "oranges-branch-village": { cat: "food", alt: "Oranges ripening on the branch, the hilltop village beyond" },
  "kitchen-dining-interior": { cat: "villa", alt: "The suite's kitchen and dining table set for a meal" },
  "living-room-interior": { cat: "villa", alt: "A warm, elegant living room inside the villa" },
  "sitting-room-curtain": { cat: "villa", alt: "A sunlit sitting room with linen curtains and a soft sofa" },
  "hallway-glass-table": { cat: "villa", alt: "An interior hallway with a glass table and views beyond" },
  "modern-kitchen-lounge": { cat: "villa", alt: "A modern kitchen opening onto a comfortable lounge" },
  "bedroom-arched-door": { cat: "villa", alt: "A bedroom with an arched door opening onto the valley" },
  "bedroom-window": { cat: "villa", alt: "A restful bedroom with a large window and Tuscan light" },
  "bedroom-lamplight": { cat: "villa", alt: "A cozy bedroom in warm lamplight" },
  "marble-bathroom": { cat: "villa", alt: "A modern marble bathroom with a walk-in shower" },
  "gym-deck-sails": { cat: "experiences", alt: "The open-air training deck under its sail canopy" },
  "dining-dusk-table": { cat: "villa", alt: "The dining table set for dinner at dusk, warm light over the Tuscan kitchen" },
  "living-room-lavender": { cat: "villa", alt: "The villa's living room with a glass table and dried lavender, the valley beyond" },
  "living-room-suite": { cat: "villa", alt: "A suite's elegant living room with a chandelier, framed art and a warm Tuscan glow" },
  "breakfast-terrace-pool": { cat: "food", alt: "Breakfast laid out on the poolside table, the valley rolling away beyond" },
  "chef-plating-kitchen": { cat: "food", alt: "The in-house chef plating dinner in the villa's kitchen" },
  "grocery-delivery-dusk": { cat: "food", alt: "A grocery delivery and prepared dishes waiting on the terrace at dusk" },
  "yoga-platform-sails": { cat: "experiences", alt: "The wooden yoga platform under sail canopies, mats laid out among the trees" },
  "patio-sail-lounge": { cat: "villa", alt: "A private gravel patio with lounge sofas under a sail canopy, the yellow villa and olive trees behind" },
  "car-hillside-road": { cat: "experiences", alt: "A car winds along a tree-lined hillside road above the green valley" },
  "hilltown-aerial-fortress": { cat: "tuscany", alt: "A medieval hilltop town and its fortress walls seen from above at golden hour" },
};

export type GalleryItem = {
  slug: string;
  image: ImageMetadata;
  cat: GalleryCategory;
  alt: string;
};

const files = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/images/gallery/*.{jpg,png}",
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
      .replace(/\.(jpe?g|png)$/, "");
    const m = meta[slug];
    if (!m) throw new Error(`gallery.ts: missing metadata for "${slug}"`);
    return { slug, image: files[path].default, cat: m.cat, alt: m.alt };
  });
