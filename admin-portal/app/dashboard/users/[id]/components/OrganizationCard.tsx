/**
 * OrganizationCard - Displays the user's organization membership
 *
 * Shows org name, role, and join date.
 */

import { Building2 } from 'lucide-react';
import { formatDate } from '@/lib/format';

interface OrgMembership {
  organization_id: string;
  org_name: string | null;
  role: string | null;
  joined_at: string | null;
}

function getRoleBadgeColor(role: string | null): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-100 text-purple-800';
    case 'admin':
      return 'bg-primary-100 text-primary-800';
    case 'member':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function OrganizationCard({
  memberships,
}: {
  memberships: OrgMembership[];
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
        <Building2 className="h-4 w-4 text-gray-400" />
        Organizations
      </h3>

      {memberships.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No organization memberships found.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {memberships.map((m) => (
            <li
              key={m.organization_id}
              className="flex items-center justify-between p-3 rounded-md bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {m.org_name || 'Unnamed Organization'}
                </p>
                <p className="text-xs text-gray-500">
                  Joined {formatDate(m.joined_at)}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(m.role)}`}
              >
                {m.role || 'unknown'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
