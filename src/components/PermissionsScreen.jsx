import React, { useState, useEffect } from 'react';

function PermissionsScreen({ onPermissionsGranted, onCheckAgain }) {
  const [isChecking, setIsChecking] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: welcome, 2: full disk access
  const [appleScriptStepComplete, setAppleScriptStepComplete] = useState(false);
  const [openSettingsComplete, setOpenSettingsComplete] = useState(false);
  const [unlockSettingsComplete, setUnlockSettingsComplete] = useState(false);
  const [findAppComplete, setFindAppComplete] = useState(false);
  const [toggleSwitchComplete, setToggleSwitchComplete] = useState(false);

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

  const handleAppleScriptAllow = () => {
    setAppleScriptStepComplete(true);
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

        {/* Step 1: AppleScript Permission */}
        <div className={`border-2 rounded-lg p-6 mb-6 transition-all ${
          appleScriptStepComplete
            ? 'bg-green-50 border-green-300'
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start flex-1">
              {appleScriptStepComplete ? (
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
                  {appleScriptStepComplete ? 'AppleScript Permission Granted' : 'Allow AppleScript Access'}
                </h3>
                {!appleScriptStepComplete && (
                  <p className="text-sm text-gray-700">
                    When you click "Open System Settings" below, you'll see this permission dialog
                  </p>
                )}
              </div>
            </div>
          </div>

          {!appleScriptStepComplete && (
            <>
              {/* macOS-style Dialog */}
              <div className="mx-auto max-w-md mb-4">
                <div className="bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl shadow-2xl border border-gray-300 overflow-hidden">
                  {/* Title Bar */}
                  <div className="bg-gradient-to-b from-gray-200 to-gray-300 px-4 py-2 flex items-center border-b border-gray-400">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>

                  {/* Dialog Content */}
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="flex-shrink-0">
                        <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-gray-900 mb-2 leading-relaxed">
                          <strong>"Visual Studio Code"</strong> (or <strong>"Electron"</strong>) wants access to control <strong>"System Events"</strong>.
                        </p>
                        <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                          Allowing control will provide access to documents and data in "System Events", and to perform actions within that app.
                        </p>
                        <p className="text-xs text-gray-500 italic">
                          An application wants to use AppleScript.
                        </p>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3">
                      <button className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors">
                        Don't Allow
                      </button>
                      <button
                        onClick={handleAppleScriptAllow}
                        className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-md hover:bg-blue-600 transition-colors relative ring-2 ring-green-400 ring-offset-2"
                      >
                        Allow
                        <div className="absolute -top-3 -right-3 animate-bounce">
                          <svg className="w-7 h-7 text-green-500 drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
                <p className="text-sm text-green-800 font-semibold flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Click "Allow" above to mark this step as complete
                </p>
              </div>
            </>
          )}
        </div>

        {/* Step 2: Open System Settings */}
        {appleScriptStepComplete && (
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
                    2
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {openSettingsComplete ? 'System Settings Opened' : 'Open System Settings'}
                  </h3>
                  {!openSettingsComplete && (
                    <p className="text-sm text-gray-700 mb-4">
                      Click the button below to open the Privacy & Security settings
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
        )}

        {/* Step 3: Unlock Settings */}
        {openSettingsComplete && (
          <div className={`border-2 rounded-lg p-6 mb-6 transition-all ${
            unlockSettingsComplete
              ? 'bg-green-50 border-green-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start flex-1">
                {unlockSettingsComplete ? (
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
                    {unlockSettingsComplete ? 'Settings Unlocked' : 'Click the Lock Icon'}
                  </h3>
                  {!unlockSettingsComplete && (
                    <p className="text-sm text-gray-700">
                      Click the 🔒 lock icon in the bottom-left corner and authenticate
                    </p>
                  )}
                </div>
              </div>
            </div>

            {!unlockSettingsComplete && (
              <>
                {/* macOS System Settings Window - Lock Step */}
                <div className="mx-auto max-w-3xl mb-4">
                  <div className="bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl shadow-2xl border border-gray-300 overflow-hidden">
                    {/* Title Bar */}
                    <div className="bg-gradient-to-b from-gray-200 to-gray-300 px-4 py-3 flex items-center justify-between border-b border-gray-400">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">Privacy & Security</span>
                      <div className="w-20"></div>
                    </div>

                    {/* Settings Content */}
                    <div className="flex">
                      {/* Sidebar */}
                      <div className="w-48 bg-gray-100 border-r border-gray-300 p-3">
                        <div className="space-y-1 text-xs">
                          <div className="px-3 py-2 bg-gray-200 rounded font-medium">Privacy & Security</div>
                          <div className="px-3 py-2 text-gray-600">Desktop & Dock</div>
                          <div className="px-3 py-2 text-gray-600">Displays</div>
                        </div>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 p-6 relative">
                        <h2 className="text-lg font-bold mb-4">Full Disk Access</h2>
                        <p className="text-xs text-gray-600 mb-4">
                          Allow apps to access all files including Messages
                        </p>

                        {/* App List */}
                        <div className="bg-white border border-gray-300 rounded-lg p-3 mb-16">
                          <div className="text-xs text-gray-400 mb-2">Applications</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between py-1">
                              <span className="text-sm">Terminal</span>
                              <div className="w-10 h-5 bg-gray-300 rounded-full"></div>
                            </div>
                            <div className="flex items-center justify-between py-1">
                              <span className="text-sm">Electron</span>
                              <div className="w-10 h-5 bg-gray-300 rounded-full"></div>
                            </div>
                          </div>
                        </div>

                        {/* Lock Icon with Red Indicator */}
                        <div className="absolute bottom-4 left-6">
                          <div className="relative inline-block">
                            <div className="w-8 h-8 bg-gray-300 rounded flex items-center justify-center">
                              🔒
                            </div>
                            {/* Red pulsing indicator */}
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setUnlockSettingsComplete(true)}
                  className="w-full bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  ✅ Done - I Clicked the Lock
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 4: Find App in List */}
        {unlockSettingsComplete && (
          <div className={`border-2 rounded-lg p-6 mb-6 transition-all ${
            findAppComplete
              ? 'bg-green-50 border-green-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start flex-1">
                {findAppComplete ? (
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
                    {findAppComplete ? 'App Located' : 'Find the App'}
                  </h3>
                  {!findAppComplete && (
                    <p className="text-sm text-gray-700">
                      Locate <strong>"Real Estate Archive"</strong> or <strong>"Electron"</strong> in the list
                    </p>
                  )}
                </div>
              </div>
            </div>

            {!findAppComplete && (
              <>
                {/* macOS System Settings Window - Find App Step */}
                <div className="mx-auto max-w-3xl mb-4">
                  <div className="bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl shadow-2xl border border-gray-300 overflow-hidden">
                    {/* Title Bar */}
                    <div className="bg-gradient-to-b from-gray-200 to-gray-300 px-4 py-3 flex items-center justify-between border-b border-gray-400">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">Privacy & Security</span>
                      <div className="w-20"></div>
                    </div>

                    {/* Settings Content */}
                    <div className="flex">
                      {/* Sidebar */}
                      <div className="w-48 bg-gray-100 border-r border-gray-300 p-3">
                        <div className="space-y-1 text-xs">
                          <div className="px-3 py-2 bg-gray-200 rounded font-medium">Privacy & Security</div>
                          <div className="px-3 py-2 text-gray-600">Desktop & Dock</div>
                          <div className="px-3 py-2 text-gray-600">Displays</div>
                        </div>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 p-6 relative">
                        <h2 className="text-lg font-bold mb-4">Full Disk Access</h2>
                        <p className="text-xs text-gray-600 mb-4">
                          Allow apps to access all files including Messages
                        </p>

                        {/* App List - Highlighted */}
                        <div className="bg-white border border-gray-300 rounded-lg p-3 mb-4">
                          <div className="text-xs text-gray-400 mb-2">Applications</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between py-1">
                              <span className="text-sm">Terminal</span>
                              <div className="w-10 h-5 bg-gray-300 rounded-full"></div>
                            </div>
                            {/* Highlighted App with Red Indicator */}
                            <div className="relative flex items-center justify-between py-1 bg-blue-100 -mx-2 px-2 rounded">
                              <span className="text-sm font-bold">Electron</span>
                              <div className="w-10 h-5 bg-gray-300 rounded-full"></div>
                              {/* Red indicator */}
                              <div className="absolute -left-4 top-1/2 -translate-y-1/2">
                                <div className="w-8 h-8 bg-red-500 rounded-full animate-ping"></div>
                                <div className="absolute inset-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Lock Icon (unlocked) */}
                        <div className="absolute bottom-4 left-6">
                          <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                            🔓
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setFindAppComplete(true)}
                  className="w-full bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  ✅ Done - I Found the App
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 5: Toggle Switch ON */}
        {findAppComplete && (
          <div className={`border-2 rounded-lg p-6 mb-6 transition-all ${
            toggleSwitchComplete
              ? 'bg-green-50 border-green-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start flex-1">
                {toggleSwitchComplete ? (
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
                    {toggleSwitchComplete ? 'Permission Granted!' : 'Toggle the Switch ON'}
                  </h3>
                  {!toggleSwitchComplete && (
                    <p className="text-sm text-gray-700">
                      Click the toggle switch next to the app name to turn it <strong className="text-green-600">ON</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {!toggleSwitchComplete && (
              <>
                {/* macOS System Settings Window - Toggle Switch Step */}
                <div className="mx-auto max-w-3xl mb-4">
                  <div className="bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl shadow-2xl border border-gray-300 overflow-hidden">
                    {/* Title Bar */}
                    <div className="bg-gradient-to-b from-gray-200 to-gray-300 px-4 py-3 flex items-center justify-between border-b border-gray-400">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">Privacy & Security</span>
                      <div className="w-20"></div>
                    </div>

                    {/* Settings Content */}
                    <div className="flex">
                      {/* Sidebar */}
                      <div className="w-48 bg-gray-100 border-r border-gray-300 p-3">
                        <div className="space-y-1 text-xs">
                          <div className="px-3 py-2 bg-gray-200 rounded font-medium">Privacy & Security</div>
                          <div className="px-3 py-2 text-gray-600">Desktop & Dock</div>
                          <div className="px-3 py-2 text-gray-600">Displays</div>
                        </div>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 p-6 relative">
                        <h2 className="text-lg font-bold mb-4">Full Disk Access</h2>
                        <p className="text-xs text-gray-600 mb-4">
                          Allow apps to access all files including Messages
                        </p>

                        {/* App List - Toggle Highlighted */}
                        <div className="bg-white border border-gray-300 rounded-lg p-3 mb-4">
                          <div className="text-xs text-gray-400 mb-2">Applications</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between py-1">
                              <span className="text-sm">Terminal</span>
                              <div className="w-10 h-5 bg-gray-300 rounded-full"></div>
                            </div>
                            {/* App with Toggle Highlighted */}
                            <div className="relative flex items-center justify-between py-1 bg-blue-100 -mx-2 px-2 rounded">
                              <span className="text-sm font-bold">Electron</span>
                              <div className="relative">
                                <div className="w-10 h-5 bg-green-500 rounded-full flex items-center justify-end px-1">
                                  <div className="w-4 h-4 bg-white rounded-full shadow"></div>
                                </div>
                                {/* Red pulsing indicator on toggle */}
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">!</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Lock Icon (unlocked) */}
                        <div className="absolute bottom-4 left-6">
                          <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                            🔓
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setToggleSwitchComplete(true);
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
                  className="w-full bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  ✅ Done - I Toggled the Switch
                </button>
              </>
            )}
          </div>
        )}

        {/* Final message after all steps */}
        {toggleSwitchComplete && (
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">All Steps Complete!</h3>
            <p className="text-gray-700 mb-4">
              We're checking for permissions... You should be redirected automatically.
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

        {!appleScriptStepComplete && (
          <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600">
              Click "Allow" in the dialog above to continue
            </p>
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
