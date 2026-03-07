'use client';

/**
 * OrganizationsTable - Client component for filtering and displaying organizations
 *
 * Receives server-fetched data and provides client-side search filtering.
 * Each row links to the organization detail page.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Search } from 'lucide-react';
import { formatDate } from '@/lib/format';

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  created_at: string | null;
  member_count: number;
}

interface OrganizationsTableProps {
  organizations: OrganizationRow[];
}

function PlanBadge({ plan }: { plan: string | null }) {
  const planText = plan || 'none';
  const colorMap: Record<string, string> = {
    enterprise: 'bg-purple-100 text-purple-800',
    professional: 'bg-primary-100 text-primary-800',
    starter: 'bg-blue-100 text-blue-800',
    trial: 'bg-yellow-100 text-yellow-800',
    none: 'bg-gray-100 text-gray-600',
  };
  const color = colorMap[planText.toLowerCase()] || 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {planText}
    </span>
  );
}

export function OrganizationsTable({ organizations }: OrganizationsTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = organizations.filter((org) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      org.slug.toLowerCase().includes(q)
    );
  });

  // Empty state - no organizations at all
  if (organizations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Building2 className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4 text-sm text-gray-500">
          No organizations found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Filter by name or slug..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Slug
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Members
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.length > 0 ? (
              filtered.map((org) => (
                <tr
                  key={org.id}
                  onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {org.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {org.slug}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <PlanBadge plan={org.plan} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {org.member_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(org.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="text-primary-600 hover:text-primary-800 font-medium">
                      View
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <p className="text-sm text-gray-500">
                    No organizations match &apos;{searchQuery}&apos;
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
