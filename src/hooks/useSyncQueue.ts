/**
 * useSyncQueue Hook
 *
 * React hook for accessing SyncQueueService state.
 * Provides reactive state updates and the service instance for mutations.
 *
 * @module hooks/useSyncQueue
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { syncQueue, SyncQueueState, SyncType } from '../services/SyncQueueService';

export interface UseSyncQueueReturn {
  /** Current sync state */
  state: SyncQueueState;
  /** Whether any sync is running */
  isRunning: boolean;
  /** Whether all syncs completed */
  isComplete: boolean;
  /** Queue and start a sync run */
  startSyncRun: (types: SyncType[]) => void;
  /** Mark a sync as started */
  markStarted: (type: SyncType) => void;
  /** Mark a sync as complete */
  markComplete: (type: SyncType) => void;
  /** Mark a sync as errored */
  markError: (type: SyncType, error: string) => void;
  /** Mark a sync as skipped */
  markSkipped: (type: SyncType) => void;
  /** Reset for a new sync run */
  reset: () => void;
}

/**
 * Hook to access sync queue state with React reactivity
 *
 * @param onAllComplete - Optional callback when all syncs complete
 */
export function useSyncQueue(onAllComplete?: () => void): UseSyncQueueReturn {
  const [state, setState] = useState<SyncQueueState>(syncQueue.getState);
  const onCompleteRef = useRef(onAllComplete);

  // Keep callback ref updated
  onCompleteRef.current = onAllComplete;

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = syncQueue.onStateChange(setState);
    return unsubscribe;
  }, []);

  // Subscribe to completion event
  useEffect(() => {
    const unsubscribe = syncQueue.onAllComplete(() => {
      onCompleteRef.current?.();
    });
    return unsubscribe;
  }, []);

  /**
   * Queue multiple sync types and mark the run as started
   */
  const startSyncRun = useCallback((types: SyncType[]) => {
    syncQueue.reset();
    types.forEach((type) => syncQueue.queue(type));
  }, []);

  const markStarted = useCallback((type: SyncType) => {
    syncQueue.start(type);
  }, []);

  const markComplete = useCallback((type: SyncType) => {
    syncQueue.complete(type);
  }, []);

  const markError = useCallback((type: SyncType, error: string) => {
    syncQueue.error(type, error);
  }, []);

  const markSkipped = useCallback((type: SyncType) => {
    syncQueue.skip(type);
  }, []);

  const reset = useCallback(() => {
    syncQueue.reset();
  }, []);

  return {
    state,
    isRunning: state.isRunning,
    isComplete: state.isComplete,
    startSyncRun,
    markStarted,
    markComplete,
    markError,
    markSkipped,
    reset,
  };
}

export default useSyncQueue;
