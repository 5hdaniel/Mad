/**
 * Tour Steps Configuration
 * Defines the steps for the Joyride tour on the export screen
 */

export const getExportTourSteps = (outlookConnected) => [
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
