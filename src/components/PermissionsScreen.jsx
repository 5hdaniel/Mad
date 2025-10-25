import React, { useState, useEffect } from 'react';

function PermissionsScreen({ onPermissionsGranted, onCheckAgain }) {
  const [isChecking, setIsChecking] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: welcome, 2: full disk access

  // Auto-check permissions when component loads
  useEffect(() => {
    autoCheckPermissions();
  }, []);

  const autoCheckPermissions = async () => {
    const result = await window.electron.checkPermissions();
    if (result.hasPermission) {
      onPermissionsGranted();
    }
  };

  const handleOpenSystemSettings = async () => {
    await window.electron.openSystemSettings();
    // Start checking periodically
    startPeriodicCheck();
  };

  const startPeriodicCheck = () => {
    const interval = setInterval(async () => {
      const result = await window.electron.checkPermissions();
      if (result.hasPermission) {
        clearInterval(interval);
        onPermissionsGranted();
      }
    }, 2000); // Check every 2 seconds

    // Stop checking after 60 seconds
    setTimeout(() => clearInterval(interval), 60000);
  };

  const handleCheckPermissions = async () => {
    setIsChecking(true);
    const result = await window.electron.checkPermissions();
    setIsChecking(false);

    if (result.hasPermission) {
      onPermissionsGranted();
    }
  };

  // Step 1: Welcome
  if (currentStep === 1) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Real Estate Archive</h1>
            <p className="text-lg text-gray-600 mb-6">
              Export your iMessage conversations with just a few clicks
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="font-semibold text-gray-900 mb-3">To get started, we need one permission:</h2>
            <div className="flex items-start text-sm text-gray-700">
              <svg className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span><strong>Full Disk Access</strong> - To read your Messages database. This is a macOS security requirement for accessing iMessage data.</span>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-gray-600">
                <strong>Your privacy matters.</strong> All data stays on your device. We never upload or share your messages.
              </p>
            </div>
          </div>

          <button
            onClick={() => setCurrentStep(2)}
            className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors text-lg"
          >
            Grant Permission
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Full Disk Access (must be done manually)
  return (
    <div className="flex items-center justify-center h-full">
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Grant Full Disk Access
          </h1>
          <p className="text-gray-600">
            Grant access to read your Messages database
          </p>
        </div>

        {/* AppleScript Permission Dialog Preview */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
          <div className="flex items-start mb-4">
            <svg className="w-6 h-6 text-yellow-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">First, you'll see this permission dialog:</h3>
              <p className="text-sm text-gray-700 mb-3">
                When you click the button below, macOS will show this popup asking for permission to open System Settings.
              </p>
            </div>
          </div>

          {/* Mock Dialog */}
          <div className="bg-white rounded-lg shadow-xl border border-gray-300 p-5 mb-4">
            <div className="flex items-start mb-4">
              <svg className="w-12 h-12 text-blue-500 mr-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-gray-800 mb-1">
                  <strong>"Visual Studio Code"</strong> (or <strong>"Electron"</strong>) wants access to control <strong>"System Events"</strong>.
                </p>
                <p className="text-xs text-gray-600 mb-3">
                  Allowing control will provide access to documents and data in "System Events", and to perform actions within that app.
                </p>
                <p className="text-xs text-gray-500 italic">
                  An application wants to use AppleScript.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <div className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm">
                Don't Allow
              </div>
              <div className="px-4 py-2 bg-blue-500 text-white rounded text-sm font-semibold shadow-md ring-2 ring-green-400 relative">
                Allow
                <div className="absolute -top-2 -right-2">
                  <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="text-sm text-green-800 font-semibold flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Click "Allow" to let the app open System Settings for you
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <p className="text-sm text-gray-700 mb-4">
            After clicking "Allow", System Settings will open. Then follow these steps:
          </p>

          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full text-xs mr-3 flex-shrink-0 mt-0.5">1</span>
              <span>Click the lock icon and authenticate to make changes</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full text-xs mr-3 flex-shrink-0 mt-0.5">2</span>
              <span>Find <strong>"Real Estate Archive"</strong> (or <strong>"Electron"</strong> in development) in the list</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full text-xs mr-3 flex-shrink-0 mt-0.5">3</span>
              <span>Toggle the switch to <strong>ON</strong> next to the app name</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full text-xs mr-3 flex-shrink-0 mt-0.5">4</span>
              <span>Come back to this app - we'll detect the permission automatically!</span>
            </li>
          </ol>
        </div>

        <button
          onClick={handleOpenSystemSettings}
          className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors mb-3"
        >
          Open System Settings
        </button>

        <button
          onClick={handleCheckPermissions}
          disabled={isChecking}
          className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {isChecking ? 'Checking...' : 'I\'ve Granted Access - Check Again'}
        </button>

        <p className="text-center text-xs text-gray-500 mt-6">
          We'll never share your data. All exports are stored locally on your device.
        </p>
      </div>
    </div>
  );
}

export default PermissionsScreen;
