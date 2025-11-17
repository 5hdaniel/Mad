import React, { useState, useEffect } from 'react';

/**
 * Onboarding Wizard
 * Guides new users through permission setup
 *
 * Flow:
 * 1. Welcome screen
 * 2. Request Contacts permission
 * 3. Setup Full Disk Access (opens System Preferences)
 * 4. Wait for user to toggle on Full Disk Access
 * 5. Completion celebration
 */
function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1); // 1=welcome, 2=contacts, 3=full-disk, 4=waiting, 5=complete
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contactsGranted, setContactsGranted] = useState(false);
  const [fullDiskGranted, setFullDiskGranted] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  // Poll for Full Disk Access permission
  useEffect(() => {
    if (step === 4) {
      const interval = setInterval(async () => {
        const result = await window.api.system.checkFullDiskAccessStatus();
        if (result.granted) {
          setFullDiskGranted(true);
          setStep(5);
          clearInterval(interval);
        }
      }, 2000); // Check every 2 seconds

      return () => clearInterval(interval);
    }
  }, [step]);

  const handleRequestContacts = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.system.requestContactsPermission();

      if (result.success) {
        setContactsGranted(true);
        // Wait a moment for user to see the result
        setTimeout(() => {
          setStep(3);
        }, 1500);
      } else {
        // Even if it fails, move on (contacts is optional)
        setTimeout(() => {
          setStep(3);
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to request contacts permission:', err);
      setError(err.message);
      // Move on anyway after error
      setTimeout(() => {
        setStep(3);
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupFullDiskAccess = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.system.setupFullDiskAccess();

      if (result.success) {
        // System Preferences is now open
        // Move to waiting step
        setStep(4);
      } else {
        setError('Failed to open System Preferences');
      }
    } catch (err) {
      console.error('Failed to setup Full Disk Access:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };

  const handleSkip = () => {
    if (onComplete) {
      onComplete({ skipped: true });
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Progress Bar */}
        <div className="h-2 bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mx-auto flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                </div>
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-3">Welcome to Magic Audit!</h2>
              <p className="text-lg text-gray-600 mb-8">
                Let's set up permissions so you can start auditing transactions
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
                <h3 className="font-semibold text-gray-900 mb-3">What we'll do:</h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Contacts Access:</strong> Match phone numbers to contact names in your emails</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Full Disk Access:</strong> Read your iMessages to find transaction communications</span>
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={handleSkip}
                  className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-all"
                >
                  Skip Setup
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  Let's Go! →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Contacts Permission */}
          {step === 2 && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mx-auto flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">Contacts Permission</h2>
              <p className="text-gray-600 mb-8">
                We'll briefly open the Contacts app to request permission.
                <br />
                This helps us match phone numbers to names in your communications.
              </p>

              {contactsGranted && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 justify-center text-green-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Contacts permission granted!</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-800">
                    {error}
                    <br />
                    <span className="text-xs">Don't worry, we'll continue anyway.</span>
                  </p>
                </div>
              )}

              <button
                onClick={handleRequestContacts}
                disabled={loading || contactsGranted}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : contactsGranted ? (
                  'Moving to next step...'
                ) : (
                  'Grant Contacts Access →'
                )}
              </button>
            </div>
          )}

          {/* Step 3: Full Disk Access Setup */}
          {step === 3 && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mx-auto flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">Full Disk Access</h2>
              <p className="text-gray-600 mb-6">
                This permission allows Magic Audit to read your iMessages database.
              </p>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8 text-left">
                <h3 className="font-semibold text-gray-900 mb-3">What happens next:</h3>
                <ol className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    <span>System Settings will open to <strong>Privacy & Security → Full Disk Access</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <span>Find <strong>MagicAudit</strong> in the list</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    <span>Toggle the switch <strong>ON</strong> next to MagicAudit</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                    <span>Come back here - we'll detect it automatically!</span>
                  </li>
                </ol>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                onClick={handleSetupFullDiskAccess}
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Opening System Settings...
                  </span>
                ) : (
                  'Open System Settings →'
                )}
              </button>
            </div>
          )}

          {/* Step 4: Waiting for Permission */}
          {step === 4 && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto flex items-center justify-center animate-pulse">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">Waiting for Permission...</h2>
              <p className="text-gray-600 mb-8">
                Please toggle Full Disk Access <strong>ON</strong> in System Settings.
                <br />
                We're checking automatically - this will update when you're done!
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Checking every 2 seconds...</span>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                <p className="mb-2">Can't find MagicAudit in the list?</p>
                <button
                  onClick={handleSetupFullDiskAccess}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Re-open System Settings
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mx-auto flex items-center justify-center animate-bounce">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-3">🎉 You're All Set!</h2>
              <p className="text-lg text-gray-600 mb-8">
                All permissions granted. You can now start auditing transactions!
              </p>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
                <h3 className="font-semibold text-gray-900 mb-3">What you can do now:</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Scan your emails and messages for transactions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Export compliance documents with all communications</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Keep perfect audit trails for every deal</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={handleComplete}
                className="px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold text-lg shadow-xl hover:shadow-2xl transition-all"
              >
                Start Using Magic Audit →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OnboardingWizard;
