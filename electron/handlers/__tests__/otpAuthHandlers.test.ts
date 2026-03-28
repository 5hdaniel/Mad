/**
 * OTP Authentication Handlers Tests
 * TASK-1337: Tests for OTP send/verify code handlers
 */

// Mock all dependencies before imports
jest.mock("../../services/databaseService", () => ({
  __esModule: true,
  default: {
    isInitialized: jest.fn(),
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    updateLastLogin: jest.fn(),
    getUserById: jest.fn(),
    createSession: jest.fn(),
  },
}));

jest.mock("../../services/supabaseService", () => ({
  __esModule: true,
  default: {
    getClient: jest.fn(),
    syncUser: jest.fn(),
    validateSubscription: jest.fn(),
    trackEvent: jest.fn(),
  },
}));

jest.mock("../../services/sessionService", () => ({
  __esModule: true,
  default: {
    saveSession: jest.fn(),
    getSessionExpirationMs: jest.fn().mockReturnValue(86400000),
  },
}));

jest.mock("../../services/rateLimitService", () => ({
  __esModule: true,
  default: {
    checkRateLimit: jest.fn(),
    recordAttempt: jest.fn(),
  },
}));

jest.mock("../../services/auditService", () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
  },
}));

jest.mock("../../services/logService", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../services/licenseService", () => ({
  validateLicense: jest.fn(),
  createUserLicense: jest.fn(),
}));

jest.mock("../../services/deviceService", () => ({
  registerDevice: jest.fn(),
  getDeviceId: jest.fn().mockReturnValue("stable-machine-id-123"),
}));

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
  BrowserWindow: jest.fn(),
  app: { getVersion: jest.fn().mockReturnValue("2.13.0") },
}));

// Import after mocks
import { handleOtpSendCode, handleOtpVerifyCode } from "../otpAuthHandlers";
import supabaseService from "../../services/supabaseService";
import databaseService from "../../services/databaseService";
import rateLimitService from "../../services/rateLimitService";
import sessionService from "../../services/sessionService";
import { validateLicense, createUserLicense } from "../../services/licenseService";
import { registerDevice } from "../../services/deviceService";

// Type helpers
const mockSupabaseService = supabaseService as jest.Mocked<typeof supabaseService>;
const mockDatabaseService = databaseService as jest.Mocked<typeof databaseService>;
const mockRateLimitService = rateLimitService as jest.Mocked<typeof rateLimitService>;
const mockSessionService = sessionService as jest.Mocked<typeof sessionService>;
const mockValidateLicense = validateLicense as jest.Mock;
const mockCreateUserLicense = createUserLicense as jest.Mock;
const mockRegisterDevice = registerDevice as jest.Mock;

// Shared mock event
const mockEvent = {} as Electron.IpcMainInvokeEvent;

