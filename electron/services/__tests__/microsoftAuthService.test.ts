/**
 * Unit tests for Microsoft Auth Service Token Refresh
 * Tests automatic token refresh functionality
 */

import microsoftAuthService from '../microsoftAuthService';
import databaseService from '../databaseService';
import tokenEncryptionService from '../tokenEncryptionService';

// Mock dependencies
jest.mock('../databaseService');
jest.mock('../tokenEncryptionService');
jest.mock('axios');

const mockDatabaseService = databaseService as jest.Mocked<typeof databaseService>;
const mockTokenEncryptionService = tokenEncryptionService as jest.Mocked<typeof tokenEncryptionService>;

describe('MicrosoftAuthService - Token Refresh', () => {
  const mockUserId = 'test-user-id';
  const mockRefreshToken = 'encrypted-refresh-token';
  const mockDecryptedRefreshToken = 'plain-refresh-token';
  const mockAccessToken = 'new-access-token';
  const mockEncryptedAccessToken = 'encrypted-new-access-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh an expired token', async () => {
      // Setup mocks
      const mockTokenRecord = {
        id: 'token-id',
        user_id: mockUserId,
        provider: 'microsoft' as const,
        purpose: 'mailbox' as const,
        access_token: 'old-encrypted-token',
        refresh_token: mockRefreshToken,
        token_expires_at: '2025-01-01T00:00:00.000Z',
        connected_email_address: 'test@example.com',
        mailbox_connected: true,
        scopes_granted: 'Mail.Read Mail.Send',
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      mockTokenEncryptionService.decrypt.mockReturnValue(mockDecryptedRefreshToken);
      mockTokenEncryptionService.encrypt.mockReturnValue(mockEncryptedAccessToken);

      // Mock the refreshToken method
      const mockNewTokens = {
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        expires_in: 3600,
        scope: 'Mail.Read Mail.Send',
      };
      jest.spyOn(microsoftAuthService, 'refreshToken').mockResolvedValue(mockNewTokens);

      // Execute
      const result = await microsoftAuthService.refreshAccessToken(mockUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(mockDatabaseService.getOAuthToken).toHaveBeenCalledWith(
        mockUserId,
        'microsoft',
        'mailbox'
      );
      expect(mockTokenEncryptionService.decrypt).toHaveBeenCalledWith(mockRefreshToken);
      expect(mockTokenEncryptionService.encrypt).toHaveBeenCalledWith(mockAccessToken);
      expect(mockDatabaseService.saveOAuthToken).toHaveBeenCalled();
    });

    it('should return error when no refresh token exists', async () => {
      // Setup: No token in database
      mockDatabaseService.getOAuthToken.mockResolvedValue(null);

      // Execute
      const result = await microsoftAuthService.refreshAccessToken(mockUserId);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBe('No refresh token available');
      expect(mockTokenEncryptionService.decrypt).not.toHaveBeenCalled();
    });

    it('should return error when token record has no refresh token', async () => {
      // Setup: Token record without refresh_token
      const mockTokenRecord = {
        id: 'token-id',
        user_id: mockUserId,
        provider: 'microsoft' as const,
        purpose: 'mailbox' as const,
        access_token: 'old-encrypted-token',
        refresh_token: undefined,
        token_expires_at: '2025-01-01T00:00:00.000Z',
        connected_email_address: 'test@example.com',
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);

      // Execute
      const result = await microsoftAuthService.refreshAccessToken(mockUserId);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBe('No refresh token available');
    });

    it('should handle Microsoft OAuth refresh failures', async () => {
      // Setup mocks
      const mockTokenRecord = {
        id: 'token-id',
        user_id: mockUserId,
        provider: 'microsoft' as const,
        purpose: 'mailbox' as const,
        access_token: 'old-encrypted-token',
        refresh_token: mockRefreshToken,
        token_expires_at: '2025-01-01T00:00:00.000Z',
        connected_email_address: 'test@example.com',
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      mockTokenEncryptionService.decrypt.mockReturnValue(mockDecryptedRefreshToken);

      // Mock refreshToken to throw error
      jest.spyOn(microsoftAuthService, 'refreshToken').mockRejectedValue(
        new Error('Invalid refresh token')
      );

      // Execute
      const result = await microsoftAuthService.refreshAccessToken(mockUserId);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
      expect(mockDatabaseService.saveOAuthToken).not.toHaveBeenCalled();
    });

    it('should preserve email address and scopes when refreshing', async () => {
      // Setup mocks
      const mockTokenRecord = {
        id: 'token-id',
        user_id: mockUserId,
        provider: 'microsoft' as const,
        purpose: 'mailbox' as const,
        access_token: 'old-encrypted-token',
        refresh_token: mockRefreshToken,
        token_expires_at: '2025-01-01T00:00:00.000Z',
        connected_email_address: 'user@company.com',
        mailbox_connected: true,
        scopes_granted: 'Mail.Read Mail.Send',
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      mockTokenEncryptionService.decrypt.mockReturnValue(mockDecryptedRefreshToken);
      mockTokenEncryptionService.encrypt.mockReturnValue(mockEncryptedAccessToken);

      const mockNewTokens = {
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        expires_in: 3600,
        scope: 'Mail.Read Mail.Send',
      };
      jest.spyOn(microsoftAuthService, 'refreshToken').mockResolvedValue(mockNewTokens);

      // Execute
      await microsoftAuthService.refreshAccessToken(mockUserId);

      // Verify saveOAuthToken was called with preserved data
      expect(mockDatabaseService.saveOAuthToken).toHaveBeenCalledWith(
        mockUserId,
        'microsoft',
        'mailbox',
        expect.objectContaining({
          connected_email_address: 'user@company.com',
          mailbox_connected: true,
        })
      );
    });

    it('should calculate correct expiry time from expires_in', async () => {
      // Setup mocks
      const mockTokenRecord = {
        id: 'token-id',
        user_id: mockUserId,
        provider: 'microsoft' as const,
        purpose: 'mailbox' as const,
        access_token: 'old-encrypted-token',
        refresh_token: mockRefreshToken,
        token_expires_at: '2025-01-01T00:00:00.000Z',
        connected_email_address: 'test@example.com',
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      mockTokenEncryptionService.decrypt.mockReturnValue(mockDecryptedRefreshToken);
      mockTokenEncryptionService.encrypt.mockReturnValue(mockEncryptedAccessToken);

      const expiresInSeconds = 3600; // 1 hour
      const mockNewTokens = {
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        expires_in: expiresInSeconds,
        scope: 'Mail.Read',
      };
      jest.spyOn(microsoftAuthService, 'refreshToken').mockResolvedValue(mockNewTokens);

      const beforeCall = Date.now();
      await microsoftAuthService.refreshAccessToken(mockUserId);
      const afterCall = Date.now();

      // Verify the expiry time is approximately 1 hour from now
      const savedCall = (mockDatabaseService.saveOAuthToken as jest.Mock).mock.calls[0];
      const savedExpiresAt = new Date(savedCall[3].token_expires_at).getTime();
      const expectedMin = beforeCall + expiresInSeconds * 1000;
      const expectedMax = afterCall + expiresInSeconds * 1000;

      expect(savedExpiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(savedExpiresAt).toBeLessThanOrEqual(expectedMax);
    });
  });
});

describe('MicrosoftAuthService - Direct Code Resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveCodeDirectly', () => {
    it('should resolve the code promise when resolver is set', async () => {
      // Start local server to set up the resolver
      const codePromise = microsoftAuthService.startLocalServer();

      // Resolve directly
      microsoftAuthService.resolveCodeDirectly('test-auth-code');

      // The promise should resolve with the code
      const code = await codePromise;
      expect(code).toBe('test-auth-code');
    });

    it('should stop local server after resolving', () => {
      const stopSpy = jest.spyOn(microsoftAuthService, 'stopLocalServer');

      // Start and then resolve
      microsoftAuthService.startLocalServer();
      microsoftAuthService.resolveCodeDirectly('test-code');

      expect(stopSpy).toHaveBeenCalled();
      stopSpy.mockRestore();
    });
  });

  describe('rejectCodeDirectly', () => {
    it('should reject the code promise when rejecter is set', async () => {
      // Start local server to set up the rejecter
      const codePromise = microsoftAuthService.startLocalServer();

      // Reject directly
      microsoftAuthService.rejectCodeDirectly('Auth error');

      // The promise should reject with the error
      await expect(codePromise).rejects.toThrow('Auth error');
    });

    it('should stop local server after rejecting', () => {
      const stopSpy = jest.spyOn(microsoftAuthService, 'stopLocalServer');

      // Start and then reject
      microsoftAuthService.startLocalServer();
      microsoftAuthService.rejectCodeDirectly('error');

      expect(stopSpy).toHaveBeenCalled();
      stopSpy.mockRestore();
    });
  });
});
