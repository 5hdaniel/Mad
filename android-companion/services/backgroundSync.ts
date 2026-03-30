/**
 * Background Sync Service (Android Companion)
 * Manages periodic background sync of SMS messages to the Keepr desktop app.
 *
 * TASK-1430: SMS BroadcastReceiver + background sync service
 *
 * Uses expo-task-manager + expo-background-fetch to run periodic sync tasks:
 * 1. Read new SMS since last sync timestamp
 * 2. Queue messages locally
 * 3. Attempt to send to desktop via encrypted HTTP transport
 * 4. Update sync statistics
 *
 * Background fetch runs approximately every 15 minutes when the app is
 * backgrounded, subject to Android's battery optimization constraints.
 */

import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readSmsMessages } from "./smsReader";
import { readContacts } from "./contactReader";
import { sendMessages, sendContacts, pingDesktop } from "./syncService";
import {
  enqueueMessages,
  dequeueBatch,
  requeueMessages,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  recordSyncAttempt,
  getQueueSize,
} from "./smsQueueService";
import type { PairingInfo } from "../types/sync";

// ============================================
// CONSTANTS
// ============================================

/** Task identifier for the background sync task */
export const BACKGROUND_SYNC_TASK = "keepr-sms-background-sync";

/** Minimum interval between background fetches (seconds) */
const BACKGROUND_FETCH_INTERVAL = 15 * 60; // 15 minutes

/** Storage key for pairing info (matches pairing screen) */
const PAIRING_STORAGE_KEY = "@keepr/pairing";

// ============================================
// TASK DEFINITION
// ============================================

/**
 * Define the background sync task.
 * This must be called at module load time (outside of any component).
 *
 * TaskManager.defineTask must be called in the global scope, not inside
 * a React component or hook.
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const result = await performSync();

    if (result.newMessages > 0 || result.sentMessages > 0) {
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("[BackgroundSync] Task failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ============================================
// SYNC LOGIC
// ============================================

/** Result of a single sync operation */
export interface SyncOperationResult {
  /** Number of new messages read from SMS provider */
  newMessages: number;
  /** Number of messages successfully sent to desktop */
  sentMessages: number;
  /** Number of contacts synced to desktop (BACKLOG-1449) */
  contactsSynced: number;
  /** Whether the desktop was reachable */
  desktopReachable: boolean;
  /** Current queue size after this operation */
  queueSize: number;
  /** Error message if sync failed */
  error?: string;
}

/**
 * Perform a full sync cycle:
 * 1. Load pairing info
 * 2. Read new SMS since last sync
 * 3. Enqueue new messages
 * 4. Attempt to send queued messages to desktop
 * 5. Update sync stats
 *
 * This is called both by the background task and by the manual "Sync Now" button.
 */
