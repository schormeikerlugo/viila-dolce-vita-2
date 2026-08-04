/* ==========================================================================
   scroll.ts — Global scroll experience (Lenis smooth-scroll + GSAP reveals)
   --------------------------------------------------------------------------
   Responsibilities:
   1. Boot Lenis for buttery smooth scrolling (reschio-style feel).
   2. Sync Lenis with GSAP's ticker + ScrollTrigger.
   3. Provide reusable, declarative scroll behaviours driven by data-attributes
      so .astro components stay clean and don't ship bespoke JS each:
        - [data-reveal]        fade + rise in when entering the viewport
        - [data-parallax="0.2"] subtle parallax on the element (0..1 strength)
        - [data-pin-fade]      crossfade a pinned media panel on scroll
   4. Respect prefers-reduced-motion (no smooth scroll, instant reveals).
   ========================================================================== */

import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

declare global {
  interface Window {
    /** Lenis-aware scroll helper for React islands; set once Lenis boots. */
    __lenisScrollTo?: (
      target: number | string | HTMLElement,
      opts?: { offset?: number; duration?: number; immediate?: boolean },
    ) => void;
  }
}

gsap.registerPlugin(ScrollTrigger, SplitText);

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let lenis: Lenis | null = null;
let rafCallback: ((time: number) => void) | null = null;

/** Boot Lenis and wire it to GSAP's ticker + ScrollTrigger. */
function initSmoothScroll() {
  if (prefersReducedMotion()) return;

  lenis = new Lenis({
    // Longer duration + gentle exponential ease = fluid, app-like inertia.
    duration: 1.35,
    easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.5,
    lerp: 0.09,
  });

  document.documentElement.classList.add("lenis");

  lenis.on("scroll", ScrollTrigger.update);
  rafCallback = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(rafCallback);
  gsap.ticker.lagSmoothing(0);

  // Expose a scroll helper for React islands (e.g. the /book wizard), which
  // can't reach this module's private `lenis` instance. Recalculate limits
  // first: when the new step is shorter, the document shrinks and Lenis would
  // otherwise clamp to a stale (too-low) max, leaving the page scrolled down.
  window.__lenisScrollTo = (target, opts) => {
    if (lenis) {
      lenis.resize();
      lenis.scrollTo(target, opts);
    } else {
      window.scrollTo({ top: typeof target === "number" ? target : 0, behavior: "smooth" });
    }
  };
}

/**
 * [data-split] — display headings reveal line by line behind a mask.
 * The luxury-editorial signature move. Waits for fonts so line breaks are
 * measured correctly; falls back to a plain reveal on reduced motion.
 */
let splitInstances: SplitText[] = [];

function initSplitReveals() {
  const targets = gsap.utils.toArray<HTMLElement>("[data-split]");
  if (!targets.length) return;

  if (prefersReducedMotion()) {
    targets.forEach((el) => el.classList.add("is-split-ready"));
    return;
  }

  const build = () => {
    targets.forEach((el) => {
      // Never split twice (View Transitions can re-run init).
      if (el.dataset.splitDone === "1") return;
      el.dataset.splitDone = "1";

      const split = new SplitText(el, {
        type: "lines",
        linesClass: "split-line",
        // Wrap each line in a masking parent so the text rises from behind
        // a clean edge instead of fading in place.
        mask: "lines",
      });
      splitInstances.push(split);
      el.classList.add("is-split-ready");

      gsap.from(split.lines, {
        yPercent: 110,
        duration: 1.1,
        stagger: 0.09,
        ease: "power4.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      });
    });
    ScrollTrigger.refresh();
  };

  // Fonts must be loaded before measuring lines (Bodoni is a variable font).
  if (document.fonts?.status === "loaded") build();
  else document.fonts?.ready.then(build).catch(build);
}

/** [data-reveal] — staggered fade + rise as elements enter the viewport. */
function initReveals() {
  const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]");
  if (!targets.length) return;

  if (prefersReducedMotion()) {
    targets.forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  targets.forEach((el) => {
    const delay = parseFloat(el.dataset.revealDelay ?? "0");
    gsap.fromTo(
      el,
      { opacity: 0, y: 18 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        delay,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none",
          onEnter: () => el.classList.add("is-revealed"),
        },
      },
    );
  });
}

/**
 * initSectionReveals — gives every <section> a soft, app-like entrance as it
 * scrolls into view (fade + gentle rise). Sections that opt out with
 * [data-no-reveal], the hero, pinned sections, and full-screen media sections
 * are skipped so their own choreography isn't disturbed.
 */
function initSectionReveals() {
  const sections = gsap.utils.toArray<HTMLElement>("main > section, main > *");

  const skip = (el: HTMLElement) =>
    el.hasAttribute("data-no-reveal") ||
    el.hasAttribute("data-pin-fade") ||
    el.classList.contains("hero") ||
    el.classList.contains("finalcta") ||
    el.classList.contains("experience") ||
    el.tagName !== "SECTION";

  sections.forEach((el) => {
    if (skip(el)) return;

    if (prefersReducedMotion()) {
      el.style.opacity = "1";
      el.style.transform = "none";
      return;
    }

    // FADE IN — a quiet fade + subtle rise as the section enters view.
    // Editorial restraint: sections reveal once and stay revealed.
    gsap.set(el, { opacity: 0, y: 24 });
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        toggleActions: "play none none none",
      },
    });
  });
}

