/**
 * SMS Queue Service (Android Companion)
 * Manages a local queue of SMS messages for reliable delivery to the desktop.
 *
 * TASK-1430: SMS BroadcastReceiver + background sync service
 *
 * Design:
 * - Messages are queued in AsyncStorage when the desktop is unreachable
 * - On sync: dequeue messages, encrypt, send via syncService
 * - Tracks last synced SMS timestamp to avoid re-sending
 * - Batches messages (up to 50 at a time) to avoid large payloads
 *
 * Storage keys:
 * - @keepr/sms-queue: Array of queued SyncMessage objects
 * - @keepr/last-sync-timestamp: Unix ms of the newest message successfully synced
 * - @keepr/sync-stats: Cumulative sync statistics
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SyncMessage } from "../types/sync";

// ============================================
// CONSTANTS
// ============================================

const QUEUE_STORAGE_KEY = "@keepr/sms-queue";
const LAST_SYNC_TIMESTAMP_KEY = "@keepr/last-sync-timestamp";
const SYNC_STATS_KEY = "@keepr/sync-stats";
const SYNC_INTERVAL_KEY = "@keepr/sync-interval";
const BACKGROUND_SYNC_ENABLED_KEY = "@keepr/background-sync-enabled";

/** Maximum messages to send in a single batch */
export const MAX_BATCH_SIZE = 50;

/** Maximum queue size before oldest messages are dropped */
const MAX_QUEUE_SIZE = 500;

// ============================================
// TYPES
// ============================================

/** Cumulative sync statistics */
export interface SyncStats {
  /** Total messages successfully synced since pairing */
  totalSynced: number;
  /** ISO timestamp of last successful sync */
  lastSyncTime: string | null;
  /** Number of sync attempts */
  syncAttempts: number;
  /** Number of successful sync attempts */
  successfulSyncs: number;
}

const DEFAULT_STATS: SyncStats = {
  totalSynced: 0,
  lastSyncTime: null,
  syncAttempts: 0,
  successfulSyncs: 0,
};

// ============================================
// QUEUE OPERATIONS
// ============================================

/**
 * Add messages to the sync queue.
 * If the queue exceeds MAX_QUEUE_SIZE, oldest messages are dropped.
 *
 * @param messages - Array of SyncMessage objects to queue
 */
export async function enqueueMessages(
  messages: SyncMessage[]
): Promise<void> {
  if (messages.length === 0) return;

  const current = await getQueue();
  const updated = [...current, ...messages];

  // Trim to MAX_QUEUE_SIZE, keeping newest messages
  const trimmed =
    updated.length > MAX_QUEUE_SIZE
      ? updated.slice(updated.length - MAX_QUEUE_SIZE)
      : updated;

  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trimmed));
}

/**
 * Dequeue up to MAX_BATCH_SIZE messages from the front of the queue.
 * Messages are removed from the queue — if send fails, they must be re-enqueued.
 *
 * @returns Array of up to MAX_BATCH_SIZE messages
 */
export async function dequeueBatch(): Promise<SyncMessage[]> {
  const current = await getQueue();
  if (current.length === 0) return [];

  const batch = current.slice(0, MAX_BATCH_SIZE);
  const remaining = current.slice(MAX_BATCH_SIZE);

  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));

  return batch;
}

/**
 * Return messages to the front of the queue (on failed send).
 * Used when a batch fails to send — re-enqueue so they are retried.
 *
 * @param messages - Messages to return to the queue
 */
export async function requeueMessages(
  messages: SyncMessage[]
): Promise<void> {
  if (messages.length === 0) return;

  const current = await getQueue();
  const updated = [...messages, ...current];

  // Trim to MAX_QUEUE_SIZE
  const trimmed =
    updated.length > MAX_QUEUE_SIZE
      ? updated.slice(updated.length - MAX_QUEUE_SIZE)
      : updated;

  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trimmed));
}

/**
 * Get the current queue contents without modifying them.
 *
 * @returns Array of queued SyncMessage objects
 */
export async function getQueue(): Promise<SyncMessage[]> {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as SyncMessage[];
  } catch {
    return [];
  }
}

/**
 * Get the number of messages currently in the queue.
 */
export async function getQueueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

