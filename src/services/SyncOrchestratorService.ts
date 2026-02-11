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

import { isMacOS } from '../utils/platform';

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
   * Initialize canonical sync functions.
   * Each sync function owns its IPC listeners internally.
   * Platform-specific functions are only registered on supported platforms.
   */
  initializeSyncFunctions(): void {
    if (this.initialized) {
      console.log('[SyncOrchestrator] Already initialized, skipping');
      return;
    }

    const macOS = isMacOS();
    console.log('[SyncOrchestrator] Initializing sync functions, isMacOS:', macOS);

    // Register contacts sync (macOS only - uses local Contacts database)
    if (macOS) {
      this.registerSyncFunction('contacts', async (userId, onProgress) => {
        console.log('[SyncOrchestrator] Starting contacts sync');
        onProgress(0);

        // IPC listener OWNED here - not in consumers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contactsApi = window.api.contacts as any;
        const cleanup = contactsApi?.onImportProgress
          ? contactsApi.onImportProgress((data: { percent: number }) => {
              onProgress(data.percent);
            })
          : () => {};

        try {
          const result = await window.api.contacts.getAll(userId);
          if (!result.success) {
            throw new Error(result.error || 'Contacts sync failed');
          }
          onProgress(100);
          console.log('[SyncOrchestrator] Contacts sync complete');
        } finally {
          cleanup();
        }
      });
    }

    // Register emails sync (all platforms - API-based)
    this.registerSyncFunction('emails', async (userId, onProgress) => {
      console.log('[SyncOrchestrator] Starting emails sync');
      onProgress(0);
      const result = await window.api.transactions.scan(userId);
      if (!result.success) {
        throw new Error(result.error || 'Email sync failed');
      }
      onProgress(100);
      console.log('[SyncOrchestrator] Emails sync complete');
    });

    // Register messages sync (macOS only - local iMessage database)
    if (macOS) {
      this.registerSyncFunction('messages', async (userId, onProgress) => {
        console.log('[SyncOrchestrator] Starting messages sync');

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
          console.log('[SyncOrchestrator] Messages sync complete, imported:', result.messagesImported);

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
    console.log('[SyncOrchestrator] Sync functions initialized');
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
      console.warn('[SyncOrchestrator] No valid sync types in request:', types);
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

      try {
        // Run the sync with progress callback
        const warning = await syncFn(userId, (percent, phase) => {
          this.updateQueueItem(type, { progress: percent, phase });
          this.updateOverallProgress();
        });

        // Mark complete (clear phase), attach warning if returned
        this.updateQueueItem(type, { status: 'complete', progress: 100, phase: undefined, warning: warning || undefined });
      } catch (error) {
        // Check if it was cancelled
        if (this.abortController?.signal.aborted) {
          break;
        }

        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SyncOrchestrator] ${type} sync failed:`, error);
        this.updateQueueItem(type, { status: 'error', error: errorMsg });
      }

      this.updateOverallProgress();
    }

    // Sync run complete
    this.setState({
      isRunning: false,
      currentSync: null,
    });
    this.abortController = null;
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