/** [data-parallax] — gentle vertical parallax tied to scroll. */
function initParallax() {
  if (prefersReducedMotion()) return;
  const targets = gsap.utils.toArray<HTMLElement>("[data-parallax]");

  targets.forEach((el) => {
    const strength = parseFloat(el.dataset.parallax ?? "0.15");
    // Centre the travel around 0 (+half → −half) so the media never uncovers
    // its container edges: the overscan margin only needs to cover half the
    // total travel on each side. Keeps the fill seamless top AND bottom.
    const half = strength * 50;
    gsap.fromTo(
      el,
      { yPercent: half },
      {
        yPercent: -half,
        ease: "none",
        scrollTrigger: {
          trigger: el.closest("[data-parallax-scope]") ?? el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      },
    );
  });
}

/**
 * [data-pin-fade] — reschio-style pinned section: the media stays fixed while
 * layered captions crossfade. Add data-pin-fade to the section, and
 * data-pin-layer to each stacked layer inside it.
 */
function initPinFades() {
  if (prefersReducedMotion()) return;
  const sections = gsap.utils.toArray<HTMLElement>("[data-pin-fade]");

  sections.forEach((section) => {
    const layers = gsap.utils.toArray<HTMLElement>(
      "[data-pin-layer]",
      section,
    );
    if (layers.length < 2) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${layers.length * 100}%`,
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    });

    layers.forEach((layer, i) => {
      if (i === 0) return;
      tl.to(layers[i - 1], { autoAlpha: 0, duration: 0.5 }, i - 0.5).fromTo(
        layer,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.5 },
        i - 0.5,
      );
    });
  });
}

/**
 * initSuitesCarousel — the pinned horizontal suites carousel.
 *
 * Desktop (>=861px, motion allowed): the section pins and vertical scroll is
 * translated into horizontal travel of the track. Each suite is centred in
 * turn and becomes the large "protagonist" card. The guest must scroll through
 * all suites before the page continues below.
 *
 * Mobile / reduced motion: no pin — the track falls back to native
 * scroll-snap (handled by CSS + a light scroll listener here).
 *
 * Registered inside initScroll (after destroyScroll + Lenis boot) so it shares
 * the global ScrollTrigger lifecycle and refresh, and coexists with Lenis.
 */
function initSuitesCarousel() {
  const roots = gsap.utils.toArray<HTMLElement>("[data-suites-showcase]");
  if (!roots.length) return;

  const canPin = () =>
    window.matchMedia("(min-width: 861px)").matches && !prefersReducedMotion();

  roots.forEach((root) => {
    const pin = root.querySelector<HTMLElement>("[data-suites-pin]");
    const scroller = root.querySelector<HTMLElement>("[data-carousel]");
    const track = root.querySelector<HTMLElement>("[data-carousel-track]");
    if (!pin || !scroller || !track) return;

    const cards = Array.from(track.querySelectorAll<HTMLElement>(".suitecard"));
    const prevBtn = root.querySelector<HTMLButtonElement>("[data-carousel-prev]");
    const nextBtn = root.querySelector<HTMLButtonElement>("[data-carousel-next]");
    if (!cards.length) return;

    let current = -1;
    let st: ScrollTrigger | null = null;
    let quickX: ((v: number) => void) | null = null;
    let nativeScrollHandler: (() => void) | null = null;

    const setActive = (i: number) => {
      const clamped = Math.max(0, Math.min(cards.length - 1, i));
      if (clamped === current) return;
      current = clamped;
      cards.forEach((card, idx) =>
        card.classList.toggle("is-active", idx === clamped),
      );
      if (prevBtn) prevBtn.disabled = clamped === 0;
      if (nextBtn) nextBtn.disabled = clamped === cards.length - 1;
    };

    // Distance to translate the track so card i's centre sits at viewport centre.
    const centreOffsetFor = (i: number) => {
      const card = cards[i];
      const cardCentre = card.offsetLeft + card.offsetWidth / 2;
      return window.innerWidth / 2 - cardCentre;
    };

    // ---- PINNED MODE ----
    const buildPinned = () => {
      root.classList.add("is-pinned");
      setActive(0);
      // Apply the initial centred position immediately (no easing on build).
      gsap.set(track, { x: centreOffsetFor(0) });
      quickX = gsap.quickTo(track, "x", {
        duration: 0.35,
        ease: "power3.out",
      }) as unknown as (v: number) => void;

      const steps = Math.max(1, cards.length - 1);
      const distance = steps * window.innerHeight * 0.9;

      st = ScrollTrigger.create({
        trigger: pin,
        start: "top top",
        end: `+=${distance}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: () => {
          const idx = current < 0 ? 0 : current;
          gsap.set(track, { x: centreOffsetFor(idx) });
        },
        onUpdate: (self) => {
          const exact = self.progress * steps;
          setActive(Math.round(exact));
          const lo = Math.floor(exact);
          const hi = Math.min(steps, lo + 1);
          const frac = exact - lo;
          const x =
            centreOffsetFor(lo) +
            (centreOffsetFor(hi) - centreOffsetFor(lo)) * frac;
          if (quickX) quickX(x);
        },
      });
    };

    const scrollToIndexPinned = (i: number) => {
      if (!st) return;
      const steps = Math.max(1, cards.length - 1);
      const p = i / steps;
      const target = st.start + (st.end - st.start) * p;
      if (lenis) lenis.scrollTo(target, { duration: 1 });
      else window.scrollTo({ top: target, behavior: "smooth" });
    };

    // ---- NATIVE FALLBACK MODE ----
    const nearestCard = () => {
      const mid = scroller.scrollLeft + scroller.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      cards.forEach((card, i) => {
        const centre = card.offsetLeft + card.offsetWidth / 2;
        const d = Math.abs(centre - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      return best;
    };
    const scrollToCardNative = (i: number) => {
      const card = cards[Math.max(0, Math.min(cards.length - 1, i))];
      if (!card) return;
      scroller.scrollTo({
        left: card.offsetLeft + card.offsetWidth / 2 - scroller.clientWidth / 2,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    };
    const buildNative = () => {
      root.classList.remove("is-pinned");
      gsap.set(track, { clearProps: "transform" });
      setActive(0);
      let ticking = false;
      nativeScrollHandler = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          setActive(nearestCard());
          ticking = false;
        });
      };
      scroller.addEventListener("scroll", nativeScrollHandler, { passive: true });
      requestAnimationFrame(() => scrollToCardNative(0));
    };

    // ---- Shared controls ----
    const goTo = (i: number) => {
      const clamped = Math.max(0, Math.min(cards.length - 1, i));
      if (root.classList.contains("is-pinned")) scrollToIndexPinned(clamped);
      else scrollToCardNative(clamped);
    };

    prevBtn?.addEventListener("click", () => goTo(current - 1));
    nextBtn?.addEventListener("click", () => goTo(current + 1));

    cards.forEach((card, i) => {
      card.addEventListener("click", (e) => {
        if (i !== current) {
          e.preventDefault();
          goTo(i);
        }
      });
    });

    scroller.setAttribute("tabindex", "0");
    scroller.setAttribute("role", "region");
    scroller.setAttribute("aria-label", "Suites carousel");
    scroller.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(current - 1);
      }
    });

    // ---- Mode management ----
    let mode: "pinned" | "native" | null = null;
    const teardownLocal = () => {
      st?.kill();
      st = null;
      quickX = null;
      gsap.set(track, { clearProps: "transform" });
      if (nativeScrollHandler) {
        scroller.removeEventListener("scroll", nativeScrollHandler);
        nativeScrollHandler = null;
      }
      current = -1;
    };
    const apply = () => {
      const want: "pinned" | "native" = canPin() ? "pinned" : "native";
      if (want === mode) return;
      teardownLocal();
      mode = want;
      if (want === "pinned") buildPinned();
      else buildNative();
    };

    apply();

    let resizeTimer: number | undefined;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        apply();
        ScrollTrigger.refresh();
      }, 160);
    });
  });
}