export async function performSync(): Promise<SyncOperationResult> {
  // Load pairing info
  const pairingInfo = await loadPairingInfo();
  if (!pairingInfo) {
    return {
      newMessages: 0,
      sentMessages: 0,
      contactsSynced: 0,
      desktopReachable: false,
      queueSize: await getQueueSize(),
      error: "Not paired with a desktop",
    };
  }

  // Step 1: Read new SMS
  let newMessages = 0;
  try {
    const lastTimestamp = await getLastSyncTimestamp();
    const messages = await readSmsMessages(lastTimestamp);
    newMessages = messages.length;

    if (messages.length > 0) {
      await enqueueMessages(messages);

      // Update last sync timestamp to the newest message
      const newestTimestamp = Math.max(...messages.map((m) => m.timestamp));
      await setLastSyncTimestamp(newestTimestamp);
    }
  } catch (error) {
    console.error("[BackgroundSync] Failed to read SMS:", error);
    // Continue — we may still have queued messages to send
  }

  // Step 2: Check if desktop is reachable
  const desktopReachable = await pingDesktop(pairingInfo);
  if (!desktopReachable) {
    const queueSize = await getQueueSize();
    await recordSyncAttempt(false, 0);
    return {
      newMessages,
      sentMessages: 0,
      contactsSynced: 0,
      desktopReachable: false,
      queueSize,
      error: "Desktop not reachable",
    };
  }

  // Step 3: Send queued messages in batches
  let totalSent = 0;
  let sendError: string | undefined;

  // Keep sending batches until queue is empty or we hit an error
  let hasMore = true;
  while (hasMore) {
    const batch = await dequeueBatch();
    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    try {
      const result = await sendMessages(batch, pairingInfo);

      if (result.success) {
        totalSent += batch.length;
      } else {
        // Send failed — re-enqueue the batch for retry
        await requeueMessages(batch);
        sendError = result.error;
        hasMore = false;
      }
    } catch (error) {
      // Network error — re-enqueue the batch
      await requeueMessages(batch);
      sendError =
        error instanceof Error ? error.message : "Unknown send error";
      hasMore = false;
    }
  }

  // Step 4: Sync contacts (BACKLOG-1449)
  let contactsSynced = 0;
  try {
    const contacts = await readContacts();
    if (contacts.length > 0) {
      const contactResult = await sendContacts(contacts, pairingInfo);
      if (contactResult.success) {
        contactsSynced = contacts.length;
        console.log(`[BackgroundSync] Synced ${contacts.length} contacts`);
      } else {
        console.warn(
          `[BackgroundSync] Contact sync failed: ${contactResult.error}`
        );
      }
    }
  } catch (error) {
    console.error("[BackgroundSync] Failed to sync contacts:", error);
    // Non-fatal — message sync result is still valid
  }

  // Step 5: Record stats
  await recordSyncAttempt(totalSent > 0, totalSent);

  const queueSize = await getQueueSize();

  return {
    newMessages,
    sentMessages: totalSent,
    contactsSynced,
    desktopReachable: true,
    queueSize,
    error: sendError,
  };
}

// ============================================
// TASK REGISTRATION
// ============================================

/**
 * Register the background sync task with expo-background-fetch.
 * Should be called after pairing is established.
 */
export async function startBackgroundSync(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    BACKGROUND_SYNC_TASK
  );
  if (isRegistered) {
    console.log("[BackgroundSync] Task already registered");
    return;
  }

  await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    minimumInterval: BACKGROUND_FETCH_INTERVAL,
    stopOnTerminate: false,
    startOnBoot: true,
  });

  console.log("[BackgroundSync] Task registered");
}

/**
 * Unregister the background sync task.
 * Should be called when the device is unpaired.
 */
export async function stopBackgroundSync(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    BACKGROUND_SYNC_TASK
  );
  if (!isRegistered) {
    console.log("[BackgroundSync] Task not registered, nothing to stop");
    return;
  }

  await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
  console.log("[BackgroundSync] Task unregistered");
}

/**
 * Check if the background sync task is currently registered.
 */
export async function isBackgroundSyncActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
}

/**
 * Get the current background fetch status.
 * Returns information about whether background fetch is available on this device.
 */
export async function getBackgroundFetchStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
  return BackgroundFetch.getStatusAsync();
}

// ============================================
// HELPERS
// ============================================

/**
 * Load pairing info from AsyncStorage.
 * Returns null if not paired.
 */
async function loadPairingInfo(): Promise<PairingInfo | null> {
  try {
    const stored = await AsyncStorage.getItem(PAIRING_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as {
      ip: string;
      port: number;
      secret: string;
      deviceName: string;
    };

    // Convert stored pairing to PairingInfo format
    // The desktop generates a deviceId during QR pairing, but the stored
    // format from the pairing screen uses deviceName. We use the device name
    // as a fallback deviceId.
    return {
      ip: parsed.ip,
      port: parsed.port,
      secret: parsed.secret,
      deviceId: parsed.deviceName,
    };
  } catch {
    return null;
  }
}
