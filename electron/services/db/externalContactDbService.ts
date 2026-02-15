/**
 * External Contact Database Service (TASK-1773, BACKLOG-569)
 *
 * Manages the external_contacts shadow table which caches macOS Contacts
 * with pre-computed last_message_at for instant sorted contact loading.
 *
 * Key Features:
 * - Caches macOS Contacts in local SQLite
 * - Stores last_message_at pre-computed from phone_last_message lookup
 * - Enables O(1) sorted contact retrieval (vs fresh macOS read every time)
 * - Background sync keeps data fresh without blocking UI
 */

import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbRun, dbGet, dbTransaction, ensureDb } from './core/dbConnection';
import logService from '../logService';
import { queryContacts, isPoolReady } from '../../workers/contactWorkerPool';

/**
 * External contact as stored in database
 */
export interface ExternalContact {
  id: string;
  user_id: string;
  name: string | null;
  phones: string[];        // Parsed from phones_json
  emails: string[];        // Parsed from emails_json
  company: string | null;
  last_message_at: string | null;
  external_record_id: string;  // Renamed from macos_record_id (Migration 27)
  source: 'macos' | 'iphone' | 'outlook';  // Source of contact (Migration 27, TASK-1920: added outlook)
  synced_at: string;
}

/**
 * External contact as returned from database (raw form with JSON strings)
 */
interface ExternalContactRow {
  id: string;
  user_id: string;
  name: string | null;
  phones_json: string | null;
  emails_json: string | null;
  company: string | null;
  last_message_at: string | null;
  external_record_id: string;  // Renamed from macos_record_id (Migration 27)
  source: string;              // New field: source of contact (Migration 27)
  synced_at: string;
}

/**
 * macOS Contact structure from Contacts API
 */
export interface MacOSContact {
  name: string;
  phones?: string[];
  emails?: string[];
  company?: string;
  recordId: string;  // macOS unique identifier
}

/**
 * iPhone Contact structure from iPhone sync (SPRINT-068, BACKLOG-585)
 */
export interface iPhoneContact {
  name: string;
  phones?: string[];
  emails?: string[];
  company?: string;
  recordId: string;  // iPhone backup contact ID (as string)
}

/**
 * Outlook Contact structure from Microsoft Graph API (TASK-1921)
 * Re-exported from outlookFetchService for convenience
 */
export interface OutlookContactInput {
  external_record_id: string;  // Graph API contact id
  name: string | null;
  emails: string[];
  phones: string[];
  company: string | null;
}

/**
 * Sync result statistics
 */
export interface SyncResult {
  inserted: number;
  updated: number;
  deleted: number;
  total: number;
}

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Get all external contacts for a user, sorted by last_message_at DESC
 * Uses NULLS LAST workaround for SQLite
 */
export function getAllForUser(userId: string): ExternalContact[] {
  // NULLS LAST: Sort NULL dates after non-NULL dates, then by name
  const sql = `
    SELECT id, user_id, name, phones_json, emails_json, company,
           last_message_at, external_record_id, source, synced_at
    FROM external_contacts
    WHERE user_id = ?
    ORDER BY last_message_at IS NULL, last_message_at DESC, name ASC
  `;

  const rows = dbAll<ExternalContactRow>(sql, [userId]);

  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    phones: JSON.parse(row.phones_json || '[]'),
    emails: JSON.parse(row.emails_json || '[]'),
    company: row.company,
    last_message_at: row.last_message_at,
    external_record_id: row.external_record_id,
    source: row.source as 'macos' | 'iphone' | 'outlook',
    synced_at: row.synced_at,
  }));
}

/**
 * TASK-1956: Async version of getAllForUser that runs the query via the
 * persistent worker pool. No new Worker() spawn per query.
 *
 * Falls back to sync getAllForUser if pool is not ready.
 *
 * @param userId - The user ID to query contacts for
 * @param timeoutMs - Maximum time to wait for the worker (default: 30000ms)
 * @returns Promise resolving to the same ExternalContact[] as getAllForUser
 */
export async function getAllForUserAsync(
  userId: string,
  timeoutMs: number = 30_000,
): Promise<ExternalContact[]> {
  if (!isPoolReady()) {
    // Fallback to sync version if pool not initialized
    return getAllForUser(userId);
  }

  const rawRows = await queryContacts('external', userId, timeoutMs) as ExternalContactRow[];

  return rawRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    phones: JSON.parse(row.phones_json || '[]'),
    emails: JSON.parse(row.emails_json || '[]'),
    company: row.company,
    last_message_at: row.last_message_at,
    external_record_id: row.external_record_id,
    source: row.source as 'macos' | 'iphone' | 'outlook',
    synced_at: row.synced_at,
  }));
}

