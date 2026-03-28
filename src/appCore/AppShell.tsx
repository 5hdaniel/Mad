/**
 * AppShell Component
 *
 * Provides the main application layout structure including:
 * - Title bar with user menu (Electron only - hidden on web/mobile)
 * - Offline banner
 * - Scrollable content area with mobile-safe overflow
 * - Bottom navigation bar on mobile (< lg breakpoint)
 * - Version info button and popup
 *
 * Mobile-first responsive design:
 * - (default) 0px+: Bottom nav visible, no title bar drag region
 * - lg: 1024px+: Desktop layout, title bar with drag region, no bottom nav
 */

import React from "react";
import type { AppStateMachine, ModalState } from "./state/types";
import { BottomNav, OfflineBanner } from "./shell";
import SystemHealthMonitor from "../components/SystemHealthMonitor";
import { isOnboardingStep } from "./routing";
import { useSessionValidator } from "../hooks/useSessionValidator";
import { isElectron } from "../utils/platform";
// TASK-2282: SupportWidget moved to App.tsx (outside auth routes)

// OAuthProvider type to match SystemHealthMonitor expectations
// Note: 'azure' is Microsoft's Azure AD provider
type OAuthProvider = "google" | "microsoft" | "azure";

interface AppShellProps {
  app: AppStateMachine;
  children: React.ReactNode;
}

/**
 * Whether any modal is currently open.
 * Used to hide bottom nav when a full-screen modal overlay is active.
 */
function isAnyModalOpen(modalState: ModalState): boolean {
  return (
    modalState.showProfile ||
    modalState.showSettings ||
    modalState.showTransactions ||
    modalState.showContacts ||
    modalState.showAuditTransaction ||
    modalState.showMoveAppPrompt ||
    modalState.showTermsModal ||
    modalState.showIPhoneSync
  );
}

/**
 * Whether to show the bottom navigation bar.
 * Only show for authenticated users on the main dashboard or contacts screen
 * (not during onboarding, login, export flows, etc.)
 * Hidden when any modal is open (modals take full screen on mobile).
 */
function shouldShowBottomNav(
  currentStep: string,
  isAuthenticated: boolean,
  modalState: ModalState,
): boolean {
  if (!isAuthenticated) return false;
  if (isAnyModalOpen(modalState)) return false;
  // Show on dashboard and contacts (the main app screens)
  return currentStep === "dashboard" || currentStep === "contacts";
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
    openTransactions,
    openContacts,
    goToStep,
    handleRetryConnection,
    handleLogout,
    getPageTitle,
  } = app;

  // TASK-2062: Poll for remote session invalidation
  useSessionValidator({
    isAuthenticated,
    onSessionInvalidated: handleLogout,
  });

  // Detect Electron for title bar drag region
  const runningInElectron = isElectron();

  // Whether to show bottom nav on mobile
  const showBottomNav = shouldShowBottomNav(currentStep, isAuthenticated, modalState);

  // PRIMARY DATABASE INITIALIZATION GATE
  // Block all content for authenticated users until database is ready
  // This prevents "Database is not initialized" errors from modal bypass
  // EXCEPTION: Don't block during onboarding - DB init is deferred for first-time macOS users
  // and will be initialized during the secure-storage/keychain step in onboarding
  if (isAuthenticated && !isDatabaseInitialized && !isOnboardingStep(currentStep)) {
    return (
      <div className="min-h-screen min-h-dvh bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        {/* Invisible drag region at top for window dragging during init (Electron only) */}
        {runningInElectron && (
          <div className="fixed top-0 left-0 right-0 h-12 drag-region" />
        )}
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing secure storage...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Title Bar - Only show on Electron (desktop) and not on login screen.
          On mobile/web platforms, there is no OS-level drag region needed. */}
      {runningInElectron && currentStep !== "login" && (
        <div className="flex-shrink-0 bg-gradient-to-b from-gray-100 to-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between select-none drag-region">
          <div className="w-8" /> {/* Spacer for centering */}
          <h1 className="text-sm font-semibold text-gray-700">
            {getPageTitle()}
          </h1>
          {/* User Menu Button */}
          {isAuthenticated && currentUser && (
            <button
              onClick={openProfile}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md transition-all hover:shadow-lg no-drag-region"
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

      {/* Mobile Header - Show page title and profile on non-Electron platforms */}
      {!runningInElectron && currentStep !== "login" && isAuthenticated && currentUser && (
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between lg:hidden">
          <h1 className="text-base font-semibold text-gray-900">
            {getPageTitle()}
          </h1>
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

      {/* Scrollable Content Area
          pb-14: padding-bottom for mobile bottom nav (56px = h-14)
          lg:pb-0: no bottom padding on desktop (no bottom nav) */}
      <div className={`flex-1 min-h-0 overflow-y-auto relative ${showBottomNav ? "pb-14 lg:pb-0" : ""}`}>
        {children}
      </div>

      {/* Mobile Bottom Navigation - visible below lg breakpoint */}
      {showBottomNav && (
        <BottomNav
          currentStep={currentStep}
          onDashboard={() => goToStep("dashboard")}
          onTransactions={openTransactions}
          onContacts={openContacts}
          onMessages={() => goToStep("contacts")}
          onSettings={() => openSettings()}
        />
      )}

      {/* TASK-2282: SupportWidget moved to App.tsx to be visible on ALL screens */}
    </div>
  );
}
