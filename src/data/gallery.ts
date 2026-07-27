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
  "pool-gathering": { cat: "celebrations", alt: "Guests gather by the pool with the valley beyond" },
  "loggia-sunset-couple": { cat: "experiences", alt: "A couple watches the sunset from the loggia, glasses in hand" },
  "arch-aperitivo-group": { cat: "celebrations", alt: "An aperitivo gathering under the arch at golden hour" },
  "loggia-wine-couple": { cat: "experiences", alt: "Wine for two under the loggia as the sun goes down" },
  "villa-pool-afternoon": { cat: "villa", alt: "The yellow villa and its pool on a sunlit afternoon" },
  "villa-plunge-olives": { cat: "villa", alt: "The villa and its plunge pool glimpsed through the olive branches" },
  "villa-loggia-terrace": { cat: "villa", alt: "The villa's arched loggia and terrace in the golden evening light" },
  "villa-drive": { cat: "villa", alt: "The villa on its hilltop above the gravel drive" },
  "villa-aerial": { cat: "villa", alt: "The villa, pool and gardens seen from above" },
  "plunge-pool-guest": { cat: "villa", alt: "A guest relaxes in the plunge pool, the hills beyond" },
  "stone-pine-sky": { cat: "landscape", alt: "A great stone pine reaching into the Tuscan sky" },
  "lone-pine-valley": { cat: "landscape", alt: "A lone stone pine over the valley at first light" },
  "barrel-sauna-garden": { cat: "experiences", alt: "The wooden barrel sauna tucked into the garden" },
  "barrel-sauna-trees": { cat: "experiences", alt: "The barrel sauna set among the trees" },
  "barrel-sauna-steps": { cat: "experiences", alt: "Stone steps climbing to the garden barrel sauna" },
  "gym-weights-detail": { cat: "experiences", alt: "Dumbbells and a bench on the open-air training deck" },
  "gym-sails-wide": { cat: "experiences", alt: "The open-air gym under its sails, set among the trees" },
  "gym-sail-canopy": { cat: "experiences", alt: "The training deck shaded by a sail canopy" },
  "gym-deck-distant": { cat: "experiences", alt: "The wooden fitness deck looking out over the countryside" },
  "gym-golden-hour": { cat: "experiences", alt: "The open-air gym at golden hour" },
  "hillside-pines": { cat: "landscape", alt: "Stone pines on the hillside in the late light" },
  "gym-deck-trees": { cat: "experiences", alt: "The training deck on its platform among the trees" },
  "gym-deck-empty": { cat: "experiences", alt: "The shaded training deck in the garden" },
  "gym-mountains": { cat: "experiences", alt: "The training deck with the mountains beyond" },
  "outdoor-dinner-lights": { cat: "celebrations", alt: "Tables set for an outdoor dinner under the string lights" },
  "villa-hill-lavender-drive": { cat: "villa", alt: "The villa on its hill above the lavender and the winding drive" },
  "villa-terraced-hillside": { cat: "villa", alt: "The estate's terraced hillside, lavender lining the drive" },
  "villa-pines-lavender": { cat: "villa", alt: "The villa framed by stone pines and rows of lavender" },
  "villa-green-hilltop": { cat: "villa", alt: "The yellow villa on its green hilltop at golden hour" },
  "lavender-rail-valley": { cat: "landscape", alt: "Lavender on the terrace rail, the valley and a lone pine beyond" },
  "lavender-urn-valley": { cat: "landscape", alt: "Lavender in a gilded urn on the terrace, the valley beyond" },
  "terrace-valley-view": { cat: "landscape", alt: "The valley view from the terrace balustrade" },
  "sauna-window-view": { cat: "experiences", alt: "A quiet moment in the sauna, the countryside through the window" },
  "oranges-branch": { cat: "food", alt: "Oranges ripening on the branch in the estate garden" },
  "citrus-blossom": { cat: "food", alt: "Citrus blossom in the estate orchard" },
  "lavender-pine-sunset": { cat: "landscape", alt: "Rows of lavender and a stone pine as the sun sets over the valley" },
  "hoopoe-meadow": { cat: "experiences", alt: "A hoopoe pauses in the meadow grass" },
  "hoopoe-hillside": { cat: "experiences", alt: "A hoopoe on the hillside, the hills behind" },
  "villa-pool-above": { cat: "villa", alt: "The villa's pool and sun terrace from above" },
  "villa-pool-loggia-above": { cat: "villa", alt: "The pool, terrace and loggia seen from above" },
  "roe-deer-lavender": { cat: "experiences", alt: "A roe deer in the lavender at dusk" },
  "roe-deer-village": { cat: "experiences", alt: "A roe deer among the lavender, the hilltop village beyond" },
  "roe-deer-garden": { cat: "experiences", alt: "A roe deer crossing the garden at first light" },
  "kitchen-plating": { cat: "food", alt: "A cook plates a dish of fresh greens in the villa's stone kitchen" },
  "rider-hills": { cat: "experiences", alt: "A rider on horseback above the Tuscan hills" },
  "buttero-evening": { cat: "experiences", alt: "A buttero on his horse in the golden evening light" },
  "cathedral-cafe-read": { cat: "village", alt: "Coffee and a book in the cathedral square of Massa Marittima" },
  "cypress-road": { cat: "landscape", alt: "The white road winding between cypresses and green hills" },
  "hilltop-fortress-aerial": { cat: "tuscany", alt: "A hilltop fortress town crowning its ridge" },
  "cathedral-aerial": { cat: "tuscany", alt: "The cathedral of San Cerbone and the rooftops of Massa Marittima" },
  "enoteca-couple": { cat: "celebrations", alt: "A couple pauses outside the enoteca in the old town" },
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
