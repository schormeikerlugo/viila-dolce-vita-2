/* ==========================================================================
   lqip.ts — low-quality image placeholders (blur-up).
   Generates a tiny (24px) webp for an image at build time; used as the
   tile's background so photos fade in over their own blur, never over grey.
   ========================================================================== */

import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";

/** URL of a tiny 24px webp preview for `src` (generated at build time). */
export async function lqip(src: ImageMetadata): Promise<string> {
  const img = await getImage({ src, width: 24, format: "webp", quality: 30 });
  return img.src;
}

/** Inline style that paints the LQIP as a cover background. */
export async function lqipStyle(src: ImageMetadata): Promise<string> {
  const url = await lqip(src);
  return `background-image:url(${url});background-size:cover;background-position:center`;
}
