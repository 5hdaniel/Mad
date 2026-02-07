import React from "react";

/**
 * Contact source types supported by the SourcePill component.
 * These map to visual variants for display.
 */
export type ContactSource =
  | "imported"
  | "external"
  | "manual"
  | "contacts_app"
  | "sms"
  | "messages"
  | "email";

export interface SourcePillProps {
  /** The contact source - mapped to visual variant */
  source: ContactSource;
  /** Size of the pill */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
}

type Variant = "imported" | "external" | "message" | "manual" | "email";

const VARIANT_STYLES: Record<Variant, { bg: string; text: string; label: string }> = {
  imported: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    label: "Imported",
  },
  manual: {
    bg: "bg-green-100",
    text: "text-green-700",
    label: "Manual",
  },
  external: {
    bg: "bg-violet-100",
    text: "text-violet-700",
    label: "Contacts App",
  },
  message: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    label: "Message",
  },
  email: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    label: "Email",
  },
};

const SIZE_STYLES: Record<"sm" | "md", string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

/**
 * Maps a contact source to its display variant.
 * - manual -> 'manual' (green)
 * - imported, contacts_app -> 'imported' (blue)
 * - external -> 'external' (violet)
 * - sms, messages -> 'message' (amber)
 */
function getVariant(source: ContactSource): Variant {
  switch (source) {
    case "manual":
      return "manual";
    case "imported":
    case "contacts_app":
      return "imported";
    case "external":
      return "external";
    case "sms":
    case "messages":
      return "message";
    case "email":
      return "email";
    default:
      return "imported";
  }
}

/**
 * SourcePill Component
 *
 * Displays a colored badge indicating the source of a contact.
 * Used across all contact management flows for consistent source visualization.
 *
 * @example
 * // Green "Imported" badge
 * <SourcePill source="contacts_app" />
 *
 * @example
 * // Blue "External" badge, medium size
 * <SourcePill source="external" size="md" />
 *
 * @example
 * // Gray "Message" badge
 * <SourcePill source="sms" />
 */
export function SourcePill({
  source,
  size = "sm",
  className = "",
}: SourcePillProps): React.ReactElement {
  const variant = getVariant(source);
  const styles = VARIANT_STYLES[variant];
  const sizeStyles = SIZE_STYLES[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${styles.bg} ${styles.text} ${sizeStyles} ${className}`.trim()}
      data-testid={`source-pill-${variant}`}
    >
      {styles.label}
    </span>
  );
}

export default SourcePill;
