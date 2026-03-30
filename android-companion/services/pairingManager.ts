/**
 * Pairing Manager (Android Companion)
 * Tracks consecutive sync failures and manages auto-unpairing logic.
 *
 * BACKLOG-1463: Pairing screen redesign
 *
 * Failure escalation:
 * - 1st fail:  Retry silently
 * - 3rd consecutive fail:  Show banner "Cannot reach desktop"
 * - After 24h offline:  Auto-unpair, prompt user to re-scan QR code
 * - On sign out:  Auto-unpair (clear AsyncStorage pairing data)
 * - On desktop disconnect:  Auto-unpair
 *
 * Storage keys:
 * - @keepr/pairing: Stored pairing info (shared with home screen)
 * - @keepr/pairing-health: Failure count + last success timestamp
 */

import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopBackgroundSync } from './backgroundSync';
import { resetAllSyncData } from './smsQueueService';

// ============================================
// CONSTANTS
// ============================================

const PAIRING_STORAGE_KEY = '@keepr/pairing';
const HEALTH_STORAGE_KEY = '@keepr/pairing-health';

/** Number of consecutive failures before showing warning banner */
const FAILURE_WARNING_THRESHOLD = 3;

/** Milliseconds offline before auto-unpairing (24 hours) */
const AUTO_UNPAIR_TIMEOUT_MS = 24 * 60 * 60 * 1000;

// ============================================
// TYPES
// ============================================

/** Connection health state persisted in AsyncStorage */
interface PairingHealth {
  /** Number of consecutive sync failures (resets on success) */
  consecutiveFailures: number;
  /** ISO timestamp of last successful sync */
  lastSuccessTime: string | null;
  /** ISO timestamp of first failure in current streak */
  firstFailureTime: string | null;
}

/** Connection status derived from pairing health */
export type ConnectionStatus = 'connected' | 'degraded' | 'disconnected';

const DEFAULT_HEALTH: PairingHealth = {
  consecutiveFailures: 0,
  lastSuccessTime: null,
  firstFailureTime: null,
};

// ============================================
// HEALTH TRACKING
// ============================================

/**
 * Record a successful sync. Resets the failure counter.
 */
export async function recordSyncSuccess(): Promise<void> {
  const health: PairingHealth = {
    consecutiveFailures: 0,
    lastSuccessTime: new Date().toISOString(),
    firstFailureTime: null,
  };
  await AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(health));
}

/**
 * Record a failed sync attempt. Increments the failure counter.
 */
export async function recordSyncFailure(): Promise<void> {
  const health = await getHealth();

  health.consecutiveFailures += 1;
  if (!health.firstFailureTime) {
    health.firstFailureTime = new Date().toISOString();
  }

  await AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(health));
}

/**
 * Check if the device should be auto-unpaired.
 * Returns true if 24+ hours have passed since the last successful sync
 * AND there have been consecutive failures.
 */
export async function shouldAutoUnpair(): Promise<boolean> {
  const health = await getHealth();

  // No failures — device is healthy
  if (health.consecutiveFailures === 0) {
    return false;
  }

  // Check if the first failure in this streak is older than 24h
  if (health.firstFailureTime) {
    const firstFailure = new Date(health.firstFailureTime).getTime();
    const elapsed = Date.now() - firstFailure;
    return elapsed >= AUTO_UNPAIR_TIMEOUT_MS;
  }

  return false;
}

/**
 * Auto-unpair the device: clear pairing data, stop background sync,
 * and reset sync queue data.
 */
export async function autoUnpair(): Promise<void> {
  Sentry.addBreadcrumb({
    category: 'pairing',
    message: 'Auto-unpair triggered (24h offline)',
    level: 'warning',
  });

  await Promise.all([
    AsyncStorage.removeItem(PAIRING_STORAGE_KEY),
    AsyncStorage.removeItem(HEALTH_STORAGE_KEY),
    resetAllSyncData(),
  ]);

  // Stop background sync task
  try {
    await stopBackgroundSync();
  } catch {
    // Non-fatal — task may not be registered
  }

  console.log('[PairingManager] Device auto-unpaired');
}

/**
 * Get the current connection status based on pairing health.
 *
 * - connected:    No recent failures
 * - degraded:     3+ consecutive failures (warning banner)
 * - disconnected: Not paired
 */
export async function getConnectionStatus(): Promise<ConnectionStatus> {
  // Check if paired at all
  const pairing = await AsyncStorage.getItem(PAIRING_STORAGE_KEY);
  if (!pairing) {
    return 'disconnected';
  }

  const health = await getHealth();

  let status: ConnectionStatus;
  if (health.consecutiveFailures >= FAILURE_WARNING_THRESHOLD) {
    status = 'degraded';
  } else {
    status = 'connected';
  }

  Sentry.addBreadcrumb({
    category: 'pairing',
    message: `Connection status: ${status}`,
    level: status === 'degraded' ? 'warning' : 'info',
    data: { consecutiveFailures: health.consecutiveFailures },
  });

  return status;
}

/**
 * Get the current failure count for display purposes.
 */
export async function getConsecutiveFailures(): Promise<number> {
  const health = await getHealth();
  return health.consecutiveFailures;
}

/**
 * Get the last successful sync time.
 */
export async function getLastSuccessTime(): Promise<string | null> {
  const health = await getHealth();
  return health.lastSuccessTime;
}

// ============================================
// INTERNAL HELPERS
// ============================================

async function getHealth(): Promise<PairingHealth> {
  try {
    const stored = await AsyncStorage.getItem(HEALTH_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_HEALTH };
    return JSON.parse(stored) as PairingHealth;
  } catch {
    return { ...DEFAULT_HEALTH };
  }
}
