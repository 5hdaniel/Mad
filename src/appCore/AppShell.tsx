/**
 * AppShell Component
 *
 * Provides the main application layout structure including:
 * - Title bar with user menu
 * - Offline banner
 * - Scrollable content area
 * - Version info button and popup
 */

import React from "react";
import type { AppStateMachine } from "./state/types";

interface AppShellProps {
  app: AppStateMachine;
  children: React.ReactNode;
}

export function AppShell({ app, children }: AppShellProps) {
  const {
    currentStep,
    isAuthenticated,
    currentUser,
    isOnline,
    isChecking,
    modalState,
    openProfile,
    toggleVersion,
    closeVersion,
    handleRetryConnection,
    getPageTitle,
  } = app;
  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Title Bar - Hide on login screen */}
      {currentStep !== "login" && (
        <div className="flex-shrink-0 bg-gradient-to-b from-gray-100 to-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between select-none">
          <div className="w-8" /> {/* Spacer for centering */}
          <h1 className="text-sm font-semibold text-gray-700">
            {getPageTitle()}
          </h1>
          {/* User Menu Button */}
          {isAuthenticated && currentUser && (
            <button
              onClick={openProfile}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md transition-all hover:shadow-lg"
              title={`${currentUser.display_name || currentUser.email} - Click for account settings`}
              data-tour="profile-button"
            >
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                currentUser.display_name?.[0]?.toUpperCase() ||
                currentUser.email?.[0]?.toUpperCase() ||
                "?"
              )}
            </button>
          )}
        </div>
      )}

      {/* Offline Banner - Show when network is unavailable */}
      {!isOnline && currentStep !== "login" && (
        <div className="flex-shrink-0 bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  You're offline
                </p>
                <p className="text-xs text-yellow-700">
                  Some features may be limited. Your local data is still
                  accessible.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetryConnection}
                disabled={isChecking}
                className="px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-200 hover:bg-yellow-300 rounded-md transition-colors disabled:opacity-50"
              >
                {isChecking ? "Checking..." : "Retry"}
              </button>
              <button
                onClick={() =>
                  window.api?.system?.contactSupport?.(
                    "Network connection issue",
                  )
                }
                className="px-3 py-1.5 text-xs font-medium text-yellow-800 hover:text-yellow-900 transition-colors"
              >
                Get Help
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto relative">
        {children}

        {/* Version Info Button - Bottom Left */}
        <button
          onClick={toggleVersion}
          className="fixed bottom-4 left-4 w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all shadow-md z-50"
          title="Version Info"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        {/* Version Info Popup */}
        {modalState.showVersion && (
          <div className="fixed bottom-16 left-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 min-w-64">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">App Info</h3>
              <button
                onClick={closeVersion}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-mono font-semibold text-gray-900">
                  1.0.7
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Update:</span>
                <span className="font-mono text-gray-700 bg-green-100 px-1 rounded">
                  Clean Filenames
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-gray-500 text-xs">MagicAudit</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
