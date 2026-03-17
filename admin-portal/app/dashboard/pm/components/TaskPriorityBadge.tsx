'use client';

/**
 * Reusable badge component for PM item priority display.
 */

import type { ItemPriority } from '@/lib/pm-types';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/pm-types';

interface TaskPriorityBadgeProps {
  priority: ItemPriority;
  className?: string;
}

export function TaskPriorityBadge({ priority, className = '' }: TaskPriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[priority]} ${className}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
