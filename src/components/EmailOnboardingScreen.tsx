import React, { useState, useEffect } from 'react';
import log from 'electron-log/renderer';

interface ConnectionStatus {
  connected: boolean;
  email?: string;
}

interface Connections {
  google: ConnectionStatus | null;
  microsoft: ConnectionStatus | null;
}

interface ConnectionResult {
  success: boolean;
}

interface EmailOnboardingScreenProps {
  userId: string;
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * EmailOnboardingScreen Component
 * Prompts new users to connect their email accounts (Gmail/Outlook) during onboarding.
 * This screen appears after terms acceptance and before the permissions screen.
 */
function EmailOnboardingScreen({ userId, onComplete, onSkip }: EmailOnboardingScreenProps) {
  const [connections, setConnections] = useState<Connections>({ google: null, microsoft: null });
  const [loadingConnections, setLoadingConnections] = useState<boolean>(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  // Check existing connections on mount
  useEffect(() => {
    if (userId) {
      checkConnections();
    }
  }, [userId]);

  const checkConnections = async (): Promise<void> => {
    setLoadingConnections(true);
    try {
      log.info('[EmailOnboarding] Checking email connection status');
      const result = await window.api.system.checkAllConnections(userId);
      if (result.success) {
        setConnections({
          google: result.google || null,
          microsoft: result.microsoft || null,
        });
        log.info('[EmailOnboarding] Connection status retrieved', {
          googleConnected: result.google?.connected || false,
          microsoftConnected: result.microsoft?.connected || false
        });
      }
    } catch (error) {
      log.error('[EmailOnboarding] Failed to check connections:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleConnectGoogle = async (): Promise<void> => {
    setConnectingProvider('google');
    let cleanup: (() => void) | undefined;
    try {
      log.info('[EmailOnboarding] Initiating Google mailbox connection');
      const result = await window.api.auth.googleConnectMailbox(userId);
      if (result.success) {
        cleanup = window.api.onGoogleMailboxConnected(async (connectionResult: ConnectionResult) => {
          if (connectionResult.success) {
            log.info('[EmailOnboarding] Google mailbox connected successfully');
            await checkConnections();
          } else {
            log.warn('[EmailOnboarding] Google mailbox connection failed');
          }
          setConnectingProvider(null);
          if (cleanup) cleanup();
        });
      }
    } catch (error) {
      log.error('[EmailOnboarding] Failed to connect Google:', error);
      setConnectingProvider(null);
      if (cleanup) cleanup();
    }
  };

  const handleConnectMicrosoft = async (): Promise<void> => {
    setConnectingProvider('microsoft');
    let cleanup: (() => void) | undefined;
    try {
      log.info('[EmailOnboarding] Initiating Microsoft mailbox connection');
      const result = await window.api.auth.microsoftConnectMailbox(userId);
      if (result.success) {
        cleanup = window.api.onMicrosoftMailboxConnected(async (connectionResult: ConnectionResult) => {
          if (connectionResult.success) {
            log.info('[EmailOnboarding] Microsoft mailbox connected successfully');
            await checkConnections();
          } else {
            log.warn('[EmailOnboarding] Microsoft mailbox connection failed');
          }
          setConnectingProvider(null);
          if (cleanup) cleanup();
        });
      }
    } catch (error) {
      log.error('[EmailOnboarding] Failed to connect Microsoft:', error);
      setConnectingProvider(null);
      if (cleanup) cleanup();
    }
  };

  const handleContinue = (): void => {
    const hasConnection = connections.google?.connected || connections.microsoft?.connected;
    log.info('[EmailOnboarding] User continuing with email connection status', { hasConnection });
    onComplete();
  };

  const handleSkip = (): void => {
    log.info('[EmailOnboarding] User skipped email connection');
    onSkip();
  };

  const hasAnyConnection = connections.google?.connected || connections.microsoft?.connected;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Connect Your Email</h2>
          <p className="text-gray-600">
            Connect your email account to export email communications alongside text messages for complete audit trails.
          </p>
        </div>

        {/* Benefits List */}
        <div className="mb-8 bg-blue-50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Why connect your email?</h3>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-blue-800">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Export complete communication history with clients</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-blue-800">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Include emails in your audit documentation</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-blue-800">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Seamless integration with Gmail and Outlook</span>
            </li>
          </ul>
        </div>

        {/* Connection Cards */}
        <div className="space-y-4 mb-8">
          {/* Gmail Connection */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.545l8.073-6.052C21.69 2.28 24 3.434 24 5.457z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Gmail</h4>
                  {loadingConnections ? (
                    <p className="text-xs text-gray-500">Checking...</p>
                  ) : connections.google?.connected ? (
                    <p className="text-xs text-green-600 font-medium">Connected: {connections.google.email}</p>
                  ) : (
                    <p className="text-xs text-gray-500">Not connected</p>
                  )}
                </div>
              </div>
              {connections.google?.connected && (
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            {!connections.google?.connected && (
              <button
                onClick={handleConnectGoogle}
                disabled={connectingProvider === 'google' || loadingConnections}
                className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-700 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {connectingProvider === 'google' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>Connect Gmail</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Outlook Connection */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.88q0-.46.33-.8.33-.33.8-.33h14.5q.46 0 .8.33.32.34.32.8V12zM7.13 18H2V7.38l5.13 4.36zM14.75 7.88q0 .47-.12.89-.12.41-.36.76-.23.35-.61.57-.37.22-.94.22h-.86v3.63h-.87V6.13h1.73q.59 0 .98.22.38.22.63.57.24.36.36.78.11.41.11.88zm-1.25 0q0-.61-.34-.92-.33-.3-.93-.3h-.86v2.45h.86q.6 0 .93-.3.34-.32.34-.93zM24 7.07v10.76L11.5 12zm-1-1.1L12.63 12L23 17.9V5.97z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Outlook</h4>
                  {loadingConnections ? (
                    <p className="text-xs text-gray-500">Checking...</p>
                  ) : connections.microsoft?.connected ? (
                    <p className="text-xs text-green-600 font-medium">Connected: {connections.microsoft.email}</p>
                  ) : (
                    <p className="text-xs text-gray-500">Not connected</p>
                  )}
                </div>
              </div>
              {connections.microsoft?.connected && (
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            {!connections.microsoft?.connected && (
              <button
                onClick={handleConnectMicrosoft}
                disabled={connectingProvider === 'microsoft' || loadingConnections}
                className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {connectingProvider === 'microsoft' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>Connect Outlook</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {hasAnyConnection ? (
            <button
              onClick={handleContinue}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSkip}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-6 rounded-xl font-semibold transition-all"
            >
              Skip for Now
            </button>
          )}

          {hasAnyConnection && (
            <button
              onClick={handleSkip}
              className="w-full text-gray-500 hover:text-gray-700 py-2 text-sm font-medium transition-colors"
            >
              Skip additional connections
            </button>
          )}

          {!hasAnyConnection && (
            <p className="text-xs text-gray-500 text-center">
              You can always connect your email later in Settings
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailOnboardingScreen;
