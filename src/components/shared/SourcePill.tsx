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
  | "sms";

export interface SourcePillProps {
  /** The contact source - mapped to visual variant */
  source: ContactSource;
  /** Size of the pill */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
}

type Variant = "imported" | "external" | "message";

const VARIANT_STYLES: Record<Variant, { bg: string; text: string; label: string }> = {
  imported: {
    bg: "bg-green-100",
    text: "text-green-700",
    label: "Imported",
  },
  external: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    label: "External",
  },
  message: {
    bg: "bg-gray-100",
    text: "text-gray-600",
    label: "Message",
  },
};

const SIZE_STYLES: Record<"sm" | "md", string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

/**
 * Maps a contact source to its display variant.
 * - imported, manual, contacts_app -> 'imported' (green)
 * - external -> 'external' (blue)
 * - sms -> 'message' (gray)
 */
function getVariant(source: ContactSource): Variant {
  switch (source) {
    case "imported":
    case "manual":
    case "contacts_app":
      return "imported";
    case "external":
      return "external";
    case "sms":
      return "message";
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
