/**
 * Unit tests for TASK-2280: Session token corruption recovery
 *
 * When validateSessionToken throws "Session token has invalid length",
 * the session handlers should:
 * 1. Clear the corrupted session file
 * 2. Log to Sentry with corruption context (no PII)
 * 3. Return a response that redirects to login (not show an error)
 *
 * Normal (valid) tokens should continue to work unchanged.
 */

// Mock electron
const mockIpcHandle = jest.fn();
jest.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
  shell: {
    openExternal: jest.fn(),
  },
}));

// Mock Sentry
const mockSentryCaptureMessage = jest.fn();
const mockSentryCaptureException = jest.fn();
const mockSentrySetUser = jest.fn();
jest.mock("@sentry/electron/main", () => ({
  captureMessage: mockSentryCaptureMessage,
  captureException: mockSentryCaptureException,
  setUser: mockSentrySetUser,
}));

// Mock supabaseService
jest.mock("../services/supabaseService", () => ({
  __esModule: true,
  default: {
    getClient: jest.fn(() => ({
      auth: { getUser: jest.fn(), setSession: jest.fn() },
    })),
    signOut: jest.fn(),
    signOutGlobal: jest.fn(),
    getAuthUserId: jest.fn(),
    getUserById: jest.fn(),
    syncTermsAcceptance: jest.fn(),
    completeEmailOnboarding: jest.fn(),
  },
}));

// Mock deviceService
jest.mock("../services/deviceService", () => ({
  getDeviceId: jest.fn().mockReturnValue("test-device-id"),
}));

// Mock databaseService
const mockDbValidateSession = jest.fn();
const mockDbDeleteSession = jest.fn();
jest.mock("../services/databaseService", () => ({
  __esModule: true,
  default: {
    isInitialized: jest.fn().mockReturnValue(true),
    validateSession: mockDbValidateSession,
    deleteSession: mockDbDeleteSession,
    getUserById: jest.fn(),
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    createSession: jest.fn(),
    updateUser: jest.fn(),
    getSubscriptionByUserId: jest.fn(),
    updateUserSubscription: jest.fn(),
  },
}));

// Mock sessionService
const mockClearSession = jest.fn().mockResolvedValue(true);
const mockLoadSession = jest.fn();
jest.mock("../services/sessionService", () => ({
  __esModule: true,
  default: {
    loadSession: mockLoadSession,
    saveSession: jest.fn(),
    clearSession: mockClearSession,
    updateSession: jest.fn(),
    hasValidSession: jest.fn(),
  },
}));

// Mock sessionSecurityService
jest.mock("../services/sessionSecurityService", () => ({
  __esModule: true,
  default: {
    checkSessionValidity: jest.fn().mockReturnValue({ valid: true }),
    cleanupSession: jest.fn(),
    recordActivity: jest.fn(),
  },
}));

