import React from 'react';

// Modern System Settings (macOS 13 Ventura and later)
function ModernSystemSettings({ step, macOSVersion }) {
  return (
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
              {macOSVersion >= 15 && <div className="px-3 py-2 text-gray-600">Screen Time</div>}
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

                {/* Highlighted App Row */}
                {(step === 'find-app' || step === 'toggle') && (
                  <div className="relative flex items-center justify-between py-1 bg-blue-100 -mx-2 px-2 rounded">
                    <span className="text-sm font-bold">Electron</span>
                    <div className="relative">
                      <div className={`w-10 h-5 ${step === 'toggle' ? 'bg-green-500' : 'bg-gray-300'} rounded-full flex items-center ${step === 'toggle' ? 'justify-end' : 'justify-start'} px-1`}>
                        <div className="w-4 h-4 bg-white rounded-full shadow"></div>
                      </div>
                      {step === 'toggle' && (
                        <>
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">!</span>
                          </div>
                        </>
                      )}
                    </div>
                    {step === 'find-app' && (
                      <div className="absolute -left-4 top-1/2 -translate-y-1/2">
                        <div className="w-8 h-8 bg-red-500 rounded-full animate-ping"></div>
                        <div className="absolute inset-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 'unlock' && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm">Electron</span>
                    <div className="w-10 h-5 bg-gray-300 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Lock Icon */}
            <div className="absolute bottom-4 left-6">
              <div className="relative inline-block">
                <div className="w-8 h-8 bg-gray-300 rounded flex items-center justify-center">
                  {step === 'unlock' ? '🔒' : '🔓'}
                </div>
                {step === 'unlock' && (
                  <>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Legacy System Preferences (macOS 12 Monterey and earlier)
function LegacySystemPreferences({ step }) {
  return (
    <div className="mx-auto max-w-3xl mb-4">
      <div className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-xl shadow-2xl border border-gray-400 overflow-hidden">
        {/* Title Bar */}
        <div className="bg-gradient-to-b from-gray-300 to-gray-400 px-4 py-3 flex items-center justify-between border-b border-gray-500">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 border border-red-700"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-700"></div>
            <div className="w-3 h-3 rounded-full bg-green-500 border border-green-700"></div>
          </div>
          <span className="text-sm font-semibold text-gray-800">Security & Privacy</span>
          <div className="w-20"></div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tab Bar */}
          <div className="flex gap-1 mb-6 border-b border-gray-300">
            <div className="px-4 py-2 text-sm text-gray-600">General</div>
            <div className="px-4 py-2 text-sm text-gray-600">FileVault</div>
            <div className="px-4 py-2 text-sm font-medium border-b-2 border-blue-500 text-blue-600">Privacy</div>
            <div className="px-4 py-2 text-sm text-gray-600">Firewall</div>
          </div>

          <div className="flex gap-4">
            {/* Left sidebar */}
            <div className="w-48 bg-white border border-gray-300 rounded">
              <div className="space-y-1 p-2 text-xs">
                <div className="px-3 py-2 text-gray-600">Location Services</div>
                <div className="px-3 py-2 text-gray-600">Contacts</div>
                <div className="px-3 py-2 text-gray-600">Calendars</div>
                <div className="px-3 py-2 bg-blue-500 text-white rounded">Full Disk Access</div>
                <div className="px-3 py-2 text-gray-600">Accessibility</div>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 relative">
              <p className="text-xs text-gray-600 mb-4">
                Allow the apps below to access all data on this Mac, including messages, emails, and backups.
              </p>

              <div className="bg-white border border-gray-300 rounded p-3 mb-16">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 py-1">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm">Terminal</span>
                  </div>

                  {/* Highlighted App */}
                  {(step === 'find-app' || step === 'toggle') && (
                    <div className="relative flex items-center gap-2 py-1 bg-blue-100 -mx-2 px-2 rounded">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={step === 'toggle'}
                          readOnly
                        />
                        {step === 'toggle' && (
                          <>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                          </>
                        )}
                      </div>
                      <span className="text-sm font-bold">Electron</span>
                      {step === 'find-app' && (
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2">
                          <div className="w-8 h-8 bg-red-500 rounded-full animate-ping"></div>
                          <div className="absolute inset-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {step === 'unlock' && (
                    <div className="flex items-center gap-2 py-1">
                      <input type="checkbox" className="w-4 h-4" />
                      <span className="text-sm">Electron</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lock Icon */}
              <div className="absolute bottom-4 left-0">
                <div className="relative inline-block">
                  <div className="w-8 h-8 bg-gray-300 rounded flex items-center justify-center border border-gray-400">
                    {step === 'unlock' ? '🔒' : '🔓'}
                  </div>
                  {step === 'unlock' && (
                    <>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">!</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component that switches based on macOS version
function SystemSettingsMockup({ macOSVersion, step }) {
  // Use modern UI for Ventura (13) and later
  if (macOSVersion >= 13) {
    return <ModernSystemSettings step={step} macOSVersion={macOSVersion} />;
  }

  // Use legacy UI for Monterey (12) and earlier
  return <LegacySystemPreferences step={step} />;
}

export default SystemSettingsMockup;
