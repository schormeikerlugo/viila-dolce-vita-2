/**
 * GuestDetailsForm — name / email / phone / notes plus the animal-sanctuary
 * consent (required — the estate is a working sanctuary). Pure controlled
 * form; validation happens in the API on submit.
 */
import type { GuestDetails } from "../../lib/booking/types";

interface Props {
  value: GuestDetails;
  onChange(value: GuestDetails): void;
  disabled?: boolean;
}

export default function GuestDetailsForm({ value, onChange, disabled = false }: Props) {
  const set = <K extends keyof GuestDetails>(key: K, v: GuestDetails[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="bk-guest">
      <div className="bk-guest__row">
        <label className="bk-field">
          <span className="bk-field__label">Name *</span>
          <input
            type="text"
            className="bk-field__input"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            autoComplete="name"
            required
            disabled={disabled}
          />
        </label>
        <label className="bk-field">
          <span className="bk-field__label">Email *</span>
          <input
            type="email"
            className="bk-field__input"
            value={value.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
            required
            disabled={disabled}
          />
        </label>
      </div>

      <label className="bk-field">
        <span className="bk-field__label">Phone / WhatsApp</span>
        <input
          type="tel"
          className="bk-field__input"
          value={value.phone ?? ""}
          onChange={(e) => set("phone", e.target.value)}
          autoComplete="tel"
          disabled={disabled}
        />
      </label>

      <label className="bk-field">
        <span className="bk-field__label">Notes for the concierge</span>
        <textarea
          className="bk-field__input bk-field__input--area"
          rows={4}
          placeholder="Occasion, arrival time, allergies, anything we should prepare…"
          value={value.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          disabled={disabled}
        />
      </label>

      <label className="bk-consent">
        <input
          type="checkbox"
          checked={value.acceptsAnimals}
          onChange={(e) => set("acceptsAnimals", e.target.checked)}
          disabled={disabled}
        />
        <span>
          I understand the villa is also a sanctuary for rescued animals who roam freely across
          the property, and I'm comfortable sharing the space with these gentle residents. *
        </span>
      </label>
    </div>
  );
}
