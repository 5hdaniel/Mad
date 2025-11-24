/**
 * Tour Steps Configuration
 * Defines the steps for Joyride tours throughout the app
 */
import { Step } from 'react-joyride';

// Main Dashboard Tour - shown to first-time users
export const getDashboardTourSteps = (): Step[] => [
  {
    target: 'body',
    content: '👋 Welcome to Magic Audit! Let me give you a quick tour of the main features.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="new-audit-card"]',
    content: 'Start a new transaction audit to track client communications and ensure compliance.',
    placement: 'bottom',
    spotlightClicks: true,
  },
  {
    target: '[data-tour="transactions-card"]',
    content: 'Browse and review all your past transaction audits in one place.',
    placement: 'bottom',
    spotlightClicks: true,
  },
  {
    target: '[data-tour="contacts-card"]',
    content: 'Manage your real estate contacts database here. Add, edit, or organize your client contacts.',
    placement: 'top',
    spotlightClicks: true,
  },
  {
    target: '[data-tour="profile-button"]',
    content: 'Access your account settings, subscription status, and email connections from your profile.',
    placement: 'bottom-end',
  },
  {
    target: 'body',
    content: '🎉 That\'s it! You\'re all set to start using Magic Audit. Let\'s get started!',
    placement: 'center',
  },
];

// Export Screen Tour - shown when user first visits export screen
export const getExportTourSteps = (outlookConnected: boolean): Step[] => [
  {
    target: 'body',
    content: 'Welcome to the Export screen! Let me show you around and explain the different features available.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="search"]',
    content: 'Use this search bar to quickly find contacts by name or phone number.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="select-all"]',
    content: 'Quickly select all contacts at once with this button.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="deselect-all"]',
    content: 'Or deselect all contacts with this button.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="export-section"]',
    content: 'This is where you choose how to export your conversations. You have multiple options:',
    placement: 'bottom',
  },
  {
    target: '[data-tour="export-all"]',
    content: outlookConnected
      ? 'Export both messages and emails for your selected contacts.'
      : 'Connect to Outlook to export both messages and emails together.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="export-emails"]',
    content: outlookConnected
      ? 'Export only emails (no text messages) for your selected contacts.'
      : 'This option will be available once you connect to Outlook.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="export-texts"]',
    content: 'Export only text messages (no emails) for your selected contacts.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="contact-list"]',
    content: 'Here you can see all your contacts. Click on a contact to select or deselect them for export.',
    placement: 'right',
    spotlightClicks: true,
  },
  {
    target: 'body',
    content: 'That\'s it! You\'re all set to start exporting your client conversations. Happy archiving!',
    placement: 'center',
  },
];

// Joyride configuration defaults
export const JOYRIDE_STYLES = {
  options: {
    primaryColor: '#3b82f6',
    zIndex: 10000,
  },
};

export const JOYRIDE_LOCALE = {
  last: 'Done',
};
