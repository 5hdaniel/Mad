import React, { useState, useEffect } from 'react';
import SystemSettingsMockup from './SystemSettingsMockup';

function PermissionsScreen({ onPermissionsGranted, onCheckAgain }) {
  const [isChecking, setIsChecking] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: welcome, 2: full disk access
  const [openSettingsComplete, setOpenSettingsComplete] = useState(false);
  const [findPrivacySecurityComplete, setFindPrivacySecurityComplete] = useState(false);
  const [findFullDiskAccessComplete, setFindFullDiskAccessComplete] = useState(false);
  const [clickPlusComplete, setClickPlusComplete] = useState(false);
  const [selectAppComplete, setSelectAppComplete] = useState(false);
  const [quitReopenComplete, setQuitReopenComplete] = useState(false);
  const [macOSInfo, setMacOSInfo] = useState(null);
  const [appInfo, setAppInfo] = useState(null);

  // Auto-check permissions and detect macOS version when component loads
  useEffect(() => {
    autoCheckPermissions();
    detectMacOSVersion();
    detectAppInfo();
  }, []);

  const detectAppInfo = async () => {
    try {
      const info = await window.electron.getAppInfo();
      setAppInfo(info);
    } catch (error) {
      console.error('Error detecting app info:', error);
    }
  };

  const detectMacOSVersion = async () => {
    try {
      const versionInfo = await window.electron.getMacOSVersion();
      setMacOSInfo(versionInfo);
    } catch (error) {
      console.error('Error detecting macOS version:', error);
      // Default to modern style if detection fails
      setMacOSInfo({
        version: 15,
        name: 'Unknown',
        uiStyle: 'settings',
        appName: 'System Settings'
      });
    }
  };

  const autoCheckPermissions = async () => {
    const result = await window.electron.checkPermissions();
    if (result.hasPermission) {
      onPermissionsGranted();
    }
  };

  const handleAppleScriptAllow = () => {
    // TODO: Implement AppleScript permission handling if needed
    // setAppleScriptStepComplete(true);
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
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Real Estate Archive</h1>
            <p className="text-lg text-gray-600 mb-6">
              Export your client conversations with just a few clicks
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
            onClick={async () => {
              // Trigger Full Disk Access attempt - this makes the app appear in System Settings
              await window.electron.triggerFullDiskAccess();
              setCurrentStep(2);
            }}
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
    <div className="flex items-center justify-center min-h-full py-8">
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

        {/* Step 1: Open System Settings */}
        <div className={`border-2 rounded-lg p-6 mb-6 transition-all ${
          openSettingsComplete
            ? 'bg-green-50 border-green-300'
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start flex-1">
              {openSettingsComplete ? (
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-white font-bold text-sm">
                  1
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {openSettingsComplete ? 'System Settings Opened' : 'Open System Settings'}
                </h3>
                {!openSettingsComplete && (
                  <p className="text-sm text-gray-700 mb-4">
                    Click the button below to open System Settings
                  </p>
                )}
              </div>
            </div>
          </div>

          {!openSettingsComplete && (
            <>
              <button
                onClick={async () => {
                  await window.electron.openSystemSettings();
                  setOpenSettingsComplete(true);
                }}
                className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors mb-3"
              >
                🔓 Open System Settings
              </button>
              <button
                onClick={() => setOpenSettingsComplete(true)}
                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                I've Opened Settings Manually
              </button>
            </>
          )}
        </div>

        {/* Step 2: Find Privacy & Security in Sidebar */}
        {openSettingsComplete && (
          <div className={`border-2 rounded-lg p-6 mb-6 transition-all ${
            findPrivacySecurityComplete
              ? 'bg-green-50 border-green-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start flex-1">
                {findPrivacySecurityComplete ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-white font-bold text-sm">
                    2
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {findPrivacySecurityComplete ? 'Privacy & Security Found' : 'Find Privacy & Security in Sidebar'}
                  </h3>
                  {!findPrivacySecurityComplete && (
                    <p className="text-sm text-gray-700">
                      In the System Settings window, look in the <strong>left sidebar</strong> for <strong>"Privacy & Security"</strong> and click on it
                    </p>
                  )}
                </div>
              </div>
            </div>

            {!findPrivacySecurityComplete && (
              <div className="flex gap-3">
                <button
                  onClick={() => setOpenSettingsComplete(false)}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => setFindPrivacySecurityComplete(true)}
                  className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  ✅ Done - Found Privacy & Security
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Find Full Disk Access */}
        {findPrivacySecurityComplete && (
          <div className={`border-2 rounded-lg p-6 mb-6 transition-all ${
            findFullDiskAccessComplete
              ? 'bg-green-50 border-green-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start flex-1">
                {findFullDiskAccessComplete ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-white font-bold text-sm">
                    3
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {findFullDiskAccessComplete ? 'Full Disk Access Found' : 'Find Full Disk Access'}
                  </h3>
                  {!findFullDiskAccessComplete && (
                    <p className="text-sm text-gray-700">
                      In the Privacy & Security section, scroll down and click on <strong>"Full Disk Access"</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {!findFullDiskAccessComplete && (
              <div className="flex gap-3">
                <button
                  onClick={() => setFindPrivacySecurityComplete(false)}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => setFindFullDiskAccessComplete(true)}
                  className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  ✅ Done - Found Full Disk Access
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Click Plus Button */}
        {findFullDiskAccessComplete && (
          <div className={`border-2 rounded-lg p-6 mb-6 transition-all ${
            clickPlusComplete
              ? 'bg-green-50 border-green-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start flex-1">
                {clickPlusComplete ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-white font-bold text-sm">
                    4
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {clickPlusComplete ? 'Plus Button Clicked' : 'Click the Plus (+) Button'}
                  </h3>
                  {!clickPlusComplete && (
                    <p className="text-sm text-gray-700">
                      Click the <strong>+ (plus)</strong> button to add a new application to the Full Disk Access list
                    </p>
                  )}
                </div>
              </div>
            </div>

            {!clickPlusComplete && (
              <div className="flex gap-3">
                <button
                  onClick={() => setFindFullDiskAccessComplete(false)}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => setClickPlusComplete(true)}
                  className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  ✅ Done - Clicked Plus Button
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Select Real Estate Archive App */}
        {clickPlusComplete && (
          <div className={`border-2 rounded-lg p-6 mb-6 transition-all ${
            selectAppComplete
              ? 'bg-green-50 border-green-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start flex-1">
                {selectAppComplete ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-white font-bold text-sm">
                    5
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {selectAppComplete ? 'App Selected' : 'Select Real Estate Archive'}
                  </h3>
                  {!selectAppComplete && (
                    <>
                      <p className="text-sm text-gray-700 mb-2">
                        In the file selector that opens, navigate to <strong>Applications</strong> and select <strong>Real Estate Archive.app</strong>
                      </p>
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          <strong>💡 Tip:</strong> If you can't find Real Estate Archive in the Applications folder, you may not have copied it from the DMG file. Drag the app from the DMG to your Applications folder first.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {!selectAppComplete && (
              <div className="flex gap-3">
                <button
                  onClick={() => setClickPlusComplete(false)}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => setSelectAppComplete(true)}
                  className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  ✅ Done - Selected the App
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Handle Quit & Reopen Prompt */}
        {selectAppComplete && (
          <div className={`border-2 rounded-lg p-6 mb-6 transition-all ${
            quitReopenComplete
              ? 'bg-green-50 border-green-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start flex-1">
                {quitReopenComplete ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-white font-bold text-sm">
                    6
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {quitReopenComplete ? 'App Restarted' : 'Quit & Reopen the App'}
                  </h3>
                  {!quitReopenComplete && (
                    <>
                      <p className="text-sm text-gray-700 mb-3">
                        You'll see a prompt that says <strong>"Real Estate Archive" will not have full disk access until it is quit.</strong>
                      </p>
                      <p className="text-sm text-gray-700 mb-2">
                        Click <strong>"Quit & Reopen"</strong> to restart the app with full disk access enabled
                      </p>
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-800">
                          <strong>Note:</strong> If you click "Later", you'll need to manually restart the app for the permissions to take effect
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {!quitReopenComplete && (
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectAppComplete(false)}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => {
                    setQuitReopenComplete(true);
                    // Start auto-checking for permissions
                    const interval = setInterval(async () => {
                      const result = await window.electron.checkPermissions();
                      if (result.hasPermission) {
                        clearInterval(interval);
                        onPermissionsGranted();
                      }
                    }, 2000);
                    setTimeout(() => clearInterval(interval), 60000);
                  }}
                  className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  ✅ Done - App Restarted
                </button>
              </div>
            )}
          </div>
        )}

        {/* Final message after all steps */}
        {quitReopenComplete && (
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">All Steps Complete!</h3>
            <p className="text-gray-700 mb-2">
              The app has been restarted with full disk access.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              If you don't see the app, you can open it manually from your Applications folder. We're checking for permissions and you should be redirected automatically.
            </p>
            <button
              onClick={handleCheckPermissions}
              disabled={isChecking}
              className="bg-primary text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isChecking ? 'Checking...' : 'Check Again'}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-500 mt-6">
          We'll never share your data. All exports are stored locally on your device.
        </p>
      </div>
    </div>
  );
}

export default PermissionsScreen;
