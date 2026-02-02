/**
 * iPhone Sync Storage Service
 *
 * Persists extracted iPhone messages and contacts to the local database.
 * Called automatically after a successful iPhone sync completes.
 *
 * Uses async yielding to prevent blocking the main Electron process.
 */

import crypto from "crypto";
import log from "electron-log";
import databaseService from "./databaseService";
import * as externalContactDb from "./db/externalContactDbService";
import type { iOSMessage, iOSConversation } from "../types/iosMessages";
import type { iOSContact } from "../types/iosContacts";
import type { SyncResult } from "./syncOrchestrator";

/**
 * Result of persisting sync data
 */
export interface PersistResult {
  success: boolean;
  messagesStored: number;
  messagesSkipped: number;
  contactsStored: number;
  contactsSkipped: number;
  duration: number;
  error?: string;
}

/**
 * Progress callback for storage operations
 */
export type StorageProgressCallback = (progress: {
  phase: "messages" | "contacts";
  current: number;
  total: number;
  percent: number;
}) => void;

/**
 * Yield to event loop - allows UI to remain responsive
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// Input validation constants
const MAX_MESSAGE_TEXT_LENGTH = 100000; // 100KB - truncate extremely long messages
const MAX_HANDLE_LENGTH = 500; // Phone numbers, emails, etc.
const MAX_GUID_LENGTH = 100; // Message GUID format

/**
 * Sanitize and validate a string field
 * @param value - The value to sanitize
 * @param maxLength - Maximum allowed length
 * @param defaultValue - Default if null/undefined
 * @returns Sanitized string
 */
