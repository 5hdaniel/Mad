/**
 * SyncOrchestratorService
 *
 * Centralized sync orchestration for all data sources.
 * Handles sync ordering, conflict resolution, and state tracking.
 *
 * Features:
 * - Accepts ordered sync requests: ['contacts', 'emails', 'messages']
 * - Runs syncs sequentially in specified order
 * - One canonical sync function per source type
 * - Handles conflicts (sync in progress → queue or force)
 * - Tracks state for UI (queue order, current sync, progress)
 *
 * @module services/SyncOrchestratorService
 */

import * as Sentry from "@sentry/electron/renderer";
import { isMacOS } from '../utils/platform';
import type { ImportSource, UserPreferences } from './settingsService';
import logger from '../utils/logger';

export type SyncType = 'contacts' | 'emails' | 'messages';

export type SyncItemStatus = 'pending' | 'running' | 'complete' | 'error';

export interface SyncItem {
  type: SyncType;
  status: SyncItemStatus;
  progress: number;  // 0-100
  error?: string;
  /** Optional phase label for display (e.g., "querying", "attachments") */
  phase?: string;
  /** Optional warning message (e.g., message cap exceeded) */
  warning?: string;
}

export interface SyncOrchestratorState {
  isRunning: boolean;
  queue: SyncItem[];           // Ordered queue with status
  currentSync: SyncType | null;
  overallProgress: number;     // 0-100
  pendingRequest: SyncRequest | null;  // Queued request waiting for user decision
}

export interface SyncRequest {
  types: SyncType[];
  userId: string;
}

/** Sync functions can optionally return a warning string (e.g., "cap exceeded") */
type SyncFunction = (userId: string, onProgress: (percent: number, phase?: string) => void) => Promise<string | void>;

type StateListener = (state: SyncOrchestratorState) => void;

class SyncOrchestratorServiceClass {
  private state: SyncOrchestratorState = {
    isRunning: false,
    queue: [],
    currentSync: null,
    overallProgress: 0,
    pendingRequest: null,
  };

  private listeners: Set<StateListener> = new Set();
  private abortController: AbortController | null = null;

  // Canonical sync functions - one per type
  private syncFunctions: Map<SyncType, SyncFunction> = new Map();

  // Track if sync functions have been initialized
  private initialized = false;

  /**
   * Register a sync function for a type.
   * Each type should have exactly one canonical sync function.
   */
  registerSyncFunction(type: SyncType, fn: SyncFunction): void {
    this.syncFunctions.set(type, fn);
  }

  /**
   * Read the import source preference fresh from DB.
   * Returns 'macos-native' (default) or 'iphone-sync'.
   * TASK-1979: Read at sync time to avoid stale cached values.
   */
  private async getImportSource(userId: string): Promise<ImportSource> {
    try {
      const result = await window.api.preferences.get(userId);
      const prefs = result.preferences as UserPreferences | undefined;
      if (result.success && prefs?.messages?.source) {
        return prefs.messages.source;
      }
    } catch (err) {
      logger.warn('[SyncOrchestrator] Failed to read import source preference, defaulting to macos-native:', err);
    }
    return 'macos-native';
  }

  /**
   * Read all contacts-related preferences in a single IPC call.
   * Returns import source and contact source preferences together.
   * TASK-2098: Consolidated to avoid duplicate preferences.get calls per sync.
   */
  private async getContactsSyncPreferences(userId: string): Promise<{
    importSource: ImportSource;
    contactSources: { macosContacts: boolean; outlookContacts: boolean };
  }> {
    const defaults = {
      importSource: 'macos-native' as ImportSource,
      contactSources: { macosContacts: true, outlookContacts: true },
    };

    try {
      const result = await window.api.preferences.get(userId);
      const prefs = result.preferences as UserPreferences | undefined;
      if (!result.success || !prefs) return defaults;

      // Extract import source (TASK-1979)
      const importSource: ImportSource = prefs.messages?.source ?? 'macos-native';

      // Extract contact source preferences (TASK-2098)
      const direct = prefs.contactSources?.direct;
      const contactSources = {
        macosContacts: typeof direct?.macosContacts === 'boolean' ? direct.macosContacts : true,
        outlookContacts: typeof direct?.outlookContacts === 'boolean' ? direct.outlookContacts : true,
      };

      return { importSource, contactSources };
    } catch (err) {
      logger.warn('[SyncOrchestrator] Failed to read contacts sync preferences, using defaults:', err);
      return defaults;
    }
  }

