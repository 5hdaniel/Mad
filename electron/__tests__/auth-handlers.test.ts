/**
 * Unit tests for Auth Handlers
 * Tests authentication IPC handlers including:
 * - Google and Microsoft login flows
 * - Session management
 * - Terms acceptance
 * - Logout
 */

import type { IpcMainInvokeEvent } from 'electron';

// Mock electron module - must be defined before jest.mock for hoisting
const mockIpcHandle = jest.fn();
const mockShellOpenExternal = jest.fn();

jest.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
  app: {
    getVersion: jest.fn().mockReturnValue('1.0.0'),
  },
  shell: {
    openExternal: mockShellOpenExternal,
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    close: jest.fn(),
    on: jest.fn(), // For 'closed' event listener
    isDestroyed: jest.fn().mockReturnValue(false),
    webContents: {
      on: jest.fn(),
      send: jest.fn(),
      session: {
        webRequest: {
          onHeadersReceived: jest.fn(),
        },
      },
    },
  })),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid'),
}));

// Mock os
jest.mock('os', () => ({
  hostname: jest.fn().mockReturnValue('test-host'),
  platform: jest.fn().mockReturnValue('darwin'),
  release: jest.fn().mockReturnValue('21.0.0'),
}));

// Mock services with inline factories (hoisting-safe)
jest.mock('../services/databaseService', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getUserByOAuthId: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    updateLastLogin: jest.fn(),
    getUserById: jest.fn(),
    saveOAuthToken: jest.fn(),
    createSession: jest.fn(),
    validateSession: jest.fn(),
    deleteSession: jest.fn(),
    acceptTerms: jest.fn(),
  },
}));

jest.mock('../services/googleAuthService', () => ({
  __esModule: true,
  default: {
    authenticateForLogin: jest.fn(),
    authenticateForMailbox: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
    getUserInfo: jest.fn(),
    stopLocalServer: jest.fn(),
    resolveCodeDirectly: jest.fn(),
    rejectCodeDirectly: jest.fn(),
  },
}));

jest.mock('../services/microsoftAuthService', () => ({
  __esModule: true,
  default: {
    authenticateForLogin: jest.fn(),
    authenticateForMailbox: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
    getUserInfo: jest.fn(),
    stopLocalServer: jest.fn(),
    resolveCodeDirectly: jest.fn(),
    rejectCodeDirectly: jest.fn(),
  },
}));

jest.mock('../services/supabaseService', () => ({
  __esModule: true,
  default: {
    syncUser: jest.fn(),
    validateSubscription: jest.fn(),
    registerDevice: jest.fn(),
    trackEvent: jest.fn(),
    syncTermsAcceptance: jest.fn(),
  },
}));

jest.mock('../services/tokenEncryptionService', () => ({
  __esModule: true,
  default: {
    encrypt: jest.fn().mockReturnValue('encrypted-token'),
  },
}));

jest.mock('../services/sessionService', () => ({
  __esModule: true,
  default: {
    saveSession: jest.fn(),
    loadSession: jest.fn(),
    clearSession: jest.fn(),
    getSessionExpirationMs: jest.fn().mockReturnValue(86400000),
  },
}));

jest.mock('../services/rateLimitService', () => ({
  __esModule: true,
  default: {
    recordAttempt: jest.fn(),
  },
}));

jest.mock('../services/sessionSecurityService', () => ({
  __esModule: true,
  default: {
    checkSessionValidity: jest.fn(),
    recordActivity: jest.fn(),
    cleanupSession: jest.fn(),
  },
}));

