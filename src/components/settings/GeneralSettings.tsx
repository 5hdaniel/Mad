import React, { useState, useCallback } from "react";
import { useNotification } from "@/hooks/useNotification";
import { useNetwork } from '../../contexts/NetworkContext';
import { settingsService } from '../../services';
import logger from '../../utils/logger';
import type { PreferencesResult } from './types';

interface GeneralSettingsProps {
  userId: string;
  initialPreferences: PreferencesResult['preferences'];
}

export function GeneralSettings({ userId, initialPreferences }: GeneralSettingsProps) {
  const { notify } = useNotification();
  const { isOnline } = useNetwork();

  // Local state initialized from loaded preferences
  const [autoSyncOnLogin, setAutoSyncOnLogin] = useState<boolean>(() => {
    const val = initialPreferences?.sync?.autoSyncOnLogin;
    return typeof val === "boolean" ? val : true;
  });
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useState<boolean>(() => {
    const val = initialPreferences?.updates?.autoDownload;
    return typeof val === "boolean" ? val : false;
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    const val = initialPreferences?.notifications?.enabled;
    return typeof val === "boolean" ? val : true;
  });
  const [exportFormat, setExportFormat] = useState<string>(() => {
    return initialPreferences?.export?.defaultFormat || "pdf";
  });
  const [emailExportMode, setEmailExportMode] = useState<"thread" | "individual">(() => {
    const val = (initialPreferences?.export as { emailExportMode?: string } | undefined)?.emailExportMode;
    return (val === "thread" || val === "individual") ? val : "thread";
  });
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'available' | 'error'>('idle');
  const [updateVersion, setUpdateVersion] = useState<string>('');

  // Handlers
  const handleAutoSyncToggle = async (): Promise<void> => {
    const newValue = !autoSyncOnLogin;
    setAutoSyncOnLogin(newValue);
    try {
      await settingsService.updatePreferences(userId, { sync: { autoSyncOnLogin: newValue } });
    } catch {
      // Silently handle
    }
  };

  const handleAutoDownloadToggle = async (): Promise<void> => {
    const newValue = !autoDownloadUpdates;
    setAutoDownloadUpdates(newValue);
    try {
      await settingsService.updatePreferences(userId, { updates: { autoDownload: newValue } });
    } catch {
      // Silently handle
    }
  };

  const handleNotificationsToggle = async (): Promise<void> => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    try {
      await settingsService.updatePreferences(userId, { notifications: { enabled: newValue } });
    } catch {
      // Silently handle
    }
  };

  const handleExportFormatChange = async (newFormat: string): Promise<void> => {
    setExportFormat(newFormat);
    try {
      await settingsService.updatePreferences(userId, { export: { defaultFormat: newFormat } });
    } catch {
      // Silently handle
    }
  };

  const handleEmailExportModeChange = async (mode: "thread" | "individual"): Promise<void> => {
    setEmailExportMode(mode);
    try {
      await settingsService.updatePreferences(userId, { export: { emailExportMode: mode } });
    } catch (err) {
      logger.error("Failed to save email export mode preference:", err);
    }
  };

  const handleCheckForUpdates = useCallback(async (): Promise<void> => {
    setUpdateStatus('checking');
    try {
      const result = await window.api.update.checkForUpdates();
      if (result?.updateAvailable) {
        setUpdateStatus('available');
        setUpdateVersion(result.version ?? '');
      } else {
        setUpdateStatus('up-to-date');
      }
    } catch {
      setUpdateStatus('error');
    }
    // Auto-reset after 5 seconds
    setTimeout(() => setUpdateStatus('idle'), 5000);
  }, []);

  const handleTestNotification = async (): Promise<void> => {
    try {
      const result = await window.api.notification?.send(
        "Test Notification",
        "Desktop notifications are working correctly."
      );
      if (result?.success) {
        notify.success("Desktop notification sent! Check your notification center if you don't see a banner.");
      } else {
        notify.warning(result?.error || "Notifications may not be supported on this system.");
      }
    } catch {
      notify.error("Failed to send test notification.");
    }
  };

  return (
    <div id="settings-general" className="mt-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        General
      </h3>
      <div className="space-y-4">
        {/* Auto-Sync on Login */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-900">
              Auto-Sync on Login
            </h4>
            <p className="text-xs text-gray-600 mt-1">
              Automatically sync emails and messages when you open the app
            </p>
          </div>
          <button
            onClick={handleAutoSyncToggle}
            className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoSyncOnLogin ? "bg-blue-500" : "bg-gray-300"
            }`}
            role="switch"
            aria-checked={autoSyncOnLogin}
            aria-label="Auto-sync on login"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoSyncOnLogin ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Auto-Download Updates */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900">
                Auto-download Updates
              </h4>
              <p className="text-xs text-gray-600 mt-1">
                Automatically download new software updates in the background
              </p>
            </div>
            <button
              onClick={handleAutoDownloadToggle}
              className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoDownloadUpdates ? "bg-blue-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={autoDownloadUpdates}
              aria-label="Auto-download updates"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoDownloadUpdates ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <button
            onClick={handleCheckForUpdates}
            disabled={updateStatus === 'checking' || !isOnline}
            title={!isOnline ? "You are offline" : undefined}
            className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!isOnline ? 'Check for Updates' :
             updateStatus === 'checking' ? 'Checking...' :
             updateStatus === 'up-to-date' ? 'Up to date' :
             updateStatus === 'available' ? `Update available (v${updateVersion})` :
             updateStatus === 'error' ? 'Check failed' :
             'Check for Updates'}
          </button>
        </div>

        {/* Notifications */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900">
                Notifications
              </h4>
              <p className="text-xs text-gray-600 mt-1">
                Show desktop notifications for important events
              </p>
            </div>
            <button
              onClick={handleNotificationsToggle}
              className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notificationsEnabled ? "bg-blue-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={notificationsEnabled}
              aria-label="Desktop notifications"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notificationsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <button
            onClick={handleTestNotification}
            disabled={!notificationsEnabled}
            className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Test Notification
          </button>
        </div>

        {/* Export Settings */}
        <div className="space-y-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-700">Default Format</span>
            <select
              value={exportFormat}
              onChange={(e) => handleExportFormatChange(e.target.value)}
              className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel (.xlsx)</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="txt_eml">TXT + EML Files</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-gray-700">Email Export Mode</span>
              <p className="text-xs text-gray-500 mt-0.5">How emails are grouped in exported PDFs</p>
            </div>
            <select
              value={emailExportMode}
              onChange={(e) => handleEmailExportModeChange(e.target.value as "thread" | "individual")}
              className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="thread">Thread (one PDF per conversation)</option>
              <option value="individual">Individual (one PDF per email, quotes stripped)</option>
            </select>
          </div>
          {/* TODO: Implement export location chooser with native folder picker */}
          <div className="flex justify-between items-center opacity-50">
            <span className="text-sm text-gray-700">Export Location</span>
            <button
              disabled
              className="text-sm text-gray-400 font-medium cursor-not-allowed"
            >
              Choose Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
