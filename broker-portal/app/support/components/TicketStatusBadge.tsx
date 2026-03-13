'use client';

/**
 * TicketStatusBadge - Customer Portal
 *
 * Displays ticket status as a colored badge.
 */

import type { TicketStatus } from '@/lib/support-types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/support-types';

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
