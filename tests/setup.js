// Jest setup file
import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';

// Configure testing-library to limit DOM output on errors
configure({
  getElementError: (message) => {
    const error = new Error(message);
    error.name = 'TestingLibraryElementError';
    return error;
  },
});

// Set DEBUG_PRINT_LIMIT to reduce DOM output
process.env.DEBUG_PRINT_LIMIT = '500';

// Limit stack trace depth in CI/CD for cleaner error output
if (process.env.CI) {
  Error.stackTraceLimit = 3; // Only show 3 stack frames in CI
}

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
      googleDisconnectMailbox: jest.fn(),
      microsoftDisconnectMailbox: jest.fn(),
      checkEmailOnboarding: jest.fn(),
      completeEmailOnboarding: jest.fn(),
      completePendingLogin: jest.fn(),
      // Pre-DB mailbox connection methods
      googleConnectMailboxPending: jest.fn(),
      microsoftConnectMailboxPending: jest.fn(),
      savePendingMailboxTokens: jest.fn(),
      acceptTermsToSupabase: jest.fn(),
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
      exportEnhanced: jest.fn(),
      bulkDelete: jest.fn(),
      bulkUpdateStatus: jest.fn(),
    },
    contacts: {
      getAll: jest.fn(),
      getAvailable: jest.fn(),
      getSortedByActivity: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      import: jest.fn(),
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
      contactSupport: jest.fn(),
      getDiagnostics: jest.fn(),
      hasEncryptionKeyStore: jest.fn(),
      initializeSecureStorage: jest.fn(),
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
    llm: {
      getConfig: jest.fn(),
      setApiKey: jest.fn(),
      validateKey: jest.fn(),
      removeApiKey: jest.fn(),
      updatePreferences: jest.fn(),
      recordConsent: jest.fn(),
      getUsage: jest.fn(),
      canUse: jest.fn(),
    },
    feedback: {
      submit: jest.fn(),
      getForTransaction: jest.fn(),
      getMetrics: jest.fn(),
      getSuggestion: jest.fn(),
      getLearningStats: jest.fn(),
      recordTransaction: jest.fn(),
      recordRole: jest.fn(),
      recordRelevance: jest.fn(),
      getStats: jest.fn(),
    },
    user: {
      getPhoneType: jest.fn(),
      setPhoneType: jest.fn(),
    },
    shell: {
      openExternal: jest.fn(),
    },
    onTransactionScanProgress: jest.fn(() => jest.fn()),
    onGoogleMailboxConnected: jest.fn(() => jest.fn()),
    onMicrosoftMailboxConnected: jest.fn(() => jest.fn()),
    onGoogleMailboxDisconnected: jest.fn(() => jest.fn()),
    onMicrosoftMailboxDisconnected: jest.fn(() => jest.fn()),
    onMicrosoftLoginComplete: jest.fn(() => jest.fn()),
    onGoogleMailboxCancelled: jest.fn(() => jest.fn()),
    onMicrosoftMailboxCancelled: jest.fn(() => jest.fn()),
    // Pre-DB mailbox connection event listeners
    onGoogleMailboxPendingConnected: jest.fn(() => jest.fn()),
    onMicrosoftMailboxPendingConnected: jest.fn(() => jest.fn()),
    onGoogleMailboxPendingCancelled: jest.fn(() => jest.fn()),
    onMicrosoftMailboxPendingCancelled: jest.fn(() => jest.fn()),
    onGoogleLoginComplete: jest.fn(() => jest.fn()),
    onGoogleLoginPending: jest.fn(() => jest.fn()),
    onGoogleLoginCancelled: jest.fn(() => jest.fn()),
    onMicrosoftLoginPending: jest.fn(() => jest.fn()),
    onMicrosoftLoginCancelled: jest.fn(() => jest.fn()),
  };

  // Mock electron for tests
  global.window.electron = {
    platform: 'darwin', // Default to macOS for tests (can be overridden in specific tests)
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
    // iOS Device Detection (Windows only)
    device: {
      startDetection: jest.fn(),
      stopDetection: jest.fn(),
      onConnected: jest.fn(() => jest.fn()),
      onDisconnected: jest.fn(() => jest.fn()),
    },
    // iOS Backup Management (Windows only)
    backup: {
      start: jest.fn(),
      submitPassword: jest.fn(),
      cancel: jest.fn(),
      onProgress: jest.fn(() => jest.fn()),
    },
    // Apple Driver Management (Windows only)
    drivers: {
      checkApple: jest.fn(),
      installApple: jest.fn(),
      hasBundled: jest.fn(),
      openITunesStore: jest.fn(),
      checkUpdate: jest.fn(),
    },
  };
}

// Suppress console output in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};
