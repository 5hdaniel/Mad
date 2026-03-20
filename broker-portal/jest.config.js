/**
 * Jest config for broker-portal tests.
 *
 * Extends the root config but overrides moduleNameMapper to resolve
 * @/ imports to the broker-portal root (not src/).
 *
 * TASK-2199: Support Ticket Notification Emails
 */

const rootConfig = require('../jest.config');

module.exports = {
  ...rootConfig,
  // Override root paths for broker-portal
  rootDir: __dirname,
  roots: ['<rootDir>'],
  setupFilesAfterEnv: [],
  moduleNameMapper: {
    ...rootConfig.moduleNameMapper,
    // Override @/ to point to broker-portal root
    '^@/(.*)$': '<rootDir>/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
  },
  testMatch: [
    '**/__tests__/**/*.(test|spec).{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.next/',
  ],
  // Disable root coverage thresholds
  coverageThreshold: undefined,
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};
