// Jest setup file
import '@testing-library/jest-dom';

// Mock window.api for tests
global.window.api = {
  auth: {
    loginWithGoogle: jest.fn(),
    loginWithMicrosoft: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
  },
  transactions: {
    getAll: jest.fn(),
    create: jest.fn(),
    createAudited: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  contacts: {
    getAll: jest.fn(),
    getSortedByActivity: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  system: {
    checkFullDiskAccess: jest.fn(),
    checkContactsPermission: jest.fn(),
    checkAllPermissions: jest.fn(),
    checkGoogleConnection: jest.fn(),
    checkMicrosoftConnection: jest.fn(),
    checkAllConnections: jest.fn(),
    healthCheck: jest.fn(),
  },
};

// Mock electron for tests
global.window.electron = {
  getAppInfo: jest.fn(),
  getMacOSVersion: jest.fn(),
  checkPermissions: jest.fn(),
  openSystemSettings: jest.fn(),
};

// Suppress console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
