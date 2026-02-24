/**
 * SyncOrchestratorService Tests
 *
 * TASK-2073: Tests for isRunning state transitions after sync completion.
 *
 * Key test cases:
 * 1. isRunning transitions to false after all sync items complete
 * 2. isRunning transitions to false after all sync items error
 * 3. isRunning transitions to false when sync is cancelled
 * 4. isRunning transitions to false even if startSync throws unexpectedly
 * 5. isRunning remains false when no sync functions are registered
 */

import type { SyncType } from '../SyncOrchestratorService';

// We need to test the class directly, so we import and construct a fresh instance.
// The module auto-initializes on import (calls initializeSyncFunctions), which
// requires window.api. We mock the minimum needed.

// Mock logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Sentry
jest.mock('@sentry/electron/renderer', () => ({
  addBreadcrumb: jest.fn(),
}));

// Mock platform
jest.mock('../../utils/platform', () => ({
  isMacOS: jest.fn(() => false),
}));

// Mock window.api to prevent auto-initialization from failing
Object.defineProperty(global, 'window', {
  value: {
    api: {
      preferences: { get: jest.fn() },
      contacts: { getAll: jest.fn(), syncOutlookContacts: jest.fn() },
      transactions: { scan: jest.fn() },
      messages: { importMacOSMessages: jest.fn(), onImportProgress: jest.fn() },
      notification: { send: jest.fn() },
    },
  },
  writable: true,
});

// Now import after mocks are set up
// Use require to get fresh module per test via jest.isolateModules if needed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { syncOrchestrator } = require('../SyncOrchestratorService');

