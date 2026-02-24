'use client';

/**
 * TASK-2062: Sign Out All Devices button with confirmation dialog.
 * Shows a confirmation prompt before executing global sign-out.
 */

import { useState } from 'react';
import { signOutAllDevices } from '@/lib/actions/signOutAllDevices';

export function SignOutAllButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signOutAllDevices();
      // If we get here (no redirect), something went wrong
      if (!result.success) {
        setError(result.error || 'Failed to sign out of all devices');
        setConfirming(false);
      }
    } catch {
      // signOutAllDevices calls redirect() which throws NEXT_REDIRECT
      // This is expected behavior - the redirect will happen
    } finally {
      setLoading(false);
    }
  };

  if (confirming) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800 font-medium mb-2">
          Are you sure?
        </p>
        <p className="text-sm text-red-700 mb-4">
          This will sign you out of all devices, including desktop apps and other
          browser sessions. Everyone will need to log in again.
        </p>
        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing out...' : 'Yes, sign out all devices'}
          </button>
          <button
            onClick={() => { setConfirming(false); setError(null); }}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-4 py-2 text-sm font-medium text-red-600 bg-white rounded-md border border-red-300 hover:bg-red-50 transition-colors"
    >
      Sign Out All Devices
    </button>
  );
}
