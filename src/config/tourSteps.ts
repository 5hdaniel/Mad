/**
 * Tour Steps Configuration
 * Defines the steps for Joyride tours throughout the app
 */
import React from "react";
import { Step } from "react-joyride";

/**
 * Options for configuring which dashboard tour steps to include
 */
export interface DashboardTourOptions {
  hasAIAddon: boolean;
  /** True when running on macOS (darwin) */
  isMacOS: boolean;
  /** True when OS notifications are already enabled for this app */
  notificationsEnabled: boolean;
}

/**
 * Notification permission tour step content component.
 * Renders explanatory text and a "Send Test Notification" button
 * that triggers a macOS notification via the existing IPC channel.
 */
function NotificationStepContent(): React.ReactElement {
  const handleSendTestNotification = (e: React.MouseEvent): void => {
    e.stopPropagation();
    window.api.notification.send(
      "Keepr",
      "Notifications help you stay updated on sync progress and audit alerts.",
    );
  };

  return React.createElement(
    "div",
    null,
    React.createElement(
      "p",
      { style: { marginBottom: "12px" } },
      "Let's enable notifications so you never miss important updates like sync completions and audit alerts.",
    ),
    React.createElement(
      "p",
      { style: { marginBottom: "12px" } },
      "Click the button below to send a test notification, then follow these steps:",
    ),
    React.createElement(
      "ol",
      { style: { paddingLeft: "20px", marginBottom: "12px" } },
      React.createElement("li", null, "A notification banner will appear at the top-right of your screen"),
      React.createElement("li", null, "Hover over the banner to reveal the \"Options\" button"),
      React.createElement("li", null, "Click \"Options\" to open the dropdown"),
      React.createElement("li", null, "Select \"Allow\" to enable notifications"),
    ),
    React.createElement(
      "button",
      {
        onClick: handleSendTestNotification,
        style: {
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          padding: "8px 16px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: "pointer",
        },
        type: "button" as const,
      },
      "Send Test Notification",
    ),
  );
}

// Main Dashboard Tour - shown to first-time users
export const getDashboardTourSteps = (
  optionsOrHasAIAddon: DashboardTourOptions | boolean,
): Step[] => {
  // Support both old signature (boolean) and new options object
  const options: DashboardTourOptions =
    typeof optionsOrHasAIAddon === "boolean"
      ? { hasAIAddon: optionsOrHasAIAddon, isMacOS: false, notificationsEnabled: true }
      : optionsOrHasAIAddon;

  const { hasAIAddon, isMacOS, notificationsEnabled } = options;

  // Show notification step only on macOS when notifications are not yet enabled
  const showNotificationStep = isMacOS && !notificationsEnabled;

  return [
  {
    target: "body",
    content:
      "Welcome to Keepr! Let me give you a quick tour of the main features.",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: '[data-tour="sync-status"]',
    content:
      "During data syncs, the audit tools will be temporarily disabled to ensure compliance accuracy. The interface will activate automatically when the sync completes. Enable notifications in Settings to be alerted when syncing finishes.",
    placement: "bottom",
    disableBeacon: true,
  },
  ...(showNotificationStep
    ? [
        {
          target: '[data-tour="sync-status"]',
          content: React.createElement(NotificationStepContent),
          placement: "bottom" as const,
          disableBeacon: true,
        },
      ]
    : []),
  {
    target: '[data-tour="new-audit-card"]',
    content:
      "Start a new transaction audit to track client communications and ensure compliance.",
    placement: "bottom",
    spotlightClicks: true,
    disableBeacon: true,
  },
  {
    target: '[data-tour="transactions-card"]',
    content:
      "Browse all your transaction audits here. Track communications, documents, and milestones for each property transaction.",
    placement: "bottom",
    spotlightClicks: true,
    disableBeacon: true,
  },
  ...(hasAIAddon
    ? [
        {
          target: '[data-tour="ai-detection-status"]',
          content:
            "This card shows transactions that our AI has automatically found in your emails. Click 'Review Now' to confirm or dismiss them.",
          placement: "bottom" as const,
          disableBeacon: true,
        },
      ]
    : []),
  {
    target: '[data-tour="contacts-card"]',
    content:
      "Manage your real estate contacts database here. Add, edit, or organize your client contacts.",
    placement: "top",
    spotlightClicks: true,
    disableBeacon: true,
  },
  {
    target: '[data-tour="profile-button"]',
    content:
      "Access your account settings, subscription status, and email connections from your profile.",
    placement: "bottom-end",
    disableBeacon: true,
  },
  {
    target: "body",
    content:
      "🎉 That's it! You're all set to start using Keepr. Let's get started!",
    placement: "center",
    disableBeacon: true,
  },
];
};

// Export Screen Tour - shown when user first visits export screen
export const getExportTourSteps = (outlookConnected: boolean): Step[] => [
  {
    target: "body",
    content:
      "Welcome to the Export screen! Let me show you around and explain the different features available.",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: '[data-tour="search"]',
    content:
      "Use this search bar to quickly find contacts by name or phone number.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="select-all"]',
    content: "Quickly select all contacts at once with this button.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="deselect-all"]',
    content: "Or deselect all contacts with this button.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="export-section"]',
    content:
      "This is where you choose how to export your conversations. You have multiple options:",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="export-all"]',
    content: outlookConnected
      ? "Export both messages and emails for your selected contacts."
      : "Connect to Outlook to export both messages and emails together.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="export-emails"]',
    content: outlookConnected
      ? "Export only emails (no text messages) for your selected contacts."
      : "This option will be available once you connect to Outlook.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="export-texts"]',
    content:
      "Export only text messages (no emails) for your selected contacts.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="contact-list"]',
    content:
      "Here you can see all your contacts. Click on a contact to select or deselect them for export.",
    placement: "right",
    spotlightClicks: true,
    disableBeacon: true,
  },
  {
    target: "body",
    content:
      "That's it! You're all set to start exporting your client conversations. Happy archiving!",
    placement: "center",
    disableBeacon: true,
  },
];

// Joyride configuration defaults
export const JOYRIDE_STYLES = {
  options: {
    primaryColor: "#3b82f6",
    zIndex: 10000,
  },
};

export const JOYRIDE_LOCALE = {
  last: "Done",
};
