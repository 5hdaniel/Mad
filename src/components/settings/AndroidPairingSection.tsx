/**
 * AndroidPairingSection — Android companion phone pairing and sync status
 *
 * Settings section that provides:
 * - "Pair Android Phone" button to generate QR codes
 * - QR code display modal for scanning
 * - List of paired devices with disconnect
 * - Sync statistics (messages received, last sync time)
 *
 * TASK-1431: Android Companion — Pairing UI in Settings
 */

import React, { useState, useEffect, useCallback } from "react";
import logger from "../../utils/logger";

// ---------------------------------------------------------------------------
// Types — mirrors IPC return shapes
// ---------------------------------------------------------------------------

interface PairedDevice {
  deviceId: string;
  deviceName: string;
  pairedAt: string;
  lastSeen: string;
}

interface SyncStatus {
  running: boolean;
  port: number | null;
  address: string | null;
  totalMessagesReceived: number;
  lastSyncTimestamp: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoOrTimestamp: string | number): string {
  const date = typeof isoOrTimestamp === "number"
    ? new Date(isoOrTimestamp)
    : new Date(isoOrTimestamp);
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(diffMs / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AndroidPairingSectionProps {
  userId: string;
}

export function AndroidPairingSection({ userId }: AndroidPairingSectionProps) {
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverStarting, setServerStarting] = useState(false);

  // ------------------------------------------------------------------
  // Refresh pairing + sync status
  // ------------------------------------------------------------------
  const refreshStatus = useCallback(async () => {
    try {
      const [pairingResult, syncResult] = await Promise.all([
        window.api.pairing.getStatus(),
        window.api.localSync.getStatus(),
      ]);

      if (pairingResult.success && pairingResult.status) {
        setDevices(pairingResult.status.devices.map((d) => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          pairedAt: d.pairedAt,
          lastSeen: d.lastSeen,
        })));
      }

      setSyncStatus(syncResult);
    } catch (err) {
      logger.error("[AndroidPairing] Failed to refresh status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    // Poll status every 10 seconds while mounted
    const interval = setInterval(refreshStatus, 10_000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // ------------------------------------------------------------------
  // Generate QR code + start sync server
  // ------------------------------------------------------------------
  const handlePairDevice = useCallback(async () => {
    setGenerating(true);
    setError(null);

    try {
      // Generate QR code (includes IP, port, secret, deviceName)
      const qrResult = await window.api.pairing.generateQR();

      if (!qrResult.success || !qrResult.result) {
        setError(qrResult.error ?? "Failed to generate QR code");
        setGenerating(false);
        return;
      }

      setQrDataUrl(qrResult.result.qrDataUrl);
      setShowQRModal(true);

      // Start the sync server with the secret from QR pairing
      setServerStarting(true);
      try {
        await window.api.localSync.startServer({
          port: qrResult.result.pairingInfo.port,
          secret: qrResult.result.pairingInfo.secret,
          userId,
        });
      } catch (serverErr) {
        logger.error("[AndroidPairing] Failed to start sync server:", serverErr);
        setError("Failed to start sync server. Check network connection.");
      } finally {
        setServerStarting(false);
      }
    } catch (err) {
      logger.error("[AndroidPairing] Failed to generate QR:", err);
      setError(err instanceof Error ? err.message : "Failed to generate pairing code");
    } finally {
      setGenerating(false);
    }
  }, [userId]);

  // ------------------------------------------------------------------
  // Close QR modal
  // ------------------------------------------------------------------
  const handleCloseModal = useCallback(() => {
    setShowQRModal(false);
    setQrDataUrl(null);
    refreshStatus();
  }, [refreshStatus]);

  // ------------------------------------------------------------------
  // Disconnect device
  // ------------------------------------------------------------------
  const handleDisconnect = useCallback(async (deviceId: string) => {
    try {
      const result = await window.api.pairing.disconnect(deviceId);
      if (result.success) {
        setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
      } else {
        logger.error("[AndroidPairing] Disconnect failed:", result.error);
      }
    } catch (err) {
      logger.error("[AndroidPairing] Disconnect error:", err);
    }
  }, []);

  // ------------------------------------------------------------------
  // Stop sync server
  // ------------------------------------------------------------------
  const handleStopServer = useCallback(async () => {
    try {
      await window.api.localSync.stopServer();
      await refreshStatus();
    } catch (err) {
      logger.error("[AndroidPairing] Stop server error:", err);
    }
  }, [refreshStatus]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div id="settings-android" className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Android Phone</h3>

      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Sync SMS messages from your Android phone over your local WiFi network.
          Messages are encrypted end-to-end during transfer.
        </p>

        {/* Sync Server Status Card */}
        {syncStatus?.running && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-800">Sync Server Active</span>
              </div>
              <button
                onClick={handleStopServer}
                className="text-xs text-green-700 hover:text-green-900 underline"
              >
                Stop
              </button>
            </div>
            <div className="text-xs text-green-700 space-y-1">
              <p>Listening on {syncStatus.address}:{syncStatus.port}</p>
              {syncStatus.totalMessagesReceived > 0 && (
                <p>{syncStatus.totalMessagesReceived} messages received</p>
              )}
              {syncStatus.lastSyncTimestamp && (
                <p>Last sync: {formatRelativeTime(syncStatus.lastSyncTimestamp)}</p>
              )}
            </div>
          </div>
        )}

        {/* Paired Devices */}
        {loading ? (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <span className="text-sm text-gray-500">Loading...</span>
          </div>
        ) : devices.length > 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
            {devices.map((device) => (
              <div key={device.deviceId} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{device.deviceName}</p>
                  <p className="text-xs text-gray-500">
                    Paired {formatRelativeTime(device.pairedAt)}
                    {" | "}
                    Last seen {formatRelativeTime(device.lastSeen)}
                  </p>
                </div>
                <button
                  onClick={() => handleDisconnect(device.deviceId)}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-500">No devices paired. Tap below to get started.</p>
          </div>
        )}

        {/* Pair Button */}
        <button
          onClick={handlePairDevice}
          disabled={generating}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? "Generating..." : "Pair Android Phone"}
        </button>

        {/* Error display */}
        {error && (
          <div className="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200">
            {error}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Scan QR Code</h4>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Open the Keepr Companion app on your Android phone and scan this code to pair.
            </p>

            {qrDataUrl ? (
              <div className="flex justify-center mb-4">
                <img
                  src={qrDataUrl}
                  alt="Pairing QR Code"
                  className="w-64 h-64 border border-gray-200 rounded-lg"
                />
              </div>
            ) : (
              <div className="flex justify-center mb-4">
                <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
            )}

            {serverStarting && (
              <p className="text-xs text-gray-500 text-center mb-2">Starting sync server...</p>
            )}

            <p className="text-xs text-gray-400 text-center">
              Both devices must be on the same WiFi network.
            </p>

            <button
              onClick={handleCloseModal}
              className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
