/**
 * Session Service Tests
 * Tests user session persistence
 */

const SessionService = require('../sessionService');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
  },
}));
jest.mock('electron');
jest.mock('path');

describe('SessionService', () => {
  let sessionService;
  const mockUserDataPath = '/mock/user/data';
  const mockSessionPath = '/mock/user/data/session.json';

  beforeEach(() => {
    jest.clearAllMocks();

    app.getPath = jest.fn(() => mockUserDataPath);
    path.join = jest.fn((...args) => args.join('/'));

    sessionService = new SessionService();
  });

  describe('initialization', () => {
    it('should set sessionFilePath based on userData path', () => {
      expect(app.getPath).toHaveBeenCalledWith('userData');
      expect(sessionService.sessionFilePath).toBe(mockSessionPath);
    });
  });

  describe('saveSession', () => {
    it('should save session data to file', async () => {
      const sessionData = {
        user: { id: 'user-123', email: 'test@example.com' },
        sessionToken: 'token-abc',
        provider: 'google',
        expiresAt: Date.now() + 3600000,
      };

      fs.writeFile.mockResolvedValue();

      const result = await sessionService.saveSession(sessionData);

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockSessionPath,
        expect.stringContaining('"sessionToken":"token-abc"'),
        'utf8'
      );
    });

    it('should add savedAt timestamp', async () => {
      const sessionData = {
        user: { id: 'user-123' },
        sessionToken: 'token',
      };

      fs.writeFile.mockResolvedValue();

      await sessionService.saveSession(sessionData);

      const writtenData = fs.writeFile.mock.calls[0][1];
      const parsedData = JSON.parse(writtenData);

      expect(parsedData.savedAt).toBeDefined();
      expect(typeof parsedData.savedAt).toBe('number');
    });

    it('should preserve all session data fields', async () => {
      const sessionData = {
        user: { id: 'user-123', email: 'test@example.com' },
        sessionToken: 'token-abc',
        provider: 'microsoft',
        subscription: { plan: 'premium' },
        expiresAt: 1234567890,
      };

      fs.writeFile.mockResolvedValue();

      await sessionService.saveSession(sessionData);

      const writtenData = fs.writeFile.mock.calls[0][1];
      const parsedData = JSON.parse(writtenData);

      expect(parsedData.user).toEqual(sessionData.user);
      expect(parsedData.sessionToken).toBe(sessionData.sessionToken);
      expect(parsedData.provider).toBe(sessionData.provider);
      expect(parsedData.subscription).toEqual(sessionData.subscription);
      expect(parsedData.expiresAt).toBe(sessionData.expiresAt);
    });

    it('should return false on file write error', async () => {
      fs.writeFile.mockRejectedValue(new Error('Disk full'));

      const result = await sessionService.saveSession({ user: { id: '123' } });

      expect(result).toBe(false);
    });

    it('should format JSON with indentation', async () => {
      fs.writeFile.mockResolvedValue();

      await sessionService.saveSession({ user: { id: '123' } });

      const writtenData = fs.writeFile.mock.calls[0][1];
      expect(writtenData).toContain('\n');
      expect(writtenData).toContain('  '); // 2-space indentation
    });
  });

  describe('loadSession', () => {
    it('should load valid session from file', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        sessionToken: 'token-abc',
        provider: 'google',
        expiresAt: Date.now() + 3600000, // 1 hour in future
        savedAt: Date.now(),
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockSession));

      const result = await sessionService.loadSession();

      expect(result).toEqual(mockSession);
      expect(fs.readFile).toHaveBeenCalledWith(mockSessionPath, 'utf8');
    });

    it('should return null and clear session if expired', async () => {
      const expiredSession = {
        user: { id: 'user-123' },
        sessionToken: 'token-abc',
        expiresAt: Date.now() - 3600000, // 1 hour in past
        savedAt: Date.now() - 7200000,
      };

      fs.readFile.mockResolvedValue(JSON.stringify(expiredSession));
      fs.unlink.mockResolvedValue();

      const result = await sessionService.loadSession();

      expect(result).toBeNull();
      expect(fs.unlink).toHaveBeenCalledWith(mockSessionPath);
    });

    it('should return null when session file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const result = await sessionService.loadSession();

      expect(result).toBeNull();
    });

    it('should return null on JSON parse error', async () => {
      fs.readFile.mockResolvedValue('invalid-json{{{');

      const result = await sessionService.loadSession();

      expect(result).toBeNull();
    });

    it('should handle sessions without expiration', async () => {
      const sessionWithoutExpiry = {
        user: { id: 'user-123' },
        sessionToken: 'token-abc',
      };

      fs.readFile.mockResolvedValue(JSON.stringify(sessionWithoutExpiry));

      const result = await sessionService.loadSession();

      expect(result).toEqual(sessionWithoutExpiry);
    });

    it('should return null on other file read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await sessionService.loadSession();

      expect(result).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('should delete session file', async () => {
      fs.unlink.mockResolvedValue();

      const result = await sessionService.clearSession();

      expect(result).toBe(true);
      expect(fs.unlink).toHaveBeenCalledWith(mockSessionPath);
    });

    it('should return true even if file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.unlink.mockRejectedValue(error);

      const result = await sessionService.clearSession();

      expect(result).toBe(true);
    });

    it('should return false on deletion error', async () => {
      fs.unlink.mockRejectedValue(new Error('Permission denied'));

      const result = await sessionService.clearSession();

      expect(result).toBe(false);
    });
  });

  describe('hasValidSession', () => {
    it('should return true when valid session exists', async () => {
      const validSession = {
        user: { id: 'user-123' },
        sessionToken: 'token-abc',
        expiresAt: Date.now() + 3600000,
      };

      fs.readFile.mockResolvedValue(JSON.stringify(validSession));

      const result = await sessionService.hasValidSession();

      expect(result).toBe(true);
    });

    it('should return false when session is expired', async () => {
      const expiredSession = {
        user: { id: 'user-123' },
        expiresAt: Date.now() - 3600000,
      };

      fs.readFile.mockResolvedValue(JSON.stringify(expiredSession));
      fs.unlink.mockResolvedValue();

      const result = await sessionService.hasValidSession();

      expect(result).toBe(false);
    });

    it('should return false when no session file exists', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const result = await sessionService.hasValidSession();

      expect(result).toBe(false);
    });
  });

  describe('updateSession', () => {
    it('should merge updates with existing session', async () => {
      const existingSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        sessionToken: 'old-token',
        provider: 'google',
      };

      const updates = {
        sessionToken: 'new-token',
        expiresAt: 9999999999,
      };

      fs.readFile.mockResolvedValue(JSON.stringify(existingSession));
      fs.writeFile.mockResolvedValue();

      await sessionService.updateSession(updates);

      const writtenData = fs.writeFile.mock.calls[0][1];
      const savedData = JSON.parse(writtenData);

      expect(savedData.sessionToken).toBe('new-token');
      expect(savedData.expiresAt).toBe(9999999999);
      expect(savedData.user).toEqual(existingSession.user);
      expect(savedData.provider).toBe('google');
    });

    it('should create new session if none exists', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);
      fs.writeFile.mockResolvedValue();

      const updates = {
        user: { id: 'user-456' },
        sessionToken: 'token-xyz',
      };

      await sessionService.updateSession(updates);

      const writtenData = fs.writeFile.mock.calls[0][1];
      const savedData = JSON.parse(writtenData);

      expect(savedData.user.id).toBe('user-456');
      expect(savedData.sessionToken).toBe('token-xyz');
    });

    it('should handle partial updates', async () => {
      const existingSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        sessionToken: 'token',
        provider: 'google',
      };

      fs.readFile.mockResolvedValue(JSON.stringify(existingSession));
      fs.writeFile.mockResolvedValue();

      await sessionService.updateSession({ provider: 'microsoft' });

      const writtenData = fs.writeFile.mock.calls[0][1];
      const savedData = JSON.parse(writtenData);

      expect(savedData.provider).toBe('microsoft');
      expect(savedData.user).toEqual(existingSession.user);
      expect(savedData.sessionToken).toBe(existingSession.sessionToken);
    });
  });

  describe('session expiration logic', () => {
    it('should correctly identify expired sessions', async () => {
      const now = Date.now();
      const expiredSession = {
        user: { id: 'user-123' },
        expiresAt: now - 1000, // 1 second ago
      };

      fs.readFile.mockResolvedValue(JSON.stringify(expiredSession));
      fs.unlink.mockResolvedValue();

      const result = await sessionService.loadSession();

      expect(result).toBeNull();
    });

    it('should not expire sessions with future expiration', async () => {
      const now = Date.now();
      const validSession = {
        user: { id: 'user-123' },
        expiresAt: now + 1000, // 1 second in future
      };

      fs.readFile.mockResolvedValue(JSON.stringify(validSession));

      const result = await sessionService.loadSession();

      expect(result).not.toBeNull();
      expect(result.user.id).toBe('user-123');
    });
  });
});
