/**
 * Unit tests for LogService
 * Tests logging functionality with different levels and outputs
 */

import { LogService, LogLevel } from '../logService';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');

describe('LogService', () => {
  let logService: LogService;
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fs functions
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });
    (fs.unlinkSync as jest.Mock).mockImplementation(() => undefined);
    (fs.appendFile as jest.Mock).mockImplementation((path, data, callback) => callback(null));
    (fs.writeFile as jest.Mock).mockImplementation((path, data, callback) => callback(null));

    // Spy on console methods
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    logService = new LogService({ logToConsole: true, logToFile: false });
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const service = new LogService();
      expect(service).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const service = new LogService({
        logToFile: true,
        logToConsole: false,
        minLevel: 'warn',
      });
      expect(service).toBeDefined();
    });

    it('should create log directory when logToFile is true', () => {
      const logDirectory = '/tmp/logs';
      new LogService({ logToFile: true, logDirectory });

      expect(fs.mkdirSync).toHaveBeenCalledWith(logDirectory, { recursive: true });
    });
  });

  describe('log levels', () => {
    it('should log debug messages', async () => {
      // Need to set minLevel to debug since default is info
      logService = new LogService({ logToConsole: true, minLevel: 'debug' });
      await logService.debug('Debug message');
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it('should log info messages', async () => {
      await logService.info('Info message');
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('should log warn messages', async () => {
      await logService.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log error messages', async () => {
      await logService.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('log filtering by level', () => {
    beforeEach(() => {
      logService = new LogService({ logToConsole: true, minLevel: 'warn' });
    });

    it('should not log debug when minLevel is warn', async () => {
      await logService.debug('Debug message');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should not log info when minLevel is warn', async () => {
      await logService.info('Info message');
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it('should log warn when minLevel is warn', async () => {
      await logService.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log error when minLevel is warn', async () => {
      await logService.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('context and metadata', () => {
    it('should log with context', async () => {
      await logService.info('Message', 'TestContext');
      expect(consoleInfoSpy).toHaveBeenCalled();
      const loggedMessage = consoleInfoSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('[TestContext]');
    });

    it('should log with metadata', async () => {
      const metadata = { userId: '123', action: 'login' };
      await logService.info('User action', undefined, metadata);
      expect(consoleInfoSpy).toHaveBeenCalled();
      const loggedMessage = consoleInfoSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('userId');
      expect(loggedMessage).toContain('123');
    });

    it('should log with both context and metadata', async () => {
      const metadata = { key: 'value' };
      await logService.info('Message', 'Context', metadata);
      expect(consoleInfoSpy).toHaveBeenCalled();
      const loggedMessage = consoleInfoSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('[Context]');
      expect(loggedMessage).toContain('key');
    });
  });

  describe('file logging', () => {
    beforeEach(() => {
      logService = new LogService({
        logToFile: true,
        logToConsole: false,
        logDirectory: '/tmp/logs',
      });
    });

    it('should write to file when logToFile is enabled', async () => {
      await logService.info('Test message');
      expect(fs.appendFile).toHaveBeenCalled();
    });

    it('should not write to console when logToConsole is disabled', async () => {
      await logService.info('Test message');
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it('should handle file write errors gracefully', async () => {
      (fs.appendFile as jest.Mock).mockImplementation((path, data, callback) =>
        callback(new Error('Write failed'))
      );

      await expect(logService.info('Test message')).rejects.toThrow('Write failed');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', async () => {
      await logService.updateConfig({ minLevel: 'error' });

      await logService.info('Should not log');
      expect(consoleInfoSpy).not.toHaveBeenCalled();

      await logService.error('Should log');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should reinitialize log file when directory changes', async () => {
      await logService.updateConfig({
        logToFile: true,
        logDirectory: '/new/path',
      });

      expect(fs.mkdirSync).toHaveBeenCalledWith('/new/path', { recursive: true });
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', async () => {
      const config = await logService.getConfig();
      expect(config).toHaveProperty('logToConsole');
      expect(config).toHaveProperty('minLevel');
    });

    it('should return a copy of config', async () => {
      const config1 = await logService.getConfig();
      const config2 = await logService.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('clearLogs', () => {
    beforeEach(() => {
      logService = new LogService({
        logToFile: true,
        logDirectory: '/tmp/logs',
      });
    });

    it('should clear log file', async () => {
      await logService.clearLogs();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle clear errors', async () => {
      (fs.writeFile as jest.Mock).mockImplementation((path, data, callback) =>
        callback(new Error('Clear failed'))
      );

      await expect(logService.clearLogs()).rejects.toThrow('Clear failed');
    });
  });

  describe('log rotation', () => {
    beforeEach(() => {
      // Mock multiple log files
      (fs.readdirSync as jest.Mock).mockReturnValue([
        'app-2024-01-01.log',
        'app-2024-01-02.log',
        'app-2024-01-03.log',
        'app-2024-01-04.log',
        'app-2024-01-05.log',
      ]);

      (fs.statSync as jest.Mock).mockImplementation((filePath) => {
        const fileName = path.basename(filePath);
        const dateMatch = fileName.match(/app-(\d{4}-\d{2}-\d{2})/);
        return {
          mtime: dateMatch ? new Date(dateMatch[1]) : new Date(),
        };
      });
    });

    it('should rotate old log files when max count is exceeded', () => {
      new LogService({
        logToFile: true,
        logDirectory: '/tmp/logs',
        maxLogFiles: 3,
      });

      // Should delete older files beyond maxLogFiles
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('log formatting', () => {
    it('should include timestamp in log entry', async () => {
      await logService.info('Test');
      const loggedMessage = consoleInfoSpy.mock.calls[0][0];
      // Should contain ISO timestamp format
      expect(loggedMessage).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format log level with proper padding', async () => {
      await logService.info('Test');
      const loggedMessage = consoleInfoSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('INFO');
    });

    it('should include the message', async () => {
      await logService.info('Test message');
      const loggedMessage = consoleInfoSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('Test message');
    });
  });
});
