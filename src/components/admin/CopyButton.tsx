/**
 * CopyButton — a small "copy to clipboard" affordance for guest data
 * (email, phone, reference). Shows a check for a moment after copying.
 */
import { useState } from "react";

interface Props {
  value: string;
  /** Accessible label, e.g. "Copy email". */
  label?: string;
}

export default function CopyButton({ value, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for insecure contexts / older browsers.
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* give up silently */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      className={`adm-copy${copied ? " is-copied" : ""}`}
      onClick={copy}
      aria-label={label}
      title={copied ? "Copied" : label}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
          <path
            d="M5 12.5l4.5 4.5L19 7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M5 15V5a1.5 1.5 0 0 1 1.5-1.5H15"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
