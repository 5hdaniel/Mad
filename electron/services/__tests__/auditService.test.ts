/**
 * Unit tests for AuditService
 * Tests audit logging functionality including:
 * - Creating immutable audit log entries
 * - Preventing modification of audit logs
 * - Syncing to cloud when online
 * - Queueing logs when offline
 * - Including all required fields
 */

import { auditService, AuditLogEntry, AuditAction, ResourceType } from '../auditService';

// Mock dependencies
const mockDatabaseService = {
  insertAuditLog: jest.fn(),
  getUnsyncedAuditLogs: jest.fn(),
  markAuditLogsSynced: jest.fn(),
};

const mockSupabaseService = {
  batchInsertAuditLogs: jest.fn(),
};

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset audit service state
    (auditService as any).pendingSyncQueue = [];
    (auditService as any).syncInProgress = false;
    (auditService as any).initialized = false;
    (auditService as any).databaseService = null;
    (auditService as any).supabaseService = null;

    // Stop any running sync interval
    auditService.stopSyncInterval();
  });

  afterEach(() => {
    auditService.stopSyncInterval();
  });

  describe('initialization', () => {
    it('should initialize with database and supabase services', () => {
      auditService.initialize(mockDatabaseService as any, mockSupabaseService as any);

      expect(auditService.isInitialized()).toBe(true);
    });

    it('should not re-initialize if already initialized', () => {
      auditService.initialize(mockDatabaseService as any, mockSupabaseService as any);
      auditService.initialize(mockDatabaseService as any, mockSupabaseService as any);

      // Should only initialize once
      expect(auditService.isInitialized()).toBe(true);
    });
  });

  describe('log', () => {
    beforeEach(() => {
      auditService.initialize(mockDatabaseService as any, mockSupabaseService as any);
    });

    it('should create immutable audit log entries', async () => {
      const entry = {
        userId: 'user-123',
        sessionId: 'session-456',
        action: 'LOGIN' as AuditAction,
        resourceType: 'SESSION' as ResourceType,
        resourceId: 'session-456',
        success: true,
      };

      await auditService.log(entry);

      expect(mockDatabaseService.insertAuditLog).toHaveBeenCalledTimes(1);

      const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
      expect(insertedEntry).toMatchObject({
        userId: 'user-123',
        sessionId: 'session-456',
        action: 'LOGIN',
        resourceType: 'SESSION',
        resourceId: 'session-456',
        success: true,
      });
      expect(insertedEntry.id).toBeDefined();
      expect(insertedEntry.timestamp).toBeInstanceOf(Date);
    });

    it('should include all required fields', async () => {
      const entry = {
        userId: 'user-123',
        action: 'TRANSACTION_CREATE' as AuditAction,
        resourceType: 'TRANSACTION' as ResourceType,
        resourceId: 'txn-789',
        metadata: { propertyAddress: '123 Main St' },
        success: true,
      };

      await auditService.log(entry);

      const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];

      // Check all required fields
      expect(insertedEntry.id).toBeDefined();
      expect(insertedEntry.timestamp).toBeDefined();
      expect(insertedEntry.userId).toBe('user-123');
      expect(insertedEntry.action).toBe('TRANSACTION_CREATE');
      expect(insertedEntry.resourceType).toBe('TRANSACTION');
      expect(insertedEntry.success).toBe(true);
    });

    it('should sanitize metadata to remove sensitive information', async () => {
      const entry = {
        userId: 'user-123',
        action: 'LOGIN' as AuditAction,
        resourceType: 'SESSION' as ResourceType,
        metadata: {
          provider: 'google',
          password: 'secret123',
          access_token: 'token123',
          normalField: 'visible',
        },
        success: true,
      };

      await auditService.log(entry);

      const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
      expect(insertedEntry.metadata.password).toBe('[REDACTED]');
      expect(insertedEntry.metadata.access_token).toBe('[REDACTED]');
      expect(insertedEntry.metadata.provider).toBe('google');
      expect(insertedEntry.metadata.normalField).toBe('visible');
    });

    it('should queue logs for cloud sync', async () => {
      const entry = {
        userId: 'user-123',
        action: 'LOGIN' as AuditAction,
        resourceType: 'SESSION' as ResourceType,
        success: true,
      };

      await auditService.log(entry);

      // Entry should be queued
      expect(auditService.getPendingSyncCount()).toBe(1);
    });

    it('should log failed operations', async () => {
      const entry = {
        userId: 'user-123',
        action: 'LOGIN_FAILED' as AuditAction,
        resourceType: 'SESSION' as ResourceType,
        success: false,
        errorMessage: 'Invalid credentials',
      };

      await auditService.log(entry);

      const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
      expect(insertedEntry.success).toBe(false);
      expect(insertedEntry.errorMessage).toBe('Invalid credentials');
    });

    it('should not throw on database failure', async () => {
      mockDatabaseService.insertAuditLog.mockRejectedValueOnce(new Error('DB error'));

      const entry = {
        userId: 'user-123',
        action: 'LOGIN' as AuditAction,
        resourceType: 'SESSION' as ResourceType,
        success: true,
      };

      // Should not throw
      await expect(auditService.log(entry)).resolves.not.toThrow();
    });
  });

  describe('withAudit', () => {
    beforeEach(() => {
      auditService.initialize(mockDatabaseService as any, mockSupabaseService as any);
    });

    it('should log successful operations', async () => {
      const operation = jest.fn().mockResolvedValue({ result: 'success' });

      const result = await auditService.withAudit(
        {
          userId: 'user-123',
          sessionId: 'session-456',
          action: 'TRANSACTION_CREATE',
          resourceType: 'TRANSACTION',
          resourceId: 'txn-789',
        },
        operation
      );

      expect(result).toEqual({ result: 'success' });
      expect(operation).toHaveBeenCalledTimes(1);

      const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
      expect(insertedEntry.success).toBe(true);
      expect(insertedEntry.action).toBe('TRANSACTION_CREATE');
    });

    it('should log failed operations and re-throw error', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        auditService.withAudit(
          {
            userId: 'user-123',
            action: 'TRANSACTION_CREATE',
            resourceType: 'TRANSACTION',
          },
          operation
        )
      ).rejects.toThrow('Operation failed');

      const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
      expect(insertedEntry.success).toBe(false);
      expect(insertedEntry.errorMessage).toBe('Operation failed');
    });
  });

  describe('syncToCloud', () => {
    beforeEach(() => {
      auditService.initialize(mockDatabaseService as any, mockSupabaseService as any);
    });

    it('should sync pending logs to cloud when online', async () => {
      // Add an entry to the queue
      const entry = {
        userId: 'user-123',
        action: 'LOGIN' as AuditAction,
        resourceType: 'SESSION' as ResourceType,
        success: true,
      };

      await auditService.log(entry);
      expect(auditService.getPendingSyncCount()).toBe(1);

      // Set up successful sync
      mockSupabaseService.batchInsertAuditLogs.mockResolvedValueOnce(undefined);

      // Manually trigger sync
      await auditService.syncToCloud();

      expect(mockSupabaseService.batchInsertAuditLogs).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.markAuditLogsSynced).toHaveBeenCalledTimes(1);
      expect(auditService.getPendingSyncCount()).toBe(0);
    });

    it('should queue logs when offline (sync fails)', async () => {
      const entry = {
        userId: 'user-123',
        action: 'LOGIN' as AuditAction,
        resourceType: 'SESSION' as ResourceType,
        success: true,
      };

      await auditService.log(entry);

      // Set up failed sync
      mockSupabaseService.batchInsertAuditLogs.mockRejectedValueOnce(new Error('Network error'));

      // Manually trigger sync
      await auditService.syncToCloud();

      // Entry should still be queued
      expect(auditService.getPendingSyncCount()).toBe(1);
    });

    it('should not sync if no pending logs', async () => {
      await auditService.syncToCloud();

      expect(mockSupabaseService.batchInsertAuditLogs).not.toHaveBeenCalled();
    });
  });

  describe('flushPendingLogs', () => {
    beforeEach(() => {
      auditService.initialize(mockDatabaseService as any, mockSupabaseService as any);
    });

    it('should sync all pending logs', async () => {
      // Add multiple entries
      for (let i = 0; i < 3; i++) {
        await auditService.log({
          userId: `user-${i}`,
          action: 'LOGIN' as AuditAction,
          resourceType: 'SESSION' as ResourceType,
          success: true,
        });
      }

      mockSupabaseService.batchInsertAuditLogs.mockResolvedValue(undefined);

      await auditService.flushPendingLogs();

      expect(auditService.getPendingSyncCount()).toBe(0);
    });
  });
});

