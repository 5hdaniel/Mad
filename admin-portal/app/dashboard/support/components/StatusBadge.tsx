'use client';

/**
 * Reusable StatusBadge component for ticket status display.
 */

import type { TicketStatus } from '@/lib/support-types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/support-types';

interface StatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]} ${className}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