/**
 * [data-mouse-parallax] — gives an element a gentle, spring-eased drift that
 * follows the pointer within its nearest section. The attribute's value is the
 * maximum travel in pixels (default 12). Disabled on coarse pointers (touch)
 * and when the user prefers reduced motion.
 */
function initMouseParallax() {
  if (prefersReducedMotion()) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const targets = gsap.utils.toArray<HTMLElement>("[data-mouse-parallax]");

  targets.forEach((el) => {
    const max = parseFloat(el.dataset.mouseParallax ?? "12");
    // React to pointer movement over the surrounding section (a comfortable
    // hit area), falling back to the element itself.
    const zone = (el.closest("section") ?? el.parentElement ?? el) as HTMLElement;

    const xTo = gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.9, ease: "power3.out" });

    const onMove = (e: PointerEvent) => {
      const r = zone.getBoundingClientRect();
      // -0.5..0.5 relative to the zone centre.
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      xTo(nx * max * 2);
      yTo(ny * max * 2);
    };
    const reset = () => {
      xTo(0);
      yTo(0);
    };

    zone.addEventListener("pointermove", onMove);
    zone.addEventListener("pointerleave", reset);
  });
}

/**
 * When the user prefers reduced motion, background videos should not autoplay.
 * Pause them and rely on the poster image instead.
 */
