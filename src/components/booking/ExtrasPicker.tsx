/**
 * ExtrasPicker — the add-on catalog grouped by category. Priced extras
 * toggle into the quote; inquire-only ones (wine, per the alcohol notice)
 * toggle as "requests" and are passed to the concierge without a price.
 */
import type { Extra, ExtraCategory } from "../../lib/booking/types";
import { money } from "../../lib/booking/dates";

const CATEGORY_LABELS: Record<ExtraCategory, string> = {
  food: "The Table",
  wellness: "Wellness",
  service: "Services",
  wine: "The Cellar",
};

const PRICE_SUFFIX: Record<Extra["priceType"], string> = {
  per_stay: "per stay",
  per_night: "per night",
  per_person: "per person",
  per_person_night: "per person / night",
};

interface Props {
  extras: Extra[];
  selected: string[];
  onToggle(id: string): void;
}

export default function ExtrasPicker({ extras, selected, onToggle }: Props) {
  const categories = (Object.keys(CATEGORY_LABELS) as ExtraCategory[]).filter((c) =>
    extras.some((e) => e.category === c),
  );

  return (
    <div className="bk-extras">
      {categories.map((cat) => (
        <section key={cat} className="bk-extras__group">
          <p className="bk-extras__cat">{CATEGORY_LABELS[cat]}</p>
          <ul className="bk-extras__list">
            {extras
              .filter((e) => e.category === cat)
              .map((extra) => {
                const on = selected.includes(extra.id);
                return (
                  <li key={extra.id}>
                    <button
                      type="button"
                      className={`bk-extra${on ? " is-selected" : ""}`}
                      onClick={() => onToggle(extra.id)}
                      aria-pressed={on}
                    >
                      <span className="bk-extra__check" aria-hidden="true" />
                      <span className="bk-extra__body">
                        <span className="bk-extra__name">{extra.name}</span>
                        <span className="bk-extra__desc">{extra.description}</span>
                      </span>
                      <span className="bk-extra__price">
                        {extra.inquireOnly ? (
                          <em>On request</em>
                        ) : (
                          <>
                            {money(extra.price)}
                            <em>{PRICE_SUFFIX[extra.priceType]}</em>
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      <p className="bk-extras__note">
        Breakfast every morning and three chef-cooked dinners a week are already included in every
        stay.
      </p>
    </div>
  );
}