describe('SyncOrchestratorService', () => {
  let stateHistory: Array<{ isRunning: boolean; currentSync: SyncType | null }>;
  let unsubscribe: () => void;

  beforeEach(() => {
    // Reset the orchestrator state
    syncOrchestrator.reset();

    // Clear any registered sync functions by re-initializing
    // Access private map for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (syncOrchestrator as any).syncFunctions = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (syncOrchestrator as any).initialized = false;

    // Track state changes
    stateHistory = [];
    unsubscribe = syncOrchestrator.subscribe((state: { isRunning: boolean; currentSync: SyncType | null }) => {
      stateHistory.push({
        isRunning: state.isRunning,
        currentSync: state.currentSync,
      });
    });
  });

  afterEach(() => {
    unsubscribe();
  });

  describe('isRunning state transitions', () => {
    it('should transition isRunning to false after all sync items complete successfully', async () => {
      // Register a sync function that resolves immediately
      syncOrchestrator.registerSyncFunction('contacts', async (_userId: string, onProgress: (p: number) => void) => {
        onProgress(50);
        onProgress(100);
      });

      const result = syncOrchestrator.requestSync({ types: ['contacts'], userId: 'test-user' });
      expect(result.started).toBe(true);

      // Wait for async startSync to complete
      // Since startSync is fire-and-forget, we need to flush microtasks
      await new Promise(resolve => setTimeout(resolve, 0));

      const state = syncOrchestrator.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentSync).toBeNull();

      // Verify the state history shows the transition: true -> false
      const isRunningHistory = stateHistory.map(s => s.isRunning);
      expect(isRunningHistory[0]).toBe(true); // First state change sets isRunning to true
      expect(isRunningHistory[isRunningHistory.length - 1]).toBe(false); // Last state change sets it to false
    });

    it('should transition isRunning to false after multiple sync items complete', async () => {
      syncOrchestrator.registerSyncFunction('contacts', async (_userId: string, onProgress: (p: number) => void) => {
        onProgress(100);
      });
      syncOrchestrator.registerSyncFunction('emails', async (_userId: string, onProgress: (p: number) => void) => {
        onProgress(100);
      });

      syncOrchestrator.requestSync({ types: ['contacts', 'emails'], userId: 'test-user' });

      await new Promise(resolve => setTimeout(resolve, 0));

      const state = syncOrchestrator.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentSync).toBeNull();
      // Both items should be complete
      expect(state.queue).toHaveLength(2);
      expect(state.queue[0].status).toBe('complete');
      expect(state.queue[1].status).toBe('complete');
    });

    it('should transition isRunning to false after all sync items error', async () => {
      syncOrchestrator.registerSyncFunction('contacts', async () => {
        throw new Error('Contacts sync failed');
      });
      syncOrchestrator.registerSyncFunction('emails', async () => {
        throw new Error('Emails sync failed');
      });

      syncOrchestrator.requestSync({ types: ['contacts', 'emails'], userId: 'test-user' });

      await new Promise(resolve => setTimeout(resolve, 0));

      const state = syncOrchestrator.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentSync).toBeNull();
      expect(state.queue[0].status).toBe('error');
      expect(state.queue[0].error).toBe('Contacts sync failed');
      expect(state.queue[1].status).toBe('error');
      expect(state.queue[1].error).toBe('Emails sync failed');
    });

    it('should transition isRunning to false after partial completion (some succeed, some error)', async () => {
      syncOrchestrator.registerSyncFunction('contacts', async (_userId: string, onProgress: (p: number) => void) => {
        onProgress(100);
      });
      syncOrchestrator.registerSyncFunction('emails', async () => {
        throw new Error('Email sync failed');
      });

      syncOrchestrator.requestSync({ types: ['contacts', 'emails'], userId: 'test-user' });

      await new Promise(resolve => setTimeout(resolve, 0));

      const state = syncOrchestrator.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentSync).toBeNull();
      expect(state.queue[0].status).toBe('complete');
      expect(state.queue[1].status).toBe('error');
    });

    it('should NOT set isRunning to true when no sync functions are registered', async () => {
      // No sync functions registered, request types that don't exist
      const result = syncOrchestrator.requestSync({ types: ['contacts'], userId: 'test-user' });

      // requestSync calls startSync which returns early for empty validTypes
      // But requestSync returns { started: true } because it's not checking validTypes
      // The important thing is isRunning stays false
      await new Promise(resolve => setTimeout(resolve, 0));

      const state = syncOrchestrator.getState();
      expect(state.isRunning).toBe(false);

      // State history should not contain isRunning: true since startSync returns
      // before setting it
      const hasRunning = stateHistory.some(s => s.isRunning === true);
      expect(hasRunning).toBe(false);
    });

    it('should transition isRunning to false after cancellation', async () => {
      let resolveSync: (() => void) | null = null;
      syncOrchestrator.registerSyncFunction('contacts', async () => {
        // This sync will hang until we resolve it
        await new Promise<void>(resolve => {
          resolveSync = resolve;
        });
      });

      syncOrchestrator.requestSync({ types: ['contacts'], userId: 'test-user' });

      // Give the sync a tick to start
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify it's running
      expect(syncOrchestrator.getState().isRunning).toBe(true);

      // Cancel the sync
      syncOrchestrator.cancel();

      // isRunning should be false after cancel
      expect(syncOrchestrator.getState().isRunning).toBe(false);

      // Clean up - resolve the pending promise
      if (resolveSync) resolveSync();
    });

    it('should transition isRunning to false even if sync function throws non-Error', async () => {
      syncOrchestrator.registerSyncFunction('contacts', async () => {
        // eslint-disable-next-line no-throw-literal
        throw 'string error';
      });

      syncOrchestrator.requestSync({ types: ['contacts'], userId: 'test-user' });

      await new Promise(resolve => setTimeout(resolve, 0));

      const state = syncOrchestrator.getState();
      expect(state.isRunning).toBe(false);
      expect(state.queue[0].status).toBe('error');
      expect(state.queue[0].error).toBe('Unknown error');
    });
  });

  describe('requestSync queuing', () => {
    it('should queue request when sync is already running', async () => {
      let resolveSync: (() => void) | null = null;
      syncOrchestrator.registerSyncFunction('contacts', async () => {
        await new Promise<void>(resolve => {
          resolveSync = resolve;
        });
      });

      // Start first sync
      const first = syncOrchestrator.requestSync({ types: ['contacts'], userId: 'test-user' });
      expect(first.started).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 0));

      // Try second sync while first is running
      const second = syncOrchestrator.requestSync({ types: ['contacts'], userId: 'test-user' });
      expect(second.started).toBe(false);
      expect(second.needsConfirmation).toBe(true);

      // Clean up
      syncOrchestrator.cancel();
      if (resolveSync) resolveSync();
    });
  });

  describe('subscriber notifications', () => {
    it('should notify subscribers of all state transitions including final isRunning=false', async () => {
      syncOrchestrator.registerSyncFunction('contacts', async (_userId: string, onProgress: (p: number) => void) => {
        onProgress(50);
        onProgress(100);
      });

      syncOrchestrator.requestSync({ types: ['contacts'], userId: 'test-user' });

      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify we received notifications
      expect(stateHistory.length).toBeGreaterThan(0);

      // First notification should have isRunning: true
      expect(stateHistory[0].isRunning).toBe(true);

      // Last notification should have isRunning: false
      expect(stateHistory[stateHistory.length - 1].isRunning).toBe(false);
      expect(stateHistory[stateHistory.length - 1].currentSync).toBeNull();
    });
  });
});