// Mock auditService
jest.mock("../services/auditService", () => ({
  __esModule: true,
  default: {
    log: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock logService
jest.mock("../services/logService", () => ({
  __esModule: true,
  default: {
    info: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock failureLogService
jest.mock("../services/failureLogService", () => ({
  __esModule: true,
  default: {
    logFailure: jest.fn().mockResolvedValue(undefined),
    getRecentFailures: jest.fn().mockResolvedValue([]),
  },
}));

// Mock syncHandlers
jest.mock("../handlers/syncHandlers", () => ({
  setSyncUserId: jest.fn(),
}));

// Mock wrapHandler to pass through handler directly
jest.mock("../utils/wrapHandler", () => ({
  wrapHandler: (fn: (...args: unknown[]) => unknown) => fn,
}));

// Mock redactSensitive
jest.mock("../utils/redactSensitive", () => ({
  redactEmail: jest.fn((email: string) => email.replace(/(.{2}).*(@.*)/, "$1***$2")),
}));

// Import after mocks
import { registerSessionHandlers } from "../handlers/sessionHandlers";
import {
  SESSION_TOKEN_MIN_LENGTH,
  SESSION_TOKEN_MAX_LENGTH,
} from "../utils/validation";

describe("Session Token Corruption Recovery (TASK-2280)", () => {
  let handlers: Record<string, (...args: unknown[]) => Promise<unknown>>;

  beforeAll(() => {
    registerSessionHandlers();

    // Collect registered IPC handlers
    handlers = {};
    for (const call of mockIpcHandle.mock.calls) {
      handlers[call[0] as string] = call[1] as (...args: unknown[]) => Promise<unknown>;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleLogout with corrupted token", () => {
    it("should clear session and return success when token has invalid length (too short)", async () => {
      const corruptedToken = "abc"; // Way too short (< 20)

      const result = await handlers["auth:logout"]({} as Electron.IpcMainInvokeEvent, corruptedToken);

      expect(result).toEqual({ success: true });
      expect(mockClearSession).toHaveBeenCalled();
    });

    it("should clear session and return success when token has invalid length (too long)", async () => {
      const corruptedToken = "x".repeat(250); // Way too long (> 200)

      const result = await handlers["auth:logout"]({} as Electron.IpcMainInvokeEvent, corruptedToken);

      expect(result).toEqual({ success: true });
      expect(mockClearSession).toHaveBeenCalled();
    });

    it("should log Sentry warning with corruption context (no PII)", async () => {
      const corruptedToken = "short";

      await handlers["auth:logout"]({} as Electron.IpcMainInvokeEvent, corruptedToken);

      expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
        "Session token corruption detected",
        expect.objectContaining({
          level: "warning",
          tags: expect.objectContaining({
            component: "session",
            recovery: "auto_clear",
            operation: "handleLogout",
          }),
          extra: expect.objectContaining({
            tokenLength: 5,
            expectedMinLength: SESSION_TOKEN_MIN_LENGTH,
            expectedMaxLength: SESSION_TOKEN_MAX_LENGTH,
            platform: process.platform,
          }),
        }),
      );
    });

    it("should NOT include the actual token value in Sentry event", async () => {
      const corruptedToken = "secret-token-value";

      await handlers["auth:logout"]({} as Electron.IpcMainInvokeEvent, corruptedToken);

      // Check that captureMessage was called
      expect(mockSentryCaptureMessage).toHaveBeenCalled();

      // Verify the actual token value is NOT in the Sentry call args
      const sentryCallArgs = JSON.stringify(mockSentryCaptureMessage.mock.calls);
      expect(sentryCallArgs).not.toContain("secret-token-value");
    });

    it("should still work normally with valid tokens", async () => {
      const validToken = "a".repeat(50); // Valid length (20-200)

      mockDbValidateSession.mockResolvedValue({
        id: "user-123",
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      });

      const result = await handlers["auth:logout"]({} as Electron.IpcMainInvokeEvent, validToken);

      expect(result).toEqual({ success: true });
      // For valid tokens, clearSession is called as part of normal logout flow
      expect(mockClearSession).toHaveBeenCalled();
      // But Sentry captureMessage for corruption should NOT have been called
      expect(mockSentryCaptureMessage).not.toHaveBeenCalledWith(
        "Session token corruption detected",
        expect.anything(),
      );
    });
  });

  describe("handleValidateSession with corrupted token", () => {
    it("should clear session and return valid=false without error when token is corrupted", async () => {
      const corruptedToken = "too-short";

      const result = await handlers["auth:validate-session"]({} as Electron.IpcMainInvokeEvent, corruptedToken);

      expect(result).toEqual({ success: false, valid: false });
      // No error message -- renderer will treat this as "no session" and show login
      expect((result as { error?: string }).error).toBeUndefined();
      expect(mockClearSession).toHaveBeenCalled();
    });

    it("should log Sentry warning with corruption context for validate-session", async () => {
      const corruptedToken = "x".repeat(300); // Too long

      await handlers["auth:validate-session"]({} as Electron.IpcMainInvokeEvent, corruptedToken);

      expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
        "Session token corruption detected",
        expect.objectContaining({
          level: "warning",
          tags: expect.objectContaining({
            component: "session",
            recovery: "auto_clear",
            operation: "handleValidateSession",
          }),
          extra: expect.objectContaining({
            tokenLength: 300,
            expectedMinLength: SESSION_TOKEN_MIN_LENGTH,
            expectedMaxLength: SESSION_TOKEN_MAX_LENGTH,
            platform: process.platform,
          }),
        }),
      );
    });

    it("should still validate normal tokens correctly", async () => {
      const validToken = "b".repeat(36); // Valid UUID-like length

      mockDbValidateSession.mockResolvedValue({
        id: "user-456",
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      });

      const result = await handlers["auth:validate-session"]({} as Electron.IpcMainInvokeEvent, validToken);

      expect(result).toEqual(
        expect.objectContaining({ success: true, valid: true }),
      );
      // Corruption recovery should NOT have been triggered
      expect(mockSentryCaptureMessage).not.toHaveBeenCalledWith(
        "Session token corruption detected",
        expect.anything(),
      );
    });
  });

  describe("Missing session file treated as not-logged-in", () => {
    it("should treat missing session as redirect-to-login (not error) in validate-session", async () => {
      // When session file is gone after corruption recovery, subsequent
      // validate-session calls with no token should return not-valid
      const result = await handlers["auth:validate-session"](
        {} as Electron.IpcMainInvokeEvent,
        null, // No token available (session was cleared)
      );

      // Should return a failure/invalid response, not throw
      expect(result).toBeDefined();
      expect((result as { valid?: boolean }).valid).toBeFalsy();
    });
  });
});