/**
 * Get count of external contacts for a user
 */
export function getCount(userId: string): number {
  const result = dbGet<{ count: number }>(
    'SELECT COUNT(*) as count FROM external_contacts WHERE user_id = ?',
    [userId]
  );
  return result?.count || 0;
}

/**
 * Get the most recent sync time for a user
 */
export function getLastSyncTime(userId: string): string | null {
  const result = dbGet<{ synced_at: string }>(
    'SELECT MAX(synced_at) as synced_at FROM external_contacts WHERE user_id = ?',
    [userId]
  );
  return result?.synced_at || null;
}

/**
 * Check if sync is stale (older than specified hours)
 */
export function isStale(userId: string, maxAgeHours: number = 24): boolean {
  const lastSync = getLastSyncTime(userId);
  if (!lastSync) return true;

  const lastSyncDate = new Date(lastSync);
  const now = new Date();
  const hoursSinceSync = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60 * 60);

  return hoursSinceSync > maxAgeHours;
}

/**
 * Get contact counts grouped by source for a user (TASK-1991)
 * Returns how many external contacts exist per source (macos, iphone, outlook)
 */
export function getContactSourceStats(userId: string): Record<string, number> {
  const rows = dbAll<{ source: string; count: number }>(
    `SELECT source, COUNT(*) as count FROM external_contacts WHERE user_id = ? GROUP BY source`,
    [userId]
  );
  const stats: Record<string, number> = { macos: 0, iphone: 0, outlook: 0 };
  for (const row of rows) {
    stats[row.source] = row.count;
  }
  return stats;
}

// ============================================
// WRITE OPERATIONS
// ============================================

/**
 * Upsert contacts from macOS Contacts API
 * Returns count of contacts processed
 */
export function upsertFromMacOS(userId: string, contacts: MacOSContact[]): number {
  const now = new Date().toISOString();

  const stmt = `
    INSERT INTO external_contacts (id, user_id, name, phones_json, emails_json, company, external_record_id, source, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'macos', ?)
    ON CONFLICT(user_id, source, external_record_id) DO UPDATE SET
      name = excluded.name,
      phones_json = excluded.phones_json,
      emails_json = excluded.emails_json,
      company = excluded.company,
      synced_at = excluded.synced_at
  `;

  let count = 0;

  dbTransaction(() => {
    for (const contact of contacts) {
      dbRun(stmt, [
        uuidv4(),
        userId,
        contact.name || null,
        JSON.stringify(contact.phones || []),
        JSON.stringify(contact.emails || []),
        contact.company || null,
        contact.recordId,
        now,
      ]);
      count++;
    }
  });

  logService.info(`Upserted ${count} external contacts from macOS`, 'ExternalContactDbService', { userId });

  return count;
}

/**
 * Upsert contacts from iPhone sync (SPRINT-068, BACKLOG-585)
 * Returns count of contacts processed
 */
export function upsertFromiPhone(userId: string, contacts: iPhoneContact[]): number {
  const now = new Date().toISOString();

  const stmt = `
    INSERT INTO external_contacts (id, user_id, name, phones_json, emails_json, company, source, external_record_id, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, 'iphone', ?, ?)
    ON CONFLICT(user_id, source, external_record_id) DO UPDATE SET
      name = excluded.name,
      phones_json = excluded.phones_json,
      emails_json = excluded.emails_json,
      company = excluded.company,
      synced_at = excluded.synced_at
  `;

  let count = 0;

  dbTransaction(() => {
    for (const contact of contacts) {
      dbRun(stmt, [
        uuidv4(),
        userId,
        contact.name || null,
        JSON.stringify(contact.phones || []),
        JSON.stringify(contact.emails || []),
        contact.company || null,
        contact.recordId,
        now,
      ]);
      count++;
    }
  });

  logService.info(`Upserted ${count} external contacts from iPhone`, 'ExternalContactDbService', { userId });

  return count;
}

/**
 * Upsert contacts from Outlook via Microsoft Graph API (TASK-1921)
 * Returns count of contacts processed
 */
