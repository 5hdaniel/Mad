import React, { useState, useEffect } from 'react';

interface ConnectionStatus {
  connected: boolean;
  email?: string;
}

interface Connections {
  google: ConnectionStatus | null;
  microsoft: ConnectionStatus | null;
}

interface PreferencesResult {
  success: boolean;
  preferences?: {
    export?: {
      defaultFormat?: string;
    };
  };
}

interface ConnectionResult {
  success: boolean;
}

interface SettingsComponentProps {
  onClose: () => void;
  userId: string;
}

/**
 * Settings Component
 * Application settings and preferences
 */
function Settings({ onClose, userId }: SettingsComponentProps) {
  const [connections, setConnections] = useState<Connections>({ google: null, microsoft: null });
  const [loadingConnections, setLoadingConnections] = useState<boolean>(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<string>('pdf'); // Default export format
  const [loadingPreferences, setLoadingPreferences] = useState<boolean>(true);

  // Load connection status and preferences on mount
  useEffect(() => {
    if (userId) {
      checkConnections();
      loadPreferences();
    }
  }, [userId]);

  const checkConnections = async (): Promise<void> => {
    setLoadingConnections(true);
    try {
      const result = await window.api.system.checkAllConnections(userId);
      if (result.success) {
        setConnections({
          google: result.google || null,
          microsoft: result.microsoft || null,
        });
      }
    } catch (error) {
      console.error('Failed to check connections:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const loadPreferences = async (): Promise<void> => {
    setLoadingPreferences(true);
    try {
      const result: PreferencesResult = await window.api.preferences.get(userId);
      if (result.success && result.preferences) {
        // Load export format preference
        if (result.preferences.export?.defaultFormat) {
          setExportFormat(result.preferences.export.defaultFormat);
        }
        // TODO: Load other preferences when they are implemented
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoadingPreferences(false);
    }
  };

  const handleExportFormatChange = async (newFormat: string): Promise<void> => {
    setExportFormat(newFormat);
    try {
      // Update only the export format preference
      const result = await window.api.preferences.update(userId, {
        export: {
          defaultFormat: newFormat
        }
      });
      if (!result.success) {
        console.error('Failed to save export format preference');
      }
    } catch (error) {
      console.error('Failed to save export format preference:', error);
    }
  };

  const handleConnectGoogle = async (): Promise<void> => {
    setConnectingProvider('google');
    let cleanup: (() => void) | undefined;
    try {
      const result = await window.api.auth.googleConnectMailbox(userId);
      if (result.success) {
        // Auth popup window opens automatically and will close when done
        // Listen for connection completion
        cleanup = window.api.onGoogleMailboxConnected(async (connectionResult: ConnectionResult) => {
          if (connectionResult.success) {
            await checkConnections();
          }
          setConnectingProvider(null);
          if (cleanup) cleanup(); // Clean up listener after handling the event
        });
      }
    } catch (error) {
      console.error('Failed to connect Google:', error);
      setConnectingProvider(null);
      if (cleanup) cleanup();
    }
  };

  const handleConnectMicrosoft = async (): Promise<void> => {
    setConnectingProvider('microsoft');
    let cleanup: (() => void) | undefined;
    try {
      const result = await window.api.auth.microsoftConnectMailbox(userId);
      if (result.success) {
        // Auth popup window opens automatically and will close when done
        // Listen for connection completion
        cleanup = window.api.onMicrosoftMailboxConnected(async (connectionResult: ConnectionResult) => {
          if (connectionResult.success) {
            await checkConnections();
          }
          setConnectingProvider(null);
          if (cleanup) cleanup(); // Clean up listener after handling the event
        });
      }
    } catch (error) {
      console.error('Failed to connect Microsoft:', error);
      setConnectingProvider(null);
      if (cleanup) cleanup();
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    handleExportFormatChange(e.target.value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative z-10 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Settings Content - Scrollable area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* General Settings */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">General</h3>
            <div className="space-y-4">
              {/* Notifications */}
              {/* TODO: Implement desktop notifications system */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-50">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">Notifications</h4>
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
                  <h4 className="text-sm font-medium text-gray-900">Auto Export</h4>
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
                  <h4 className="text-sm font-medium text-gray-900">Dark Mode</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Coming soon...
                  </p>
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
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Connections</h3>
            <div className="space-y-4">
              {/* Gmail Connection */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.545l8.073-6.052C21.69 2.28 24 3.434 24 5.457z"/>
                    </svg>
                    <h4 className="text-sm font-medium text-gray-900">Gmail</h4>
                  </div>
                  {loadingConnections ? (
                    <div className="text-xs text-gray-500">Checking...</div>
                  ) : connections.google?.connected ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-medium">Connected</span>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Not Connected</span>
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    </div>
                  )}
                </div>
                {connections.google?.email && (
                  <p className="text-xs text-gray-600 mb-3">{connections.google.email}</p>
                )}
                <button
                  onClick={handleConnectGoogle}
                  disabled={connectingProvider === 'google' || connections.google?.connected}
                  className="w-full mt-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connectingProvider === 'google' ? 'Connecting...' : connections.google?.connected ? 'Connected' : 'Connect Gmail'}
                </button>
              </div>

              {/* Outlook Connection */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                    </svg>
                    <h4 className="text-sm font-medium text-gray-900">Outlook</h4>
                  </div>
                  {loadingConnections ? (
                    <div className="text-xs text-gray-500">Checking...</div>
                  ) : connections.microsoft?.connected ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-medium">Connected</span>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Not Connected</span>
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    </div>
                  )}
                </div>
                {connections.microsoft?.email && (
                  <p className="text-xs text-gray-600 mb-3">{connections.microsoft.email}</p>
                )}
                <button
                  onClick={handleConnectMicrosoft}
                  disabled={connectingProvider === 'microsoft' || connections.microsoft?.connected}
                  className="w-full mt-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connectingProvider === 'microsoft' ? 'Connecting...' : connections.microsoft?.connected ? 'Connected' : 'Connect Outlook'}
                </button>
              </div>
            </div>
          </div>

          {/* Export Settings */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export</h3>
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
                <button disabled className="text-sm text-gray-400 font-medium cursor-not-allowed">
                  Choose Folder
                </button>
              </div>
            </div>
          </div>

          {/* Data & Privacy */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data & Privacy</h3>
            <div className="space-y-3">
              {/* TODO: Implement data viewer showing transactions, contacts, and cached emails */}
              <button disabled className="w-full text-left p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-50 cursor-not-allowed">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">View Stored Data</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      See all data stored locally on your device
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* TODO: Implement data clearing with confirmation dialog */}
              <button disabled className="w-full text-left p-4 bg-red-50 rounded-lg border border-red-200 opacity-50 cursor-not-allowed">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-red-700">Clear All Data</h4>
                    <p className="text-xs text-red-600 mt-1">
                      Delete all local data and reset the app
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </button>
            </div>
          </div>

          {/* About */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">About</h3>
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">M</span>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-semibold text-gray-900">MagicAudit</h4>
                  <p className="text-xs text-gray-600">Version 1.0.7</p>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                {/* TODO: Implement manual update check using electron-updater */}
                <button disabled className="w-full text-left text-gray-400 font-medium cursor-not-allowed">
                  Check for Updates
                </button>
                {/* TODO: Implement release notes viewer/link to GitHub releases */}
                <button disabled className="w-full text-left text-gray-400 font-medium cursor-not-allowed">
                  View Release Notes
                </button>
                {/* TODO: Implement privacy policy viewer/link */}
                <button disabled className="w-full text-left text-gray-400 font-medium cursor-not-allowed">
                  Privacy Policy
                </button>
                {/* TODO: Implement terms of service viewer/link */}
                <button disabled className="w-full text-left text-gray-400 font-medium cursor-not-allowed">
                  Terms of Service
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-xl flex-shrink-0">
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
