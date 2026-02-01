import React, { useState, useEffect, useCallback } from "react";
import { LLMSettings } from "./settings/LLMSettings";
import { MacOSMessagesImportSettings } from "./settings/MacOSMessagesImportSettings";
import { MacOSContactsImportSettings } from "./settings/MacOSContactsImportSettings";
import { LicenseGate } from "./common/LicenseGate";
import {
  emitEmailConnectionChanged,
  useEmailConnectionListener,
} from "@/utils/emailConnectionEvents";

interface ConnectionError {
  type: string;
  userMessage: string;
  action?: string;
  actionHandler?: string;
}

interface ConnectionStatus {
  connected: boolean;
  email?: string;
  error?: ConnectionError | null;
}

interface Connections {
  google: ConnectionStatus | null;
  microsoft: ConnectionStatus | null;
}

// Refresh interval for connection status (60 seconds)
const CONNECTION_REFRESH_INTERVAL = 60000;

interface PreferencesResult {
  success: boolean;
  error?: string;
  preferences?: {
    export?: {
      defaultFormat?: string;
    };
    scan?: {
      lookbackMonths?: number;
    };
    sync?: {
      autoSyncOnLogin?: boolean;
    };
  };
}

interface ConnectionResult {
  success: boolean;
}

interface SettingsComponentProps {
  onClose: () => void;
  userId: string;
  /** Callback when email is connected - updates app state */
  onEmailConnected?: (email: string, provider: "google" | "microsoft") => void;
  /** Callback when email is disconnected - updates app state (TASK-1730) */
  onEmailDisconnected?: (provider: "google" | "microsoft") => void;
}

/**
 * Settings Component
 * Application settings and preferences
 */
