import React, { useState, useEffect } from 'react';

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
  authProvider: 'google' | 'microsoft';
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * EmailOnboardingScreen Component
 * Prompts new users to connect their email accounts (Gmail/Outlook) during onboarding.
 * This screen appears after terms acceptance and before the permissions screen.
 * Shows the primary email service (matching login provider) prominently, with the other as optional.
 */
function EmailOnboardingScreen({ userId, authProvider, onComplete, onSkip }: EmailOnboardingScreenProps) {
  const [connections, setConnections] = useState<Connections>({ google: null, microsoft: null });
  const [loadingConnections, setLoadingConnections] = useState<boolean>(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  // Determine primary and secondary providers based on how user logged in
  const isPrimaryGoogle = authProvider === 'google';
  const primaryProvider = isPrimaryGoogle ? 'google' : 'microsoft';
  const secondaryProvider = isPrimaryGoogle ? 'microsoft' : 'google';

  // Check existing connections on mount
  useEffect(() => {
    if (userId) {
      checkConnections();
    }
  }, [userId]);

  const checkConnections = async (): Promise<void> => {
    setLoadingConnections(true);
    try {
      console.log('[EmailOnboarding] Checking email connection status');
      const result = await window.api.system.checkAllConnections(userId);
      if (result.success) {
        setConnections({
          google: result.google || null,
          microsoft: result.microsoft || null,
        });
        console.log('[EmailOnboarding] Connection status retrieved', {
          googleConnected: result.google?.connected || false,
          microsoftConnected: result.microsoft?.connected || false
        });
      }
    } catch (error) {
      console.error('[EmailOnboarding] Failed to check connections:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleConnectGoogle = async (): Promise<void> => {
    setConnectingProvider('google');
    let cleanup: (() => void) | undefined;
    try {
      console.log('[EmailOnboarding] Initiating Google mailbox connection');
      const result = await window.api.auth.googleConnectMailbox(userId);
      if (result.success) {
        cleanup = window.api.onGoogleMailboxConnected(async (connectionResult: ConnectionResult) => {
          if (connectionResult.success) {
            console.log('[EmailOnboarding] Google mailbox connected successfully');
            await checkConnections();
          } else {
            console.warn('[EmailOnboarding] Google mailbox connection failed');
          }
          setConnectingProvider(null);
          if (cleanup) cleanup();
        });
      }
    } catch (error) {
      console.error('[EmailOnboarding] Failed to connect Google:', error);
      setConnectingProvider(null);
      if (cleanup) cleanup();
    }
  };

  const handleConnectMicrosoft = async (): Promise<void> => {
    setConnectingProvider('microsoft');
    let cleanup: (() => void) | undefined;
    try {
      console.log('[EmailOnboarding] Initiating Microsoft mailbox connection');
      const result = await window.api.auth.microsoftConnectMailbox(userId);
      if (result.success) {
        cleanup = window.api.onMicrosoftMailboxConnected(async (connectionResult: ConnectionResult) => {
          if (connectionResult.success) {
            console.log('[EmailOnboarding] Microsoft mailbox connected successfully');
            await checkConnections();
          } else {
            console.warn('[EmailOnboarding] Microsoft mailbox connection failed');
          }
          setConnectingProvider(null);
          if (cleanup) cleanup();
        });
      }
    } catch (error) {
      console.error('[EmailOnboarding] Failed to connect Microsoft:', error);
      setConnectingProvider(null);
      if (cleanup) cleanup();
    }
  };

  const handleContinue = (): void => {
    const hasConnection = connections.google?.connected || connections.microsoft?.connected;
    console.log('[EmailOnboarding] User continuing with email connection status', { hasConnection });
    onComplete();
  };

  const handleSkip = (): void => {
    console.log('[EmailOnboarding] User skipped email connection');
    onSkip();
  };

  const hasAnyConnection = connections.google?.connected || connections.microsoft?.connected;
  const primaryConnection = isPrimaryGoogle ? connections.google : connections.microsoft;
  const secondaryConnection = isPrimaryGoogle ? connections.microsoft : connections.google;

  // Provider display info
  const providerInfo = {
    google: {
      name: 'Gmail',
      icon: (
        <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.545l8.073-6.052C21.69 2.28 24 3.434 24 5.457z"/>
        </svg>
      ),
      hoverBorder: 'hover:border-red-300',
      hoverBg: 'hover:bg-red-50',
      connectHandler: handleConnectGoogle,
    },
    microsoft: {
      name: 'Outlook',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 21 21" fill="none">
          {/* Microsoft 4-square logo */}
          <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
          <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
        </svg>
      ),
      hoverBorder: 'hover:border-blue-300',
      hoverBg: 'hover:bg-blue-50',
      connectHandler: handleConnectMicrosoft,
    },
  };

  const primaryInfo = providerInfo[primaryProvider];
  const secondaryInfo = providerInfo[secondaryProvider];

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
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Connect Your {primaryInfo.name}</h2>
          <p className="text-gray-600">
            Connect your {primaryInfo.name} account to export email communications alongside text messages for complete audit trails.
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
          </ul>
        </div>

        {/* Primary Connection Card - Highlighted */}
        <div className="mb-6">
          <div className="p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-lg shadow-md flex items-center justify-center">
                  {primaryInfo.icon}
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900">{primaryInfo.name}</h4>
                  {loadingConnections ? (
                    <p className="text-xs text-gray-500">Checking...</p>
                  ) : primaryConnection?.connected ? (
                    <p className="text-xs text-green-600 font-medium">Connected: {primaryConnection.email}</p>
                  ) : (
                    <p className="text-xs text-gray-500">Recommended - matches your login</p>
                  )}
                </div>
              </div>
              {primaryConnection?.connected && (
                <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            {!primaryConnection?.connected && (
              <button
                onClick={primaryInfo.connectHandler}
                disabled={connectingProvider === primaryProvider || loadingConnections}
                className={`w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md`}
              >
                {connectingProvider === primaryProvider ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <span>Connect {primaryInfo.name}</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Secondary Connection Card - Optional */}
        <div className="mb-8">
          <p className="text-xs text-gray-500 text-center mb-3">Or connect another email service (optional)</p>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center">
                  {secondaryInfo.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{secondaryInfo.name}</h4>
                  {loadingConnections ? (
                    <p className="text-xs text-gray-500">Checking...</p>
                  ) : secondaryConnection?.connected ? (
                    <p className="text-xs text-green-600 font-medium">Connected: {secondaryConnection.email}</p>
                  ) : (
                    <p className="text-xs text-gray-400">Optional</p>
                  )}
                </div>
              </div>
              {secondaryConnection?.connected && (
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            {!secondaryConnection?.connected && (
              <button
                onClick={secondaryInfo.connectHandler}
                disabled={connectingProvider === secondaryProvider || loadingConnections}
                className={`w-full px-4 py-2 bg-white border-2 border-gray-200 ${secondaryInfo.hoverBorder} ${secondaryInfo.hoverBg} text-gray-600 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {connectingProvider === secondaryProvider ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <span>Connect {secondaryInfo.name}</span>
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
