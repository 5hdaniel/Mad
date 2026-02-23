'use client';

/**
 * TASK-2062: Active Sessions list for the broker portal.
 * Displays devices where the user is currently logged in.
 * The broker portal session itself is shown as "Web Portal (this browser)".
 */

import { useState, useEffect } from 'react';
import { getActiveDevices } from '@/lib/actions/getActiveDevices';

interface DeviceSession {
  device_id: string;
  device_name: string | null;
  os: string | null;
  platform: string | null;
  last_seen_at: string | null;
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return 'Unknown';

  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  if (diffMs < 0 || isNaN(diffMs)) return 'Just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;

  return new Date(isoDate).toLocaleDateString();
}

export function ActiveSessionsList() {
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await getActiveDevices();
        if (result.success && result.devices) {
          setDevices(result.devices);
        } else if (result.error) {
          setError(result.error);
        }
      } catch {
        setError('Failed to load active sessions');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      {/* Current browser session (broker portal) */}
      <div className="mb-3 flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <svg className="h-5 w-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-900">Web Portal</p>
          <p className="text-xs text-blue-700">This browser &middot; Active now</p>
        </div>
        <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
          Current
        </span>
      </div>

      {/* Desktop devices from Supabase */}
      {loading ? (
        <p className="text-sm text-gray-500 py-2">Loading devices...</p>
      ) : error ? (
        <p className="text-sm text-red-500 py-2">{error}</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-gray-400 py-2 italic">No desktop sessions found.</p>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <div
              key={device.device_id}
              className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200"
            >
              <svg className="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25h-13.5A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25h-13.5A2.25 2.25 0 0 1 3 12V5.25" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {device.device_name || 'Unknown device'}
                </p>
                <p className="text-xs text-gray-500">
                  {device.os || device.platform || 'Unknown OS'} &middot;{' '}
                  {formatRelativeTime(device.last_seen_at)}
                </p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                Desktop
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