function Settings({ onClose, userId, onEmailConnected, onEmailDisconnected }: SettingsComponentProps) {
  const [connections, setConnections] = useState<Connections>({
    google: null,
    microsoft: null,
  });
  const [loadingConnections, setLoadingConnections] = useState<boolean>(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null,
  );
  const [disconnectingProvider, setDisconnectingProvider] = useState<
    string | null
  >(null);
  const [exportFormat, setExportFormat] = useState<string>("pdf"); // Default export format
  const [scanLookbackMonths, setScanLookbackMonths] = useState<number>(9); // Default 9 months
  const [autoSyncOnLogin, setAutoSyncOnLogin] = useState<boolean>(true); // Default auto-sync ON
  const [loadingPreferences, setLoadingPreferences] = useState<boolean>(true);

  // Database maintenance state
  const [reindexing, setReindexing] = useState<boolean>(false);
  const [reindexResult, setReindexResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Load connection status and preferences on mount, with periodic refresh
  useEffect(() => {
    if (userId) {
      checkConnections();
      loadPreferences();

      // Set up periodic refresh for connection status
      const refreshInterval = setInterval(() => {
        checkConnections();
      }, CONNECTION_REFRESH_INTERVAL);

      return () => clearInterval(refreshInterval);
    }
  }, [userId]);

  // TASK-1730: Listen for email connection events from other components (e.g., onboarding flow)
  // This ensures Settings UI updates immediately when email is connected elsewhere
  useEmailConnectionListener(
    useCallback(() => {
      // Refresh connection status when email connection state changes
      checkConnections();
    }, [])
  );

  /**
   * Check all email connections and update state.
   * Returns the connection result for callers that need immediate access to the data.
   */
  const checkConnections = async (): Promise<{
    google?: { connected: boolean; email?: string };
    microsoft?: { connected: boolean; email?: string };
  } | null> => {
    setLoadingConnections(true);
    try {
      const result = await window.api.system.checkAllConnections(userId);
      if (result.success) {
        setConnections({
          google: result.google
            ? {
                connected: result.google.connected,
                email: result.google.email,
                error: result.google.error,
              }
            : null,
          microsoft: result.microsoft
            ? {
                connected: result.microsoft.connected,
                email: result.microsoft.email,
                error: result.microsoft.error,
              }
            : null,
        });
        // Return the result for immediate use by callers
        return {
          google: result.google,
          microsoft: result.microsoft,
        };
      }
      return null;
    } catch (error) {
      console.error("Failed to check connections:", error);
      return null;
    } finally {
      setLoadingConnections(false);
    }
  };

  const loadPreferences = async (): Promise<void> => {
    setLoadingPreferences(true);
    try {
      const result: PreferencesResult =
        await window.api.preferences.get(userId);
      if (result.success && result.preferences) {
        // Load export format preference
        if (result.preferences.export?.defaultFormat) {
          setExportFormat(result.preferences.export.defaultFormat);
        }
        // Load scan lookback preference - use type check for numbers
        const loadedLookback = result.preferences.scan?.lookbackMonths;
        if (typeof loadedLookback === "number" && loadedLookback > 0) {
          setScanLookbackMonths(loadedLookback);
        }
        // Load auto-sync preference (default is true if not set)
        if (typeof result.preferences.sync?.autoSyncOnLogin === "boolean") {
          setAutoSyncOnLogin(result.preferences.sync.autoSyncOnLogin);
        }
      } else if (!result.success) {
        console.error("[Settings] Failed to load preferences:", result.error);
      }
    } catch (error) {
      // Log preference loading errors for debugging
      console.error("[Settings] Error loading preferences:", error);
    } finally {
      setLoadingPreferences(false);
    }
  };

  const handleExportFormatChange = async (newFormat: string): Promise<void> => {
    setExportFormat(newFormat);
    try {
      // Update only the export format preference
      await window.api.preferences.update(userId, {
        export: {
          defaultFormat: newFormat,
        },
      });
      // Silently handle - preference will still be applied locally for this session
    } catch {
      // Silently handle - preference will still be applied locally for this session
    }
  };

  const handleScanLookbackChange = async (months: number): Promise<void> => {
    setScanLookbackMonths(months);
    try {
      const result = await window.api.preferences.update(userId, {
        scan: {
          lookbackMonths: months,
        },
      });
      if (!result.success) {
        console.error("[Settings] Failed to save scan lookback:", result);
      }
    } catch (error) {
      console.error("[Settings] Error saving scan lookback:", error);
    }
  };

  const handleAutoSyncToggle = async (): Promise<void> => {
    const newValue = !autoSyncOnLogin;
    setAutoSyncOnLogin(newValue);
    try {
      // Update auto-sync preference
      await window.api.preferences.update(userId, {
        sync: {
          autoSyncOnLogin: newValue,
        },
      });
      // Silently handle - preference will still be applied locally for this session
    } catch {
      // Silently handle - preference will still be applied locally for this session
    }
  };

  const handleConnectGoogle = async (): Promise<void> => {
    setConnectingProvider("google");
    let cleanup: (() => void) | undefined;
    try {
      const result = await window.api.auth.googleConnectMailbox(userId);
      if (result.success) {
        // Auth popup window opens automatically and will close when done
        // Listen for connection completion
        cleanup = window.api.onGoogleMailboxConnected(
          async (connectionResult: ConnectionResult) => {
            if (connectionResult.success) {
              // Refresh connections and get the result in one call
              const connResult = await checkConnections();
              const email = connResult?.google?.email;
              // Notify parent to update app state so banner disappears
              if (email && onEmailConnected) {
                onEmailConnected(email, "google");
              }
              // TASK-1730: Emit event for cross-component state propagation
              if (email) {
                emitEmailConnectionChanged({
                  connected: true,
                  email,
                  provider: "google",
                });
              }
            }
            setConnectingProvider(null);
            if (cleanup) cleanup();
          },
        );
      }
    } catch (error) {
      console.error("Failed to connect Google:", error);
      setConnectingProvider(null);
      if (cleanup) cleanup();
    }
  };

  const handleConnectMicrosoft = async (): Promise<void> => {
    setConnectingProvider("microsoft");
    let cleanup: (() => void) | undefined;
    try {
      const result = await window.api.auth.microsoftConnectMailbox(userId);
      if (result.success) {
        // Auth popup window opens automatically and will close when done
        // Listen for connection completion
        cleanup = window.api.onMicrosoftMailboxConnected(
          async (connectionResult: ConnectionResult) => {
            if (connectionResult.success) {
              // Refresh connections and get the result in one call
              const connResult = await checkConnections();
              const email = connResult?.microsoft?.email;
              // Notify parent to update app state so banner disappears
              if (email && onEmailConnected) {
                onEmailConnected(email, "microsoft");
              }
              // TASK-1730: Emit event for cross-component state propagation
              if (email) {
                emitEmailConnectionChanged({
                  connected: true,
                  email,
                  provider: "microsoft",
                });
              }
            }
            setConnectingProvider(null);
            if (cleanup) cleanup();
          },
        );
      }
    } catch (error) {
      console.error("Failed to connect Microsoft:", error);
      setConnectingProvider(null);
      if (cleanup) cleanup();
    }
  };

  const handleDisconnectGoogle = async (): Promise<void> => {
    setDisconnectingProvider("google");
    try {
      const result = await window.api.auth.googleDisconnectMailbox(userId);
      if (result.success) {
        await checkConnections();
        // TASK-1730: Notify parent to update app state machine
        if (onEmailDisconnected) {
          onEmailDisconnected("google");
        }
        // TASK-1730: Emit event for cross-component state propagation
        emitEmailConnectionChanged({ connected: false, provider: "google" });
      }
    } catch (error) {
      console.error("Failed to disconnect Google:", error);
    } finally {
      setDisconnectingProvider(null);
    }
  };

  const handleDisconnectMicrosoft = async (): Promise<void> => {
    setDisconnectingProvider("microsoft");
    try {
      const result = await window.api.auth.microsoftDisconnectMailbox(userId);
      if (result.success) {
        await checkConnections();
        // TASK-1730: Notify parent to update app state machine
        if (onEmailDisconnected) {
          onEmailDisconnected("microsoft");
        }
        // TASK-1730: Emit event for cross-component state propagation
        emitEmailConnectionChanged({ connected: false, provider: "microsoft" });
      }
    } catch (error) {
      console.error("Failed to disconnect Microsoft:", error);
    } finally {
      setDisconnectingProvider(null);
    }
  };

  const handleSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    handleExportFormatChange(e.target.value);
  };

  const handleReindexDatabase = async (): Promise<void> => {
    // Show confirmation with freeze warning
    const confirmed = window.confirm(
      "This will optimize the database for better performance.\n\n" +
        "Note: The app may briefly freeze during this process. This is normal and should only take a few seconds.\n\n" +
        "Continue?",
    );
    if (!confirmed) return;

    setReindexing(true);
    setReindexResult(null);
    try {
      const result = await window.api.system.reindexDatabase();
      if (result.success) {
        setReindexResult({
          success: true,
          message: `Database optimized: ${result.indexesRebuilt} indexes rebuilt in ${result.durationMs}ms`,
        });
      } else {
        setReindexResult({
          success: false,
          message: result.error || "Failed to optimize database",
        });
      }
    } catch (error) {
      console.error("Failed to reindex database:", error);
      setReindexResult({
        success: false,
        message: "An unexpected error occurred while optimizing the database",
      });
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Settings Content - Scrollable area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
            {/* General Settings */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                General
              </h3>
              <div className="space-y-4">
                {/* Scan Lookback */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      Scan Lookback Period
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      How far back to search emails and messages
                    </p>
                  </div>
                  <select
                    value={scanLookbackMonths}
                    onChange={(e) =>
                      handleScanLookbackChange(Number(e.target.value))
                    }
                    disabled={loadingPreferences}
                    className="ml-4 text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={9}>9 months</option>
                    <option value={12}>12 months</option>
                    <option value={18}>18 months</option>
                    <option value={24}>24 months</option>
                  </select>
                </div>

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
                    disabled={loadingPreferences}
                    className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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

                {/* Coming Soon Settings */}
                {/* Notifications */}
                {/* TODO: Implement desktop notifications system */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-50">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      Notifications
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Show desktop notifications for important events
                    </p>
                  </div>
                  <button
                    disabled
                    className="ml-4 relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed"
                  >
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                  </button>
                </div>

                {/* Auto Export */}
                {/* TODO: Implement automatic daily export functionality */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-50">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      Auto Export
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Automatically export new transactions daily
                    </p>
                  </div>
                  <button
                    disabled
                    className="ml-4 relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed"
                  >
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                  </button>
                </div>

                {/* Dark Mode */}
                {/* TODO: Implement dark mode theme system */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-50">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      Dark Mode
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">Coming soon...</p>
                  </div>
                  <button
                    disabled
                    className="ml-4 relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed"
                  >
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                  </button>
                </div>
              </div>
            </div>

            {/* Email Connections */}
            <div id="email-connections" className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Email Connections
              </h3>
              <div className="space-y-4">
                {/* Gmail Connection */}
                <div className={`p-4 rounded-lg border ${
                  connections.google?.error && !connections.google?.connected && connections.google.error.type !== "NOT_CONNECTED"
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-red-500"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.545l8.073-6.052C21.69 2.28 24 3.434 24 5.457z" />
                      </svg>
                      <h4 className="text-sm font-medium text-gray-900">
                        Gmail
                      </h4>
                    </div>
                    {loadingConnections ? (
                      <div className="text-xs text-gray-500">Checking...</div>
                    ) : connections.google?.connected ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-600 font-medium">
                          Connected
                        </span>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                    ) : connections.google?.error && connections.google.error.type !== "NOT_CONNECTED" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-yellow-600 font-medium">
                          {connections.google.error.type === "TOKEN_REFRESH_FAILED" ||
                           connections.google.error.type === "TOKEN_EXPIRED"
                            ? "Session Expired"
                            : "Connection Issue"}
                        </span>
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          Not Connected
                        </span>
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      </div>
                    )}
                  </div>
                  {connections.google?.email && (
                    <p className="text-xs text-gray-600 mb-2">
                      {connections.google.email}
                    </p>
                  )}
                  {/* Show error message and action prompt when connection has issues (not for NOT_CONNECTED) */}
                  {connections.google?.error && !connections.google?.connected && connections.google.error.type !== "NOT_CONNECTED" && (
                    <div className="mb-3 p-2 bg-yellow-100 rounded text-xs">
                      <p className="text-yellow-800 font-medium">
                        {connections.google.error.userMessage}
                      </p>
                      {connections.google.error.action && (
                        <p className="text-yellow-700 mt-1">
                          {connections.google.error.action}
                        </p>
                      )}
                    </div>
                  )}
                  {connections.google?.connected ? (
                    <button
                      onClick={handleDisconnectGoogle}
                      disabled={disconnectingProvider === "google"}
                      className="w-full mt-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {disconnectingProvider === "google"
                        ? "Disconnecting..."
                        : "Disconnect Gmail"}
                    </button>
                  ) : connections.google?.error && connections.google.error.type !== "NOT_CONNECTED" ? (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={connectingProvider === "google"}
                      className="w-full mt-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connectingProvider === "google"
                        ? "Reconnecting..."
                        : "Reconnect Gmail"}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={connectingProvider === "google"}
                      className="w-full mt-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connectingProvider === "google"
                        ? "Connecting..."
                        : "Connect Gmail"}
                    </button>
                  )}
                </div>

                {/* Outlook Connection */}
                <div className={`p-4 rounded-lg border ${
                  connections.microsoft?.error && !connections.microsoft?.connected && connections.microsoft.error.type !== "NOT_CONNECTED"
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                        <rect
                          x="11"
                          y="1"
                          width="9"
                          height="9"
                          fill="#7FBA00"
                        />
                        <rect
                          x="1"
                          y="11"
                          width="9"
                          height="9"
                          fill="#00A4EF"
                        />
                        <rect
                          x="11"
                          y="11"
                          width="9"
                          height="9"
                          fill="#FFB900"
                        />
                      </svg>
                      <h4 className="text-sm font-medium text-gray-900">
                        Outlook
                      </h4>
                    </div>
                    {loadingConnections ? (
                      <div className="text-xs text-gray-500">Checking...</div>
                    ) : connections.microsoft?.connected ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-600 font-medium">
                          Connected
                        </span>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                    ) : connections.microsoft?.error && connections.microsoft.error.type !== "NOT_CONNECTED" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-yellow-600 font-medium">
                          {connections.microsoft.error.type === "TOKEN_REFRESH_FAILED" ||
                           connections.microsoft.error.type === "TOKEN_EXPIRED"
                            ? "Session Expired"
                            : "Connection Issue"}
                        </span>
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          Not Connected
                        </span>
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      </div>
                    )}
                  </div>
                  {connections.microsoft?.email && (
                    <p className="text-xs text-gray-600 mb-2">
                      {connections.microsoft.email}
                    </p>
                  )}
                  {/* Show error message and action prompt when connection has issues (not for NOT_CONNECTED) */}
                  {connections.microsoft?.error && !connections.microsoft?.connected && connections.microsoft.error.type !== "NOT_CONNECTED" && (
                    <div className="mb-3 p-2 bg-yellow-100 rounded text-xs">
                      <p className="text-yellow-800 font-medium">
                        {connections.microsoft.error.userMessage}
                      </p>
                      {connections.microsoft.error.action && (
                        <p className="text-yellow-700 mt-1">
                          {connections.microsoft.error.action}
                        </p>
                      )}
                    </div>
                  )}
                  {connections.microsoft?.connected ? (
                    <button
                      onClick={handleDisconnectMicrosoft}
                      disabled={disconnectingProvider === "microsoft"}
                      className="w-full mt-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {disconnectingProvider === "microsoft"
                        ? "Disconnecting..."
                        : "Disconnect Outlook"}
                    </button>
                  ) : connections.microsoft?.error && connections.microsoft.error.type !== "NOT_CONNECTED" ? (
                    <button
                      onClick={handleConnectMicrosoft}
                      disabled={connectingProvider === "microsoft"}
                      className="w-full mt-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connectingProvider === "microsoft"
                        ? "Reconnecting..."
                        : "Reconnect Outlook"}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectMicrosoft}
                      disabled={connectingProvider === "microsoft"}
                      className="w-full mt-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connectingProvider === "microsoft"
                        ? "Connecting..."
                        : "Connect Outlook"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* macOS Messages Import - Only shows on macOS */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Messages
              </h3>
              <div className="space-y-4">
                <MacOSMessagesImportSettings userId={userId} />
              </div>
            </div>

            {/* macOS Contacts Import - Only shows on macOS */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Contacts
              </h3>
              <div className="space-y-4">
                <MacOSContactsImportSettings userId={userId} />
              </div>
            </div>

            {/* Export Settings */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Export
              </h3>
              <div className="space-y-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Default Format</span>
                  <select
                    value={exportFormat}
                    onChange={handleSelectChange}
                    disabled={loadingPreferences}
                    className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="txt_eml">TXT + EML Files</option>
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

            {/* AI Settings - Only visible with AI add-on (BACKLOG-462) */}
            <LicenseGate requires="ai_addon">
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  AI Settings
                </h3>
                <LLMSettings userId={userId} />
              </div>
            </LicenseGate>

            {/* Data & Privacy */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Data & Privacy
              </h3>
              <div className="space-y-3">
                {/* Reindex Database - Database maintenance for performance */}
                <button
                  onClick={handleReindexDatabase}
                  disabled={reindexing}
                  className="w-full text-left p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        Reindex Database
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Optimize database performance if you notice slowness
                      </p>
                      {/* Show result message */}
                      {reindexResult && (
                        <p
                          className={`text-xs mt-2 ${
                            reindexResult.success
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {reindexResult.message}
                        </p>
                      )}
                    </div>
                    {reindexing ? (
                      <svg
                        className="w-5 h-5 text-blue-500 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    )}
                  </div>
                </button>

                {/* TODO: Implement data viewer showing transactions, contacts, and cached emails */}
                <button
                  disabled
                  className="w-full text-left p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        View Stored Data
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        See all data stored locally on your device
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </button>

                {/* TODO: Implement data clearing with confirmation dialog */}
                <button
                  disabled
                  className="w-full text-left p-4 bg-red-50 rounded-lg border border-red-200 opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-red-700">
                        Clear All Data
                      </h4>
                      <p className="text-xs text-red-600 mt-1">
                        Delete all local data and reset the app
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </div>
                </button>
              </div>
            </div>

            {/* About */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                About
              </h3>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xl">M</span>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-semibold text-gray-900">
                      MagicAudit
                    </h4>
                    <p className="text-xs text-gray-600">Version 1.0.7</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  {/* TODO: Implement manual update check using electron-updater */}
                  <button
                    disabled
                    className="w-full text-left text-gray-400 font-medium cursor-not-allowed"
                  >
                    Check for Updates
                  </button>
                  {/* TODO: Implement release notes viewer/link to GitHub releases */}
                  <button
                    disabled
                    className="w-full text-left text-gray-400 font-medium cursor-not-allowed"
                  >
                    View Release Notes
                  </button>
                  {/* TODO: Implement privacy policy viewer/link */}
                  <button
                    disabled
                    className="w-full text-left text-gray-400 font-medium cursor-not-allowed"
                  >
                    Privacy Policy
                  </button>
                  {/* TODO: Implement terms of service viewer/link */}
                  <button
                    disabled
                    className="w-full text-left text-gray-400 font-medium cursor-not-allowed"
                  >
                    Terms of Service
                  </button>
                </div>
              </div>
            </div>
          </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
