import React, { useState, useEffect } from 'react';

/**
 * Settings Component
 * Application settings and preferences
 */
function Settings({ onClose, userId }) {
  const [autoExport, setAutoExport] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [connections, setConnections] = useState({ google: null, microsoft: null });
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState(null);
  const [googleAuthCode, setGoogleAuthCode] = useState('');
  const [showGoogleCodeInput, setShowGoogleCodeInput] = useState(false);

  // Load connection status on mount
  useEffect(() => {
    if (userId) {
      checkConnections();
    }
  }, [userId]);

  const checkConnections = async () => {
    setLoadingConnections(true);
    try {
      const result = await window.api.system.checkAllConnections(userId);
      if (result.success) {
        setConnections({
          google: result.google,
          microsoft: result.microsoft,
        });
      }
    } catch (error) {
      console.error('Failed to check connections:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleConnectGoogle = async () => {
    setConnectingProvider('google');
    try {
      const result = await window.api.auth.googleConnectMailbox(userId);
      if (result.success && result.authUrl) {
        await window.api.shell.openExternal(result.authUrl);
        setShowGoogleCodeInput(true);
      }
    } catch (error) {
      console.error('Failed to connect Google:', error);
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleGoogleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!googleAuthCode.trim()) return;

    setConnectingProvider('google');
    try {
      const result = await window.api.auth.googleCompleteMailboxConnection(googleAuthCode.trim(), userId);
      if (result.success) {
        setShowGoogleCodeInput(false);
        setGoogleAuthCode('');
        await checkConnections();
      }
    } catch (error) {
      console.error('Failed to complete Google connection:', error);
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleConnectMicrosoft = async () => {
    setConnectingProvider('microsoft');
    try {
      const result = await window.api.auth.microsoftConnectMailbox(userId);
      if (result.success && result.authUrl) {
        await window.api.shell.openExternal(result.authUrl);

        // Listen for connection completion
        window.api.onMicrosoftMailboxConnected(async (connectionResult) => {
          if (connectionResult.success) {
            await checkConnections();
          }
          setConnectingProvider(null);
        });
      }
    } catch (error) {
      console.error('Failed to connect Microsoft:', error);
      setConnectingProvider(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
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

        {/* Settings Content */}
        <div className="p-6">
          {/* General Settings */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">General</h3>
            <div className="space-y-4">
              {/* Auto Export */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">Auto Export</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Automatically export new transactions daily
                  </p>
                </div>
                <button
                  onClick={() => setAutoExport(!autoExport)}
                  className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoExport ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoExport ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">Notifications</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Show desktop notifications for important events
                  </p>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Dark Mode - Coming Soon */}
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
                {showGoogleCodeInput ? (
                  <form onSubmit={handleGoogleCodeSubmit} className="mt-3">
                    <label className="block text-xs text-gray-700 mb-1">
                      Paste the authorization code from your browser:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={googleAuthCode}
                        onChange={(e) => setGoogleAuthCode(e.target.value)}
                        placeholder="Authorization code"
                        className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={connectingProvider === 'google'}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50"
                      >
                        {connectingProvider === 'google' ? 'Connecting...' : 'Submit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowGoogleCodeInput(false);
                          setGoogleAuthCode('');
                        }}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={handleConnectGoogle}
                    disabled={connectingProvider === 'google' || connections.google?.connected}
                    className="w-full mt-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connectingProvider === 'google' ? 'Connecting...' : connections.google?.connected ? 'Connected' : 'Connect Gmail'}
                  </button>
                )}
              </div>

              {/* Outlook Connection */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.88q0-.46.33-.8.33-.33.8-.33h14.5q.46 0 .8.33.32.34.32.8V12zM7.13 18H2V7.38l5.13 4.36zM14.75 7.88q0 .47-.12.89-.12.41-.36.76-.23.35-.61.57-.37.22-.94.22h-.86v3.63h-.87V6.13h1.73q.59 0 .98.22.38.22.63.57.24.36.36.78.11.41.11.88zm-1.25 0q0-.61-.34-.92-.33-.3-.93-.3h-.86v2.45h.86q.6 0 .93-.3.34-.32.34-.93zM24 7.07v10.76L11.5 12zm-1-1.1L12.63 12L23 17.9V5.97z"/>
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
                <select className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option>PDF</option>
                  <option>CSV</option>
                  <option>Excel</option>
                </select>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Export Location</span>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Choose Folder
                </button>
              </div>
            </div>
          </div>

          {/* Data & Privacy */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data & Privacy</h3>
            <div className="space-y-3">
              <button className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all">
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

              <button className="w-full text-left p-4 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-all">
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
                <button className="w-full text-left text-blue-600 hover:text-blue-700 font-medium">
                  Check for Updates
                </button>
                <button className="w-full text-left text-blue-600 hover:text-blue-700 font-medium">
                  View Release Notes
                </button>
                <button className="w-full text-left text-blue-600 hover:text-blue-700 font-medium">
                  Privacy Policy
                </button>
                <button className="w-full text-left text-blue-600 hover:text-blue-700 font-medium">
                  Terms of Service
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-xl">
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