/**
 * Clear all messages from the queue.
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
}

// ============================================
// LAST SYNC TIMESTAMP
// ============================================

/**
 * Get the timestamp of the newest SMS that was successfully synced.
 * Used to determine which messages are "new" on the next read.
 *
 * @returns Unix timestamp in ms, or 0 if never synced
 */
export async function getLastSyncTimestamp(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(LAST_SYNC_TIMESTAMP_KEY);
    if (!stored) return 0;
    const ts = parseInt(stored, 10);
    return isNaN(ts) ? 0 : ts;
  } catch {
    return 0;
  }
}

/**
 * Update the last sync timestamp.
 * Should be set to the newest message timestamp in the successfully synced batch.
 *
 * @param timestamp - Unix timestamp in ms
 */
export async function setLastSyncTimestamp(timestamp: number): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_TIMESTAMP_KEY, String(timestamp));
}

// ============================================
// SYNC STATISTICS
// ============================================

/**
 * Get cumulative sync statistics.
 */
export async function getSyncStats(): Promise<SyncStats> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_STATS_KEY);
    if (!stored) return { ...DEFAULT_STATS };
    return JSON.parse(stored) as SyncStats;
  } catch {
    return { ...DEFAULT_STATS };
  }
}

/**
 * Record a sync attempt and update statistics.
 *
 * @param success - Whether the sync was successful
 * @param messageCount - Number of messages in this batch (only counted on success)
 */
export async function recordSyncAttempt(
  success: boolean,
  messageCount: number
): Promise<void> {
  const stats = await getSyncStats();

  stats.syncAttempts += 1;

  if (success) {
    stats.successfulSyncs += 1;
    stats.totalSynced += messageCount;
    stats.lastSyncTime = new Date().toISOString();
  }

  await AsyncStorage.setItem(SYNC_STATS_KEY, JSON.stringify(stats));
}

// ============================================
// SYNC SETTINGS (BACKLOG-1464)
// ============================================

/** Valid sync interval values in minutes, or 'manual' to disable background sync */
export type SyncIntervalValue = 15 | 30 | 60 | "manual";

/** Default sync interval (15 minutes — Android's minimum for BackgroundFetch) */
export const DEFAULT_SYNC_INTERVAL: SyncIntervalValue = 15;

/**
 * Get the configured sync interval.
 * @returns The stored interval value, or DEFAULT_SYNC_INTERVAL if not set
 */
export async function getSyncInterval(): Promise<SyncIntervalValue> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_INTERVAL_KEY);
    if (!stored) return DEFAULT_SYNC_INTERVAL;
    if (stored === "manual") return "manual";
    const num = parseInt(stored, 10);
    if (num === 15 || num === 30 || num === 60) return num;
    return DEFAULT_SYNC_INTERVAL;
  } catch {
    return DEFAULT_SYNC_INTERVAL;
  }
}

/**
 * Set the sync interval preference.
 * @param interval - Interval in minutes (15/30/60) or 'manual'
 */
export async function setSyncInterval(
  interval: SyncIntervalValue
): Promise<void> {
  await AsyncStorage.setItem(SYNC_INTERVAL_KEY, String(interval));
}

/**
 * Get whether background sync is enabled.
 * Defaults to true (enabled).
 */
export async function getBackgroundSyncEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(BACKGROUND_SYNC_ENABLED_KEY);
    if (stored === null) return true; // Default: enabled
    return stored === "true";
  } catch {
    return true;
  }
}

/**
 * Set whether background sync is enabled.
 * @param enabled - true to enable, false to disable
 */
export async function setBackgroundSyncEnabled(
  enabled: boolean
): Promise<void> {
  await AsyncStorage.setItem(BACKGROUND_SYNC_ENABLED_KEY, String(enabled));
}

// ============================================
// RESET
// ============================================

/**
 * Reset all sync data (queue, timestamp, stats, settings).
 * Called when the device is unpaired.
 */
export async function resetAllSyncData(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(QUEUE_STORAGE_KEY),
    AsyncStorage.removeItem(LAST_SYNC_TIMESTAMP_KEY),
    AsyncStorage.removeItem(SYNC_STATS_KEY),
    AsyncStorage.removeItem(SYNC_INTERVAL_KEY),
    AsyncStorage.removeItem(BACKGROUND_SYNC_ENABLED_KEY),
  ]);
}
