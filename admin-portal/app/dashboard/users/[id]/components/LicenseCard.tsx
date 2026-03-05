/**
 * LicenseCard - Displays user's license/subscription information
 *
 * Shows license tier, status, and expiry.
 */

import { Shield } from 'lucide-react';

interface License {
  id: string;
  tier: string | null;
  status: string | null;
  expires_at: string | null;
  created_at: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case 'active':
      return 'bg-success-50 text-success-600';
    case 'expired':
      return 'bg-danger-50 text-danger-600';
    case 'trial':
      return 'bg-warning-50 text-warning-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function LicenseCard({ licenses }: { licenses: License[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
        <Shield className="h-4 w-4 text-gray-400" />
        Licenses
      </h3>

      {licenses.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No licenses found.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {licenses.map((lic) => (
            <li
              key={lic.id}
              className="flex items-center justify-between p-3 rounded-md bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {lic.tier || 'Standard'}
                </p>
                <p className="text-xs text-gray-500">
                  Expires {formatDate(lic.expires_at)}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lic.status)}`}
              >
                {lic.status || 'unknown'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