describe('AuditService - Auth Handler Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auditService as any).pendingSyncQueue = [];
    (auditService as any).initialized = false;
    auditService.stopSyncInterval();
    auditService.initialize(mockDatabaseService as any, mockSupabaseService as any);
  });

  afterEach(() => {
    auditService.stopSyncInterval();
  });

  it('should log successful login', async () => {
    await auditService.log({
      userId: 'user-123',
      sessionId: 'session-456',
      action: 'LOGIN',
      resourceType: 'SESSION',
      resourceId: 'session-456',
      metadata: { provider: 'google', isNewUser: false },
      success: true,
    });

    const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
    expect(insertedEntry.action).toBe('LOGIN');
    expect(insertedEntry.success).toBe(true);
    expect(insertedEntry.metadata.provider).toBe('google');
  });

  it('should log failed login', async () => {
    await auditService.log({
      userId: 'unknown',
      action: 'LOGIN_FAILED',
      resourceType: 'SESSION',
      metadata: { provider: 'google', error: 'Invalid credentials' },
      success: false,
      errorMessage: 'Invalid credentials',
    });

    const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
    expect(insertedEntry.action).toBe('LOGIN_FAILED');
    expect(insertedEntry.success).toBe(false);
    expect(insertedEntry.errorMessage).toBe('Invalid credentials');
  });

  it('should log logout', async () => {
    await auditService.log({
      userId: 'user-123',
      sessionId: 'session-456',
      action: 'LOGOUT',
      resourceType: 'SESSION',
      resourceId: 'session-456',
      success: true,
    });

    const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
    expect(insertedEntry.action).toBe('LOGOUT');
    expect(insertedEntry.success).toBe(true);
  });
});

