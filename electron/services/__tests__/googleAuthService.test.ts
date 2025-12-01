/**
 * Unit tests for Google Auth Service Token Refresh
 * Tests automatic token refresh functionality
 */

import googleAuthService from '../googleAuthService';
import databaseService from '../databaseService';
import tokenEncryptionService from '../tokenEncryptionService';

// Mock dependencies
jest.mock('../databaseService');
jest.mock('../tokenEncryptionService');
jest.mock('googleapis');

const mockDatabaseService = databaseService as jest.Mocked<typeof databaseService>;
const mockTokenEncryptionService = tokenEncryptionService as jest.Mocked<typeof tokenEncryptionService>;

describe('GoogleAuthService - Token Refresh', () => {
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
        provider: 'google' as const,
        purpose: 'mailbox' as const,
        access_token: 'old-encrypted-token',
        refresh_token: mockRefreshToken,
        token_expires_at: '2025-01-01T00:00:00.000Z',
        connected_email_address: 'test@gmail.com',
        mailbox_connected: true,
        scopes_granted: 'https://www.googleapis.com/auth/gmail.readonly',
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
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };
      jest.spyOn(googleAuthService, 'refreshToken').mockResolvedValue(mockNewTokens);

      // Execute
      const result = await googleAuthService.refreshAccessToken(mockUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(mockDatabaseService.getOAuthToken).toHaveBeenCalledWith(
        mockUserId,
        'google',
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
      const result = await googleAuthService.refreshAccessToken(mockUserId);

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
        provider: 'google' as const,
        purpose: 'mailbox' as const,
        access_token: 'old-encrypted-token',
        refresh_token: undefined,
        token_expires_at: '2025-01-01T00:00:00.000Z',
        connected_email_address: 'test@gmail.com',
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);

      // Execute
      const result = await googleAuthService.refreshAccessToken(mockUserId);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBe('No refresh token available');
    });

    it('should handle Google OAuth refresh failures', async () => {
      // Setup mocks
      const mockTokenRecord = {
        id: 'token-id',
        user_id: mockUserId,
        provider: 'google' as const,
        purpose: 'mailbox' as const,
        access_token: 'old-encrypted-token',
        refresh_token: mockRefreshToken,
        token_expires_at: '2025-01-01T00:00:00.000Z',
        connected_email_address: 'test@gmail.com',
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      mockTokenEncryptionService.decrypt.mockReturnValue(mockDecryptedRefreshToken);

      // Mock refreshToken to throw error
      jest.spyOn(googleAuthService, 'refreshToken').mockRejectedValue(
        new Error('Invalid refresh token')
      );

      // Execute
      const result = await googleAuthService.refreshAccessToken(mockUserId);

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
        provider: 'google' as const,
        purpose: 'mailbox' as const,
        access_token: 'old-encrypted-token',
        refresh_token: mockRefreshToken,
        token_expires_at: '2025-01-01T00:00:00.000Z',
        connected_email_address: 'user@company.com',
        mailbox_connected: true,
        scopes_granted: 'https://www.googleapis.com/auth/gmail.readonly',
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      mockTokenEncryptionService.decrypt.mockReturnValue(mockDecryptedRefreshToken);
      mockTokenEncryptionService.encrypt.mockReturnValue(mockEncryptedAccessToken);

      const mockNewTokens = {
        access_token: mockAccessToken,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };
      jest.spyOn(googleAuthService, 'refreshToken').mockResolvedValue(mockNewTokens);

      // Execute
      await googleAuthService.refreshAccessToken(mockUserId);

      // Verify saveOAuthToken was called with preserved data
      expect(mockDatabaseService.saveOAuthToken).toHaveBeenCalledWith(
        mockUserId,
        'google',
        'mailbox',
        expect.objectContaining({
          connected_email_address: 'user@company.com',
          mailbox_connected: true,
          scopes_granted: 'https://www.googleapis.com/auth/gmail.readonly',
        })
      );
    });

    it('should keep existing refresh token when Google does not return a new one', async () => {
      // Setup mocks
      const existingRefreshToken = 'existing-encrypted-refresh-token';
      const mockTokenRecord = {
        id: 'token-id',
        user_id: mockUserId,
        provider: 'google' as const,
        purpose: 'mailbox' as const,
        access_token: 'old-encrypted-token',
        refresh_token: existingRefreshToken,
        token_expires_at: '2025-01-01T00:00:00.000Z',
        connected_email_address: 'test@gmail.com',
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      mockTokenEncryptionService.decrypt.mockReturnValue(mockDecryptedRefreshToken);
      mockTokenEncryptionService.encrypt.mockReturnValue(mockEncryptedAccessToken);

      const mockNewTokens = {
        access_token: mockAccessToken,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };
      jest.spyOn(googleAuthService, 'refreshToken').mockResolvedValue(mockNewTokens);

      // Execute
      await googleAuthService.refreshAccessToken(mockUserId);

      // Verify the existing refresh token is preserved
      expect(mockDatabaseService.saveOAuthToken).toHaveBeenCalledWith(
        mockUserId,
        'google',
        'mailbox',
        expect.objectContaining({
          refresh_token: existingRefreshToken, // Should keep the old one
        })
      );
    });
  });
});

describe('GoogleAuthService - Direct Code Resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveCodeDirectly', () => {
    it('should resolve the code promise when resolver is set', async () => {
      // Start local server to set up the resolver
      const codePromise = googleAuthService.startLocalServer();

      // Resolve directly
      googleAuthService.resolveCodeDirectly('test-auth-code');

      // The promise should resolve with the code
      const code = await codePromise;
      expect(code).toBe('test-auth-code');
    });

    it('should stop local server after resolving', () => {
      const stopSpy = jest.spyOn(googleAuthService, 'stopLocalServer');

      // Start and then resolve
      googleAuthService.startLocalServer();
      googleAuthService.resolveCodeDirectly('test-code');

      expect(stopSpy).toHaveBeenCalled();
      stopSpy.mockRestore();
    });
  });

  describe('rejectCodeDirectly', () => {
    it('should reject the code promise when rejecter is set', async () => {
      // Start local server to set up the rejecter
      const codePromise = googleAuthService.startLocalServer();

      // Reject directly
      googleAuthService.rejectCodeDirectly('Auth error');

      // The promise should reject with the error
      await expect(codePromise).rejects.toThrow('Auth error');
    });

    it('should stop local server after rejecting', async () => {
      const stopSpy = jest.spyOn(googleAuthService, 'stopLocalServer');

      // Start and then reject - must catch the rejected promise
      const codePromise = googleAuthService.startLocalServer();
      googleAuthService.rejectCodeDirectly('error');

      // Await the rejection to prevent unhandled promise rejection
      await expect(codePromise).rejects.toThrow('error');
      expect(stopSpy).toHaveBeenCalled();
      stopSpy.mockRestore();
    });
  });
});
