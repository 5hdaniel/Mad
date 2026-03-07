/**
 * DevicesTable - Displays registered devices for a user
 *
 * Shows device name, platform, last active, and app version.
 */

import { Monitor } from 'lucide-react';
import { formatTimestamp } from '@/lib/format';

interface Device {
  id: string;
  device_name: string | null;
  os: string | null;
  app_version: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export function DevicesTable({ devices }: { devices: Device[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
        <Monitor className="h-4 w-4 text-gray-400" />
        Devices
      </h3>

      {devices.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No devices registered.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registered
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                    {device.device_name || 'Unknown Device'}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                    {device.os || '--'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <code className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                      {device.app_version || '--'}
                    </code>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                    {formatTimestamp(device.last_seen_at, 'Never')}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                    {formatTimestamp(device.created_at, 'Never')}
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
