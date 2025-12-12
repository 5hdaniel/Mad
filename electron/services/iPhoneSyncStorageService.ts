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

    // Get database instance
    const db = (databaseService as any)._ensureDb();

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

          // Build participants JSON
          const participants = JSON.stringify({
            from: msg.isFromMe ? "me" : msg.handle,
            to: msg.isFromMe ? [msg.handle] : ["me"],
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
              msg.guid, // external_id (for deduplication)
              direction, // direction
              msg.text || "", // body_text
              participants, // participants JSON
              threadId, // thread_id
              msg.date.toISOString(), // sent_at
              msg.attachments.length > 0 ? 1 : 0, // has_attachments
              metadata // metadata
            );
            stored++;
            // Add to set so duplicates within same batch are caught
            existingIds.add(msg.guid);
          } catch (insertError) {
            // Likely a duplicate - skip silently
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
   * Store contacts to the database
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

    let stored = 0;
    let skipped = 0;

    const db = (databaseService as any)._ensureDb();

    // Prepare statements
    // Note: We populate both 'name' (legacy column) and 'display_name' (new column) for compatibility
    const insertContactStmt = db.prepare(`
      INSERT INTO contacts (id, user_id, name, display_name, company, source, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'contacts_app', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const insertPhoneStmt = db.prepare(`
      INSERT OR IGNORE INTO contact_phones (id, contact_id, phone_e164, phone_display, label, source, created_at)
      VALUES (?, ?, ?, ?, ?, 'import', CURRENT_TIMESTAMP)
    `);

    const insertEmailStmt = db.prepare(`
      INSERT OR IGNORE INTO contact_emails (id, contact_id, email, label, source, created_at)
      VALUES (?, ?, ?, ?, 'import', CURRENT_TIMESTAMP)
    `);

    // Check if contact exists by looking up phone numbers
    const checkPhoneStmt = db.prepare(`
      SELECT c.id FROM contacts c
      JOIN contact_phones cp ON c.id = cp.contact_id
      WHERE c.user_id = ? AND cp.phone_e164 = ?
      LIMIT 1
    `);

    // Process contacts
    const processContact = db.transaction((contact: iOSContact) => {
      // Check if any of the contact's phones already exist
      let existingContactId: string | null = null;
      for (const phone of contact.phoneNumbers) {
        if (phone.normalizedNumber) {
          const existing = checkPhoneStmt.get(userId, phone.normalizedNumber) as { id: string } | undefined;
          if (existing) {
            existingContactId = existing.id;
            break;
          }
        }
      }

      if (existingContactId) {
        // Contact already exists - add any new phones/emails
        for (const phone of contact.phoneNumbers) {
          if (phone.normalizedNumber) {
            try {
              insertPhoneStmt.run(
                crypto.randomUUID(),
                existingContactId,
                phone.normalizedNumber,
                phone.number,
                phone.label || "mobile"
              );
            } catch {
              // Duplicate phone, ignore
            }
          }
        }

        for (const email of contact.emails) {
          try {
            insertEmailStmt.run(
              crypto.randomUUID(),
              existingContactId,
              email.email.toLowerCase(),
              email.label || "home"
            );
          } catch {
            // Duplicate email, ignore
          }
        }

        skipped++;
        return;
      }

      // Create new contact
      const contactId = crypto.randomUUID();
      const metadata = JSON.stringify({
        source: "iphone_sync",
        originalId: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
      });

      insertContactStmt.run(
        contactId,
        userId,
        contact.displayName,  // name (legacy)
        contact.displayName,  // display_name (new)
        contact.organization || null,
        metadata
      );

      // Add phone numbers
      for (const phone of contact.phoneNumbers) {
        if (phone.normalizedNumber) {
          insertPhoneStmt.run(
            crypto.randomUUID(),
            contactId,
            phone.normalizedNumber,
            phone.number,
            phone.label || "mobile"
          );
        }
      }

      // Add emails
      for (const email of contact.emails) {
        insertEmailStmt.run(
          crypto.randomUUID(),
          contactId,
          email.email.toLowerCase(),
          email.label || "home"
        );
      }

      stored++;
    });

    // Process each contact with periodic yielding
    for (let i = 0; i < contacts.length; i++) {
      try {
        processContact(contacts[i]);
      } catch (error) {
        log.warn(`[${IPhoneSyncStorageService.SERVICE_NAME}] Failed to store contact`, {
          displayName: contacts[i].displayName,
          error: error instanceof Error ? error.message : "Unknown",
        });
        skipped++;
      }

      // Report progress every 50 contacts
      if ((i + 1) % 50 === 0 || i === contacts.length - 1) {
        onProgress?.(i + 1, contacts.length);
        // Yield to event loop
        await yieldToEventLoop();
      }
    }

    return { stored, skipped };
  }
}

// Export singleton instance
export const iPhoneSyncStorageService = new IPhoneSyncStorageService();
export default iPhoneSyncStorageService;
