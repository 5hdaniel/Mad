// Base configuration shared across all environments
const baseConfig = {
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
};

// Coverage configuration (shared)
const coverageConfig = {
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
};

// CI uses simple flat config (no projects) for faster execution
// Local development uses projects for integration tests
const isCI = process.env.CI === 'true' || process.env.CI === true;

module.exports = isCI ? {
  // CI: Simple flat configuration (like the working config before multi-project)
  ...baseConfig,
  ...coverageConfig,
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  testMatch: [
    '**/__tests__/**/*.(test|spec).{js,jsx,ts,tsx}',
    '**/tests/**/*.(test|spec).{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/tests/integration/', // Integration tests run locally only
  ],
  testTimeout: 30000,
  verbose: false,
  errorOnDeprecated: false,
  bail: 1,
  maxWorkers: 2,
} : {
  // Local: Multi-project configuration with integration tests
  ...coverageConfig,
  projects: [
    {
      ...baseConfig,
      displayName: 'unit',
      testEnvironment: 'jest-environment-jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
      },
      testMatch: [
        '**/__tests__/**/*.(test|spec).{js,jsx,ts,tsx}',
        '**/tests/**/*.(test|spec).{js,jsx,ts,tsx}',
        '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/build/',
        '/tests/integration/',
      ],
    },
    {
      ...baseConfig,
      displayName: 'integration',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
    },
  ],
  testTimeout: 30000,
  verbose: false,
  errorOnDeprecated: false,
  bail: 1,
  maxWorkers: '50%',
};
