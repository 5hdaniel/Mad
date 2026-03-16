'use client';

/**
 * Reusable badge component for PM label display.
 * Uses the label's own hex color for styling.
 */

interface LabelBadgeProps {
  name: string;
  color: string; // hex color like '#6B7280'
  onRemove?: () => void;
  className?: string;
}

export function LabelBadge({ name, color, onRemove, className = '' }: LabelBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ backgroundColor: `${color}20`, color }}
    >
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70" aria-label={`Remove ${name}`}>
          x
        </button>
      )}
    </span>
  );
}
