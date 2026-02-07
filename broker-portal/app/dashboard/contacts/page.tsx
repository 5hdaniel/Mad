/**
 * Contacts Dashboard Page
 *
 * Server component that fetches initial contacts and renders
 * the ContactsListClient component with server-action-driven
 * search and filtering.
 *
 * TASK-1913: Contacts dashboard page + import UI
 */

import { getExternalContacts } from '@/lib/actions/contacts';
import ContactsListClient from '@/components/contacts/ContactsListClient';

export default async function ContactsPage() {
  const { contacts, total } = await getExternalContacts({ limit: 50, offset: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your imported contacts from external sources
        </p>
      </div>

      {/* Client Component */}
      <ContactsListClient initialContacts={contacts} initialTotal={total} />
    </div>
  );
}