export function upsertFromOutlook(userId: string, contacts: OutlookContactInput[]): number {
  const now = new Date().toISOString();

  const stmt = `
    INSERT INTO external_contacts (id, user_id, name, phones_json, emails_json, company, source, external_record_id, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, 'outlook', ?, ?)
    ON CONFLICT(user_id, source, external_record_id) DO UPDATE SET
      name = excluded.name,
      phones_json = excluded.phones_json,
      emails_json = excluded.emails_json,
      company = excluded.company,
      synced_at = excluded.synced_at
  `;

  let count = 0;

  dbTransaction(() => {
    for (const contact of contacts) {
      dbRun(stmt, [
        uuidv4(),
        userId,
        contact.name || null,
        JSON.stringify(contact.phones || []),
        JSON.stringify(contact.emails || []),
        contact.company || null,
        contact.external_record_id,
        now,
      ]);
      count++;
    }
  });

  logService.info(`Upserted ${count} external contacts from Outlook`, 'ExternalContactDbService', { userId });

  return count;
}

/**
 * Full sync from Outlook contacts (TASK-1921)
 * - Upserts all contacts from Outlook
 * - Deletes Outlook contacts that no longer exist (only source='outlook')
 * - Updates last_message_at from phone_last_message lookup
 *
 * CRITICAL: Does NOT touch macos/iphone contacts — only manages 'outlook' source
 */
export function syncOutlookContacts(userId: string, outlookContacts: OutlookContactInput[]): SyncResult {
  const syncStartTime = new Date().toISOString();

  // Step 1: Upsert all Outlook contacts (sets synced_at to current time)
  const upsertCount = upsertFromOutlook(userId, outlookContacts);

  // Step 2: Delete stale Outlook contacts only (synced_at < syncStartTime, source='outlook')
  const deleteCount = deleteStaleContactsBySource(userId, 'outlook', syncStartTime);

  // Step 3: Update last_message_at from phone_last_message lookup table
  updateLastMessageAtFromLookupTable(userId);

  const result: SyncResult = {
    inserted: upsertCount,
    updated: 0,
    deleted: deleteCount,
    total: getCount(userId),
  };

  logService.info('Outlook contacts sync complete', 'ExternalContactDbService', {
    userId,
    ...result,
  });

  return result;
}

/**
 * Update last_message_at for all contacts using phone_last_message lookup table
 * Uses json_each() for proper JSON array phone matching (SR Engineer requirement)
 *
 * This is a batch operation that updates all contacts in one transaction.
 */
export function updateLastMessageAtFromLookupTable(userId: string): number {
  const db = ensureDb();

  // Batch update using json_each() to match phones in JSON array
  // SR Engineer requirement: Use json_each() NOT LIKE patterns
  const result = db.prepare(`
    UPDATE external_contacts
    SET last_message_at = (
      SELECT MAX(plm.last_message_at)
      FROM phone_last_message plm, json_each(external_contacts.phones_json) AS p
      WHERE plm.user_id = external_contacts.user_id
        AND plm.phone_normalized = SUBSTR(REPLACE(p.value, '+', ''), -10)
    )
    WHERE user_id = ?
  `).run(userId);

  logService.info(`Updated last_message_at for ${result.changes} external contacts`, 'ExternalContactDbService', { userId });

  return result.changes;
}

/**
 * Update last_message_at for a single phone number
 * Uses json_each() for proper JSON array phone matching
 *
 * Called after individual message imports to keep dates current.
 */
export function updateLastMessageAtForPhone(userId: string, normalizedPhone: string, lastMessageAt: string): number {
  const db = ensureDb();

  // Find and update contacts that have this phone number in their phones_json array
  // Uses json_each() to properly search the JSON array
  const result = db.prepare(`
    UPDATE external_contacts
    SET last_message_at = CASE
      WHEN last_message_at IS NULL OR last_message_at < ? THEN ?
      ELSE last_message_at
    END
    WHERE user_id = ?
      AND id IN (
        SELECT ec.id
        FROM external_contacts ec, json_each(ec.phones_json) AS p
        WHERE ec.user_id = ?
          AND SUBSTR(REPLACE(p.value, '+', ''), -10) = ?
      )
  `).run(lastMessageAt, lastMessageAt, userId, userId, normalizedPhone);

  return result.changes;
}

/**
 * Delete stale contacts that were not updated in the current sync
 * Used during full sync to remove contacts that no longer exist in macOS Contacts
 * @deprecated Use deleteStaleContactsBySource for source-specific cleanup
 */
