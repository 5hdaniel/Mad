/**
 * Contact Query Worker (TASK-1956, BACKLOG-661)
 *
 * Runs the external_contacts query in a separate thread to avoid blocking
 * the Electron main process. With 1000+ contacts, the synchronous
 * better-sqlite3 query blocks the main thread for ~3.7s, freezing all UI.
 *
 * This worker:
 * 1. Opens its own encrypted SQLite connection via workerData
 * 2. Runs the getAllForUser query
 * 3. Posts raw rows back to the parent (JSON parsing done in parent)
 * 4. Closes the connection and exits
 *
 * Security: The encryption key is passed via workerData (same-process,
 * never crosses an IPC boundary).
 */

import { parentPort, workerData } from "worker_threads";
import Database from "better-sqlite3-multiple-ciphers";

interface ContactQueryWorkerData {
  dbPath: string;
  encryptionKey: string;
  userId: string;
}

const { dbPath, encryptionKey, userId } =
  workerData as ContactQueryWorkerData;

try {
  // Open a separate database connection (same file, WAL mode allows concurrent reads)
  const db = new Database(dbPath);

  // Configure encryption (must match main process settings in dbConnection.ts)
  db.pragma(`key = "x'${encryptionKey}'"`);
  db.pragma("cipher_compatibility = 4");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");

  // Run the same query as getAllForUser in externalContactDbService.ts
  const sql = `
    SELECT id, user_id, name, phones_json, emails_json, company,
           last_message_at, external_record_id, source, synced_at
    FROM external_contacts
    WHERE user_id = ?
    ORDER BY last_message_at IS NULL, last_message_at DESC, name ASC
  `;

  const rows = db.prepare(sql).all(userId);

  // Close connection before posting results
  db.close();

  parentPort?.postMessage({ success: true, data: rows });
} catch (error) {
  parentPort?.postMessage({
    success: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
