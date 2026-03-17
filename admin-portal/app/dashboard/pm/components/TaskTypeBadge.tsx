'use client';

/**
 * Reusable badge component for PM item type display.
 */

import type { ItemType } from '@/lib/pm-types';
import { TYPE_LABELS, TYPE_COLORS } from '@/lib/pm-types';

interface TaskTypeBadgeProps {
  type: ItemType;
  className?: string;
}

export function TaskTypeBadge({ type, className = '' }: TaskTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[type]} ${className}`}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}
