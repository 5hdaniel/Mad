/**
 * AuditLogTable - Displays recent audit log entries for a user
 *
 * Shows action, resource, timestamp, and metadata.
 */

import { FileText } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActionColor(action: string): string {
  if (action.startsWith('delete') || action.startsWith('remove')) {
    return 'text-danger-600 bg-danger-50';
  }
  if (action.startsWith('create') || action.startsWith('add')) {
    return 'text-success-600 bg-success-50';
  }
  if (action.startsWith('update') || action.startsWith('edit')) {
    return 'text-primary-600 bg-primary-50';
  }
  return 'text-gray-600 bg-gray-100';
}

export function AuditLogTable({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
        <FileText className="h-4 w-4 text-gray-400" />
        Recent Activity
      </h3>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No audit log entries found.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActionColor(entry.action)}`}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                    {entry.resource_type || '--'}
                    {entry.resource_id && (
                      <code className="ml-1 text-xs text-gray-400">
                        {entry.resource_id.slice(0, 8)}
                      </code>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                    {formatDate(entry.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
