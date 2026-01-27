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
import { OfflineBanner, VersionPopup } from "./shell";
import SystemHealthMonitor from "../components/SystemHealthMonitor";
import { isOnboardingStep } from "./routing";

// OAuthProvider type to match SystemHealthMonitor expectations
type OAuthProvider = "google" | "microsoft";

interface AppShellProps {
  app: AppStateMachine;
  children: React.ReactNode;
}

export function AppShell({ app, children }: AppShellProps) {
  const {
    currentStep,
    isAuthenticated,
    isDatabaseInitialized,
    currentUser,
    authProvider,
    hasPermissions,
    hasEmailConnected,
    isTourActive,
    needsTermsAcceptance,
    isOnline,
    isChecking,
    modalState,
    openProfile,
    openSettings,
    toggleVersion,
    closeVersion,
    handleRetryConnection,
    getPageTitle,
  } = app;

  // PRIMARY DATABASE INITIALIZATION GATE
  // Block all content for authenticated users until database is ready
  // This prevents "Database is not initialized" errors from modal bypass
  // EXCEPTION: Don't block during onboarding - DB init is deferred for first-time macOS users
  // and will be initialized during the secure-storage/keychain step in onboarding
  if (isAuthenticated && !isDatabaseInitialized && !isOnboardingStep(currentStep)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing secure storage...</p>
        </div>
      </div>
    );
  }

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
      {currentStep !== "login" && (
        <OfflineBanner
          isOnline={isOnline}
          isChecking={isChecking}
          onRetry={handleRetryConnection}
        />
      )}

      {/* System Health Monitor - Show permission/connection errors */}
      {isAuthenticated &&
        currentUser &&
        authProvider &&
        hasPermissions &&
        currentStep === "dashboard" &&
        hasEmailConnected && (
          <SystemHealthMonitor
            key={`health-monitor-${hasEmailConnected}`}
            userId={currentUser.id}
            provider={authProvider as OAuthProvider}
            hidden={isTourActive || needsTermsAcceptance}
            onOpenSettings={openSettings}
          />
        )}

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto relative">
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
        <VersionPopup
          isVisible={modalState.showVersion}
          onClose={closeVersion}
        />
      </div>
    </div>
  );
}