jest.mock('../services/auditService', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    log: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/logService', () => ({
  __esModule: true,
  default: {
    info: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocks are set up
import { registerAuthHandlers, initializeDatabase } from '../auth-handlers';
import databaseService from '../services/databaseService';
import googleAuthService from '../services/googleAuthService';
import microsoftAuthService from '../services/microsoftAuthService';
import supabaseService from '../services/supabaseService';
import sessionService from '../services/sessionService';
import sessionSecurityService from '../services/sessionSecurityService';
import auditService from '../services/auditService';
import logService from '../services/logService';

// Get typed references to mocked services
const mockDatabaseService = databaseService as jest.Mocked<typeof databaseService>;
const mockGoogleAuthService = googleAuthService as jest.Mocked<typeof googleAuthService>;
const mockMicrosoftAuthService = microsoftAuthService as jest.Mocked<typeof microsoftAuthService>;
const mockSupabaseService = supabaseService as jest.Mocked<typeof supabaseService>;
const mockSessionService = sessionService as jest.Mocked<typeof sessionService>;
const mockSessionSecurityService = sessionSecurityService as jest.Mocked<typeof sessionSecurityService>;
const mockAuditService = auditService as jest.Mocked<typeof auditService>;
const mockLogService = logService as jest.Mocked<typeof logService>;

// Test UUIDs
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_SESSION_TOKEN = '550e8400-e29b-41d4-a716-446655440001-session-token';

describe('Auth Handlers', () => {
  let registeredHandlers: Map<string, Function>;
  const mockEvent = {} as IpcMainInvokeEvent;
  const mockMainWindow = {
    isDestroyed: jest.fn().mockReturnValue(false),
    webContents: {
      send: jest.fn(),
    },
  };

  beforeAll(() => {
    // Capture registered handlers
    registeredHandlers = new Map();
    mockIpcHandle.mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    // Register all handlers
    registerAuthHandlers(mockMainWindow as any);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeDatabase', () => {
    it('should initialize database and audit service', async () => {
      await initializeDatabase();

      expect(mockDatabaseService.initialize).toHaveBeenCalledTimes(1);
      expect(mockAuditService.initialize).toHaveBeenCalledWith(
        mockDatabaseService,
        mockSupabaseService
      );
      expect(mockLogService.info).toHaveBeenCalledWith(
        'Database initialized',
        'AuthHandlers'
      );
    });

    it('should handle database initialization failure', async () => {
      mockDatabaseService.initialize.mockRejectedValueOnce(new Error('DB init failed'));

      await expect(initializeDatabase()).rejects.toThrow('DB init failed');
      expect(mockLogService.error).toHaveBeenCalled();
    });
  });

  describe('auth:google:login', () => {
    it('should return auth URL on successful login start and open popup', async () => {
      // Mock codePromise that never resolves (we just test the initial response)
      const codePromise = new Promise<string>(() => {});
      mockGoogleAuthService.authenticateForLogin.mockResolvedValue({
        authUrl: 'https://accounts.google.com/oauth',
        codePromise,
        scopes: ['email', 'profile'],
      });

      const handler = registeredHandlers.get('auth:google:login');
      const result = await handler(mockEvent);

      expect(result.success).toBe(true);
      expect(result.authUrl).toBe('https://accounts.google.com/oauth');
      expect(result.scopes).toEqual(['email', 'profile']);
      // Verify BrowserWindow was created for popup
      expect(require('electron').BrowserWindow).toHaveBeenCalled();
    });

    it('should handle Google login failure', async () => {
      mockGoogleAuthService.authenticateForLogin.mockRejectedValue(
        new Error('Network error')
      );

      const handler = registeredHandlers.get('auth:google:login');
      const result = await handler(mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(mockLogService.error).toHaveBeenCalled();
    });

    it('should call stopLocalServer when popup is closed before auth completes', async () => {
      const codePromise = new Promise<string>(() => {});
      mockGoogleAuthService.authenticateForLogin.mockResolvedValue({
        authUrl: 'https://accounts.google.com/oauth',
        codePromise,
        scopes: ['email', 'profile'],
      });

      const handler = registeredHandlers.get('auth:google:login');
      await handler(mockEvent);

      // Get the BrowserWindow mock instance
      const BrowserWindow = require('electron').BrowserWindow;
      const mockWindowInstance = BrowserWindow.mock.results[BrowserWindow.mock.results.length - 1]?.value;

      // Simulate window close by calling the 'closed' event handler
      const closedHandler = mockWindowInstance?.on.mock.calls.find(
        (call: [string, () => void]) => call[0] === 'closed'
      )?.[1];

      if (closedHandler) {
        closedHandler();
        expect(mockGoogleAuthService.stopLocalServer).toHaveBeenCalled();
      }
    });
  });

  describe('auth:google:complete-login', () => {
    const mockTokens = {
      access_token: 'access-token-123',
      refresh_token: 'refresh-token-456',
      expires_at: '2025-12-31T23:59:59Z',
      scopes: ['email', 'profile'],
    };

    const mockUserInfo = {
      id: 'google-user-id',
      email: 'test@example.com',
      given_name: 'Test',
      family_name: 'User',
      name: 'Test User',
      picture: 'https://example.com/avatar.png',
    };

    const mockCloudUser = {
      id: 'cloud-user-id',
      subscription_tier: 'pro',
      subscription_status: 'active',
      trial_ends_at: null,
    };

    const mockLocalUser = {
      id: TEST_USER_ID,
      email: 'test@example.com',
      terms_accepted_at: null,
    };

    beforeEach(() => {
      mockGoogleAuthService.exchangeCodeForTokens.mockResolvedValue({
        tokens: mockTokens,
        userInfo: mockUserInfo,
      });
      mockSupabaseService.syncUser.mockResolvedValue(mockCloudUser);
      mockDatabaseService.getUserByOAuthId.mockResolvedValue(null);
      mockDatabaseService.createUser.mockResolvedValue(mockLocalUser);
      mockDatabaseService.getUserById.mockResolvedValue(mockLocalUser);
      mockDatabaseService.createSession.mockResolvedValue('session-token-123');
      mockSupabaseService.validateSubscription.mockResolvedValue({ tier: 'pro' });
    });

    it('should complete Google login for new user', async () => {
      const handler = registeredHandlers.get('auth:google:complete-login');
      const result = await handler(mockEvent, 'valid-auth-code');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.sessionToken).toBe('session-token-123');
      expect(result.isNewUser).toBe(true);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          success: true,
        })
      );
    });

    it('should complete Google login for existing user', async () => {
      const existingUser = {
        ...mockLocalUser,
        terms_accepted_at: new Date().toISOString(),
      };
      mockDatabaseService.getUserByOAuthId.mockResolvedValue(existingUser);
      mockDatabaseService.getUserById.mockResolvedValue(existingUser);

      const handler = registeredHandlers.get('auth:google:complete-login');
      const result = await handler(mockEvent, 'valid-auth-code');

      expect(result.success).toBe(true);
      expect(mockDatabaseService.updateUser).toHaveBeenCalled();
      expect(mockDatabaseService.createUser).not.toHaveBeenCalled();
    });

    it('should handle invalid auth code', async () => {
      const handler = registeredHandlers.get('auth:google:complete-login');
      const result = await handler(mockEvent, '');

      expect(result.success).toBe(false);
      // handleGoogleCompleteLogin doesn't wrap ValidationError, returns error.message directly
      expect(result.error).toContain('Authorization code');
    });

    it('should log audit event on failed login', async () => {
      mockGoogleAuthService.exchangeCodeForTokens.mockRejectedValue(
        new Error('Token exchange failed')
      );

      const handler = registeredHandlers.get('auth:google:complete-login');
      const result = await handler(mockEvent, 'invalid-code');

      expect(result.success).toBe(false);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          success: false,
        })
      );
    });
  });

  describe('auth:google:connect-mailbox', () => {
    const mockUser = {
      id: TEST_USER_ID,
      email: 'test@example.com',
    };

    beforeEach(() => {
      mockDatabaseService.getUserById.mockResolvedValue(mockUser);
      mockGoogleAuthService.authenticateForMailbox.mockResolvedValue({
        authUrl: 'https://accounts.google.com/oauth/mailbox',
        codePromise: new Promise(() => {}), // Never resolves in test
        scopes: ['gmail.readonly'],
      });
    });

    it('should start mailbox connection flow', async () => {
      const handler = registeredHandlers.get('auth:google:connect-mailbox');
      const result = await handler(mockEvent, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.authUrl).toBe('https://accounts.google.com/oauth/mailbox');
      expect(result.scopes).toContain('gmail.readonly');
    });

    it('should handle invalid user ID', async () => {
      const handler = registeredHandlers.get('auth:google:connect-mailbox');
      const result = await handler(mockEvent, '');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('auth:microsoft:login', () => {
    it('should return auth URL on successful login start', async () => {
      mockMicrosoftAuthService.authenticateForLogin.mockResolvedValue({
        authUrl: 'https://login.microsoftonline.com/oauth',
        codePromise: new Promise(() => {}),
        codeVerifier: 'verifier-123',
        scopes: ['User.Read'],
      });

      const handler = registeredHandlers.get('auth:microsoft:login');
      const result = await handler(mockEvent);

      expect(result.success).toBe(true);
      expect(result.authUrl).toContain('microsoftonline');
      expect(result.scopes).toContain('User.Read');
    });

    it('should handle Microsoft login failure', async () => {
      mockMicrosoftAuthService.authenticateForLogin.mockRejectedValue(
        new Error('Auth initialization failed')
      );

      const handler = registeredHandlers.get('auth:microsoft:login');
      const result = await handler(mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Auth initialization failed');
    });

    it('should log each step of the authentication flow', async () => {
      mockMicrosoftAuthService.authenticateForLogin.mockResolvedValue({
        authUrl: 'https://login.microsoftonline.com/oauth',
        codePromise: new Promise(() => {}),
        codeVerifier: 'verifier-123',
        scopes: ['User.Read'],
      });

      const handler = registeredHandlers.get('auth:microsoft:login');
      await handler(mockEvent);

      // Verify initial logging happens
      expect(mockLogService.info).toHaveBeenCalledWith(
        'Starting Microsoft login flow with redirect',
        'AuthHandlers'
      );
      expect(mockLogService.info).toHaveBeenCalledWith(
        'Opening auth URL in popup window',
        'AuthHandlers'
      );
    });
  });

  describe('auth:microsoft:connect-mailbox', () => {
    beforeEach(() => {
      mockDatabaseService.getUserById.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
      });
      mockMicrosoftAuthService.authenticateForMailbox.mockResolvedValue({
        authUrl: 'https://login.microsoftonline.com/oauth/mailbox',
        codePromise: new Promise(() => {}),
        codeVerifier: 'verifier-123',
        scopes: ['Mail.Read'],
      });
    });

    it('should start Microsoft mailbox connection flow', async () => {
      const handler = registeredHandlers.get('auth:microsoft:connect-mailbox');
      const result = await handler(mockEvent, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.authUrl).toContain('microsoftonline');
    });

    it('should handle invalid user ID', async () => {
      const handler = registeredHandlers.get('auth:microsoft:connect-mailbox');
      const result = await handler(mockEvent, '');

      expect(result.success).toBe(false);
    });
  });

  describe('auth:logout', () => {
    beforeEach(() => {
      mockDatabaseService.validateSession.mockResolvedValue({
        user_id: TEST_USER_ID,
      });
    });

    it('should logout user successfully', async () => {
      const handler = registeredHandlers.get('auth:logout');
      const result = await handler(mockEvent, TEST_SESSION_TOKEN);

      expect(result.success).toBe(true);
      expect(mockDatabaseService.deleteSession).toHaveBeenCalledWith(TEST_SESSION_TOKEN);
      expect(mockSessionService.clearSession).toHaveBeenCalled();
      expect(mockSessionSecurityService.cleanupSession).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGOUT',
          success: true,
        })
      );
    });

    it('should handle invalid session token', async () => {
      const handler = registeredHandlers.get('auth:logout');
      const result = await handler(mockEvent, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle logout failure gracefully', async () => {
      mockDatabaseService.deleteSession.mockRejectedValue(new Error('DB error'));

      const handler = registeredHandlers.get('auth:logout');
      const result = await handler(mockEvent, TEST_SESSION_TOKEN);

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
    });
  });

  describe('auth:accept-terms', () => {
    it('should accept terms successfully', async () => {
      const updatedUser = {
        id: TEST_USER_ID,
        terms_accepted_at: new Date().toISOString(),
      };
      mockDatabaseService.acceptTerms.mockResolvedValue(updatedUser);
      mockSupabaseService.syncTermsAcceptance.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('auth:accept-terms');
      const result = await handler(mockEvent, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(mockLogService.info).toHaveBeenCalled();
    });

    it('should handle Supabase sync failure gracefully', async () => {
      mockDatabaseService.acceptTerms.mockResolvedValue({ id: TEST_USER_ID });
      mockSupabaseService.syncTermsAcceptance.mockRejectedValue(new Error('Sync failed'));

      const handler = registeredHandlers.get('auth:accept-terms');
      const result = await handler(mockEvent, TEST_USER_ID);

      // Should still succeed even if sync fails
      expect(result.success).toBe(true);
      expect(mockLogService.warn).toHaveBeenCalled();
    });

    it('should handle invalid user ID', async () => {
      const handler = registeredHandlers.get('auth:accept-terms');
      const result = await handler(mockEvent, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });
  });

  describe('auth:validate-session', () => {
    const mockSession = {
      user_id: TEST_USER_ID,
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
    };

    beforeEach(() => {
      mockDatabaseService.validateSession.mockResolvedValue(mockSession);
      mockSessionSecurityService.checkSessionValidity.mockResolvedValue({
        valid: true,
      });
    });

    it('should validate session successfully', async () => {
      const handler = registeredHandlers.get('auth:validate-session');
      const result = await handler(mockEvent, TEST_SESSION_TOKEN);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(mockSessionSecurityService.recordActivity).toHaveBeenCalled();
    });

    it('should return invalid for non-existent session', async () => {
      mockDatabaseService.validateSession.mockResolvedValue(null);

      const handler = registeredHandlers.get('auth:validate-session');
      const result = await handler(mockEvent, TEST_SESSION_TOKEN);

      expect(result.success).toBe(false);
      expect(result.valid).toBe(false);
    });

    it('should clean up expired session', async () => {
      // Reset deleteSession mock to resolve (it might be set to reject from previous tests)
      mockDatabaseService.deleteSession.mockResolvedValue(undefined);
      mockSessionSecurityService.checkSessionValidity.mockResolvedValue({
        valid: false,
        reason: 'expired',
      });

      const handler = registeredHandlers.get('auth:validate-session');
      const result = await handler(mockEvent, TEST_SESSION_TOKEN);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session expired');
      expect(mockDatabaseService.deleteSession).toHaveBeenCalled();
      // sessionSecurityService.cleanupSession is a sync function, verify it was called
      expect(mockSessionSecurityService.cleanupSession).toHaveBeenCalledWith(TEST_SESSION_TOKEN);
    });

    it('should handle invalid session token format', async () => {
      const handler = registeredHandlers.get('auth:validate-session');
      const result = await handler(mockEvent, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });
  });

  describe('auth:get-current-user', () => {
    const mockSessionData = {
      user: { id: TEST_USER_ID, email: 'test@example.com' },
      sessionToken: 'session-token-123',
      provider: 'google',
      subscription: { tier: 'pro' },
    };

    const mockDbSession = {
      user_id: TEST_USER_ID,
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
    };

    beforeEach(() => {
      mockSessionService.loadSession.mockResolvedValue(mockSessionData);
      mockDatabaseService.validateSession.mockResolvedValue(mockDbSession);
      mockSessionSecurityService.checkSessionValidity.mockResolvedValue({
        valid: true,
      });
      mockDatabaseService.getUserById.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
        terms_accepted_at: new Date().toISOString(),
      });
    });

    it('should return current user successfully', async () => {
      const handler = registeredHandlers.get('auth:get-current-user');
      const result = await handler(mockEvent);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.sessionToken).toBe('session-token-123');
      expect(result.provider).toBe('google');
    });

    it('should return error when no active session', async () => {
      mockSessionService.loadSession.mockResolvedValue(null);

      const handler = registeredHandlers.get('auth:get-current-user');
      const result = await handler(mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active session');
    });

    it('should clear session when database validation fails', async () => {
      mockDatabaseService.validateSession.mockResolvedValue(null);

      const handler = registeredHandlers.get('auth:get-current-user');
      const result = await handler(mockEvent);

      expect(result.success).toBe(false);
      expect(mockSessionService.clearSession).toHaveBeenCalled();
    });

    it('should handle expired session', async () => {
      // Reset mocks and set up this test specifically
      mockDatabaseService.deleteSession.mockResolvedValue(undefined);
      mockSessionSecurityService.checkSessionValidity.mockResolvedValue({
        valid: false,
        reason: 'idle timeout',
      });

      const handler = registeredHandlers.get('auth:get-current-user');
      const result = await handler(mockEvent);

      expect(result.success).toBe(false);
      // Error format is "Session {reason}"
      expect(result.error).toBe('Session idle timeout');
    });
  });

  describe('shell:open-external', () => {
    it('should open valid HTTPS URL', async () => {
      mockShellOpenExternal.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('shell:open-external');
      const result = await handler(mockEvent, 'https://example.com');

      expect(result.success).toBe(true);
      expect(mockShellOpenExternal).toHaveBeenCalledWith('https://example.com');
    });

    it('should reject invalid URLs', async () => {
      const handler = registeredHandlers.get('shell:open-external');
      const result = await handler(mockEvent, 'javascript:alert(1)');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle shell open failure', async () => {
      mockShellOpenExternal.mockRejectedValue(new Error('Shell error'));

      const handler = registeredHandlers.get('shell:open-external');
      const result = await handler(mockEvent, 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Shell error');
    });
  });

  describe('Login Cancelled Events', () => {
    const { BrowserWindow } = require('electron');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should send google:login-cancelled when Google login window is closed before completion', async () => {
      // Track the 'closed' event handler
      let closedHandler: (() => void) | null = null;
      const mockAuthWindow = {
        loadURL: jest.fn(),
        close: jest.fn(),
        on: jest.fn((event: string, handler: () => void) => {
          if (event === 'closed') {
            closedHandler = handler;
          }
        }),
        isDestroyed: jest.fn().mockReturnValue(false),
        webContents: {
          on: jest.fn(),
          send: jest.fn(),
          session: {
            webRequest: {
              onHeadersReceived: jest.fn(),
            },
          },
        },
      };

      BrowserWindow.mockImplementation(() => mockAuthWindow);

      mockGoogleAuthService.authenticateForLogin.mockResolvedValue({
        authUrl: 'https://accounts.google.com/oauth',
        codePromise: new Promise(() => {}),
        scopes: ['email', 'profile'],
      });

      const handler = registeredHandlers.get('auth:google:login');
      await handler(mockEvent);

      // Verify the 'closed' event handler was registered
      expect(mockAuthWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));

      // Simulate window being closed before auth completes
      if (closedHandler) {
        closedHandler();
      }

      // Verify the cancelled event was sent to the main window
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('google:login-cancelled');
      expect(mockLogService.info).toHaveBeenCalledWith(
        'Sent google:login-cancelled event to renderer',
        'AuthHandlers'
      );
    });

    it('should send microsoft:login-cancelled when Microsoft login window is closed before completion', async () => {
      // Track the 'closed' event handler
      let closedHandler: (() => void) | null = null;
      const mockAuthWindow = {
        loadURL: jest.fn(),
        close: jest.fn(),
        on: jest.fn((event: string, handler: () => void) => {
          if (event === 'closed') {
            closedHandler = handler;
          }
        }),
        isDestroyed: jest.fn().mockReturnValue(false),
        webContents: {
          on: jest.fn(),
          send: jest.fn(),
          session: {
            webRequest: {
              onHeadersReceived: jest.fn(),
            },
          },
        },
      };

      BrowserWindow.mockImplementation(() => mockAuthWindow);

      mockMicrosoftAuthService.authenticateForLogin.mockResolvedValue({
        authUrl: 'https://login.microsoftonline.com/oauth',
        codePromise: new Promise(() => {}),
        codeVerifier: 'verifier-123',
        scopes: ['User.Read'],
      });

      const handler = registeredHandlers.get('auth:microsoft:login');
      await handler(mockEvent);

      // Verify the 'closed' event handler was registered
      expect(mockAuthWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));

      // Simulate window being closed before auth completes
      if (closedHandler) {
        closedHandler();
      }

      // Verify the cancelled event was sent to the main window
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('microsoft:login-cancelled');
      expect(mockLogService.info).toHaveBeenCalledWith(
        'Sent microsoft:login-cancelled event to renderer',
        'AuthHandlers'
      );
    });
  });

  describe('Mailbox Connection Cancelled Events', () => {
    const { BrowserWindow } = require('electron');

    beforeEach(() => {
      jest.clearAllMocks();
      mockDatabaseService.getUserById.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
      });
    });

    it('should send google:mailbox-cancelled when Google auth window is closed before completion', async () => {
      // Track the 'closed' event handler
      let closedHandler: (() => void) | null = null;
      const mockAuthWindow = {
        loadURL: jest.fn(),
        close: jest.fn(),
        on: jest.fn((event: string, handler: () => void) => {
          if (event === 'closed') {
            closedHandler = handler;
          }
        }),
        isDestroyed: jest.fn().mockReturnValue(false),
        webContents: {
          on: jest.fn(),
          send: jest.fn(),
          session: {
            webRequest: {
              onHeadersReceived: jest.fn(),
            },
          },
        },
      };

      BrowserWindow.mockImplementation(() => mockAuthWindow);

      mockGoogleAuthService.authenticateForMailbox.mockResolvedValue({
        authUrl: 'https://accounts.google.com/oauth/mailbox',
        codePromise: new Promise(() => {}),
        scopes: ['gmail.readonly'],
      });

      const handler = registeredHandlers.get('auth:google:connect-mailbox');
      await handler(mockEvent, TEST_USER_ID);

      // Verify the 'closed' event handler was registered
      expect(mockAuthWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));

      // Simulate window being closed before auth completes
      if (closedHandler) {
        closedHandler();
      }

      // Verify the cancelled event was sent to the main window
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('google:mailbox-cancelled');
      expect(mockLogService.info).toHaveBeenCalledWith(
        'Sent google:mailbox-cancelled event to renderer',
        'AuthHandlers'
      );
    });

    it('should send microsoft:mailbox-cancelled when Microsoft auth window is closed before completion', async () => {
      // Track the 'closed' event handler
      let closedHandler: (() => void) | null = null;
      const mockAuthWindow = {
        loadURL: jest.fn(),
        close: jest.fn(),
        on: jest.fn((event: string, handler: () => void) => {
          if (event === 'closed') {
            closedHandler = handler;
          }
        }),
        isDestroyed: jest.fn().mockReturnValue(false),
        webContents: {
          on: jest.fn(),
          send: jest.fn(),
          session: {
            webRequest: {
              onHeadersReceived: jest.fn(),
            },
          },
        },
      };

      BrowserWindow.mockImplementation(() => mockAuthWindow);

      mockMicrosoftAuthService.authenticateForMailbox.mockResolvedValue({
        authUrl: 'https://login.microsoftonline.com/oauth/mailbox',
        codePromise: new Promise(() => {}),
        codeVerifier: 'verifier-123',
        scopes: ['Mail.Read'],
      });

      const handler = registeredHandlers.get('auth:microsoft:connect-mailbox');
      await handler(mockEvent, TEST_USER_ID);

      // Verify the 'closed' event handler was registered
      expect(mockAuthWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));

      // Simulate window being closed before auth completes
      if (closedHandler) {
        closedHandler();
      }

      // Verify the cancelled event was sent to the main window
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('microsoft:mailbox-cancelled');
      expect(mockLogService.info).toHaveBeenCalledWith(
        'Sent microsoft:mailbox-cancelled event to renderer',
        'AuthHandlers'
      );
    });

    it('should register closed event handler on auth window', async () => {
      const mockAuthWindow = {
        loadURL: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        isDestroyed: jest.fn().mockReturnValue(false),
        webContents: {
          on: jest.fn(),
          send: jest.fn(),
          session: {
            webRequest: {
              onHeadersReceived: jest.fn(),
            },
          },
        },
      };

      BrowserWindow.mockImplementation(() => mockAuthWindow);

      mockGoogleAuthService.authenticateForMailbox.mockResolvedValue({
        authUrl: 'https://accounts.google.com/oauth/mailbox',
        codePromise: new Promise(() => {}),
        scopes: ['gmail.readonly'],
      });

      const handler = registeredHandlers.get('auth:google:connect-mailbox');
      await handler(mockEvent, TEST_USER_ID);

      // Verify the 'closed' event handler was registered on the auth window
      expect(mockAuthWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));
    });
  });
});
