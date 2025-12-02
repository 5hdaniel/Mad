import React, { useState, useEffect } from 'react';

interface SecureStorageSetupProps {
  onComplete: () => void;
  onRetry: () => void;
}

type SetupStatus = 'explanation' | 'loading' | 'success' | 'error';

interface SecureStorageResult {
  success: boolean;
  available: boolean;
  error?: string;
  platform?: string;
  guidance?: string;
}

/**
 * SecureStorageSetup Component
 *
 * Explains secure storage (macOS Keychain) to users before triggering the
 * system password prompt. This improves UX by not surprising users with
 * an unexpected password dialog.
 *
 * The keychain is used for DATABASE ENCRYPTION only - to protect local PII
 * (contacts, messages, emails). OAuth tokens are kept in memory only and
 * users re-authenticate each session for better security.
 *
 * On macOS, this will trigger the Keychain Access prompt (once ever).
 * If the user has Touch ID configured for their Keychain, macOS will
 * automatically use Touch ID instead of asking for a password.
 */
function SecureStorageSetup({ onComplete, onRetry }: SecureStorageSetupProps) {
  const [status, setStatus] = useState<SetupStatus>('explanation');
  const [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string>('');

  // Check if key store already exists on mount (file check, does NOT trigger keychain)
  useEffect(() => {
    const checkExistingSetup = async () => {
      try {
        // Detect platform from navigator (no IPC call that might trigger keychain)
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('mac')) {
          setPlatform('darwin');
        } else if (userAgent.includes('win')) {
          setPlatform('win32');
        } else {
          setPlatform('linux');
        }

        // Check if key store exists (file check only, no keychain prompt)
        const result = await window.api.system.hasEncryptionKeyStore();
        if (result.hasKeyStore) {
          // Already set up - skip to success
          setStatus('success');
          setTimeout(() => {
            onComplete();
          }, 500);
        }
      } catch (err) {
        console.error('Failed to check existing setup:', err);
      }
    };

    checkExistingSetup();
  }, [onComplete]);

  const handleSetup = async () => {
    setStatus('loading');
    setError(null);
    setGuidance(null);

    try {
      const result: SecureStorageResult = await window.api.system.initializeSecureStorage();

      if (result.success) {
        setStatus('success');
        // Auto-proceed after brief success message
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        setStatus('error');
        setError(result.error || 'Secure storage setup failed');
        setGuidance(result.guidance || null);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  const handleRetry = () => {
    // Reset to explanation state so user can try again
    setStatus('explanation');
    setError(null);
    setGuidance(null);
  };

  // Platform-specific messaging
  const getPlatformSpecificText = () => {
    if (platform === 'darwin') {
      return {
        title: 'macOS Keychain Access',
        description: 'Magic Audit uses your Mac\'s built-in Keychain to encrypt the local database where your contacts and messages are stored.',
        promptInfo: 'You\'ll see a system dialog asking for permission. Click "Always Allow" to grant permanent access and avoid repeated prompts.',
        touchIdNote: 'If you have Touch ID enabled for your Keychain, you can use your fingerprint instead of entering your password.',
        icon: (
          <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ),
      };
    } else if (platform === 'win32') {
      return {
        title: 'Windows Data Protection',
        description: 'Magic Audit uses Windows Data Protection API (DPAPI) to encrypt the local database where your contacts and messages are stored.',
        promptInfo: 'This process happens automatically on Windows.',
        touchIdNote: null,
        icon: (
          <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      };
    } else {
      return {
        title: 'Secure Data Protection',
        description: 'Magic Audit uses your system\'s secure storage to encrypt the local database where your contacts and messages are stored.',
        promptInfo: 'You may be asked to authenticate to access the secure storage.',
        touchIdNote: null,
        icon: (
          <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ),
      };
    }
  };

  const platformText = getPlatformSpecificText();

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
              {platformText.icon}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{platformText.title}</h2>
            <p className="text-blue-100 text-sm">Secure local data protection</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Explanation State */}
          {status === 'explanation' && (
            <>
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  {platformText.description}
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-blue-800 font-medium mb-1">What to expect</p>
                      <p className="text-sm text-blue-700">{platformText.promptInfo}</p>
                    </div>
                  </div>
                </div>

                {platformText.touchIdNote && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <div>
                        <p className="text-sm text-green-800 font-medium mb-1">Touch ID Available</p>
                        <p className="text-sm text-green-700">{platformText.touchIdNote}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Why we need this:</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Encrypts your local database containing contacts and messages</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Protects your personal data with OS-level encryption</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Ensures sensitive information stays private on your device</span>
                    </li>
                  </ul>
                </div>
              </div>

              <button
                onClick={handleSetup}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all hover:from-blue-600 hover:to-indigo-700"
              >
                Continue Setup
              </button>
            </>
          )}

          {/* Loading State */}
          {status === 'loading' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Setting up secure storage...</h3>
              <p className="text-sm text-gray-600">
                Please complete the system dialog if it appears.
              </p>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure storage enabled!</h3>
              <p className="text-sm text-gray-600">
                Your local data will be encrypted and protected.
              </p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Setup Required</h3>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 mb-2">
                  <strong>Error:</strong> {error}
                </p>
                {guidance && (
                  <p className="text-sm text-red-700 whitespace-pre-line">{guidance}</p>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm text-yellow-800 font-medium mb-1">Why is this needed?</p>
                    <p className="text-sm text-yellow-700">
                      Magic Audit requires secure storage to protect your local data.
                      Without it, we cannot safely encrypt your contacts and messages.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all hover:from-blue-600 hover:to-indigo-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SecureStorageSetup;
