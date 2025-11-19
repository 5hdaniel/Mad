/**
 * Microsoft Auth Service Tests
 * Tests Microsoft OAuth authentication flow
 */

const MicrosoftAuthService = require('../microsoftAuthService');

// Mock MSAL Node
const mockPublicClientApp = {
  acquireTokenByCode: jest.fn(),
  acquireTokenSilent: jest.fn(),
  getTokenCache: jest.fn(),
};

jest.mock('@azure/msal-node', () => ({
  PublicClientApplication: jest.fn(() => mockPublicClientApp),
  LogLevel: {
    Error: 0,
    Warning: 1,
    Info: 2,
    Verbose: 3,
  },
}));

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('MicrosoftAuthService', () => {
  let microsoftAuthService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup environment
    process.env.MICROSOFT_CLIENT_ID = 'test-client-id';
    process.env.MICROSOFT_TENANT_ID = 'test-tenant-id';

    microsoftAuthService = new MicrosoftAuthService();
  });

  afterEach(() => {
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_TENANT_ID;
  });

  describe('initialize', () => {
    it('should initialize MSAL client with credentials', () => {
      const { PublicClientApplication } = require('@azure/msal-node');

      microsoftAuthService.initialize();

      expect(PublicClientApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            clientId: 'test-client-id',
            authority: expect.stringContaining('test-tenant-id'),
          }),
        })
      );
      expect(microsoftAuthService.initialized).toBe(true);
    });

    it('should throw error when credentials are missing', () => {
      delete process.env.MICROSOFT_CLIENT_ID;

      expect(() => microsoftAuthService.initialize()).toThrow(
        'Microsoft OAuth credentials not configured'
      );
    });

    it('should not reinitialize if already initialized', () => {
      const { PublicClientApplication } = require('@azure/msal-node');

      microsoftAuthService.initialize();
      const callCount = PublicClientApplication.mock.calls.length;

      microsoftAuthService.initialize();

      expect(PublicClientApplication).toHaveBeenCalledTimes(callCount);
    });

    it('should use correct redirect URI', () => {
      microsoftAuthService.initialize();

      expect(microsoftAuthService.redirectUri).toBe('http://localhost:3000/callback');
    });
  });

  describe('getLoginUrl', () => {
    it('should generate auth URL with minimal scopes', () => {
      const url = microsoftAuthService.getLoginUrl();

      expect(url).toContain('login.microsoftonline.com');
      expect(url).toContain('test-client-id');
      expect(url).toContain('user.read');
      expect(url).toContain('offline_access');
    });

    it('should include redirect URI in URL', () => {
      const url = microsoftAuthService.getLoginUrl();

      expect(url).toContain(encodeURIComponent('http://localhost:3000/callback'));
    });

    it('should request offline access for refresh tokens', () => {
      const url = microsoftAuthService.getLoginUrl();

      expect(url).toContain('offline_access');
    });
  });

  describe('getMailboxAccessUrl', () => {
    it('should generate auth URL with Mail scopes', () => {
      const url = microsoftAuthService.getMailboxAccessUrl();

      expect(url).toContain('Mail.Read');
      expect(url).toContain('prompt=consent');
    });

    it('should force consent prompt for incremental auth', () => {
      const url = microsoftAuthService.getMailboxAccessUrl();

      expect(url).toContain('prompt=consent');
    });
  });

  describe('handleCallback', () => {
    it('should exchange code for tokens', async () => {
      const mockTokenResponse = {
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresOn: new Date(Date.now() + 3600000),
        account: {
          homeAccountId: 'account-123',
          username: 'test@outlook.com',
        },
      };

      mockPublicClientApp.acquireTokenByCode.mockResolvedValue(mockTokenResponse);

      const result = await microsoftAuthService.handleCallback('auth-code-123');

      expect(mockPublicClientApp.acquireTokenByCode).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'auth-code-123',
        })
      );
      expect(result).toEqual(mockTokenResponse);
    });

    it('should handle token exchange errors', async () => {
      mockPublicClientApp.acquireTokenByCode.mockRejectedValue(new Error('Invalid code'));

      await expect(microsoftAuthService.handleCallback('invalid-code')).rejects.toThrow(
        'Invalid code'
      );
    });

    it('should use correct scopes in token request', async () => {
      mockPublicClientApp.acquireTokenByCode.mockResolvedValue({});

      await microsoftAuthService.handleCallback('code');

      expect(mockPublicClientApp.acquireTokenByCode).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: expect.arrayContaining(['user.read', 'offline_access']),
        })
      );
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user profile from Microsoft Graph', async () => {
      const mockUserInfo = {
        id: 'user-123',
        displayName: 'Test User',
        mail: 'test@outlook.com',
        userPrincipalName: 'test@outlook.com',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserInfo),
      });

      const result = await microsoftAuthService.getUserInfo('access-token');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
          }),
        })
      );
      expect(result).toEqual(mockUserInfo);
    });

    it('should handle API errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(microsoftAuthService.getUserInfo('invalid-token')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(microsoftAuthService.getUserInfo('token')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('acquireTokenSilent', () => {
    it('should acquire token silently using cache', async () => {
      const mockAccount = {
        homeAccountId: 'account-123',
        username: 'test@outlook.com',
      };

      const mockTokenResponse = {
        accessToken: 'cached-access-token',
        expiresOn: new Date(Date.now() + 3600000),
      };

      mockPublicClientApp.acquireTokenSilent.mockResolvedValue(mockTokenResponse);

      const result = await microsoftAuthService.acquireTokenSilent(mockAccount);

      expect(mockPublicClientApp.acquireTokenSilent).toHaveBeenCalledWith(
        expect.objectContaining({
          account: mockAccount,
        })
      );
      expect(result).toEqual(mockTokenResponse);
    });

    it('should handle silent acquisition failure', async () => {
      mockPublicClientApp.acquireTokenSilent.mockRejectedValue(
        new Error('Interaction required')
      );

      await expect(
        microsoftAuthService.acquireTokenSilent({ homeAccountId: '123' })
      ).rejects.toThrow('Interaction required');
    });
  });

  describe('_ensureInitialized', () => {
    it('should initialize if not already initialized', () => {
      expect(microsoftAuthService.initialized).toBe(false);

      microsoftAuthService._ensureInitialized();

      expect(microsoftAuthService.initialized).toBe(true);
    });
  });

  describe('scopes', () => {
    it('should define minimal login scopes', () => {
      expect(microsoftAuthService.loginScopes).toContain('user.read');
      expect(microsoftAuthService.loginScopes).toContain('offline_access');
    });

    it('should define mailbox access scopes', () => {
      expect(microsoftAuthService.mailboxScopes).toContain('Mail.Read');
      expect(microsoftAuthService.mailboxScopes).toContain('offline_access');
    });
  });

  describe('redirect URI', () => {
    it('should use different port than Google auth', () => {
      microsoftAuthService.initialize();

      // Google uses 3001, Microsoft uses 3000
      expect(microsoftAuthService.redirectUri).toBe('http://localhost:3000/callback');
    });
  });
});
