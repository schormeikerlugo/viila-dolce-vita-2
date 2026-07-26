/* ==========================================================================
   media.ts — Central, semantic map of every optimizable photo + mockup.
   --------------------------------------------------------------------------
   Astro's <Image> needs statically-analyzable imports. We import each source
   photo once here and re-export it under a meaningful name, so pages/components
   reference `photos.heroValley` instead of "AdobeStock_142591712.jpeg".

   Videos live in /public/videos (already web-optimized by scripts/convert-media)
   and are referenced by plain URL strings, not imports.
   ========================================================================== */

import type { ImageMetadata } from "astro";

/* ---- Landscape / scenery photos (src/assets/images) ---- */
import restaurantStreet from "../assets/images/AdobeStock_125095281.jpeg";
import florenceDuomoDusk from "../assets/images/AdobeStock_128259350.jpeg";
import hillTownValley from "../assets/images/AdobeStock_130627599.jpeg";
import valdorciaGolden from "../assets/images/AdobeStock_142591712.jpeg";
import butteriRider from "../assets/images/AdobeStock_1796327710.jpeg";
import wineCellar from "../assets/images/AdobeStock_182683585.jpeg";
import monteriggioni from "../assets/images/AdobeStock_2052571888.jpeg";
import hillsPinkDawn from "../assets/images/AdobeStock_213190115.jpeg";
import cypressRoad from "../assets/images/AdobeStock_307249910.jpeg";
import terraceTableView from "../assets/images/AdobeStock_421048028.jpeg";
import terraceTableTall from "../assets/images/AdobeStock_421048044.jpeg";
import romeStreetCafe from "../assets/images/AdobeStock_59958744.jpeg";
import florenceDuomoAerial from "../assets/images/AdobeStock_660479470.jpeg";
import montepulciano from "../assets/images/AdobeStock_69197875.jpeg";
import valdorciaMist from "../assets/images/AdobeStock_73719062.jpeg";
import butteriFoal from "../assets/images/AdobeStock_806802471.jpeg";
import welcomeVilla from "../assets/images/seccion2.png"; // transparent PNG (no background)
import massaMarittima from "../assets/images/seccion3.png"; // Massa Marittima cathedral + piazza (full-bleed band)
import contactValleyDusk from "../assets/images/contact-valley-dusk.png"; // dusk over the valley — Contact side image

/* ---- Our Story feature photos (full-resolution originals) ---- */
import landMaremmaHilltown from "../assets/images/land-maremma-hilltown.jpg"; // The Land — Maremma hilltown over the valley
import houseTerraceView from "../assets/images/house-terrace-view.png";       // The House — terrace + valley view
import hilltopRest from "../assets/images/hilltop-rest.png";                   // The Hilltop — rest at altitude

/* ---- Weddings & Events (src/assets/images/weddings) — home teaser gallery ---- */
import weddingVeil from "../assets/images/weddings/wedding-veil.jpg";     // couple under veil, warm Mediterranean light (tall)
import weddingDance from "../assets/images/weddings/wedding-dance.jpg";   // first dance, dramatic gown-lit (mid)
import weddingBouquet from "../assets/images/weddings/wedding-bouquet.jpg"; // couple + lit bouquet (B&W caption tile)
import weddingCoupleSunset from "../assets/images/weddings/wedding-couple-sunset.jpg"; // bride & groom outdoors at dusk, full-length (wide)
import weddingSilhouette from "../assets/images/weddings/wedding-silhouette.jpg";       // couple silhouette against glowing light (dramatic, wide)
import weddingEmbrace from "../assets/images/weddings/wedding-embrace.jpg";             // intimate close-up embrace, warm low light (tall)
import weddingTerraceHilltop from "../assets/images/weddings/wedding-terrace-hilltop.png"; // hilltop terrace over the valley (Weddings hero)
import weddingSettingView from "../assets/images/weddings/wedding-setting-view.png";       // set table on the wisteria terrace, valley beyond (The Setting)

