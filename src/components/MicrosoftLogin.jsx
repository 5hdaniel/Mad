import React, { useState, useEffect } from 'react';

function MicrosoftLogin({ onLoginComplete, onSkip }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [error, setError] = useState(null);
  const [deviceCode, setDeviceCode] = useState(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      // Initialize Outlook service
      const initResult = await window.electron.outlookInitialize();

      if (!initResult.success) {
        // Not configured - allow user to skip
        setError(initResult.error);
        setIsInitializing(false);
        return;
      }

      // Check if already authenticated
      const isAuth = await window.electron.outlookIsAuthenticated();

      if (isAuth) {
        const emailResult = await window.electron.outlookGetUserEmail();
        if (emailResult.success) {
          setUserEmail(emailResult.email);
          setIsAuthenticated(true);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setError(null);
    setDeviceCode(null);

    // Listen for device code from main process
    const handleDeviceCode = (deviceCodeInfo) => {
      setDeviceCode(deviceCodeInfo);
    };

    // Set up listener (will be cleaned up when authentication completes)
    if (window.electron.onDeviceCode) {
      window.electron.onDeviceCode(handleDeviceCode);
    }

    try {
      const result = await window.electron.outlookAuthenticate();

      if (result.success) {
        setIsAuthenticated(true);
        setUserEmail(result.userInfo?.username);
        setDeviceCode(null); // Clear device code

        // Small delay to show success state
        setTimeout(() => {
          onLoginComplete(result.userInfo);
        }, 1000);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleContinue = () => {
    if (isAuthenticated) {
      onLoginComplete({ username: userEmail });
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

  // Already authenticated - show continue
  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Connected to Outlook</h2>

          <button
            onClick={handleContinue}
            className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Continue
          </button>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connect to Microsoft Outlook</h2>
          <p className="text-gray-600">
            Sign in to export email communications alongside your text messages.
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
            className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAuthenticating ? 'Authenticating...' : 'Sign in with Microsoft'}
          </button>
          <button
            onClick={handleSkip}
            disabled={isAuthenticating}
            className="w-full bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Skip for Now
          </button>
          <p className="text-xs text-gray-500 text-center">
            You can still export text messages without connecting
          </p>
        </div>
      </div>
    </div>
  );
}

export default MicrosoftLogin;
