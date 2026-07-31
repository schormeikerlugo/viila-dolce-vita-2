/**
 * SuitePicker — the bookable options for a concrete stay: five suite cards
 * plus the Entire Estate, priced by the API (`getStayOptions`). Unavailable
 * options stay visible but muted, with the reason on the card.
 */
import type { SuiteCardData, UnitId, UnitOption } from "../../lib/booking/types";
import { ESTATE } from "../../lib/booking/types";
import { money } from "../../lib/booking/dates";

interface Props {
  suites: SuiteCardData[];
  options: UnitOption[];
  selected: UnitId | null;
  nights: number;
  onSelect(unit: UnitId): void;
  loading?: boolean;
}

export default function SuitePicker({
  suites,
  options,
  selected,
  nights,
  onSelect,
  loading = false,
}: Props) {
  const opt = (unit: UnitId) => options.find((o) => o.unit === unit);
  const ordered = [...suites].sort((a, b) => a.rank - b.rank);
  const estate = opt(ESTATE);
  const nightsText = `${nights} ${nights === 1 ? "night" : "nights"}`;

  if (loading) {
    return (
      <div className="bk-suites" aria-busy="true">
        {ordered.map((s) => (
          <div key={s.slug} className="bk-suitecard is-skeleton" aria-hidden="true">
            <div className="bk-suitecard__media" />
            <div className="bk-suitecard__body">
              <span className="bk-skel bk-skel--title" />
              <span className="bk-skel bk-skel--line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bk-suites">
      {ordered.map((s) => {
        const o = opt(s.slug);
        const available = o?.available ?? false;
        return (
          <button
            key={s.slug}
            type="button"
            className={[
              "bk-suitecard",
              selected === s.slug && "is-selected",
              !available && "is-unavailable",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => available && onSelect(s.slug)}
            disabled={!available}
          >
            <div className="bk-suitecard__media">
              <img src={s.image} alt={s.imageAlt} loading="lazy" />
            </div>
            <div className="bk-suitecard__body">
              <span className="bk-suitecard__eyebrow">
                Sleeps {s.sleeps} · {s.highlight}
              </span>
              <span className="bk-suitecard__name">{s.name}</span>
              {available && o?.nightly != null && o?.total != null ? (
                <span className="bk-suitecard__price">
                  {money(o.nightly)} <em>/ night</em>
                  <span className="bk-suitecard__total">
                    {money(o.total)} · {nightsText}
                  </span>
                </span>
              ) : (
                <span className="bk-suitecard__price bk-suitecard__price--off">
                  {o?.reason ?? "Unavailable for these dates"}
                </span>
              )}
            </div>
            <span className="bk-suitecard__mark" aria-hidden="true">
              {selected === s.slug ? "Selected" : "Select"}
            </span>
          </button>
        );
      })}

      {/* Entire estate — full-width closing option. */}
      <button
        type="button"
        className={[
          "bk-suitecard",
          "bk-suitecard--estate",
          selected === ESTATE && "is-selected",
          !(estate?.available ?? false) && "is-unavailable",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => estate?.available && onSelect(ESTATE)}
        disabled={!estate?.available}
      >
        <div className="bk-suitecard__body">
          <span className="bk-suitecard__eyebrow">Five suites · Seven bedrooms · Sleeps 15</span>
          <span className="bk-suitecard__name">The Entire Estate</span>
          <span className="bk-suitecard__sub">
            Every suite, the pool, the grounds and the staff — the hilltop entirely yours.
          </span>
          {estate?.available && estate.nightly != null && estate.total != null ? (
            <span className="bk-suitecard__price">
              {money(estate.nightly)} <em>/ night</em>
              <span className="bk-suitecard__total">
                {money(estate.total)} · {nightsText}
              </span>
            </span>
          ) : (
            <span className="bk-suitecard__price bk-suitecard__price--off">
              {estate?.reason ?? "Unavailable for these dates"}
            </span>
          )}
        </div>
        <span className="bk-suitecard__mark" aria-hidden="true">
          {selected === ESTATE ? "Selected" : "Select"}
        </span>
      </button>
    </div>
  );
}
