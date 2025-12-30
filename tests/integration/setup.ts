/**
 * Integration Test Setup
 *
 * Global setup and teardown for integration tests.
 * Configures the test environment for sandbox-based testing.
 */

// Use fake timers for deterministic time-based tests
jest.useFakeTimers();

// Set a fixed date for all tests (deterministic)
const FIXED_DATE = new Date('2024-03-01T12:00:00Z');
jest.setSystemTime(FIXED_DATE);

// Suppress console output in tests to reduce noise (can be overridden per-test)
const originalConsole = { ...console };
beforeAll(() => {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // Keep error and warn for debugging failed tests
    error: originalConsole.error,
    warn: originalConsole.warn,
  };
});

afterAll(() => {
  global.console = originalConsole;
  jest.useRealTimers();
});

// Export the fixed date for use in tests
export const TEST_FIXED_DATE = FIXED_DATE;
export const TEST_FIXED_TIMESTAMP = FIXED_DATE.toISOString();

// Export test user ID for consistent fixture loading
export const TEST_USER_ID = 'test-user-001';