  /**
   * Initialize canonical sync functions.
   * Each sync function owns its IPC listeners internally.
   * Platform-specific functions are only registered on supported platforms.
   */
  initializeSyncFunctions(): void {
    if (this.initialized) {
      logger.info('[SyncOrchestrator] Already initialized, skipping');
      return;
    }

    const macOS = isMacOS();
    logger.info('[SyncOrchestrator] Initializing sync functions, isMacOS:', macOS);

    // Register contacts sync (macOS Contacts + Outlook contacts on all platforms)
    // TASK-1953: Always register contacts sync so Outlook contacts work on all platforms
    // TASK-2098: Read contact source preferences to conditionally skip phases
    this.registerSyncFunction('contacts', async (userId, onProgress) => {
      logger.info('[SyncOrchestrator] Starting contacts sync');
      onProgress(0);

      // TASK-2098: Read both import source and contact source preferences in one IPC call
      const { importSource, contactSources: sourcePrefs } = await this.getContactsSyncPreferences(userId);
      logger.info('[SyncOrchestrator] Import source preference:', importSource);
      logger.info('[SyncOrchestrator] Contact source preferences:', sourcePrefs);

      // Phase 1: macOS Contacts sync (macOS only, skip if iphone-sync selected or source disabled)
      if (macOS && importSource !== 'iphone-sync' && sourcePrefs.macosContacts) {
        const result = await window.api.contacts.syncExternal(userId);
        if (!result.success) {
          throw new Error(result.error || 'macOS Contacts sync failed');
        }
        logger.info('[SyncOrchestrator] macOS Contacts sync complete');
      } else if (macOS && !sourcePrefs.macosContacts) {
        logger.info('[SyncOrchestrator] Skipping macOS Contacts (disabled by user preference)');
      } else if (macOS && importSource === 'iphone-sync') {
        logger.info('[SyncOrchestrator] Skipping macOS Contacts (import source: iphone-sync)');
      }

      onProgress(50);

      // Phase 2: Outlook contacts sync (all platforms, non-fatal, skip if source disabled)
      // TASK-1953: Outlook contacts sync via Graph API
      // TASK-2098: Skip if user disabled Outlook contacts in onboarding/settings
      if (!sourcePrefs.outlookContacts) {
        logger.info('[SyncOrchestrator] Skipping Outlook contacts (disabled by user preference)');
      } else {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const contactsApi = window.api.contacts as any;
          const outlookResult = await contactsApi.syncOutlookContacts(userId);
          if (outlookResult.success) {
            logger.info('[SyncOrchestrator] Outlook contacts synced:', outlookResult.count);
          } else if (outlookResult.reconnectRequired) {
            logger.warn('[SyncOrchestrator] Outlook contacts need reconnection');
          } else {
            logger.warn('[SyncOrchestrator] Outlook contacts sync returned error:', outlookResult.error);
          }
        } catch (err) {
          // Don't fail the whole contacts sync if Outlook fails
          logger.warn('[SyncOrchestrator] Outlook contacts sync failed (non-fatal):', err);
          Sentry.addBreadcrumb({
            category: 'sync',
            message: 'Outlook contacts sync failed (non-fatal)',
            level: 'warning',
            data: {
              syncType: 'contacts',
              provider: 'outlook',
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }

      onProgress(100);
      logger.info('[SyncOrchestrator] All contacts sync complete');
    });

    // Register emails sync (all platforms - API-based)
    this.registerSyncFunction('emails', async (userId, onProgress) => {
      logger.info('[SyncOrchestrator] Starting emails sync');
      onProgress(0);
      const result = await window.api.transactions.scan(userId);
      if (!result.success) {
        throw new Error(result.error || 'Email sync failed');
      }
      onProgress(100);
      logger.info('[SyncOrchestrator] Emails sync complete');
    });

    // Register messages sync (macOS only - local iMessage database)
    if (macOS) {
      this.registerSyncFunction('messages', async (userId, onProgress) => {
        logger.info('[SyncOrchestrator] Starting messages sync');

        // TASK-1979: Skip macOS Messages import when iphone-sync is selected
        const importSource = await this.getImportSource(userId);
        if (importSource === 'iphone-sync') {
          logger.info('[SyncOrchestrator] Skipping macOS Messages (import source: iphone-sync)');
          onProgress(100);
          return;
        }

        // Phase order and weighted progress calculation
        // Dynamically detect if 'deleting' phase is present (forceReimport mode)
        let hasDeletePhase = false;

        // IPC listener OWNED here - not in consumers
        const cleanup = window.api.messages.onImportProgress((data) => {
          // Detect if we're in forceReimport mode (has deleting phase)
          if (data.phase === 'deleting') {
            hasDeletePhase = true;
          }

          // Use 4 phases if deleting is present, otherwise 3
          const phases = hasDeletePhase
            ? ['querying', 'deleting', 'importing', 'attachments']
            : ['querying', 'importing', 'attachments'];
          const n = phases.length;

          // Calculate weighted progress: step_index * (100/n) + ipc_progress / n
          const stepIndex = phases.indexOf(data.phase);
          const weightedProgress = stepIndex >= 0
            ? Math.round(stepIndex * (100 / n) + data.percent / n)
            : data.percent;
          onProgress(weightedProgress, data.phase);
        });

        try {
          const result = await window.api.messages.importMacOSMessages(userId);
          if (!result.success) {
            throw new Error(result.error || 'Message import failed');
          }
          onProgress(100);
          logger.info('[SyncOrchestrator] Messages sync complete, imported:', result.messagesImported);

          // Return warning if message cap was exceeded
          if (result.wasCapped && result.totalAvailable) {
            const excluded = result.totalAvailable - result.messagesImported;
            return `${excluded.toLocaleString()} messages excluded by import limit. Adjust in Settings.`;
          }
        } finally {
          cleanup();
        }
      });
    }

    this.initialized = true;
    logger.info('[SyncOrchestrator] Sync functions initialized');
  }

  /**
   * Get current state
   */
  getState(): SyncOrchestratorState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  private setState(partial: Partial<SyncOrchestratorState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  /**
   * Request a sync. If sync is in progress, queues as pending request.
   * Returns true if sync started, false if queued (needs user decision).
   */
  requestSync(request: SyncRequest): { started: boolean; needsConfirmation: boolean } {
    Sentry.addBreadcrumb({
      category: 'sync',
      message: `Sync requested: ${request.types.join(', ')}`,
      level: 'info',
      data: {
        syncTypes: request.types,
        userId: request.userId.substring(0, 8) + '...',
        alreadyRunning: this.state.isRunning,
      },
    });

    if (this.state.isRunning) {
      // Sync in progress - queue this request for user decision
      this.setState({ pendingRequest: request });
      return { started: false, needsConfirmation: true };
    }

    // No sync in progress - start immediately
    this.startSync(request);
    return { started: true, needsConfirmation: false };
  }

  /**
   * Force sync - abandons current sync and starts new one
   */
  forceSync(request: SyncRequest): void {
    this.cancel();
    this.setState({ pendingRequest: null });
    this.startSync(request);
  }

  /**
   * Accept the pending request (user confirmed)
   */
  acceptPendingRequest(): void {
    const pending = this.state.pendingRequest;
    if (!pending) return;

    this.forceSync(pending);
  }

  /**
   * Reject the pending request (user cancelled)
   */
  rejectPendingRequest(): void {
    this.setState({ pendingRequest: null });
  }

  /**
   * Cancel current sync
   */
  cancel(): void {
    Sentry.addBreadcrumb({
      category: 'sync',
      message: 'Sync cancelled',
      level: 'info',
      data: {
        currentSync: this.state.currentSync,
        queueLength: this.state.queue.length,
      },
    });

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setState({
      isRunning: false,
      queue: [],
      currentSync: null,
      overallProgress: 0,
    });
  }

  /**
   * Reset state (e.g., on logout)
   */
  reset(): void {
    this.cancel();
    this.setState({ pendingRequest: null });
  }

  /**
   * Start sync with given request
   */
  private async startSync(request: SyncRequest): Promise<void> {
    const { types, userId } = request;

    // Filter to only types that have registered sync functions
    const validTypes = types.filter((type) => this.syncFunctions.has(type));
    if (validTypes.length === 0) {
      logger.warn('[SyncOrchestrator] No valid sync types in request:', types);
      return;
    }

    // Initialize queue with pending status
    const queue: SyncItem[] = validTypes.map((type) => ({
      type,
      status: 'pending',
      progress: 0,
    }));

    this.abortController = new AbortController();
    this.setState({
      isRunning: true,
      queue,
      currentSync: null,
      overallProgress: 0,
    });

    try {
      // Run syncs sequentially
      for (let i = 0; i < validTypes.length; i++) {
        // Check if cancelled
        if (this.abortController?.signal.aborted) {
          break;
        }

        const type = validTypes[i];
        const syncFn = this.syncFunctions.get(type);
        if (!syncFn) continue;

        // Update current sync
        this.updateQueueItem(type, { status: 'running', progress: 0 });
        this.setState({ currentSync: type });

        Sentry.addBreadcrumb({
          category: 'sync',
          message: `Sync started: ${type}`,
          level: 'info',
          data: {
            syncType: type,
            userId: userId.substring(0, 8) + '...',
            queuePosition: i + 1,
            queueTotal: validTypes.length,
          },
        });

        try {
          // Run the sync with progress callback
          const warning = await syncFn(userId, (percent, phase) => {
            this.updateQueueItem(type, { progress: percent, phase });
            this.updateOverallProgress();
          });

          Sentry.addBreadcrumb({
            category: 'sync',
            message: `Sync completed: ${type}`,
            level: 'info',
            data: {
              syncType: type,
              hadWarning: !!warning,
            },
          });

          // Mark complete (clear phase), attach warning if returned
          this.updateQueueItem(type, { status: 'complete', progress: 100, phase: undefined, warning: warning || undefined });
        } catch (error) {
          // Check if it was cancelled
          if (this.abortController?.signal.aborted) {
            break;
          }

          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`[SyncOrchestrator] ${type} sync failed:`, error);
          this.updateQueueItem(type, { status: 'error', error: errorMsg });
        }

        this.updateOverallProgress();
      }
    } finally {
      // Defensive: ALWAYS reset isRunning when startSync exits, regardless of
      // how the loop terminates (normal completion, cancellation, or unexpected error).
      // This prevents the UI from getting stuck in a permanent "syncing" state.
      this.setState({
        isRunning: false,
        currentSync: null,
      });
      this.abortController = null;
    }
  }

  private updateQueueItem(type: SyncType, updates: Partial<SyncItem>): void {
    const queue = this.state.queue.map((item) =>
      item.type === type ? { ...item, ...updates } : item
    );
    this.setState({ queue });
  }

  private updateOverallProgress(): void {
    const { queue } = this.state;
    if (queue.length === 0) {
      this.setState({ overallProgress: 0 });
      return;
    }

    // Calculate weighted progress
    const totalProgress = queue.reduce((sum, item) => sum + item.progress, 0);
    const overallProgress = Math.round(totalProgress / queue.length);
    this.setState({ overallProgress });
  }
}

// Singleton instance
export const syncOrchestrator = new SyncOrchestratorServiceClass();

// Auto-initialize on module load (renderer process only)
if (typeof window !== 'undefined') {
  syncOrchestrator.initializeSyncFunctions();
}

export default syncOrchestrator;
