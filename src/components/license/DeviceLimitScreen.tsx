/**
 * DeviceLimitScreen Component
 * SPRINT-062: Device Limit Management
 *
 * Shown when the user has reached their device limit.
 * Allows them to deactivate other devices to use this one.
 */

import React, { useState, useEffect, useCallback } from "react";
import type { Device } from "../../../shared/types/license";
import logger from '../../utils/logger';

export function DeviceLimitScreen(): React.ReactElement {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setError(null);
      // Get user ID from current user
      const userResult = await window.api?.auth?.getCurrentUser?.();
      if (!userResult?.success || !userResult?.user) {
        setError("Unable to load devices. Please try signing in again.");
        setLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (userResult.user as any).id;
      if (!userId) {
        setError("Unable to load devices. Please try signing in again.");
        setLoading(false);
        return;
      }

      const deviceList = await window.api?.license?.listRegisteredDevices?.(userId);
      setDevices(deviceList || []);
    } catch (err) {
      logger.error("Failed to load devices:", err);
      setError("Failed to load devices. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleDeactivate = async (deviceId: string) => {
    try {
      setDeactivating(deviceId);
      setError(null);

      // Get user ID
      const userResult = await window.api?.auth?.getCurrentUser?.();
      if (!userResult?.success || !userResult?.user) {
        setError("Unable to deactivate device. Please try signing in again.");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (userResult.user as any).id;
      if (!userId) {
        setError("Unable to deactivate device. Please try signing in again.");
        return;
      }

      // Deactivate the device
      await window.api?.license?.deactivateDevice?.(userId, deviceId);

      // Reload devices
      await loadDevices();

      // Try to register current device again
      const result = await window.api?.license?.registerDevice?.(userId);
      if (result?.success) {
        // Successfully registered, reload the app
        window.location.reload();
      }
    } catch (err) {
      logger.error("Failed to deactivate device:", err);
      setError("Failed to deactivate device. Please try again.");
    } finally {
      setDeactivating(null);
    }
  };

  const handleUpgrade = () => {
    window.api?.shell?.openExternal?.("https://keeprcompliance.com/pricing");
  };

  const activeDevices = devices.filter((d) => d.is_active);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg w-full mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Device Limit Reached
          </h1>
          <p className="text-gray-600">
            You can only use Keepr on 1 device with your current plan.
            Deactivate another device to use this one.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Device List */}
        <div className="space-y-3 mb-6">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : activeDevices.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No active devices found. Try refreshing the page.
            </div>
          ) : (
            activeDevices.map((device) => (
              <div
                key={device.device_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {device.device_name || "Unknown Device"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatPlatform(device.platform)} - Last seen{" "}
                    {formatDate(device.last_seen_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleDeactivate(device.device_id)}
                  disabled={deactivating === device.device_id}
                  className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {deactivating === device.device_id ? "Removing..." : "Remove"}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Upgrade option */}
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-3">
            Need more devices? Upgrade your plan.
          </p>
          <button
            onClick={handleUpgrade}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  );
}

function formatPlatform(platform: string | null): string {
  switch (platform) {
    case "macos":
      return "macOS";
    case "windows":
      return "Windows";
    case "linux":
      return "Linux";
    default:
      return "Unknown";
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch {
    return "Unknown";
  }
}
