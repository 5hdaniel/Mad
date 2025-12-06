import React from "react";

interface SystemSettingsProps {
  step: string;
  macOSVersion?: number;
}

// Modern System Settings (macOS 13 Ventura and later) - Sequoia 15.6 accurate
function ModernSystemSettings({
  step,
  macOSVersion = 15,
}: SystemSettingsProps) {
  // Sequoia (15+) has a more refined, cleaner design
  const isSequoia = macOSVersion >= 15;

  return (
    <div className="mx-auto max-w-4xl mb-4">
      <div
        className="bg-white rounded-xl shadow-2xl overflow-hidden"
        style={{ height: "500px" }}
      >
        {/* Title Bar - macOS Sequoia style */}
        <div className="bg-gradient-to-b from-gray-100 to-gray-50 px-4 py-2.5 flex items-center border-b border-gray-200">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer"></div>
            <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 cursor-pointer"></div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex h-full">
          {/* Sidebar - Sequoia style */}
          <div className="w-56 bg-gray-50/50 border-r border-gray-200">
            {/* Search bar */}
            <div className="p-3">
              <div className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs text-gray-400 flex items-center gap-2">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span>Search</span>
              </div>
            </div>

            {/* Sidebar Menu */}
            <div className="px-2 space-y-0.5 text-sm">
              <div className="px-3 py-1.5 bg-blue-500 text-white rounded-md font-medium">
                Privacy & Security
              </div>
              <div className="px-3 py-1.5 text-gray-700 hover:bg-gray-200 rounded-md cursor-pointer">
                General
              </div>
              <div className="px-3 py-1.5 text-gray-700 hover:bg-gray-200 rounded-md cursor-pointer">
                Appearance
              </div>
              <div className="px-3 py-1.5 text-gray-700 hover:bg-gray-200 rounded-md cursor-pointer">
                Accessibility
              </div>
              <div className="px-3 py-1.5 text-gray-700 hover:bg-gray-200 rounded-md cursor-pointer">
                Control Center
              </div>
              {isSequoia && (
                <div className="px-3 py-1.5 text-gray-700 hover:bg-gray-200 rounded-md cursor-pointer">
                  Siri & Spotlight
                </div>
              )}
              <div className="px-3 py-1.5 text-gray-700 hover:bg-gray-200 rounded-md cursor-pointer">
                Desktop & Dock
              </div>
              <div className="px-3 py-1.5 text-gray-700 hover:bg-gray-200 rounded-md cursor-pointer">
                Displays
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-semibold text-gray-900">
                Privacy & Security
              </h1>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 relative">
              <div className="max-w-2xl">
                <h2 className="text-base font-semibold text-gray-900 mb-2">
                  Full Disk Access
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Allow the apps below to access data like Mail, Messages,
                  Safari, Home, Time Machine backups, and certain administrative
                  settings for all users on this Mac.
                </p>

                {/* App List */}
                <div className="bg-gray-50 border border-gray-300 rounded-lg overflow-hidden mb-20">
                  <div className="divide-y divide-gray-300">
                    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-100">
                      <span className="text-sm text-gray-900">
                        Terminal.app
                      </span>
                      <div className="relative w-11 h-6 bg-gray-300 rounded-full transition-colors">
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow"></div>
                      </div>
                    </div>

                    {/* Highlighted App Row */}
                    {(step === "find-app" || step === "toggle") && (
                      <div className="relative flex items-center justify-between px-4 py-2.5 bg-blue-50">
                        <span className="text-sm text-gray-900 font-medium">
                          Electron.app
                        </span>
                        <div className="relative">
                          <div
                            className={`relative w-11 h-6 ${step === "toggle" ? "bg-green-500" : "bg-gray-300"} rounded-full transition-colors`}
                          >
                            <div
                              className={`absolute ${step === "toggle" ? "right-1" : "left-1"} top-1 w-4 h-4 bg-white rounded-full shadow transition-all`}
                            ></div>
                          </div>
                          {step === "toggle" && (
                            <>
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full animate-ping"></div>
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  !
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                        {step === "find-app" && (
                          <div className="absolute -left-5 top-1/2 -translate-y-1/2">
                            <div className="w-8 h-8 bg-red-500 rounded-full animate-ping"></div>
                            <div className="absolute inset-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                              <svg
                                className="w-5 h-5 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {step === "unlock" && (
                      <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-100">
                        <span className="text-sm text-gray-900">
                          Electron.app
                        </span>
                        <div className="relative w-11 h-6 bg-gray-300 rounded-full">
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lock Icon - Bottom Left (Hidden in Sequoia 15+) */}
                {!isSequoia && (
                  <div className="absolute bottom-6 left-6">
                    <div className="relative inline-block">
                      <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                        <div className="w-7 h-7 bg-gray-200 rounded-md flex items-center justify-center text-base">
                          {step === "unlock" ? "🔒" : "🔓"}
                        </div>
                        <span className="text-xs">
                          {step === "unlock" ? "Click to make changes" : ""}
                        </span>
                      </button>
                      {step === "unlock" && (
                        <>
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              !
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
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
function LegacySystemPreferences({ step }: { step: string }) {
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
          <span className="text-sm font-semibold text-gray-800">
            Security & Privacy
          </span>
          <div className="w-20"></div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tab Bar */}
          <div className="flex gap-1 mb-6 border-b border-gray-300">
            <div className="px-4 py-2 text-sm text-gray-600">General</div>
            <div className="px-4 py-2 text-sm text-gray-600">FileVault</div>
            <div className="px-4 py-2 text-sm font-medium border-b-2 border-blue-500 text-blue-600">
              Privacy
            </div>
            <div className="px-4 py-2 text-sm text-gray-600">Firewall</div>
          </div>

          <div className="flex gap-4">
            {/* Left sidebar */}
            <div className="w-48 bg-white border border-gray-300 rounded">
              <div className="space-y-1 p-2 text-xs">
                <div className="px-3 py-2 text-gray-600">Location Services</div>
                <div className="px-3 py-2 text-gray-600">Contacts</div>
                <div className="px-3 py-2 text-gray-600">Calendars</div>
                <div className="px-3 py-2 bg-blue-500 text-white rounded">
                  Full Disk Access
                </div>
                <div className="px-3 py-2 text-gray-600">Accessibility</div>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 relative">
              <p className="text-xs text-gray-600 mb-4">
                Allow the apps below to access all data on this Mac, including
                messages, emails, and backups.
              </p>

              <div className="bg-white border border-gray-300 rounded p-3 mb-16">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 py-1">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm">Terminal</span>
                  </div>

                  {/* Highlighted App */}
                  {(step === "find-app" || step === "toggle") && (
                    <div className="relative flex items-center gap-2 py-1 bg-blue-100 -mx-2 px-2 rounded">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={step === "toggle"}
                          readOnly
                        />
                        {step === "toggle" && (
                          <>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                                !
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      <span className="text-sm font-bold">Electron</span>
                      {step === "find-app" && (
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2">
                          <div className="w-8 h-8 bg-red-500 rounded-full animate-ping"></div>
                          <div className="absolute inset-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {step === "unlock" && (
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
                    {step === "unlock" ? "🔒" : "🔓"}
                  </div>
                  {step === "unlock" && (
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
function SystemSettingsMockup({
  macOSVersion = 15,
  step,
}: SystemSettingsProps) {
  // Use modern UI for Ventura (13) and later
  if (macOSVersion >= 13) {
    return <ModernSystemSettings step={step} macOSVersion={macOSVersion} />;
  }

  // Use legacy UI for Monterey (12) and earlier
  return <LegacySystemPreferences step={step} />;
}

export default SystemSettingsMockup;