describe("OTP Auth Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: rate limiting allows
    mockRateLimitService.checkRateLimit.mockResolvedValue({ allowed: true, remainingAttempts: 5 });
  });

  // ==========================================
  // handleOtpSendCode
  // ==========================================
  describe("handleOtpSendCode", () => {
    it("sends OTP code successfully for valid email", async () => {
      const mockAuth = {
        signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseService.getClient.mockReturnValue({
        auth: mockAuth,
      } as ReturnType<typeof supabaseService.getClient>);

      const result = await handleOtpSendCode(mockEvent, "test@example.com");

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
        email: "test@example.com",
      });
    });

    it("rejects invalid email format", async () => {
      const result = await handleOtpSendCode(mockEvent, "not-an-email");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("rejects empty email", async () => {
      const result = await handleOtpSendCode(mockEvent, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("returns error when rate limited", async () => {
      mockRateLimitService.checkRateLimit.mockResolvedValue({ allowed: false, remainingAttempts: 0 });

      const result = await handleOtpSendCode(mockEvent, "test@example.com");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many attempts");
    });

    it("returns error when Supabase signInWithOtp fails", async () => {
      const mockAuth = {
        signInWithOtp: jest.fn().mockResolvedValue({
          error: { message: "Email sending failed", status: 500 },
        }),
      };
      mockSupabaseService.getClient.mockReturnValue({
        auth: mockAuth,
      } as ReturnType<typeof supabaseService.getClient>);

      const result = await handleOtpSendCode(mockEvent, "test@example.com");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email sending failed");
    });

    it("returns rate limit message for Supabase 429 errors", async () => {
      const mockAuth = {
        signInWithOtp: jest.fn().mockResolvedValue({
          error: { message: "rate limit exceeded", status: 429 },
        }),
      };
      mockSupabaseService.getClient.mockReturnValue({
        auth: mockAuth,
      } as ReturnType<typeof supabaseService.getClient>);

      const result = await handleOtpSendCode(mockEvent, "test@example.com");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many requests");
    });
  });

  // ==========================================
  // handleOtpVerifyCode
  // ==========================================
  describe("handleOtpVerifyCode", () => {
    const mockUser = {
      id: "user-uuid-123",
      email: "test@example.com",
      display_name: "Test User",
      is_active: true,
      subscription_tier: "free" as const,
      subscription_status: "trial" as const,
      terms_accepted_at: "2024-01-01T00:00:00Z",
      terms_version_accepted: "1.0",
      privacy_policy_version_accepted: "1.0",
    };

    const mockSession = {
      access_token: "access-token-123",
      refresh_token: "refresh-token-456",
      expires_at: Date.now() + 3600,
      user: {
        id: "user-uuid-123",
        email: "test@example.com",
        user_metadata: { full_name: "Test User" },
        app_metadata: {},
      },
    };

    const mockCloudUser = {
      id: "user-uuid-123",
      email: "test@example.com",
      subscription_tier: "free",
      subscription_status: "trial",
    };

    const setupSuccessfulVerification = () => {
      const mockAuth = {
        verifyOtp: jest.fn().mockResolvedValue({
          data: {
            session: mockSession,
            user: mockSession.user,
          },
          error: null,
        }),
      };
      mockSupabaseService.getClient.mockReturnValue({
        auth: mockAuth,
      } as ReturnType<typeof supabaseService.getClient>);

      mockValidateLicense.mockResolvedValue({
        isValid: true,
        licenseType: "trial",
        transactionCount: 0,
        transactionLimit: 5,
        canCreateTransaction: true,
        deviceCount: 1,
        deviceLimit: 1,
        aiEnabled: false,
      });

      mockRegisterDevice.mockResolvedValue({ success: true, device: { id: "device-1" } });
      mockSupabaseService.syncUser.mockResolvedValue(mockCloudUser as ReturnType<typeof supabaseService.syncUser> extends Promise<infer T> ? T : never);
      mockDatabaseService.isInitialized.mockReturnValue(true);
      mockDatabaseService.getUserByEmail.mockResolvedValue(null);
      mockDatabaseService.createUser.mockResolvedValue(mockUser);
      mockDatabaseService.updateLastLogin.mockResolvedValue(undefined);
      mockDatabaseService.getUserById.mockResolvedValue(mockUser);
      mockDatabaseService.createSession.mockResolvedValue("session-token-789");
      mockSessionService.saveSession.mockResolvedValue(undefined);
      mockSupabaseService.validateSubscription.mockResolvedValue({
        tier: "free",
        status: "trial",
      } as ReturnType<typeof supabaseService.validateSubscription> extends Promise<infer T> ? T : never);
      mockSupabaseService.trackEvent.mockResolvedValue(undefined);

      return mockAuth;
    };

    it("verifies OTP code and completes login for new user", async () => {
      setupSuccessfulVerification();

      const result = await handleOtpVerifyCode(mockEvent, "test@example.com", "123456");

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.sessionToken).toBe("session-token-789");
      expect(result.subscription).toBeDefined();
    });

    it("verifies OTP code and completes login for existing user", async () => {
      const mockAuth = setupSuccessfulVerification();
      // Return existing user from getUserByEmail
      mockDatabaseService.getUserByEmail.mockResolvedValue(mockUser);

      const result = await handleOtpVerifyCode(mockEvent, "test@example.com", "123456");

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      // Should not create a new user
      expect(mockDatabaseService.createUser).not.toHaveBeenCalled();
      // Should update existing user
      expect(mockDatabaseService.updateUser).toHaveBeenCalled();
    });

    it("returns error for empty token", async () => {
      const result = await handleOtpVerifyCode(mockEvent, "test@example.com", "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Verification code is required");
    });

    it("returns error for invalid email", async () => {
      const result = await handleOtpVerifyCode(mockEvent, "bad-email", "123456");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("rejects non-6-digit OTP codes", async () => {
      const result1 = await handleOtpVerifyCode(mockEvent, "test@example.com", "12345");
      expect(result1.success).toBe(false);
      expect(result1.error).toContain("6 digits");

      const result2 = await handleOtpVerifyCode(mockEvent, "test@example.com", "1234567");
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("6 digits");

      const result3 = await handleOtpVerifyCode(mockEvent, "test@example.com", "abcdef");
      expect(result3.success).toBe(false);
      expect(result3.error).toContain("6 digits");
    });

    it("returns user-friendly error for expired code", async () => {
      const mockAuth = {
        verifyOtp: jest.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: { message: "Token has expired or is invalid" },
        }),
      };
      mockSupabaseService.getClient.mockReturnValue({
        auth: mockAuth,
      } as ReturnType<typeof supabaseService.getClient>);

      const result = await handleOtpVerifyCode(mockEvent, "test@example.com", "123456");

      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("returns user-friendly error for invalid token", async () => {
      const mockAuth = {
        verifyOtp: jest.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: { message: "Token is invalid" },
        }),
      };
      mockSupabaseService.getClient.mockReturnValue({
        auth: mockAuth,
      } as ReturnType<typeof supabaseService.getClient>);

      const result = await handleOtpVerifyCode(mockEvent, "test@example.com", "999999");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid verification code");
    });

    it("returns error when license is blocked", async () => {
      const mockAuth = {
        verifyOtp: jest.fn().mockResolvedValue({
          data: { session: mockSession, user: mockSession.user },
          error: null,
        }),
      };
      mockSupabaseService.getClient.mockReturnValue({
        auth: mockAuth,
      } as ReturnType<typeof supabaseService.getClient>);

      // Pipeline steps before license check (sync user -> create local user)
      mockSupabaseService.syncUser.mockResolvedValue(mockCloudUser as ReturnType<typeof supabaseService.syncUser> extends Promise<infer T> ? T : never);
      mockDatabaseService.isInitialized.mockReturnValue(true);
      mockDatabaseService.getUserByEmail.mockResolvedValue(null);
      mockDatabaseService.createUser.mockResolvedValue(mockUser);
      mockDatabaseService.updateLastLogin.mockResolvedValue(undefined);
      mockDatabaseService.getUserById.mockResolvedValue(mockUser);

      mockValidateLicense.mockResolvedValue({
        isValid: false,
        licenseType: "trial",
        blockReason: "expired",
        transactionCount: 0,
        transactionLimit: 5,
        canCreateTransaction: false,
        deviceCount: 0,
        deviceLimit: 1,
        aiEnabled: false,
      });

      const result = await handleOtpVerifyCode(mockEvent, "test@example.com", "123456");

      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("returns error when device limit reached", async () => {
      const mockAuth = {
        verifyOtp: jest.fn().mockResolvedValue({
          data: { session: mockSession, user: mockSession.user },
          error: null,
        }),
      };
      mockSupabaseService.getClient.mockReturnValue({
        auth: mockAuth,
      } as ReturnType<typeof supabaseService.getClient>);

      // Pipeline steps before device registration (sync user -> create local user -> license)
      mockSupabaseService.syncUser.mockResolvedValue(mockCloudUser as ReturnType<typeof supabaseService.syncUser> extends Promise<infer T> ? T : never);
      mockDatabaseService.isInitialized.mockReturnValue(true);
      mockDatabaseService.getUserByEmail.mockResolvedValue(null);
      mockDatabaseService.createUser.mockResolvedValue(mockUser);
      mockDatabaseService.updateLastLogin.mockResolvedValue(undefined);
      mockDatabaseService.getUserById.mockResolvedValue(mockUser);

      mockValidateLicense.mockResolvedValue({
        isValid: true,
        licenseType: "trial",
        transactionCount: 0,
        transactionLimit: 5,
        canCreateTransaction: true,
        deviceCount: 1,
        deviceLimit: 1,
        aiEnabled: false,
      });

      mockRegisterDevice.mockResolvedValue({
        success: false,
        error: "device_limit_reached",
      });

      const result = await handleOtpVerifyCode(mockEvent, "test@example.com", "123456");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Device limit");
    });

    it("creates trial license for new users with no_license", async () => {
      const mockAuth = {
        verifyOtp: jest.fn().mockResolvedValue({
          data: { session: mockSession, user: mockSession.user },
          error: null,
        }),
      };
      mockSupabaseService.getClient.mockReturnValue({
        auth: mockAuth,
      } as ReturnType<typeof supabaseService.getClient>);

      mockValidateLicense.mockResolvedValue({
        isValid: false,
        licenseType: "trial",
        blockReason: "no_license",
        transactionCount: 0,
        transactionLimit: 5,
        canCreateTransaction: true,
        deviceCount: 0,
        deviceLimit: 1,
        aiEnabled: false,
      });
      mockCreateUserLicense.mockResolvedValue({
        isValid: true,
        licenseType: "trial",
        transactionCount: 0,
        transactionLimit: 5,
        canCreateTransaction: true,
        deviceCount: 0,
        deviceLimit: 1,
        aiEnabled: false,
      });

      mockRegisterDevice.mockResolvedValue({ success: true });
      mockSupabaseService.syncUser.mockResolvedValue(mockCloudUser as ReturnType<typeof supabaseService.syncUser> extends Promise<infer T> ? T : never);
      mockDatabaseService.isInitialized.mockReturnValue(true);
      mockDatabaseService.getUserByEmail.mockResolvedValue(null);
      mockDatabaseService.createUser.mockResolvedValue(mockUser);
      mockDatabaseService.updateLastLogin.mockResolvedValue(undefined);
      mockDatabaseService.getUserById.mockResolvedValue(mockUser);
      mockDatabaseService.createSession.mockResolvedValue("session-token");
      mockSessionService.saveSession.mockResolvedValue(undefined);
      mockSupabaseService.validateSubscription.mockResolvedValue({
        tier: "free",
        status: "trial",
      } as ReturnType<typeof supabaseService.validateSubscription> extends Promise<infer T> ? T : never);
      mockSupabaseService.trackEvent.mockResolvedValue(undefined);

      const result = await handleOtpVerifyCode(mockEvent, "test@example.com", "123456");

      expect(result.success).toBe(true);
      expect(mockCreateUserLicense).toHaveBeenCalledWith("user-uuid-123");
    });

    it("records failed attempt on verification failure", async () => {
      const mockAuth = {
        verifyOtp: jest.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: { message: "Invalid token" },
        }),
      };
      mockSupabaseService.getClient.mockReturnValue({
        auth: mockAuth,
      } as ReturnType<typeof supabaseService.getClient>);

      await handleOtpVerifyCode(mockEvent, "test@example.com", "999999");

      expect(mockRateLimitService.recordAttempt).toHaveBeenCalledWith(
        "test@example.com",
        false,
      );
    });
  });
});
