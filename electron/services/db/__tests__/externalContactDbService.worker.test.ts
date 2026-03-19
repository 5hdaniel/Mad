/**
 * Unit tests for getAllForUserAsync (TASK-1956, BACKLOG-661)
 *
 * Tests the worker pool wrapper that offloads the external contacts
 * query to avoid blocking the Electron main process.
 *
 * Updated: Tests now mock contactWorkerPool (the actual dependency)
 * instead of worker_threads (the old direct-Worker implementation).
 */

const mockQueryContacts = jest.fn();
const mockIsPoolReady = jest.fn();

jest.mock('../../../workers/contactWorkerPool', () => ({
  queryContacts: mockQueryContacts,
  isPoolReady: mockIsPoolReady,
}));

// Mock dbConnection for the sync fallback path (getAllForUser)
const mockDbAll = jest.fn().mockReturnValue([]);
jest.mock('../core/dbConnection', () => ({
  getDbPath: jest.fn().mockReturnValue('/fake/path/mad.db'),
  getEncryptionKey: jest.fn().mockReturnValue('fake-encryption-key'),
  dbAll: mockDbAll,
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

import { getAllForUserAsync } from '../externalContactDbService';

describe('getAllForUserAsync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPoolReady.mockReturnValue(true);
  });

  it('should resolve with parsed contacts when worker pool returns rows', async () => {
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

    mockQueryContacts.mockResolvedValue(mockRows);

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

    expect(mockQueryContacts).toHaveBeenCalledWith('external', 'user-1', 30_000);
  });

  it('should parse null phones_json and emails_json as empty arrays', async () => {
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

    mockQueryContacts.mockResolvedValue(mockRows);

    const result = await getAllForUserAsync('user-1');

    expect(result[0].phones).toEqual([]);
    expect(result[0].emails).toEqual([]);
  });

  it('should reject when worker pool rejects with an error', async () => {
    mockQueryContacts.mockRejectedValue(new Error('Database encryption failed'));

    await expect(getAllForUserAsync('user-1')).rejects.toThrow('Database encryption failed');
  });

  it('should reject when worker pool times out', async () => {
    mockQueryContacts.mockRejectedValue(new Error('Contact query worker timed out after 100ms'));

    await expect(getAllForUserAsync('user-1', 100)).rejects.toThrow(
      'Contact query worker timed out after 100ms',
    );

    expect(mockQueryContacts).toHaveBeenCalledWith('external', 'user-1', 100);
  });

  it('should pass custom timeout to queryContacts', async () => {
    mockQueryContacts.mockResolvedValue([]);

    await getAllForUserAsync('user-1', 5000);

    expect(mockQueryContacts).toHaveBeenCalledWith('external', 'user-1', 5000);
  });

  it('should fall back to sync getAllForUser when pool is not ready', async () => {
    mockIsPoolReady.mockReturnValue(false);
    mockDbAll.mockReturnValue([
      {
        id: 'ext-3',
        user_id: 'user-1',
        name: 'Sync Contact',
        phones_json: '["555-9999"]',
        emails_json: '["sync@example.com"]',
        company: null,
        last_message_at: null,
        external_record_id: 'record-3',
        source: 'macos',
        synced_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await getAllForUserAsync('user-1');

    expect(mockQueryContacts).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Sync Contact');
    expect(result[0].phones).toEqual(['555-9999']);
  });

  it('should return empty array when pool returns no rows', async () => {
    mockQueryContacts.mockResolvedValue([]);

    const result = await getAllForUserAsync('user-1');

    expect(result).toEqual([]);
  });

  it('should propagate worker pool errors with original message', async () => {
    mockQueryContacts.mockRejectedValue(new Error('Worker crashed unexpectedly'));

    await expect(getAllForUserAsync('user-1')).rejects.toThrow('Worker crashed unexpectedly');
  });
});
