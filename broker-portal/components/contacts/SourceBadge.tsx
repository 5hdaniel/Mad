/**
 * Source Badge Component
 *
 * Displays a color-coded badge indicating the source of a contact.
 *
 * TASK-1913: Contacts dashboard page + import UI
 */

import { cn } from '@/lib/utils';

interface SourceBadgeProps {
  source: 'outlook' | 'gmail' | 'manual';
}

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  outlook: {
    label: 'Outlook',
    className: 'bg-blue-100 text-blue-800',
  },
  gmail: {
    label: 'Gmail',
    className: 'bg-red-100 text-red-800',
  },
  manual: {
    label: 'Manual',
    className: 'bg-gray-100 text-gray-800',
  },
};

export default function SourceBadge({ source }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.manual;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
