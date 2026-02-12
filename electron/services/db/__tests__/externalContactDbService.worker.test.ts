/**
 * Unit tests for getAllForUserAsync (TASK-1956, BACKLOG-661)
 *
 * Tests the worker thread wrapper that offloads the external contacts
 * query to avoid blocking the Electron main process.
 */

// Mock worker_threads before any imports
const mockOn = jest.fn();
const mockTerminate = jest.fn();
const mockWorkerInstance = {
  on: mockOn,
  terminate: mockTerminate,
};

jest.mock('worker_threads', () => ({
  Worker: jest.fn().mockImplementation(() => mockWorkerInstance),
  parentPort: null,
  workerData: null,
}));

// Mock dbConnection to provide path and key
jest.mock('../core/dbConnection', () => ({
  getDbPath: jest.fn().mockReturnValue('/fake/path/mad.db'),
  getEncryptionKey: jest.fn().mockReturnValue('fake-encryption-key'),
  dbAll: jest.fn().mockReturnValue([]),
  dbRun: jest.fn().mockReturnValue({ lastInsertRowid: 0, changes: 0 }),
  dbGet: jest.fn().mockReturnValue(undefined),
  dbTransaction: jest.fn().mockImplementation((fn: () => unknown) => fn()),
  ensureDb: jest.fn(),
}));

jest.mock('../../logService', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { Worker } from 'worker_threads';
import { getDbPath, getEncryptionKey } from '../core/dbConnection';
import { getAllForUserAsync } from '../externalContactDbService';

describe('getAllForUserAsync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the on handler registry
    mockOn.mockReset();
    mockTerminate.mockReset();
  });

  it('should resolve with parsed contacts when worker succeeds', async () => {
    const mockRows = [
      {
        id: 'ext-1',
        user_id: 'user-1',
        name: 'John Doe',
        phones_json: '["555-1234"]',
        emails_json: '["john@example.com"]',
        company: 'Acme',
        last_message_at: '2026-01-01T00:00:00Z',
        external_record_id: 'record-1',
        source: 'macos',
        synced_at: '2026-01-01T00:00:00Z',
      },
    ];

    // Capture the 'message' handler when worker.on('message', ...) is called
    mockOn.mockImplementation((event: string, handler: (data: unknown) => void) => {
      if (event === 'message') {
        // Simulate worker posting a message immediately
        setTimeout(() => handler({ success: true, data: mockRows }), 0);
      }
    });

    const result = await getAllForUserAsync('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'ext-1',
      user_id: 'user-1',
      name: 'John Doe',
      phones: ['555-1234'],
      emails: ['john@example.com'],
      company: 'Acme',
      last_message_at: '2026-01-01T00:00:00Z',
      external_record_id: 'record-1',
      source: 'macos',
      synced_at: '2026-01-01T00:00:00Z',
    });

    // Verify Worker was constructed with correct params
    expect(Worker).toHaveBeenCalledWith(
      expect.stringContaining('contactQueryWorker'),
      expect.objectContaining({
        workerData: {
          dbPath: '/fake/path/mad.db',
          encryptionKey: 'fake-encryption-key',
          userId: 'user-1',
        },
      }),
    );
  });

  it('should parse empty phones_json and emails_json as empty arrays', async () => {
    const mockRows = [
      {
        id: 'ext-2',
        user_id: 'user-1',
        name: 'No Phones',
        phones_json: null,
        emails_json: null,
        company: null,
        last_message_at: null,
        external_record_id: 'record-2',
        source: 'outlook',
        synced_at: '2026-01-01T00:00:00Z',
      },
    ];

    mockOn.mockImplementation((event: string, handler: (data: unknown) => void) => {
      if (event === 'message') {
        setTimeout(() => handler({ success: true, data: mockRows }), 0);
      }
    });

    const result = await getAllForUserAsync('user-1');

    expect(result[0].phones).toEqual([]);
    expect(result[0].emails).toEqual([]);
  });

  it('should reject when worker posts an error message', async () => {
    mockOn.mockImplementation((event: string, handler: (data: unknown) => void) => {
      if (event === 'message') {
        setTimeout(() => handler({ success: false, error: 'Database encryption failed' }), 0);
      }
    });

    await expect(getAllForUserAsync('user-1')).rejects.toThrow('Database encryption failed');
  });

  it('should reject when worker emits an error event', async () => {
    mockOn.mockImplementation((event: string, handler: (data: unknown) => void) => {
      if (event === 'error') {
        setTimeout(() => handler(new Error('Worker crashed')), 0);
      }
    });

    await expect(getAllForUserAsync('user-1')).rejects.toThrow('Worker crashed');
  });

  it('should reject on timeout and terminate the worker', async () => {
    // Don't trigger any events - let it timeout
    mockOn.mockImplementation(() => {
      // No-op: worker never responds
    });

    const promise = getAllForUserAsync('user-1', 100); // 100ms timeout for fast test

    await expect(promise).rejects.toThrow('Contact query worker timed out after 100ms');
    expect(mockTerminate).toHaveBeenCalled();
  });

  it('should reject when database is not initialized (no path)', async () => {
    (getDbPath as jest.Mock).mockReturnValueOnce(null);

    await expect(getAllForUserAsync('user-1')).rejects.toThrow(
      'Database not initialized: missing path or encryption key',
    );

    // Worker should NOT be created
    expect(Worker).not.toHaveBeenCalled();
  });

  it('should reject when database is not initialized (no encryption key)', async () => {
    (getEncryptionKey as jest.Mock).mockReturnValueOnce(null);

    await expect(getAllForUserAsync('user-1')).rejects.toThrow(
      'Database not initialized: missing path or encryption key',
    );

    expect(Worker).not.toHaveBeenCalled();
  });

  it('should reject when worker exits with non-zero code', async () => {
    mockOn.mockImplementation((event: string, handler: (data: unknown) => void) => {
      if (event === 'exit') {
        setTimeout(() => handler(1), 0);
      }
    });

    await expect(getAllForUserAsync('user-1')).rejects.toThrow(
      'Contact query worker exited with code 1',
    );
  });
});