function respectReducedMotionVideos() {
  if (!prefersReducedMotion()) return;
  document.querySelectorAll<HTMLVideoElement>("video[autoplay]").forEach((v) => {
    v.removeAttribute("autoplay");
    v.pause();
  });
}

/**
 * Smooth-scroll in-page anchor links (e.g. Experiences #day-trips), offsetting
 * for the fixed nav so headings aren't hidden underneath it.
 */
function initAnchorLinks() {
  const NAV_OFFSET = -90;
  document
    .querySelectorAll<HTMLAnchorElement>('a[href^="#"], a[href*="#"]')
    .forEach((link) => {
      const url = new URL(link.href, window.location.href);
      // Only same-page anchors.
      if (url.pathname !== window.location.pathname || !url.hash) return;
      link.addEventListener("click", (e) => {
        const target = document.querySelector(url.hash);
        if (!target) return;
        e.preventDefault();
        scrollTo(target as HTMLElement, NAV_OFFSET);
        history.replaceState(null, "", url.hash);
      });
    });
}

/** Tear down the previous page's scroll state (for View Transition navigations). */
function destroyScroll() {
  // Release SplitText instances from the outgoing page.
  splitInstances.forEach((s) => s.revert?.());
  splitInstances = [];
  ScrollTrigger.getAll().forEach((st) => st.kill());
  if (rafCallback) {
    gsap.ticker.remove(rafCallback);
    rafCallback = null;
  }
  if (lenis) {
    lenis.destroy();
    lenis = null;
  }
  document.documentElement.classList.remove("lenis");
}

/** Public entry — call on first load AND after every View Transition. */
export function initScroll() {
  destroyScroll();
  document.documentElement.classList.remove("no-js");
  document.body.classList.add("is-ready");

  respectReducedMotionVideos();
  initSmoothScroll();

  // After a View Transition, start the new page at the top unless the URL
  // targets an in-page anchor. Native scrollTo(0,0) in astro:after-swap isn't
  // enough because the freshly-booted Lenis instance keeps its own scroll
  // position, so reset it explicitly here (immediate = no animation).
  const hash = window.location.hash;
  if (hash && document.querySelector(hash)) {
    // Deep link to a section, honoring the fixed-nav offset.
    requestAnimationFrame(() => scrollTo(hash, -90));
  } else if (lenis) {
    lenis.scrollTo(0, { immediate: true, force: true });
  } else {
    window.scrollTo(0, 0);
  }
  // Pin-fades first so they claim their scroll space before section reveals
  // measure their trigger positions (otherwise reveals after a pinned section
  // can miscalculate and stay hidden).
  initPinFades();
  // The suites carousel also pins — register it before reveals so downstream
  // sections measure their trigger positions with the pin space accounted for.
  initSuitesCarousel();
  initSplitReveals();
  initReveals();
  initParallax();
  initMouseParallax();
  initSectionReveals();
  initAnchorLinks();

  // Recalculate once fonts/images settle so triggers line up.
  window.addEventListener("load", () => ScrollTrigger.refresh());
}

/** Programmatic scroll (used by nav anchors / "scroll to discover"). */
export function scrollTo(target: string | HTMLElement, offset = 0) {
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.2 });
  } else {
    const el =
      typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ behavior: "smooth" });
  }
}
