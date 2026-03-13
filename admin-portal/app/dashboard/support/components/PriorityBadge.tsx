'use client';

/**
 * Reusable PriorityBadge component for ticket priority display.
 */

import type { TicketPriority } from '@/lib/support-types';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/support-types';

interface PriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
}

export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[priority]} ${className}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
