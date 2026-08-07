/**
 * TestimonialCarousel — React island. Horizontal card carousel of guest
 * reviews (stars · quote · author · country), divided by table-style rules.
 * Autoplay advances one card at a time (pauses on hover / tab hidden /
 * reduced motion). Styling lives in global.css so cards are visible during SSR.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Testimonial } from "../data/testimonials";

interface Props {
  items: Testimonial[];
  interval?: number;
}

function Stars({ rating = 5 }: { rating?: number }) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="tc-card__stars" aria-label={`${r} out of 5 stars`}>
      {"★★★★★".slice(0, r)}
    </span>
  );
}

export default function TestimonialCarousel({ items, interval = 6500 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  const go = useCallback(
    (dir: number) => setIndex((i) => (i + dir + items.length) % items.length),
    [items.length],
  );

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused || items.length <= 1) return;
    timer.current = window.setTimeout(() => go(1), interval);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [index, paused, go, interval, items.length]);

  if (!items.length) return null;

  return (
    <div
      className="tc"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        className="tc__nav tc__nav--prev"
        aria-label="Previous review"
        onClick={() => go(-1)}
      >
        ‹
      </button>

      <div className="tc__viewport">
        <ul
          className="tc__track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {items.map((t, i) => (
            <li className="tc__slide" key={i} aria-hidden={i !== index}>
              <article className="tc-card">
                <Stars rating={t.rating} />
                <p className="tc-card__quote">{t.quote}</p>
                <footer className="tc-card__author">
                  <span className="tc-card__name">&ndash;{t.author}</span>
                  {(t.location || t.meta) && (
                    <span className="tc-card__country">{t.location ?? t.meta}</span>
                  )}
                </footer>
              </article>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className="tc__nav tc__nav--next"
        aria-label="Next review"
        onClick={() => go(1)}
      >
        ›
      </button>

      <div className="tc__dots" role="tablist" aria-label="Reviews">
        {items.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === index}
            aria-label={`Review ${i + 1}`}
            className={`tc__dot ${i === index ? "is-active" : ""}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