export const photos = {
  welcomeVilla,
  massaMarittima,
  contactValleyDusk,
  landMaremmaHilltown,
  houseTerraceView,
  hilltopRest,
  weddingVeil,
  weddingDance,
  weddingBouquet,
  weddingCoupleSunset,
  weddingSilhouette,
  weddingEmbrace,
  weddingTerraceHilltop,
  weddingSettingView,
  restaurantStreet,
  florenceDuomoDusk,
  hillTownValley,
  valdorciaGolden,
  butteriRider,
  wineCellar,
  monteriggioni,
  hillsPinkDawn,
  cypressRoad,
  terraceTableView,
  terraceTableTall,
  romeStreetCafe,
  florenceDuomoAerial,
  montepulciano,
  valdorciaMist,
  butteriFoal,
} satisfies Record<string, ImageMetadata>;

/* ---- Branded product mockups (src/assets/images/mockups) ----
   Semantic names verified against each source PNG. */
import mkTableSetting from "../assets/images/mockups/image 2.png";      // menu + reserved card + coaster + napkin ring
import mkDiningTable from "../assets/images/mockups/image 3.png";       // sunset table: menu, placemat, coaster, reserved
import mkBathLinens from "../assets/images/mockups/image 4.png";        // towels, robe on hanger, slippers, laundry bag
import mkApparelOlive from "../assets/images/mockups/image 5.png";      // apron, tote, cap, polo, foulard, keyring, pouch
import mkWelcomeLetter from "../assets/images/mockups/image 6.png";     // welcome letter + room key (branding)
import mkStationery from "../assets/images/mockups/image 7.png";        // stationery / branding
import mkWineGift from "../assets/images/mockups/image 8.png";          // wine bottle + gift basket + tasting notes
import mkAmenitiesOlive from "../assets/images/mockups/image 9.png";    // bath amenities (olive labels)
import mkGourmet from "../assets/images/mockups/image 10.png";          // olive oil, honey, mug, tea towel
import mkBranding11 from "../assets/images/mockups/image 11.png";       // branding
import mkMenuReserved from "../assets/images/mockups/image 12.png";     // menu + riservato (dining)
import mkPoolBathCream from "../assets/images/mockups/image 13.png";    // towels, robe, laundry bag, slippers (poolside)
import mkApparelNavy from "../assets/images/mockups/image 14.png";      // navy polo, cap, tote, pouch, striped towel
import mkBranding15 from "../assets/images/mockups/image 15.png";       // branding
import mkBranding16 from "../assets/images/mockups/image 16.png";       // branding
import mkBranding17 from "../assets/images/mockups/image 17.png";       // branding
import mkAmenitiesFull from "../assets/images/mockups/image 18.png";    // shampoo/conditioner/lotion/candle/soap/salts
import mkBranding19 from "../assets/images/mockups/image 19.png";       // branding
import mkPoolLounge from "../assets/images/mockups/image 20.png";       // pool towel, cushion, cap, tote, marble tray

export const mockups = {
  // --- Shop-facing products ---
  tableSetting: mkTableSetting,
  diningTable: mkDiningTable,
  bathLinens: mkBathLinens,
  apparelOlive: mkApparelOlive,
  wineGift: mkWineGift,
  amenitiesOlive: mkAmenitiesOlive,
  gourmet: mkGourmet,
  poolBathCream: mkPoolBathCream,
  apparelNavy: mkApparelNavy,
  amenitiesFull: mkAmenitiesFull,
  poolLounge: mkPoolLounge,
  menuReserved: mkMenuReserved,
  // --- Branding / signage (used on About, Rooms, Dining) ---
  welcomeLetter: mkWelcomeLetter,
  stationery: mkStationery,
  branding11: mkBranding11,
  branding15: mkBranding15,
  branding16: mkBranding16,
  branding17: mkBranding17,
  branding19: mkBranding19,
} satisfies Record<string, ImageMetadata>;