function sanitizeString(value: string | null | undefined, maxLength: number, defaultValue = ""): string {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  const str = String(value);
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

/**
 * Validate a GUID/external ID format
 * @param guid - The GUID to validate
 * @returns true if valid format
 */
function isValidGuid(guid: string | null | undefined): boolean {
  if (!guid || typeof guid !== "string") return false;
  // Allow alphanumeric, hyphens, underscores, and common GUID characters
  // iOS message GUIDs can be various formats
  return guid.length > 0 && guid.length <= MAX_GUID_LENGTH && /^[\w\-:.]+$/.test(guid);
}

/**
 * iPhone Sync Storage Service
 * Handles persistence of iPhone sync data to the local database
 */
class IPhoneSyncStorageService {
  private static readonly SERVICE_NAME = "IPhoneSyncStorageService";
  // Smaller batch size for better responsiveness
  private static readonly BATCH_SIZE = 500;
  // Yield every N batches to let event loop breathe
  private static readonly YIELD_INTERVAL = 2;

  /**
   * Persist all data from a sync result to the database
   */
  async persistSyncResult(
    userId: string,
    result: SyncResult,
    onProgress?: StorageProgressCallback
  ): Promise<PersistResult> {
    const startTime = Date.now();

    try {
      log.info(`[${IPhoneSyncStorageService.SERVICE_NAME}] Starting persistence`, {
        messages: result.messages.length,
        contacts: result.contacts.length,
        conversations: result.conversations.length,
      });

      // Store messages first (larger dataset)
      const messageResult = await this.storeMessages(
        userId,
        result.messages,
        result.conversations,
        (current, total) => {
          onProgress?.({
            phase: "messages",
            current,
            total,
            percent: Math.round((current / total) * 100),
          });
        }
      );

      // Store contacts
      const contactResult = await this.storeContacts(
        userId,
        result.contacts,
        (current, total) => {
          onProgress?.({
            phase: "contacts",
            current,
            total,
            percent: Math.round((current / total) * 100),
          });
        }
      );

      const duration = Date.now() - startTime;

      log.info(`[${IPhoneSyncStorageService.SERVICE_NAME}] Persistence complete`, {
        messagesStored: messageResult.stored,
        messagesSkipped: messageResult.skipped,
        contactsStored: contactResult.stored,
        contactsSkipped: contactResult.skipped,
        duration,
      });

      return {
        success: true,
        messagesStored: messageResult.stored,
        messagesSkipped: messageResult.skipped,
        contactsStored: contactResult.stored,
        contactsSkipped: contactResult.skipped,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      log.error(`[${IPhoneSyncStorageService.SERVICE_NAME}] Persistence failed`, {
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        messagesStored: 0,
        messagesSkipped: 0,
        contactsStored: 0,
        contactsSkipped: 0,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Store messages to the database with bulk insert
   * Uses async yielding to prevent blocking
   *
   * OPTIMIZED: Pre-loads all existing external_ids into a Set for O(1) lookup
   * instead of O(n) database queries per message
   */
  private async storeMessages(
    userId: string,
    messages: iOSMessage[],
    conversations: iOSConversation[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{ stored: number; skipped: number }> {
    if (messages.length === 0) {
      return { stored: 0, skipped: 0 };
    }

    // Build a map of message id -> chatId by looking through conversations
    const messageToChat = new Map<number, number>();
    for (const conv of conversations) {
      for (const msg of conv.messages) {
        messageToChat.set(msg.id, conv.chatId);
      }
    }

    let stored = 0;
    let skipped = 0;

    // Get database instance via public API
    const db = databaseService.getRawDatabase();

    // OPTIMIZATION: Load ALL existing external_ids into a Set (one query instead of 626k)
    // This gives us O(1) lookup instead of O(n) database queries
    log.info(`[${IPhoneSyncStorageService.SERVICE_NAME}] Loading existing message IDs for deduplication...`);
    const existingIds = new Set<string>();
    const existingRows = db.prepare(`
      SELECT external_id FROM messages
      WHERE user_id = ? AND external_id IS NOT NULL
    `).all(userId) as { external_id: string }[];
    for (const row of existingRows) {
      existingIds.add(row.external_id);
    }
    log.info(`[${IPhoneSyncStorageService.SERVICE_NAME}] Found ${existingIds.size} existing messages`);

    // Prepare the insert statement
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO messages (
        id, user_id, channel, external_id, direction,
        body_text, participants, thread_id, sent_at,
        has_attachments, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // Process in batches
    const totalBatches = Math.ceil(messages.length / IPhoneSyncStorageService.BATCH_SIZE);

    log.info(`[${IPhoneSyncStorageService.SERVICE_NAME}] Processing ${messages.length} messages in ${totalBatches} batches`);

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const start = batchNum * IPhoneSyncStorageService.BATCH_SIZE;
      const end = Math.min(start + IPhoneSyncStorageService.BATCH_SIZE, messages.length);
      const batch = messages.slice(start, end);

      // Use a transaction for each batch
      const insertBatch = db.transaction((msgs: iOSMessage[]) => {
        for (const msg of msgs) {
          // Validate GUID before using it
          if (!isValidGuid(msg.guid)) {
            log.warn(`[${IPhoneSyncStorageService.SERVICE_NAME}] Skipping message with invalid GUID`, {
              guid: msg.guid?.substring(0, 20),
            });
            skipped++;
            continue;
          }

          // O(1) lookup using Set instead of database query
          if (existingIds.has(msg.guid)) {
            skipped++;
            continue;
          }

          // Find the conversation/thread for this message
          const chatId = messageToChat.get(msg.id);
          const threadId = chatId ? `ios-chat-${chatId}` : null;

          // Map channel
          const channel = msg.service === "iMessage" ? "imessage" : "sms";

          // Map direction
          const direction = msg.isFromMe ? "outbound" : "inbound";

          // Sanitize user-provided data
          const sanitizedHandle = sanitizeString(msg.handle, MAX_HANDLE_LENGTH, "unknown");
          const sanitizedText = sanitizeString(msg.text, MAX_MESSAGE_TEXT_LENGTH, "");

          // Build participants JSON with sanitized data
          const participants = JSON.stringify({
            from: msg.isFromMe ? "me" : sanitizedHandle,
            to: msg.isFromMe ? [sanitizedHandle] : ["me"],
          });

          // Build metadata
          const metadata = JSON.stringify({
            source: "iphone_sync",
            originalId: msg.id,
            dateRead: msg.dateRead?.toISOString() || null,
            dateDelivered: msg.dateDelivered?.toISOString() || null,
            attachmentCount: msg.attachments.length,
          });

          try {
            insertStmt.run(
              crypto.randomUUID(), // id
              userId, // user_id
              channel, // channel
              msg.guid, // external_id (for deduplication) - already validated
              direction, // direction
              sanitizedText, // body_text - sanitized
              participants, // participants JSON - sanitized
              threadId, // thread_id
              msg.date.toISOString(), // sent_at
              msg.attachments.length > 0 ? 1 : 0, // has_attachments
              metadata // metadata
            );
            stored++;
            // Add to set so duplicates within same batch are caught
            existingIds.add(msg.guid);
          } catch (insertError) {
            // Log unexpected errors (not just duplicates)
            const errMsg = insertError instanceof Error ? insertError.message : "Unknown error";
            if (!errMsg.includes("UNIQUE constraint")) {
              log.warn(`[${IPhoneSyncStorageService.SERVICE_NAME}] Failed to insert message`, {
                guid: msg.guid,
                error: errMsg,
              });
            }
            skipped++;
          }
        }
      });

      // Execute batch
      insertBatch(batch);

      // Report progress
      onProgress?.(end, messages.length);

      // Yield to event loop every N batches to keep UI responsive
      if ((batchNum + 1) % IPhoneSyncStorageService.YIELD_INTERVAL === 0) {
        await yieldToEventLoop();
      }

      // Log progress every 10 batches
      if ((batchNum + 1) % 10 === 0) {
        log.info(`[${IPhoneSyncStorageService.SERVICE_NAME}] Progress: ${end}/${messages.length} messages (${Math.round((end / messages.length) * 100)}%)`);
      }
    }

    return { stored, skipped };
  }

  /**
   * Store contacts to the external_contacts table (SPRINT-068, BACKLOG-585)
   *
   * ARCHITECTURE CHANGE: iPhone contacts now go to external_contacts table
   * (same as macOS contacts) instead of the contacts table. This enables:
   * - Consistent contact name lookup on Windows via external_contacts
   * - Texts auto-attaching correctly by phone number matching
   * - Same UI experience as macOS
   *
   * Uses async yielding to prevent blocking
   */
  private async storeContacts(
    userId: string,
    contacts: iOSContact[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{ stored: number; skipped: number }> {
    if (contacts.length === 0) {
      return { stored: 0, skipped: 0 };
    }

    log.info(`[${IPhoneSyncStorageService.SERVICE_NAME}] Storing ${contacts.length} contacts to external_contacts`);

    // Convert iOSContact[] to iPhoneContact[] for externalContactDbService
    const iPhoneContacts: externalContactDb.iPhoneContact[] = contacts.map(contact => {
      const sanitizedDisplayName = sanitizeString(contact.displayName, MAX_HANDLE_LENGTH, "Unknown");
      const sanitizedOrganization = sanitizeString(contact.organization, MAX_HANDLE_LENGTH);

      return {
        name: sanitizedDisplayName,
        phones: contact.phoneNumbers
          .map(p => sanitizeString(p.normalizedNumber, MAX_HANDLE_LENGTH))
          .filter((p): p is string => !!p),
        emails: contact.emails
          .map(e => sanitizeString(e.email, MAX_HANDLE_LENGTH)?.toLowerCase())
          .filter((e): e is string => !!e),
        company: sanitizedOrganization || undefined,
        recordId: String(contact.id),  // iPhone contact ID as string
      };
    });

    // Report initial progress
    onProgress?.(0, contacts.length);
    await yieldToEventLoop();

    // Use the externalContactDbService to upsert contacts
    // This handles deduplication via UNIQUE(user_id, source, external_record_id)
    const stored = externalContactDb.upsertFromiPhone(userId, iPhoneContacts);

    // Report completion
    onProgress?.(contacts.length, contacts.length);

    log.info(`[${IPhoneSyncStorageService.SERVICE_NAME}] Stored ${stored} contacts to external_contacts`);

    return { stored, skipped: contacts.length - stored };
  }
}

// Export singleton instance
export const iPhoneSyncStorageService = new IPhoneSyncStorageService();
export default iPhoneSyncStorageService;