export function deleteStaleContacts(userId: string, currentSyncTime: string): number {
  const result = dbRun(
    `DELETE FROM external_contacts WHERE user_id = ? AND synced_at < ?`,
    [userId, currentSyncTime]
  );

  if (result.changes > 0) {
    logService.info(`Deleted ${result.changes} stale external contacts`, 'ExternalContactDbService', { userId });
  }

  return result.changes;
}

/**
 * Delete stale contacts by source that were not updated in the current sync
 * Used during full sync to remove contacts that no longer exist in source system
 */
export function deleteStaleContactsBySource(userId: string, source: 'macos' | 'iphone' | 'outlook', currentSyncTime: string): number {
  const result = dbRun(
    `DELETE FROM external_contacts WHERE user_id = ? AND source = ? AND synced_at < ?`,
    [userId, source, currentSyncTime]
  );

  if (result.changes > 0) {
    logService.info(`Deleted ${result.changes} stale ${source} external contacts`, 'ExternalContactDbService', { userId });
  }

  return result.changes;
}

/**
 * Delete stale iPhone contacts (SPRINT-068, BACKLOG-585)
 * Only deletes contacts with source='iphone' that weren't updated in current sync
 */
export function deleteStaleIPhoneContacts(userId: string, currentSyncTime: string): number {
  return deleteStaleContactsBySource(userId, 'iphone', currentSyncTime);
}

/**
 * Delete a specific contact by macOS record ID
 */
export function deleteByMacOSRecordId(userId: string, recordId: string): void {
  dbRun(
    'DELETE FROM external_contacts WHERE user_id = ? AND source = ? AND external_record_id = ?',
    [userId, 'macos', recordId]
  );
}

/**
 * Clear all external contacts for a user
 */
export function clearAllForUser(userId: string): void {
  dbRun('DELETE FROM external_contacts WHERE user_id = ?', [userId]);
  logService.info('Cleared all external contacts', 'ExternalContactDbService', { userId });
}

// ============================================
// SYNC OPERATIONS
// ============================================

/**
 * Full sync from macOS Contacts
 * - Upserts all contacts from macOS
 * - Deletes contacts that no longer exist in macOS
 * - Updates last_message_at from phone_last_message lookup
 */
export function fullSync(userId: string, macOSContacts: MacOSContact[]): SyncResult {
  const syncStartTime = new Date().toISOString();

  // Step 1: Upsert all contacts (this sets synced_at to current time)
  const upsertCount = upsertFromMacOS(userId, macOSContacts);

  // Step 2: Delete contacts not in current sync (synced_at < syncStartTime)
  const deleteCount = deleteStaleContacts(userId, syncStartTime);

  // Step 3: Update last_message_at from phone_last_message lookup table
  updateLastMessageAtFromLookupTable(userId);

  const result: SyncResult = {
    inserted: upsertCount,  // This is actually upsert count (insert or update)
    updated: 0,             // We can't distinguish easily with UPSERT
    deleted: deleteCount,
    total: getCount(userId),
  };

  logService.info('External contacts full sync complete', 'ExternalContactDbService', {
    userId,
    ...result,
  });

  return result;
}

// ============================================
// SEARCH OPERATIONS
// ============================================

/**
 * Search external contacts by name, phone, or email
 * Useful for contact selection when user types a query
 */
export function search(userId: string, query: string, limit: number = 50): ExternalContact[] {
  const searchPattern = `%${query}%`;

  const sql = `
    SELECT id, user_id, name, phones_json, emails_json, company,
           last_message_at, external_record_id, source, synced_at
    FROM external_contacts
    WHERE user_id = ?
      AND (
        name LIKE ?
        OR phones_json LIKE ?
        OR emails_json LIKE ?
        OR company LIKE ?
      )
    ORDER BY last_message_at IS NULL, last_message_at DESC, name ASC
    LIMIT ?
  `;

  const rows = dbAll<ExternalContactRow>(sql, [
    userId,
    searchPattern,
    searchPattern,
    searchPattern,
    searchPattern,
    limit,
  ]);

  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    phones: JSON.parse(row.phones_json || '[]'),
    emails: JSON.parse(row.emails_json || '[]'),
    company: row.company,
    last_message_at: row.last_message_at,
    external_record_id: row.external_record_id,
    source: row.source as 'macos' | 'iphone' | 'outlook',
    synced_at: row.synced_at,
  }));
}
