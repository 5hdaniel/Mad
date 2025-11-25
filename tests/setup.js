// Jest setup file
import '@testing-library/jest-dom';

// Mock window.api for tests (only in jsdom environment)
if (typeof window !== 'undefined') {
  global.window = global.window || {};
  global.window.api = {
    auth: {
      loginWithGoogle: jest.fn(),
      loginWithMicrosoft: jest.fn(),
      logout: jest.fn(),
      getCurrentUser: jest.fn(),
      acceptTerms: jest.fn(),
      googleLogin: jest.fn(),
      googleCompleteLogin: jest.fn(),
      microsoftLogin: jest.fn(),
      microsoftCompleteLogin: jest.fn(),
      googleConnectMailbox: jest.fn(),
      microsoftConnectMailbox: jest.fn(),
    },
    transactions: {
      getAll: jest.fn(),
      create: jest.fn(),
      createAudited: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      scan: jest.fn(),
      getDetails: jest.fn(),
      assignContact: jest.fn(),
      removeContact: jest.fn(),
    },
    contacts: {
      getAll: jest.fn(),
      getSortedByActivity: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      checkCanDelete: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
    },
    system: {
      checkFullDiskAccess: jest.fn(),
      checkContactsPermission: jest.fn(),
      checkAllPermissions: jest.fn(),
      checkGoogleConnection: jest.fn(),
      checkMicrosoftConnection: jest.fn(),
      checkAllConnections: jest.fn(),
      healthCheck: jest.fn(),
      openPrivacyPane: jest.fn(),
    },
    address: {
      initialize: jest.fn(),
      getSuggestions: jest.fn(),
      getDetails: jest.fn(),
    },
    preferences: {
      get: jest.fn(),
      update: jest.fn(),
    },
    shell: {
      openExternal: jest.fn(),
    },
    onTransactionScanProgress: jest.fn(() => jest.fn()),
    onGoogleMailboxConnected: jest.fn(() => jest.fn()),
    onMicrosoftMailboxConnected: jest.fn(() => jest.fn()),
    onMicrosoftLoginComplete: jest.fn(() => jest.fn()),
  };

  // Mock electron for tests
  global.window.electron = {
    getAppInfo: jest.fn(),
    getMacOSVersion: jest.fn(),
    checkPermissions: jest.fn(),
    openSystemSettings: jest.fn(),
    checkAppLocation: jest.fn(),
    getConversations: jest.fn(),
    outlookInitialize: jest.fn(),
    outlookIsAuthenticated: jest.fn(),
    outlookAuthenticate: jest.fn(),
    outlookGetUserEmail: jest.fn(),
    outlookExportEmails: jest.fn(),
    openFolder: jest.fn(),
    onExportProgress: jest.fn(() => jest.fn()),
  };
}

// Suppress console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
