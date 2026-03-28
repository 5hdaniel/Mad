/**
 * BottomNav Component
 *
 * Mobile bottom navigation bar shown on screens < lg (1024px).
 * Provides quick access to key app sections: Dashboard, Transactions,
 * Contacts, Messages, and Settings.
 *
 * Hidden on desktop (lg:) where the full layout provides navigation.
 * Only shown for authenticated users past the login/onboarding screens.
 */

import React from "react";

interface BottomNavProps {
  /** Currently active step/screen */
  currentStep: string;
  /** Open the Transactions modal */
  onTransactions: () => void;
  /** Open the Contacts modal */
  onContacts: () => void;
  /** Navigate to the dashboard step */
  onDashboard: () => void;
  /** Open the Settings modal */
  onSettings: () => void;
  /** Navigate to conversations/messages */
  onMessages: () => void;
}

export function BottomNav({
  currentStep,
  onTransactions,
  onContacts,
  onDashboard,
  onSettings,
  onMessages,
}: BottomNavProps) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14 px-1">
        <NavButton
          label="Home"
          icon={<HomeIcon />}
          isActive={currentStep === "dashboard"}
          onClick={onDashboard}
        />
        <NavButton
          label="Transactions"
          icon={<TransactionsIcon />}
          isActive={false}
          onClick={onTransactions}
        />
        <NavButton
          label="Contacts"
          icon={<ContactsIcon />}
          isActive={currentStep === "contacts"}
          onClick={onContacts}
        />
        <NavButton
          label="Messages"
          icon={<MessagesIcon />}
          isActive={false}
          onClick={onMessages}
        />
        <NavButton
          label="Settings"
          icon={<SettingsIcon />}
          isActive={false}
          onClick={onSettings}
        />
      </div>
    </nav>
  );
}

// -- Nav Button --

interface NavButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

function NavButton({ label, icon, isActive, onClick }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center flex-1 py-1 px-1 min-w-0 transition-colors ${
        isActive
          ? "text-blue-600"
          : "text-gray-500 hover:text-gray-700 active:text-blue-500"
      }`}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="w-6 h-6">{icon}</span>
      <span className="text-[10px] mt-0.5 leading-tight truncate max-w-full">
        {label}
      </span>
    </button>
  );
}

// -- SVG Icons (inline, no dependencies) --

function HomeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function TransactionsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <line x1="2" y1="9" x2="22" y2="9" />
      <line x1="10" y1="3" x2="10" y2="9" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
