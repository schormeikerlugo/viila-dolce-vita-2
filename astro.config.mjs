// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://villadolcevita.eu",
  integrations: [
    react(),
    sitemap({
      // Keep the noindex admin shell out of the sitemap.
      filter: (page) => !page.includes("/admin"),
    }),
  ],
  // Preserve old bookmarks/links after the slug changes
  // (About Us → Our Story → The Property, Rooms → Suites).
  redirects: {
    "/about-us": "/the-property",
    "/our-story": "/the-property",
    "/rooms": "/suites",
  },
  image: {
    // Sharp handles the large 3-5K source photos -> responsive AVIF/WebP.
    service: { entrypoint: "astro/assets/services/sharp" },
  },
  vite: {
    // GSAP + Lenis are client-only; keep them out of the SSR bundle.
    ssr: { noExternal: ["gsap", "lenis"] },
  },
});