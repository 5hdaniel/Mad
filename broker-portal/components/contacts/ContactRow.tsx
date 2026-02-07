/**
 * Contact Row Component
 *
 * Renders a single contact as a table row with responsive column visibility.
 *
 * TASK-1913: Contacts dashboard page + import UI
 */

import SourceBadge from './SourceBadge';
import { formatRelativeTime } from '@/lib/utils';
import type { ExternalContact } from '@/lib/actions/contacts';

interface ContactRowProps {
  contact: ExternalContact;
}

export default function ContactRow({ contact }: ContactRowProps) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {contact.name || 'Unknown'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {contact.email || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
        {contact.phone || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
        {contact.company || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <SourceBadge source={contact.source} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
        {contact.synced_at ? formatRelativeTime(contact.synced_at) : '-'}
      </td>
    </tr>
  );
}
