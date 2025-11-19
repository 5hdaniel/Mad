/**
 * Google Auth Service Tests
 * Tests Google OAuth authentication flow
 */

const GoogleAuthService = require('../googleAuthService');
const { google } = require('googleapis');

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(),
    },
  },
}));

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('GoogleAuthService', () => {
  let googleAuthService;
  let mockOAuth2Client;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup environment
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    // Mock OAuth2 client
    mockOAuth2Client = {
      generateAuthUrl: jest.fn(),
      getToken: jest.fn(),
      setCredentials: jest.fn(),
      credentials: {},
    };

    google.auth.OAuth2.mockImplementation(() => mockOAuth2Client);

    googleAuthService = new GoogleAuthService();
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  describe('initialize', () => {
    it('should initialize OAuth2 client with credentials', () => {
      googleAuthService.initialize();

      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        'test-client-id',
        'test-client-secret',
        'http://localhost:3001/callback'
      );
      expect(googleAuthService.initialized).toBe(true);
    });

    it('should throw error when credentials are missing', () => {
      delete process.env.GOOGLE_CLIENT_ID;

      expect(() => googleAuthService.initialize()).toThrow(
        'Google OAuth credentials not configured'
      );
    });

    it('should not reinitialize if already initialized', () => {
      googleAuthService.initialize();
      const callCount = google.auth.OAuth2.mock.calls.length;

      googleAuthService.initialize();

      expect(google.auth.OAuth2).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('getLoginUrl', () => {
    it('should generate auth URL with minimal scopes', () => {
      mockOAuth2Client.generateAuthUrl.mockReturnValue('https://accounts.google.com/auth');

      const url = googleAuthService.getLoginUrl();

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          scope: expect.arrayContaining([
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
          ]),
        })
      );
      expect(url).toBe('https://accounts.google.com/auth');
    });

    it('should request offline access for refresh tokens', () => {
      googleAuthService.getLoginUrl();

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
        })
      );
    });
  });

  describe('getMailboxAccessUrl', () => {
    it('should generate auth URL with Gmail scopes', () => {
      mockOAuth2Client.generateAuthUrl.mockReturnValue('https://accounts.google.com/gmail');

      const url = googleAuthService.getMailboxAccessUrl();

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: expect.arrayContaining([
            'https://www.googleapis.com/auth/gmail.readonly',
          ]),
          prompt: 'consent',
        })
      );
      expect(url).toBe('https://accounts.google.com/gmail');
    });

    it('should force consent prompt for incremental auth', () => {
      googleAuthService.getMailboxAccessUrl();

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'consent',
        })
      );
    });
  });

  describe('handleCallback', () => {
    it('should exchange code for tokens', async () => {
      const mockTokens = {
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expiry_date: Date.now() + 3600000,
      };

      mockOAuth2Client.getToken.mockResolvedValue({
        tokens: mockTokens,
      });

      const result = await googleAuthService.handleCallback('auth-code-123');

      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith('auth-code-123');
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(mockTokens);
      expect(result).toEqual(mockTokens);
    });

    it('should handle token exchange errors', async () => {
      mockOAuth2Client.getToken.mockRejectedValue(new Error('Invalid code'));

      await expect(googleAuthService.handleCallback('invalid-code')).rejects.toThrow(
        'Invalid code'
      );
    });

    it('should set credentials on client', async () => {
      const mockTokens = { access_token: 'token' };
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      await googleAuthService.handleCallback('code');

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(mockTokens);
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user profile information', async () => {
      const mockUserInfo = {
        data: {
          id: 'user-123',
          email: 'test@gmail.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg',
        },
      };

      mockOAuth2Client.request = jest.fn().mockResolvedValue(mockUserInfo);

      const result = await googleAuthService.getUserInfo();

      expect(mockOAuth2Client.request).toHaveBeenCalledWith({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo',
      });
      expect(result).toEqual(mockUserInfo.data);
    });

    it('should handle userinfo fetch errors', async () => {
      mockOAuth2Client.request = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(googleAuthService.getUserInfo()).rejects.toThrow('Network error');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh tokens using refresh token', async () => {
      const newTokens = {
        access_token: 'new-access-token',
        expiry_date: Date.now() + 3600000,
      };

      mockOAuth2Client.refreshAccessToken = jest.fn().mockResolvedValue({
        credentials: newTokens,
      });

      const result = await googleAuthService.refreshAccessToken();

      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(result).toEqual(newTokens);
    });

    it('should handle refresh errors', async () => {
      mockOAuth2Client.refreshAccessToken = jest
        .fn()
        .mockRejectedValue(new Error('Refresh token expired'));

      await expect(googleAuthService.refreshAccessToken()).rejects.toThrow(
        'Refresh token expired'
      );
    });
  });

  describe('_ensureInitialized', () => {
    it('should initialize if not already initialized', () => {
      expect(googleAuthService.initialized).toBe(false);

      googleAuthService._ensureInitialized();

      expect(googleAuthService.initialized).toBe(true);
    });

    it('should not reinitialize if already initialized', () => {
      googleAuthService.initialize();
      const callCount = google.auth.OAuth2.mock.calls.length;

      googleAuthService._ensureInitialized();

      expect(google.auth.OAuth2).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('local server', () => {
    it('should use correct redirect URI', () => {
      expect(googleAuthService.redirectUri).toBe('http://localhost:3001/callback');
    });

    it('should initialize server as null', () => {
      expect(googleAuthService.server).toBeNull();
    });
  });
});