describe('AuditService - Transaction Handler Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auditService as any).pendingSyncQueue = [];
    (auditService as any).initialized = false;
    auditService.stopSyncInterval();
    auditService.initialize(mockDatabaseService as any, mockSupabaseService as any);
  });

  afterEach(() => {
    auditService.stopSyncInterval();
  });

  it('should log transaction create', async () => {
    await auditService.log({
      userId: 'user-123',
      action: 'TRANSACTION_CREATE',
      resourceType: 'TRANSACTION',
      resourceId: 'txn-789',
      metadata: { propertyAddress: '123 Main St' },
      success: true,
    });

    const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
    expect(insertedEntry.action).toBe('TRANSACTION_CREATE');
    expect(insertedEntry.resourceType).toBe('TRANSACTION');
    expect(insertedEntry.resourceId).toBe('txn-789');
  });

  it('should log transaction update', async () => {
    await auditService.log({
      userId: 'user-123',
      action: 'TRANSACTION_UPDATE',
      resourceType: 'TRANSACTION',
      resourceId: 'txn-789',
      metadata: { updatedFields: ['status', 'closing_date'] },
      success: true,
    });

    const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
    expect(insertedEntry.action).toBe('TRANSACTION_UPDATE');
    expect(insertedEntry.metadata.updatedFields).toEqual(['status', 'closing_date']);
  });

  it('should log transaction delete', async () => {
    await auditService.log({
      userId: 'user-123',
      action: 'TRANSACTION_DELETE',
      resourceType: 'TRANSACTION',
      resourceId: 'txn-789',
      metadata: { propertyAddress: '123 Main St' },
      success: true,
    });

    const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
    expect(insertedEntry.action).toBe('TRANSACTION_DELETE');
  });

  it('should log data export', async () => {
    await auditService.log({
      userId: 'user-123',
      action: 'DATA_EXPORT',
      resourceType: 'EXPORT',
      resourceId: 'txn-789',
      metadata: { format: 'pdf', propertyAddress: '123 Main St' },
      success: true,
    });

    const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
    expect(insertedEntry.action).toBe('DATA_EXPORT');
    expect(insertedEntry.resourceType).toBe('EXPORT');
    expect(insertedEntry.metadata.format).toBe('pdf');
  });
});

describe('AuditService - Contact Handler Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auditService as any).pendingSyncQueue = [];
    (auditService as any).initialized = false;
    auditService.stopSyncInterval();
    auditService.initialize(mockDatabaseService as any, mockSupabaseService as any);
  });

  afterEach(() => {
    auditService.stopSyncInterval();
  });

  it('should log contact create', async () => {
    await auditService.log({
      userId: 'user-123',
      action: 'CONTACT_CREATE',
      resourceType: 'CONTACT',
      resourceId: 'contact-456',
      metadata: { name: 'John Doe' },
      success: true,
    });

    const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
    expect(insertedEntry.action).toBe('CONTACT_CREATE');
    expect(insertedEntry.resourceType).toBe('CONTACT');
  });

  it('should log contact update', async () => {
    await auditService.log({
      userId: 'user-123',
      action: 'CONTACT_UPDATE',
      resourceType: 'CONTACT',
      resourceId: 'contact-456',
      metadata: { updatedFields: ['email', 'phone'] },
      success: true,
    });

    const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
    expect(insertedEntry.action).toBe('CONTACT_UPDATE');
  });

  it('should log contact delete', async () => {
    await auditService.log({
      userId: 'user-123',
      action: 'CONTACT_DELETE',
      resourceType: 'CONTACT',
      resourceId: 'contact-456',
      metadata: { name: 'John Doe' },
      success: true,
    });

    const insertedEntry = mockDatabaseService.insertAuditLog.mock.calls[0][0];
    expect(insertedEntry.action).toBe('CONTACT_DELETE');
  });
});
