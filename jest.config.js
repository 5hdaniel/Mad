module.exports = {
  // Test environment - use node for backend, jsdom for frontend
  testEnvironment: 'jest-environment-jsdom',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Use node environment for backend tests
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },

  // Module paths
  moduleDirectories: ['node_modules', 'src'],

  // Transform files
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['@babel/preset-react'] }],
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },

  // Module name mapper for CSS and assets
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
    '^electron$': '<rootDir>/tests/__mocks__/electron.js',
    '^electron-log$': '<rootDir>/tests/__mocks__/electron-log.js',
    '^electron-updater$': '<rootDir>/tests/__mocks__/electron-updater.js',
    // Native database modules - must be mocked to avoid binding errors
    '^better-sqlite3-multiple-ciphers$': '<rootDir>/tests/__mocks__/better-sqlite3-multiple-ciphers.js',
    '^sqlite3$': '<rootDir>/tests/__mocks__/sqlite3.js',
    // Path aliases from tsconfig
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@electron/(.*)$': '<rootDir>/electron/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'electron/services/**/*.{js,ts}',
    'electron/utils/**/*.{js,ts}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!electron/**/*.test.{js,ts}',
    '!electron/main.js',
    '!**/node_modules/**',
    '!tests/integration/**',
  ],

  // Coverage thresholds configuration
  // TASK-1055: Updated thresholds for SPRINT-037
  // Strategy: Conservative global thresholds with stricter per-path rules for critical utilities
  // Note: CI only runs src/** tests, so electron/** thresholds only apply locally
  coverageThreshold: process.env.CI ? {
    // CI thresholds - only src/** tests run in CI
    // Target: Increase by 5% per quarter
    // Note: Threshold check uses different calculation than summary
    global: {
      branches: 24,     // SPRINT-037 baseline (threshold check: ~24-25%)
      functions: 24,    // SPRINT-037 baseline (threshold check: ~24-25%)
      lines: 24,        // SPRINT-037 baseline (threshold check: ~24-25%)
      statements: 24,   // SPRINT-037 baseline (threshold check: ~24-25%)
    },
    // Higher standards for pure utility code (easier to test, well-covered)
    './src/utils/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/hooks/': {
      branches: 55,     // Current: ~60%
      functions: 80,    // Current: ~84%
      lines: 80,        // Current: ~83%
      statements: 80,   // Current: ~83%
    },
    // Note: electron/utils/ not tested in CI (see testMatch config)
  } : {
    // Local thresholds - all tests run locally
    // Note: Local thresholds are intentionally lower because:
    // 1. Running partial test suites will fail per-path thresholds
    // 2. Integration tests add coverage variance
    // CI is the authoritative coverage gate
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10,
    },
    // Per-path thresholds disabled locally - use CI as gate
    // './electron/utils/': { ... }
  },

  // Test match patterns - in CI, only run frontend tests (src/) for reliability
  testMatch: process.env.CI ? [
    '**/src/**/*.(test|spec).{js,jsx,ts,tsx}',
  ] : [
    '**/__tests__/**/*.(test|spec).{js,jsx,ts,tsx}',
    '**/tests/**/*.(test|spec).{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
  ],

  // Ignore patterns - exclude problematic tests in CI
  // Integration tests (tests/integration/) are excluded from CI but run locally
  // They test the full email/SMS sync -> classification -> detection pipeline
  // using fake fixtures for deterministic, offline testing
  testPathIgnorePatterns: process.env.CI ? [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/tests/integration/', // Integration tests run locally, not in CI
    'ContactSelectModal.test.tsx', // Hangs in CI during loading
  ] : [
    '/node_modules/',
    '/dist/',
    '/build/',
  ],

  // Reduce output noise
  verbose: false,

  // Limit error output
  errorOnDeprecated: false,

  // Concise error output for CI/CD
  bail: 1, // Stop after first test failure (optional - remove if you want all failures)
  maxWorkers: process.env.CI ? 2 : '50%', // Limit parallel tests in CI for cleaner output

  // Global test timeout - fail any test taking longer than 30 seconds
  testTimeout: 30000,
};
