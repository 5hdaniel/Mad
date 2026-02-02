/**
 * SyncQueueService
 *
 * Lightweight service to track sync operations and reliably detect completion.
 * Designed for sequential sync execution with reliable "all done" detection.
 *
 * Why this exists:
 * - useAutoRefresh has race conditions with IPC-based progress updates
 * - Need a single source of truth for "are we syncing" and "are we done"
 * - OS notification should fire exactly once when ALL syncs complete
 *
 * Usage:
 * 1. Call queue.start('contacts') before starting a sync
 * 2. Call queue.complete('contacts') when sync finishes (success or error)
 * 3. Subscribe to queue.onAllComplete() for notification trigger
 *
 * @module services/SyncQueueService
 */

export type SyncType = 'contacts' | 'emails' | 'messages';

export type SyncItemState = 'idle' | 'queued' | 'running' | 'complete' | 'error';

export interface SyncItem {
  type: SyncType;
  state: SyncItemState;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface SyncQueueState {
  contacts: SyncItem;
  emails: SyncItem;
  messages: SyncItem;
  /** True when a sync run is in progress */
  isRunning: boolean;
  /** True when all queued syncs have completed */
  isComplete: boolean;
  /** Timestamp when sync run started */
  runStartedAt: number | null;
  /** Timestamp when all syncs completed */
  runCompletedAt: number | null;
}

type StateChangeCallback = (state: SyncQueueState) => void;
type AllCompleteCallback = () => void;

const createInitialItem = (type: SyncType): SyncItem => ({
  type,
  state: 'idle',
});

const createInitialState = (): SyncQueueState => ({
  contacts: createInitialItem('contacts'),
  emails: createInitialItem('emails'),
  messages: createInitialItem('messages'),
  isRunning: false,
  isComplete: false,
  runStartedAt: null,
  runCompletedAt: null,
});

/**
 * SyncQueueService - singleton to track sync state
 */
class SyncQueueService {
  private state: SyncQueueState = createInitialState();
  private stateListeners: Set<StateChangeCallback> = new Set();
  private completeListeners: Set<AllCompleteCallback> = new Set();
  private queuedTypes: Set<SyncType> = new Set();

  /**
   * Get current state
   */
  getState(): SyncQueueState {
    return { ...this.state };
  }

  /**
   * Reset all state (call before starting a new sync run)
   */
  reset(): void {
    this.state = createInitialState();
    this.queuedTypes.clear();
    this.notifyStateChange();
  }

  /**
   * Queue a sync type to run (call before starting any syncs)
   * This lets the service know what syncs are expected
   */
  queue(type: SyncType): void {
    this.queuedTypes.add(type);
    this.state[type] = {
      type,
      state: 'queued',
    };

    if (!this.state.isRunning) {
      this.state.isRunning = true;
      this.state.isComplete = false;
      this.state.runStartedAt = Date.now();
      this.state.runCompletedAt = null;
    }

    this.notifyStateChange();
  }

  /**
   * Mark a sync as started (call when sync actually begins)
   */
  start(type: SyncType): void {
    // Auto-queue if not already queued
    if (!this.queuedTypes.has(type)) {
      this.queue(type);
    }

    this.state[type] = {
      type,
      state: 'running',
      startedAt: Date.now(),
    };
    this.notifyStateChange();
  }

  /**
   * Mark a sync as complete (call when sync finishes successfully)
   */
  complete(type: SyncType): void {
    this.state[type] = {
      ...this.state[type],
      state: 'complete',
      completedAt: Date.now(),
    };
    this.checkAllComplete();
    this.notifyStateChange();
  }

  /**
   * Mark a sync as errored (call when sync fails)
   */
  error(type: SyncType, errorMessage: string): void {
    this.state[type] = {
      ...this.state[type],
      state: 'error',
      error: errorMessage,
      completedAt: Date.now(),
    };
    this.checkAllComplete();
    this.notifyStateChange();
  }

  /**
   * Mark a sync as skipped (e.g., not on macOS, no email connected)
   * This removes it from the "queued" list so it doesn't block completion
   */
  skip(type: SyncType): void {
    this.queuedTypes.delete(type);
    this.state[type] = {
      type,
      state: 'complete', // Skipped = complete (nothing to do)
      completedAt: Date.now(),
    };
    this.checkAllComplete();
    this.notifyStateChange();
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateListeners.add(callback);
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  /**
   * Subscribe to "all syncs complete" event
   * Fires exactly once per sync run when all queued syncs finish
   */
  onAllComplete(callback: AllCompleteCallback): () => void {
    this.completeListeners.add(callback);
    return () => {
      this.completeListeners.delete(callback);
    };
  }

  /**
   * Check if all queued syncs are done (complete or error)
   */
  private checkAllComplete(): void {
    // If nothing was ever queued, not complete
    if (this.queuedTypes.size === 0) return;

    // Check if all queued types are done
    const allDone = Array.from(this.queuedTypes).every((type) => {
      const item = this.state[type];
      return item.state === 'complete' || item.state === 'error';
    });

    if (allDone && this.state.isRunning) {
      this.state.isRunning = false;
      this.state.isComplete = true;
      this.state.runCompletedAt = Date.now();

      // Notify completion listeners
      this.completeListeners.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error('[SyncQueue] Error in complete listener:', e);
        }
      });
    }
  }

  private notifyStateChange(): void {
    const snapshot = this.getState();
    this.stateListeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (e) {
        console.error('[SyncQueue] Error in state listener:', e);
      }
    });
  }
}

// Export singleton instance
export const syncQueue = new SyncQueueService();

// Export class for testing
export { SyncQueueService };
