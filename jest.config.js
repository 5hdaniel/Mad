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
    '^.+\\.(ts|tsx)$': ['ts-jest'],
  },

  // Module name mapper for CSS and assets
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'electron/services/**/*.{js,ts}',
    'electron/*-handlers.{js,ts}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!electron/main.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],

  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.(test|spec).{js,jsx,ts,tsx}',
    '**/tests/**/*.(test|spec).{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
  ],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],

  // Verbose output
  verbose: true,
};
