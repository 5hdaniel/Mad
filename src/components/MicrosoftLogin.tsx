import React, { useState, useEffect } from 'react';

interface MicrosoftLoginProps {
  onLoginComplete: (userInfo: { username?: string }) => void;
  onSkip?: () => void;
}

interface DeviceCodeInfo {
  verificationUri: string;
  userCode: string;
}

function MicrosoftLogin({ onLoginComplete, onSkip }: MicrosoftLoginProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  // Auto-continue when authenticated
  useEffect(() => {
    if (isAuthenticated && userEmail) {
      // Small delay to show the success state before continuing
      const timer = setTimeout(() => {
        onLoginComplete({ username: userEmail });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, userEmail, onLoginComplete]);

  const checkAuthentication = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      // Initialize Outlook service
      const initResult = await window.electron.outlookInitialize();

      if (!initResult.success) {
        // Not configured - allow user to skip
        setError(initResult.error || null);
        setIsInitializing(false);
        return;
      }

      // Check if already authenticated
      const isAuth = await window.electron.outlookIsAuthenticated();

      if (isAuth) {
        const email = await window.electron.outlookGetUserEmail();
        if (email) {
          setUserEmail(email);
          setIsAuthenticated(true);
        } else {
          setUserEmail(null);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setError(null);
    setDeviceCode(null);

    // Listen for device code from main process
    const handleDeviceCode = (code: string) => {
      // Parse the code string if it's JSON, otherwise create a simple object
      try {
        const parsed = JSON.parse(code) as DeviceCodeInfo;
        setDeviceCode(parsed);
      } catch {
        // If not JSON, assume it's a simple format
        setDeviceCode({ verificationUri: '', userCode: code });
      }
    };

    // Set up listener (will be cleaned up when authentication completes)
    let cleanup;
    if (window.electron.onDeviceCode) {
      cleanup = window.electron.onDeviceCode(handleDeviceCode);
    }

    try {
      const result = await window.electron.outlookAuthenticate();

      if (result.success) {
        setIsAuthenticated(true);
        setUserEmail(result.userInfo?.username || null);
        setDeviceCode(null); // Clear device code

        // Small delay to show success state
        setTimeout(() => {
          if (result.userInfo) {
            onLoginComplete(result.userInfo);
          }
        }, 1000);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      if (cleanup) cleanup();
      setIsAuthenticating(false);
    }
  };

  const handleContinue = () => {
    if (isAuthenticated) {
      onLoginComplete({ username: userEmail || undefined });
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  // Not configured - show skip option
  if (error && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Email Export (Optional)</h2>
            <p className="text-gray-600 mb-4">
              Connect to Microsoft Outlook to export email communications alongside text messages.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">{error}</p>
              <p className="text-xs text-yellow-700 mt-2">
                Email export requires Microsoft app configuration. You can still export text messages.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleSkip}
              className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              Continue Without Email Export
            </button>
            <p className="text-xs text-gray-500 text-center">
              You'll still be able to export text messages
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Already authenticated - show success briefly
  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Connected to Outlook</h2>
        </div>
      </div>
    );
  }

  // Show login screen
  return (
    <div className="flex items-center justify-center min-h-full py-8">
      <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Login</h2>
          <p className="text-gray-600">
            Sign in with your account to access email export features and validate your subscription.
          </p>
        </div>

        {deviceCode && (
          <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-300 rounded-lg">
            <p className="text-sm text-blue-900 font-semibold mb-3">
              ✨ Browser opened automatically
            </p>
            <p className="text-sm text-blue-800 mb-3">
              If the browser didn't open, go to:{' '}
              <a
                href={deviceCode.verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline hover:text-blue-600"
              >
                {deviceCode.verificationUri}
              </a>
            </p>
            <div className="bg-white p-4 rounded border border-blue-200">
              <p className="text-xs text-blue-700 mb-1">Enter this code:</p>
              <p className="font-mono font-bold text-2xl text-blue-900 text-center tracking-wider">
                {deviceCode.userCode}
              </p>
            </div>
            <p className="text-xs text-blue-600 mt-3 text-center">
              Waiting for you to complete authentication in the browser...
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleAuthenticate}
            disabled={isAuthenticating}
            className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            {isAuthenticating ? 'Authenticating...' : 'Sign in with Microsoft'}
          </button>

          <button
            onClick={() => {
              // TODO: Implement Google authentication
              alert('Google sign-in coming soon! This feature will be available in a future update.');
            }}
            disabled={isAuthenticating}
            className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <button
            onClick={handleSkip}
            disabled={isAuthenticating}
            className="w-full bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Skip for Now
          </button>
          <p className="text-xs text-gray-500 text-center">
            You can still export text messages without signing in
          </p>
        </div>
      </div>
    </div>
  );
}

export default MicrosoftLogin;