/* ---- Per-suite room photos (src/assets/images/suites/<slug>) ----
   Copied from content/Images/Suites by scripts/convert-media (copySuites).
   Each suite exposes an ordered gallery; [0] is the card/lead image. */
import capri1 from "../assets/images/suites/capri/capri-1.png";

import milano1 from "../assets/images/suites/milano/milano-1.jpg";

import napoli1 from "../assets/images/suites/napoli/napoli-1.png";
import napoli2 from "../assets/images/suites/napoli/napoli-2.png";
import napoli3 from "../assets/images/suites/napoli/napoli-3.png";
import napoli4 from "../assets/images/suites/napoli/napoli-4.png";
import napoli5 from "../assets/images/suites/napoli/napoli-5.png";
import napoli6 from "../assets/images/suites/napoli/napoli-6.png";

import positano1 from "../assets/images/suites/positano/positano-1.png";
import positano2 from "../assets/images/suites/positano/positano-2.png";
import positano3 from "../assets/images/suites/positano/positano-3.png";
import positano4 from "../assets/images/suites/positano/positano-4.png";
import positano5 from "../assets/images/suites/positano/positano-5.png";

import roma1 from "../assets/images/suites/roma/roma-1.jpg";
import roma2 from "../assets/images/suites/roma/roma-2.png";
import roma3 from "../assets/images/suites/roma/roma-3.png";
import roma4 from "../assets/images/suites/roma/roma-4.png";
import roma5 from "../assets/images/suites/roma/roma-5.jpg";
import roma6 from "../assets/images/suites/roma/roma-6.jpg";

export const suitePhotos = {
  capri: [capri1],
  milano: [milano1],
  napoli: [napoli1, napoli2, napoli3, napoli4, napoli5, napoli6],
  positano: [positano1, positano2, positano3, positano4, positano5],
  roma: [roma1, roma2, roma3, roma4, roma5, roma6],
} satisfies Record<string, ImageMetadata[]>;

/* ---- Web-ready videos (public/videos) — referenced by URL ---- */
const V = "/videos";
export const videos = {
  laDolceVita: `${V}/LaDolceVita`, // main home hero
  nightSky: `${V}/AdobeStock_105691259`,
  aerialTownGolden: `${V}/AdobeStock_1063526130`,
  grapeHarvest: `${V}/AdobeStock_132949803`,
  terraceDining: `${V}/AdobeStock_134096176`,
  lavenderField: `${V}/AdobeStock_1666287388`,
  socialToast: `${V}/AdobeStock_208447201`,
  sunForest: `${V}/AdobeStock_267761054`,
  butteriArch: `${V}/AdobeStock_278824177`,
  aerialMedieval: `${V}/AdobeStock_354666909`,
  kitchenPasta: `${V}/AdobeStock_356205980`,
  cypressRoadDrive: `${V}/AdobeStock_453992980`,
  medievalArchPiazza: `${V}/AdobeStock_599116141`,
  vineyardDinner: `${V}/AdobeStock_621847746`,
  medievalAlley: `${V}/AdobeStock_635357112`,
} as const;

/** Videos that ship an additional 720p variant (`<name>-720.webm/mp4`) for
 *  small screens. Generate with ffmpeg, e.g.:
 *  ffmpeg -i in.mp4 -vf scale=1280:-2 -c:v libx264 -crf 26 -an out-720.mp4 */
const has720: ReadonlySet<keyof typeof videos> = new Set(["laDolceVita"]);

/** Helper: build <source> URLs + poster for a given video key. */
export function videoSources(key: keyof typeof videos) {
  const base = videos[key];
  return {
    webm: `${base}.webm`,
    mp4: `${base}.mp4`,
    poster: `${base}-poster.jpg`,
    /** Optional lighter sources for viewports ≤768px. */
    webm720: has720.has(key) ? `${base}-720.webm` : undefined,
    mp4720: has720.has(key) ? `${base}-720.mp4` : undefined,
  };
}
