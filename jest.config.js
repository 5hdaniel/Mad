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

  coverageThreshold: {
    global: {
      branches: 30,
      functions: 40,
      lines: 45,
      statements: 45,
    },
    // Per-path thresholds - enforce higher coverage where it matters most
    './src/utils/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/hooks/': {
      branches: 60,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './electron/utils/': {
      branches: 50,
      functions: 60,
      lines: 55,
      statements: 55,
    },
  },

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.(test|spec).{js,jsx,ts,tsx}',
    '**/tests/**/*.(test|spec).{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
  ],

  // Ignore patterns - exclude integration tests that use fake timers
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/tests/integration/'],

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
