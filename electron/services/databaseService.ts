/**
 * Database Service - Facade Layer
 *
 * This service acts as a thin facade over the domain-specific db/* services.
 * It provides backward compatibility for existing consumers while delegating
 * all operations to the appropriate domain service.
 *
 * ARCHITECTURE:
 * - Initialization, encryption, and migration logic lives here
 * - Domain operations (CRUD) delegate to db/* services
 * - 37 consumer files import from here for backward compatibility
 *
 * SECURITY: Database is encrypted at rest using SQLCipher (AES-256)
 * Encryption key is stored in OS keychain via Electron safeStorage
 *
 * @see electron/services/db/ for domain-specific implementations
 */

import Database from "better-sqlite3-multiple-ciphers";
import type { Database as DatabaseType } from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { app } from "electron";
import logService from "./logService";
import {
  setDb,
  setDbPath,
  setEncryptionKey,
  closeDb,
  vacuumDb,
} from "./db/core/dbConnection";

// Import types
import type {
  User,
  NewUser,
  Contact,
  NewContact,
  ContactFilters,
  Transaction,
  NewTransaction,
  TransactionFilters,
  TransactionWithContacts,
  Communication,
  NewCommunication,
  CommunicationFilters,
  UserFeedback,
  OAuthToken,
  Session,
  OAuthProvider,
  OAuthPurpose,
  IDatabaseService,
  IgnoredCommunication,
  NewIgnoredCommunication,
  Message,
} from "../types";

import { DatabaseError, NotFoundError } from "../types";
import { databaseEncryptionService } from "./databaseEncryptionService";
import type { AuditLogEntry, AuditLogDbRow } from "./auditService";

// Import domain services for delegation
import * as userDb from "./db/userDbService";
import * as sessionDb from "./db/sessionDbService";
import * as oauthDb from "./db/oauthTokenDbService";
import * as transactionDb from "./db/transactionDbService";
import * as contactDb from "./db/contactDbService";
import * as transactionContactDb from "./db/transactionContactDbService";
import * as communicationDb from "./db/communicationDbService";
import * as feedbackDb from "./db/feedbackDbService";
import * as auditDb from "./db/auditLogDbService";

// Re-export types for backward compatibility
export type { ContactAssignmentOperation } from "./db/transactionContactDbService";
export type {
  TransactionContactData,
  TransactionContactResult,
} from "./db/transactionContactDbService";
export type { ContactWithActivity, TransactionWithRoles } from "./db/contactDbService";

/**
 * DatabaseService - Facade for all database operations
 *
 * Maintains backward compatibility while delegating to domain services.
 * Only initialization, encryption, and migration logic remains here.
 */
class DatabaseService implements IDatabaseService {
  private db: DatabaseType | null = null;
  private dbPath: string | null = null;
  private encryptionKey: string | null = null;

  // ============================================
  // INITIALIZATION & LIFECYCLE (Keep in facade)
  // ============================================

  /**
   * Initialize database - creates DB file and tables if needed
   * Handles encryption and migration from unencrypted databases
   */
  async initialize(): Promise<boolean> {
    if (this.db) {
      await logService.debug("Database already initialized, skipping", "DatabaseService");
      return true;
    }

    try {
      const userDataPath = app.getPath("userData");
      this.dbPath = path.join(userDataPath, "mad.db");

      await logService.info("Initializing database", "DatabaseService", { path: this.dbPath });

      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      await databaseEncryptionService.initialize();
      this.encryptionKey = await databaseEncryptionService.getEncryptionKey();

      const needsMigration = await this._checkMigrationNeeded();
      if (needsMigration) {
        await logService.info("Migrating existing database to encrypted storage", "DatabaseService");
        await this._migrateToEncryptedDatabase();
      }

      this.db = this._openDatabase();

      // Share connection with dbConnection module for sub-services
      setDb(this.db);
      setDbPath(this.dbPath);
      setEncryptionKey(this.encryptionKey);

      await this.runMigrations();

      await logService.debug("Database initialized successfully with encryption", "DatabaseService");
      return true;
    } catch (error) {
      await logService.error("Failed to initialize database", "DatabaseService", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.db !== null;
  }

  private _ensureDb(): DatabaseType {
    if (!this.db) {
      throw new DatabaseError("Database is not initialized. Call initialize() first.");
    }
    return this.db;
  }

  getRawDatabase(): DatabaseType {
    return this._ensureDb();
  }

  private _openDatabase(): DatabaseType {
    if (!this.dbPath) throw new DatabaseError("Database path is not set");
    if (!this.encryptionKey) throw new DatabaseError("Encryption key is not set");

    const db = new Database(this.dbPath);
    db.pragma(`key = "x'${this.encryptionKey}'"`);
    db.pragma("cipher_compatibility = 4");
    db.pragma("foreign_keys = ON");

    try {
      db.pragma("cipher_integrity_check");
    } catch {
      throw new DatabaseError("Failed to decrypt database. Encryption key may be invalid.");
    }

    return db;
  }

  private async _checkMigrationNeeded(): Promise<boolean> {
    if (!this.dbPath || !fs.existsSync(this.dbPath)) return false;
    const isEncrypted = await databaseEncryptionService.isDatabaseEncrypted(this.dbPath);
    return !isEncrypted;
  }

  private async _migrateToEncryptedDatabase(): Promise<void> {
    if (!this.dbPath || !this.encryptionKey) {
      throw new DatabaseError("Database path or encryption key not set");
    }

    const unencryptedPath = this.dbPath;
    const backupPath = `${this.dbPath}.backup`;
    const encryptedPath = `${this.dbPath}.encrypted`;

    try {
      await logService.info("Starting database encryption migration", "DatabaseService");
      fs.copyFileSync(unencryptedPath, backupPath);

      const oldDb = new Database(unencryptedPath, { readonly: true });
      const tables = oldDb.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];

      const indexes = oldDb.prepare(`
        SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL
      `).all() as { sql: string }[];

      const triggers = oldDb.prepare(`
        SELECT sql FROM sqlite_master WHERE type='trigger' AND sql IS NOT NULL
      `).all() as { sql: string }[];

      const newDb = new Database(encryptedPath);
      newDb.pragma(`key = "x'${this.encryptionKey}'"`);

      for (const { name: tableName } of tables) {
        const tableInfo = oldDb.prepare(
          `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`
        ).get(tableName) as { sql: string } | undefined;

        if (tableInfo?.sql) {
          newDb.exec(tableInfo.sql);
          const rows = oldDb.prepare(`SELECT * FROM "${tableName}"`).all();
          if (rows.length > 0) {
            const columns = Object.keys(rows[0] as object);
            const placeholders = columns.map(() => "?").join(", ");
            const insertStmt = newDb.prepare(
              `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`
            );
            const insertMany = newDb.transaction((data: unknown[]) => {
              for (const row of data) {
                insertStmt.run(...columns.map((col) => (row as Record<string, unknown>)[col]));
              }
            });
            insertMany(rows);
          }
        }
      }

      for (const { sql } of indexes) {
        try { newDb.exec(sql); } catch { /* Index may already exist */ }
      }

      for (const { sql } of triggers) {
        try { newDb.exec(sql); } catch { /* Trigger may already exist */ }
      }

      oldDb.close();
      newDb.close();

      await this._secureDelete(unencryptedPath);
      fs.renameSync(encryptedPath, unencryptedPath);
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

      await logService.info("Database encryption migration completed successfully", "DatabaseService");
    } catch (error) {
      await logService.error("Database encryption migration failed", "DatabaseService", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (fs.existsSync(backupPath)) {
        if (fs.existsSync(unencryptedPath)) fs.unlinkSync(unencryptedPath);
        fs.renameSync(backupPath, unencryptedPath);
      }
      if (fs.existsSync(encryptedPath)) fs.unlinkSync(encryptedPath);

      throw error;
    }
  }

  private async _secureDelete(filePath: string): Promise<void> {
    try {
      const stats = fs.statSync(filePath);
      const fd = fs.openSync(filePath, "r+");
      for (let pass = 0; pass < 3; pass++) {
        const randomData = crypto.randomBytes(stats.size);
        fs.writeSync(fd, randomData, 0, randomData.length, 0);
        fs.fsyncSync(fd);
      }
      fs.closeSync(fd);
      fs.unlinkSync(filePath);
    } catch {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  // ============================================
  // MIGRATIONS (Version-based runner)
  // ============================================

  /**
   * Run database migrations.
   *
   * 1. Create pre-migration backup
   * 2. Run schema.sql (all IF NOT EXISTS — safe for existing DBs)
   * 3. Run versioned migrations for anything beyond the baseline
   *
   * Baseline version = 29 (all historical migrations 1-28 folded into schema.sql)
   */
  async runMigrations(): Promise<void> {
    const db = this._ensureDb();
    const schemaPath = path.join(__dirname, "../database/schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    // Pre-migration backup (TASK-1969)
    if (this.dbPath && fs.existsSync(this.dbPath)) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
        const backupPath = this.dbPath.replace(".db", `-backup-${timestamp}.db`);

        try {
          db.pragma("wal_checkpoint(TRUNCATE)");
        } catch {
          // WAL may not be enabled — safe to ignore
        }

        fs.copyFileSync(this.dbPath, backupPath);
        await logService.info(`Pre-migration backup created: ${backupPath}`, "DatabaseService");
      } catch (backupError) {
        await logService.warn("Pre-migration backup failed", "DatabaseService", { error: backupError instanceof Error ? backupError.message : String(backupError) });
      }
    }

    try {
      // schema.sql uses CREATE TABLE/INDEX IF NOT EXISTS throughout,
      // so it's safe to run on both fresh and existing databases.
      db.exec(schemaSql);

      await this._runVersionedMigrations();
    } catch (error) {
      await logService.error("Failed to run migrations", "DatabaseService", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // Backup retention: keep last 3, delete older (SR review gap #2)
    if (this.dbPath) {
      try {
        const dbDir = path.dirname(this.dbPath);
        const dbName = path.basename(this.dbPath, ".db");
        const backupFiles = fs
          .readdirSync(dbDir)
          .filter((f) => f.startsWith(`${dbName}-backup-`) && f.endsWith(".db"))
          .sort()
          .reverse(); // newest first (timestamp-based names sort chronologically)

        for (const old of backupFiles.slice(3)) {
          fs.unlinkSync(path.join(dbDir, old));
          await logService.info(`Removed old backup: ${old}`, "DatabaseService");
        }
      } catch {
        // Cleanup failures must not affect the app
      }
    }
  }

  /**
   * Version-based migration runner.
   *
   * Reads current schema version, then runs any migrations with version > current.
   * After each migration, the version is bumped in the schema_version table.
   *
   * Baseline = 29 (schema.sql contains everything through migration 28).
   * Future migrations add entries to the `migrations` array below.
   */
  private async _runVersionedMigrations(): Promise<void> {
    const db = this._ensureDb();

    // Ensure schema_version table exists (may be missing on very old DBs)
    const schemaVersionExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
    ).get();

    if (!schemaVersionExists) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          version INTEGER NOT NULL DEFAULT 1,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 29);
      `);
    }

    const currentVersion = (
      db.prepare("SELECT version FROM schema_version WHERE id = 1").get() as
        { version: number } | undefined
    )?.version || 0;

    // -------------------------------------------------------
    // Future migrations go here. Example:
    //
    // { version: 30, description: "Add new_column to some_table",
    //   migrate: (d) => { d.exec("ALTER TABLE some_table ADD COLUMN new_column TEXT"); } },
    // -------------------------------------------------------
    const migrations: {
      version: number;
      description: string;
      migrate: (d: DatabaseType) => void;
    }[] = [
      // Baseline = 29. Add new migrations below.
      {
        version: 30,
        description: "Fix transaction_summary view to count from transaction_contacts instead of deprecated transaction_participants",
        migrate: (d) => {
          d.exec(`
            DROP VIEW IF EXISTS transaction_summary;
            CREATE VIEW IF NOT EXISTS transaction_summary AS
            SELECT
              t.id,
              t.user_id,
              t.property_address,
              t.transaction_type,
              t.status,
              t.stage,
              t.started_at,
              t.closed_at,
              t.message_count,
              t.attachment_count,
              t.confidence_score,
              (SELECT COUNT(*) FROM transaction_contacts tc WHERE tc.transaction_id = t.id) as participant_count,
              (SELECT COUNT(*) FROM audit_packages ap WHERE ap.transaction_id = t.id) as audit_count
            FROM transactions t;
          `);
        },
      },
    ];

    for (const m of migrations) {
      if (m.version > currentVersion) {
        await logService.info(
          `Running migration ${m.version}: ${m.description}`,
          "DatabaseService"
        );
        // Wrap migration + version bump in a transaction so partial failures
        // don't leave the DB in a half-migrated state (SR review gap #1)
        const runInTransaction = db.transaction(() => {
          m.migrate(db);
          db.exec(
            `UPDATE schema_version SET version = ${m.version}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
          );
        });
        runInTransaction();
        await logService.info(
          `Migration ${m.version} complete: ${m.description}`,
          "DatabaseService"
        );
      }
    }

    // Ensure version is at least 29 (the consolidated baseline)
    if (currentVersion < 29) {
      db.exec(
        "UPDATE schema_version SET version = 29, updated_at = CURRENT_TIMESTAMP WHERE id = 1"
      );
    }

    await logService.info("All database migrations completed successfully", "DatabaseService");
  }

  // ============================================
  // USER OPERATIONS (Delegate to userDbService)
  // ============================================

  // TASK-1507G: Accept optional ID to unify user IDs across local SQLite and Supabase
  async createUser(userData: NewUser & { id?: string }): Promise<User> {
    return userDb.createUser(userData);
  }

  async getUserById(userId: string): Promise<User | null> {
    return userDb.getUserById(userId);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return userDb.getUserByEmail(email);
  }

  async getUserByOAuthId(provider: OAuthProvider, oauthId: string): Promise<User | null> {
    return userDb.getUserByOAuthId(provider, oauthId);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    return userDb.updateUser(userId, updates);
  }

  async deleteUser(userId: string): Promise<void> {
    return userDb.deleteUser(userId);
  }

  async updateLastLogin(userId: string): Promise<void> {
    return userDb.updateLastLogin(userId);
  }

  async acceptTerms(userId: string, termsVersion: string, privacyVersion: string): Promise<User> {
    return userDb.acceptTerms(userId, termsVersion, privacyVersion);
  }

  async completeEmailOnboarding(userId: string): Promise<void> {
    return userDb.completeEmailOnboarding(userId);
  }

  async hasCompletedEmailOnboarding(userId: string): Promise<boolean> {
    return userDb.hasCompletedEmailOnboarding(userId);
  }

  /**
   * Migrate a local user's ID to match Supabase auth.uid()
   * BACKLOG-600: This handles users created before TASK-1507G (user ID unification)
   *
   * Updates all FK references across tables:
   * - users_local (primary)
   * - messages, contacts, transactions, emails, etc.
   * - sessions, oauth_tokens, email_accounts
   *
   * @param oldUserId - The current local user ID
   * @param newUserId - The Supabase auth.uid() to migrate to
   */
  async migrateUserIdForUnification(oldUserId: string, newUserId: string): Promise<void> {
    const db = this.getRawDatabase();

    try {
      // CRITICAL: Disable FK checks during migration to avoid circular dependency issues
      // The old ID is referenced by child tables, and we need to update both parent and children
      db.exec("PRAGMA foreign_keys = OFF");

      // Use a transaction to ensure atomicity
      db.exec("BEGIN TRANSACTION");

      try {
        // Update the users_local table FIRST (the primary record)
        // With FK checks off, this won't cause issues
        db.prepare("UPDATE users_local SET id = ? WHERE id = ?").run(newUserId, oldUserId);
        logService.info("[DB Migration] Updated users_local primary record", "DatabaseService");

        // Tables with user_id FK that need to be updated
        const tablesToUpdate = [
          "messages",
          "contacts",
          "contact_phones",
          "contact_emails",
          "transactions",
          "emails",
          "communications",
          "sessions",
          "oauth_tokens",
          "email_accounts",
          "user_preferences",
          "external_contacts",
          "attachments",
          "audit_logs_local",
        ];

        for (const table of tablesToUpdate) {
          try {
            // Check if table exists and has user_id column
            const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
            const hasUserId = tableInfo.some((col) => col.name === "user_id");

            if (hasUserId) {
              const result = db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`).run(newUserId, oldUserId);
              if (result.changes > 0) {
                logService.info(`[DB Migration] Updated ${result.changes} rows in ${table}`, "DatabaseService");
              }
            }
          } catch (tableError) {
            // Table might not exist, skip it
            logService.debug(`[DB Migration] Skipping table ${table}: ${tableError}`, "DatabaseService");
          }
        }

        db.exec("COMMIT");
        logService.info("[DB Migration] User ID migration completed successfully", "DatabaseService", {
          oldId: oldUserId.substring(0, 8) + "...",
          newId: newUserId.substring(0, 8) + "...",
        });
      } catch (error) {
        db.exec("ROLLBACK");
        logService.error("[DB Migration] User ID migration failed, rolled back", "DatabaseService", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    } finally {
      // CRITICAL: Re-enable FK checks
      db.exec("PRAGMA foreign_keys = ON");
    }
  }

  // ============================================
  // SESSION OPERATIONS (Delegate to sessionDbService)
  // ============================================

  async createSession(userId: string): Promise<string> {
    return sessionDb.createSession(userId);
  }

  async validateSession(sessionToken: string): Promise<(Session & User) | null> {
    return sessionDb.validateSession(sessionToken);
  }

  async deleteSession(sessionToken: string): Promise<void> {
    return sessionDb.deleteSession(sessionToken);
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    return sessionDb.deleteAllUserSessions(userId);
  }

  async clearAllSessions(): Promise<void> {
    return sessionDb.clearAllSessions();
  }

  async clearAllOAuthTokens(): Promise<void> {
    return oauthDb.clearAllOAuthTokens();
  }

  // ============================================
  // CONTACT OPERATIONS (Delegate to contactDbService)
  // ============================================

  async createContact(contactData: NewContact): Promise<Contact> {
    return contactDb.createContact(contactData);
  }

  createContactsBatch(
    contacts: Parameters<typeof contactDb.createContactsBatch>[0],
    onProgress?: (current: number, total: number) => void
  ): string[] {
    return contactDb.createContactsBatch(contacts, onProgress);
  }

  async getContactById(contactId: string): Promise<Contact | null> {
    return contactDb.getContactById(contactId);
  }

  async findContactByName(userId: string, name: string): Promise<Contact | null> {
    return contactDb.findContactByName(userId, name);
  }

  async getContacts(filters?: ContactFilters): Promise<Contact[]> {
    return contactDb.getContacts(filters);
  }

  async getImportedContactsByUserId(userId: string): Promise<Contact[]> {
    return contactDb.getImportedContactsByUserId(userId);
  }

  /** TASK-1956: Non-blocking version using worker thread */
  async getImportedContactsByUserIdAsync(userId: string): Promise<Contact[]> {
    return contactDb.getImportedContactsByUserIdAsync(userId);
  }

  async getUnimportedContactsByUserId(userId: string): Promise<Contact[]> {
    return contactDb.getUnimportedContactsByUserId(userId);
  }

  async markContactAsImported(contactId: string, source?: string): Promise<void> {
    return contactDb.markContactAsImported(contactId, source);
  }

  async backfillContactEmails(contactId: string, emails: string[]): Promise<number> {
    return contactDb.backfillContactEmails(contactId, emails);
  }

  async backfillContactPhones(contactId: string, phones: string[]): Promise<number> {
    return contactDb.backfillContactPhones(contactId, phones);
  }

  async getContactsSortedByActivity(userId: string, propertyAddress?: string): Promise<contactDb.ContactWithActivity[]> {
    return contactDb.getContactsSortedByActivity(userId, propertyAddress);
  }

  async backfillContactCommunicationDates(userId: string): Promise<number> {
    return contactDb.backfillContactCommunicationDates(userId);
  }

  async searchContacts(query: string, userId: string): Promise<Contact[]> {
    return contactDb.searchContacts(query, userId);
  }

  searchContactsForSelection(userId: string, query: string, limit?: number): contactDb.ContactWithActivity[] {
    return contactDb.searchContactsForSelection(userId, query, limit);
  }

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<void> {
    return contactDb.updateContact(contactId, updates);
  }

  async getTransactionsByContact(contactId: string): Promise<contactDb.TransactionWithRoles[]> {
    return contactDb.getTransactionsByContact(contactId);
  }

  async deleteContact(contactId: string): Promise<void> {
    return contactDb.deleteContact(contactId);
  }

  async getContactByPhone(phone: string): Promise<{ id: string; display_name: string; phone: string } | null> {
    return contactDb.getContactByPhone(phone);
  }

  /**
   * Get the most recent message date for a phone number using lookup table
   * Falls back to direct query if lookup table is empty (BACKLOG-567)
   */
  getLastMessageDateForPhone(userId: string, normalizedPhone: string): string | null {
    const db = this.getRawDatabase();

    // Fast indexed lookup from phone_last_message table
    const result = db.prepare(`
      SELECT last_message_at as last_date
      FROM phone_last_message
      WHERE user_id = ?
        AND phone_normalized = ?
    `).get(userId, normalizedPhone) as { last_date: string | null } | undefined;

    return result?.last_date || null;
  }

  /**
   * Batch lookup for multiple phones (much more efficient than N queries)
   * Returns a Map of normalized phone -> last_message_at (BACKLOG-567)
   */
  getLastMessageDatesForPhones(userId: string, phones: string[]): Map<string, string> {
    const db = this.getRawDatabase();
    const result = new Map<string, string>();

    if (phones.length === 0) return result;

    // Use parameterized query for safety
    const placeholders = phones.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT phone_normalized, last_message_at
      FROM phone_last_message
      WHERE user_id = ?
        AND phone_normalized IN (${placeholders})
    `).all(userId, ...phones) as { phone_normalized: string; last_message_at: string }[];

    for (const row of rows) {
      result.set(row.phone_normalized, row.last_message_at);
    }

    return result;
  }

  /**
   * Populate phone_last_message lookup table from messages (BACKLOG-567)
   * This aggregates all SMS/iMessage into a phone->lastDate lookup for O(1) queries
   */
  async backfillPhoneLastMessageTable(userId: string): Promise<number> {
    const db = this.getRawDatabase();

    await logService.info("Backfilling phone_last_message table", "DatabaseService", { userId });

    // Get all distinct phone numbers from participants_flat and their max sent_at
    // participants_flat format: ",16508685180,16508685180" (comma-separated digits)
    const messages = db.prepare(`
      SELECT participants_flat, MAX(sent_at) as last_date
      FROM messages
      WHERE user_id = ?
        AND (channel = 'sms' OR channel = 'imessage')
        AND participants_flat IS NOT NULL
        AND participants_flat != ''
      GROUP BY participants_flat
    `).all(userId) as { participants_flat: string; last_date: string }[];

    // Parse and aggregate phones
    const phoneLastDates = new Map<string, string>();

    for (const msg of messages) {
      // Split comma-separated phones and normalize each
      const phones = msg.participants_flat.split(',').filter(p => p.trim().length >= 7);

      for (const phone of phones) {
        const normalized = phone.trim().slice(-10); // Last 10 digits
        if (normalized.length < 7) continue;

        const existing = phoneLastDates.get(normalized);
        if (!existing || msg.last_date > existing) {
          phoneLastDates.set(normalized, msg.last_date);
        }
      }
    }

    // Insert/update all phones in a transaction
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO phone_last_message (phone_normalized, user_id, last_message_at)
      VALUES (?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION');
    try {
      let count = 0;
      for (const [phone, lastDate] of phoneLastDates) {
        insertStmt.run(phone, userId, lastDate);
        count++;
      }
      db.exec('COMMIT');

      await logService.info("Phone last message backfill complete", "DatabaseService", {
        userId,
        phonesUpdated: count,
      });

      return count;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  async getContactNamesByPhones(phones: string[]): Promise<Map<string, string>> {
    return contactDb.getContactNamesByPhones(phones);
  }

  async removeContact(contactId: string): Promise<void> {
    return contactDb.removeContact(contactId);
  }

  async getOrCreateContactFromEmail(userId: string, email: string, name?: string): Promise<Contact> {
    return contactDb.getOrCreateContactFromEmail(userId, email, name);
  }

  // ============================================
  // OAUTH TOKEN OPERATIONS (Delegate to oauthTokenDbService)
  // ============================================

  async saveOAuthToken(userId: string, provider: OAuthProvider, purpose: OAuthPurpose, tokenData: Partial<OAuthToken>): Promise<string> {
    return oauthDb.saveOAuthToken(userId, provider, purpose, tokenData);
  }

  async getOAuthToken(userId: string, provider: OAuthProvider, purpose: OAuthPurpose): Promise<OAuthToken | null> {
    return oauthDb.getOAuthToken(userId, provider, purpose);
  }

  async updateOAuthToken(tokenId: string, updates: Partial<OAuthToken>): Promise<void> {
    return oauthDb.updateOAuthToken(tokenId, updates);
  }

  async deleteOAuthToken(userId: string, provider: OAuthProvider, purpose: OAuthPurpose): Promise<void> {
    return oauthDb.deleteOAuthToken(userId, provider, purpose);
  }

  async getOAuthTokenSyncTime(userId: string, provider: OAuthProvider): Promise<Date | null> {
    return oauthDb.getOAuthTokenSyncTime(userId, provider);
  }

  async updateOAuthTokenSyncTime(userId: string, provider: OAuthProvider, syncTime: Date): Promise<void> {
    return oauthDb.updateOAuthTokenSyncTime(userId, provider, syncTime);
  }

  // ============================================
  // TRANSACTION OPERATIONS (Delegate to transactionDbService)
  // ============================================

  async createTransaction(transactionData: NewTransaction): Promise<Transaction> {
    return transactionDb.createTransaction(transactionData);
  }

  async getTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
    return transactionDb.getTransactions(filters);
  }

  async getTransactionById(transactionId: string): Promise<Transaction | null> {
    return transactionDb.getTransactionById(transactionId);
  }

  async getTransactionWithContacts(transactionId: string): Promise<TransactionWithContacts | null> {
    return transactionDb.getTransactionWithContacts(transactionId);
  }

  async updateTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void> {
    return transactionDb.updateTransaction(transactionId, updates);
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    return transactionDb.deleteTransaction(transactionId);
  }

  async findExistingTransactionsByAddresses(
    userId: string,
    propertyAddresses: string[],
  ): Promise<Map<string, string>> {
    return transactionDb.findExistingTransactionsByAddresses(userId, propertyAddresses);
  }

  // ============================================
  // COMMUNICATION OPERATIONS (Delegate to communicationDbService)
  // ============================================

  async createCommunication(communicationData: NewCommunication): Promise<Communication> {
    return communicationDb.createCommunication(communicationData);
  }

  async getCommunicationById(communicationId: string): Promise<Communication | null> {
    return communicationDb.getCommunicationById(communicationId);
  }

  async getCommunications(filters?: CommunicationFilters): Promise<Communication[]> {
    return communicationDb.getCommunications(filters);
  }

  async getCommunicationsByTransaction(transactionId: string, channelFilter?: "email" | "text", limit?: number): Promise<Communication[]> {
    // TASK-992: Use getCommunicationsWithMessages to include direction from messages table
    return communicationDb.getCommunicationsWithMessages(transactionId, channelFilter, limit);
  }

  async updateCommunication(communicationId: string, updates: Partial<Communication>): Promise<void> {
    return communicationDb.updateCommunication(communicationId, updates);
  }

  async deleteCommunication(communicationId: string): Promise<void> {
    return communicationDb.deleteCommunication(communicationId);
  }

  async deleteCommunicationByMessageId(messageId: string): Promise<void> {
    return communicationDb.deleteCommunicationByMessageId(messageId);
  }

  /**
   * Delete communication records by thread_id for a specific transaction.
   * TASK-1116: Used when unlinking a thread from a transaction.
   */
  async deleteCommunicationByThread(threadId: string, transactionId: string): Promise<void> {
    return communicationDb.deleteCommunicationByThread(threadId, transactionId);
  }

  async addIgnoredCommunication(data: NewIgnoredCommunication): Promise<IgnoredCommunication> {
    return communicationDb.addIgnoredCommunication(data);
  }

  async getIgnoredCommunicationsByTransaction(transactionId: string): Promise<IgnoredCommunication[]> {
    return communicationDb.getIgnoredCommunicationsByTransaction(transactionId);
  }

  async getIgnoredCommunicationsByUser(userId: string): Promise<IgnoredCommunication[]> {
    return communicationDb.getIgnoredCommunicationsByUser(userId);
  }

  async isEmailIgnoredForTransaction(transactionId: string, emailSender: string, emailSubject: string, emailSentAt: string): Promise<boolean> {
    return communicationDb.isEmailIgnoredForTransaction(transactionId, emailSender, emailSubject, emailSentAt);
  }

  async isEmailIgnoredByUser(userId: string, emailSender: string, emailSubject: string, emailSentAt: string): Promise<boolean> {
    return communicationDb.isEmailIgnoredByUser(userId, emailSender, emailSubject, emailSentAt);
  }

  async removeIgnoredCommunication(ignoredCommId: string): Promise<void> {
    return communicationDb.removeIgnoredCommunication(ignoredCommId);
  }

  async linkCommunicationToTransaction(communicationId: string, transactionId: string): Promise<void> {
    return communicationDb.linkCommunicationToTransaction(communicationId, transactionId);
  }

  async saveExtractedData(transactionId: string, fieldName: string, fieldValue: string, sourceCommId?: string, confidence?: number): Promise<string> {
    return communicationDb.saveExtractedData(transactionId, fieldName, fieldValue, sourceCommId, confidence);
  }

  // ============================================
  // TRANSACTION CONTACT OPERATIONS (Delegate to transactionContactDbService)
  // ============================================

  async linkContactToTransaction(transactionId: string, contactId: string, role?: string): Promise<void> {
    return transactionContactDb.linkContactToTransaction(transactionId, contactId, role);
  }

  async assignContactToTransaction(transactionId: string, data: transactionContactDb.TransactionContactData): Promise<string> {
    return transactionContactDb.assignContactToTransaction(transactionId, data);
  }

  async getTransactionContacts(transactionId: string): Promise<Contact[]> {
    return transactionContactDb.getTransactionContacts(transactionId);
  }

  async getTransactionContactsWithRoles(transactionId: string): Promise<transactionContactDb.TransactionContactResult[]> {
    return transactionContactDb.getTransactionContactsWithRoles(transactionId);
  }

  async getTransactionContactsByRole(transactionId: string, role: string): Promise<transactionContactDb.TransactionContactResult[]> {
    return transactionContactDb.getTransactionContactsByRole(transactionId, role);
  }

  async updateContactRole(transactionId: string, contactId: string, updates: Partial<transactionContactDb.TransactionContactData>): Promise<void> {
    return transactionContactDb.updateContactRole(transactionId, contactId, updates);
  }

  async unlinkContactFromTransaction(transactionId: string, contactId: string): Promise<void> {
    return transactionContactDb.unlinkContactFromTransaction(transactionId, contactId);
  }

  async isContactAssignedToTransaction(transactionId: string, contactId: string): Promise<boolean> {
    return transactionContactDb.isContactAssignedToTransaction(transactionId, contactId);
  }

  async batchUpdateContactAssignments(transactionId: string, operations: transactionContactDb.ContactAssignmentOperation[]): Promise<void> {
    return transactionContactDb.batchUpdateContactAssignments(transactionId, operations);
  }

  // ============================================
  // USER FEEDBACK OPERATIONS (Delegate to feedbackDbService)
  // ============================================

  async saveFeedback(feedbackData: Omit<UserFeedback, "id" | "created_at">): Promise<UserFeedback> {
    return feedbackDb.saveFeedback(feedbackData);
  }

  async getFeedbackByTransaction(transactionId: string): Promise<UserFeedback[]> {
    return feedbackDb.getFeedbackByTransaction(transactionId);
  }

  async getFeedbackByField(userId: string, fieldName: string, limit: number = 100): Promise<UserFeedback[]> {
    return feedbackDb.getFeedbackByField(userId, fieldName, limit);
  }

  // ============================================
  // AUDIT LOG OPERATIONS (Delegate to auditLogDbService)
  // ============================================

  async insertAuditLog(entry: AuditLogEntry): Promise<void> {
    return auditDb.insertAuditLog(entry);
  }

  async getUnsyncedAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    return auditDb.getUnsyncedAuditLogs(limit);
  }

  async markAuditLogsSynced(ids: string[]): Promise<void> {
    return auditDb.markAuditLogsSynced(ids);
  }

  async getAuditLogs(filters: auditDb.AuditLogFilters): Promise<AuditLogEntry[]> {
    return auditDb.getAuditLogs(filters);
  }

  // ============================================
  // LLM ANALYSIS OPERATIONS (Keep in facade - no db/* equivalent)
  // ============================================

  async getMessagesForLLMAnalysis(userId: string, limit = 100): Promise<Message[]> {
    const db = this._ensureDb();
    const sql = `
      SELECT * FROM messages
      WHERE user_id = ?
        AND is_transaction_related IS NULL
        AND duplicate_of IS NULL
      ORDER BY received_at DESC
      LIMIT ?
    `;
    return db.prepare(sql).all(userId, limit) as Message[];
  }

  async getPendingLLMAnalysisCount(userId: string): Promise<number> {
    const db = this._ensureDb();
    const sql = `
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ?
        AND is_transaction_related IS NULL
        AND duplicate_of IS NULL
    `;
    const result = db.prepare(sql).get(userId) as { count: number } | undefined;
    return result?.count ?? 0;
  }

  // ============================================
  // MESSAGES TABLE OPERATIONS (Direct queries for text messages)
  // ============================================

  /**
   * Get unlinked text messages (SMS/iMessage) from the messages table
   * These are messages not yet attached to any transaction
   * Limited to 1000 most recent messages to prevent UI freeze
   */
  async getUnlinkedTextMessages(userId: string, limit = 1000): Promise<Message[]> {
    const db = this._ensureDb();
    const sql = `
      SELECT * FROM messages
      WHERE user_id = ?
        AND transaction_id IS NULL
        AND channel IN ('sms', 'imessage')
      ORDER BY sent_at DESC
      LIMIT ?
    `;
    return db.prepare(sql).all(userId, limit) as Message[];
  }

  /**
   * Get unlinked emails - emails not attached to any transaction
   * BACKLOG-506: Now queries emails table directly since communications is a junction table
   */
  async getUnlinkedEmails(userId: string, limit = 500): Promise<Communication[]> {
    const db = this._ensureDb();
    // Get emails that don't have a corresponding communication link with a transaction
    const sql = `
      SELECT
        e.id,
        e.user_id,
        NULL as transaction_id,
        e.subject,
        e.sender,
        e.sent_at,
        SUBSTR(e.body_plain, 1, 200) as body_preview
      FROM emails e
      WHERE e.user_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM communications c
          WHERE c.email_id = e.id
            AND c.transaction_id IS NOT NULL
        )
      ORDER BY e.sent_at DESC
      LIMIT ?
    `;
    return db.prepare(sql).all(userId, limit) as Communication[];
  }

  /**
   * Get distinct contacts (phone numbers) with unlinked message counts
   * Used for contact-first message browsing
   */
  async getMessageContacts(userId: string): Promise<{ contact: string; messageCount: number; lastMessageAt: string }[]> {
    const db = this._ensureDb();
    // Extract phone number from participants JSON and group by it
    // This query handles the JSON structure where participants.from or participants.to contains the phone
    const sql = `
      SELECT
        COALESCE(
          CASE
            WHEN direction = 'inbound' THEN json_extract(participants, '$.from')
            ELSE json_extract(participants, '$.to[0]')
          END,
          thread_id
        ) as contact,
        COUNT(*) as messageCount,
        MAX(sent_at) as lastMessageAt
      FROM messages
      WHERE user_id = ?
        AND transaction_id IS NULL
        AND channel IN ('sms', 'imessage')
        AND participants IS NOT NULL
      GROUP BY contact
      HAVING contact IS NOT NULL AND contact != 'me' AND contact != 'unknown' AND contact != ''
      ORDER BY lastMessageAt DESC
    `;
    return db.prepare(sql).all(userId) as { contact: string; messageCount: number; lastMessageAt: string }[];
  }

  /**
   * Get unlinked messages for a specific contact (phone number)
   * Used after user selects a contact in the contact-first UI
   *
   * Strategy: First find all thread_ids where the contact appears, then fetch
   * ALL messages from those threads. This ensures group chats are fully captured
   * even when individual messages have different handles.
   */
  async getMessagesByContact(userId: string, contact: string): Promise<Message[]> {
    const db = this._ensureDb();

    // Step 1: Find all thread_ids where the contact appears in any message
    const threadIdsSql = `
      SELECT DISTINCT thread_id FROM messages
      WHERE user_id = ?
        AND transaction_id IS NULL
        AND channel IN ('sms', 'imessage')
        AND thread_id IS NOT NULL
        AND (
          json_extract(participants, '$.from') = ?
          OR json_extract(participants, '$.to[0]') = ?
        )
    `;
    const threadRows = db.prepare(threadIdsSql).all(userId, contact, contact) as { thread_id: string }[];
    const threadIds = threadRows.map(r => r.thread_id);

    if (threadIds.length === 0) {
      // Fallback: return messages directly matching the contact (for cases without thread_id)
      const fallbackSql = `
        SELECT * FROM messages
        WHERE user_id = ?
          AND transaction_id IS NULL
          AND channel IN ('sms', 'imessage')
          AND (
            json_extract(participants, '$.from') = ?
            OR json_extract(participants, '$.to[0]') = ?
          )
        ORDER BY sent_at DESC
      `;
      return db.prepare(fallbackSql).all(userId, contact, contact) as Message[];
    }

    // Step 2: Fetch ALL messages from those threads (not just messages where contact appears)
    // This captures all messages in group chats where the contact is a participant
    const placeholders = threadIds.map(() => '?').join(', ');
    const messagesSql = `
      SELECT * FROM messages
      WHERE user_id = ?
        AND transaction_id IS NULL
        AND channel IN ('sms', 'imessage')
        AND thread_id IN (${placeholders})
      ORDER BY sent_at DESC
    `;
    return db.prepare(messagesSql).all(userId, ...threadIds) as Message[];
  }

  /**
   * Update a message in the messages table
   */
  async updateMessage(messageId: string, updates: Partial<Message>): Promise<void> {
    const db = this._ensureDb();
    const allowedFields = [
      "transaction_id",
      "transaction_link_confidence",
      "transaction_link_source",
      "is_transaction_related",
      "classification_confidence",
      "classification_method",
      "classified_at",
      "is_false_positive",
      "false_positive_reason",
      "stage_hint",
      "stage_hint_source",
      "stage_hint_confidence",
      "llm_analysis",
    ];

    const entries = Object.entries(updates).filter(([key]) =>
      allowedFields.includes(key)
    );

    if (entries.length === 0) return;

    const setClause = entries.map(([key]) => `${key} = ?`).join(", ");
    const values = entries.map(([, value]) => value);
    values.push(messageId);

    db.prepare(`UPDATE messages SET ${setClause} WHERE id = ?`).run(...values);
  }

  /**
   * Link a message to a transaction
   */
  async linkMessageToTransaction(messageId: string, transactionId: string): Promise<void> {
    const db = this._ensureDb();
    db.prepare(`UPDATE messages SET transaction_id = ? WHERE id = ?`).run(
      transactionId,
      messageId
    );
  }

  /**
   * Unlink a message from a transaction
   */
  async unlinkMessageFromTransaction(messageId: string): Promise<void> {
    const db = this._ensureDb();
    db.prepare(`UPDATE messages SET transaction_id = NULL WHERE id = ?`).run(messageId);
  }

  /**
   * Get messages linked to a transaction
   */
  async getMessagesByTransaction(transactionId: string): Promise<Message[]> {
    const db = this._ensureDb();
    const sql = `
      SELECT * FROM messages
      WHERE transaction_id = ?
      ORDER BY sent_at DESC
    `;
    return db.prepare(sql).all(transactionId) as Message[];
  }

  /**
   * Get a single message by ID
   */
  async getMessageById(messageId: string): Promise<Message | null> {
    const db = this._ensureDb();
    const sql = `SELECT * FROM messages WHERE id = ?`;
    const result = db.prepare(sql).get(messageId) as Message | undefined;
    return result || null;
  }

  // ============================================
  // DIAGNOSTIC OPERATIONS (for debugging data issues)
  // ============================================

  /**
   * Diagnostic: Find messages with NULL thread_id
   * These messages use fallback grouping which can cause incorrect merging
   */
  async diagnosticGetMessagesWithNullThreadId(userId: string): Promise<{
    count: number;
    samples: Array<{ id: string; body_text: string; participants: string; sent_at: string }>;
  }> {
    const db = this._ensureDb();

    const countResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ? AND thread_id IS NULL AND channel IN ('sms', 'imessage')
    `).get(userId) as { count: number };

    const samples = db.prepare(`
      SELECT id, body_text, participants, sent_at FROM messages
      WHERE user_id = ? AND thread_id IS NULL AND channel IN ('sms', 'imessage')
      ORDER BY sent_at DESC LIMIT 10
    `).all(userId) as Array<{ id: string; body_text: string; participants: string; sent_at: string }>;

    return { count: countResult.count, samples };
  }

  /**
   * Diagnostic: Get recent messages with unknown recipient
   * Returns external_id (macOS ROWID) for cross-referencing
   */
  async diagnosticUnknownRecipientMessages(userId: string): Promise<{
    samples: Array<{ external_id: string; body_text: string; participants: string; sent_at: string }>;
  }> {
    const db = this._ensureDb();

    const samples = db.prepare(`
      SELECT external_id, body_text, participants, sent_at FROM messages
      WHERE user_id = ? AND thread_id IS NULL AND channel IN ('sms', 'imessage')
      AND participants LIKE '%"unknown"%'
      ORDER BY sent_at DESC LIMIT 10
    `).all(userId) as Array<{ external_id: string; body_text: string; participants: string; sent_at: string }>;

    return { samples };
  }

  /**
   * Diagnostic: Find messages with potential garbage text
   * Looks for binary signatures in body_text
   */
  async diagnosticGetMessagesWithGarbageText(userId: string): Promise<{
    count: number;
    samples: Array<{ id: string; body_text: string; thread_id: string | null; sent_at: string }>;
  }> {
    const db = this._ensureDb();

    // DETERMINISTIC: Check for exact fallback messages (no heuristics)
    // These are the only values the parser returns when it cannot parse
    const countResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ? AND channel IN ('sms', 'imessage')
      AND body_text IN (
        '[Unable to parse message]',
        '[Message text - parsing error]',
        '[Message text - unable to extract from rich format]'
      )
    `).get(userId) as { count: number };

    const samples = db.prepare(`
      SELECT id, body_text, thread_id, sent_at FROM messages
      WHERE user_id = ? AND channel IN ('sms', 'imessage')
      AND body_text IN (
        '[Unable to parse message]',
        '[Message text - parsing error]',
        '[Message text - unable to extract from rich format]'
      )
      ORDER BY sent_at DESC LIMIT 10
    `).all(userId) as Array<{ id: string; body_text: string; thread_id: string | null; sent_at: string }>;

    return { count: countResult.count, samples };
  }

  /**
   * Diagnostic: Complete message health report
   * Shows total counts and breakdown of parsing issues
   */
  async diagnosticMessageHealthReport(userId: string): Promise<{
    total: number;
    withThreadId: number;
    withNullThreadId: number;
    withGarbageText: number;
    withEmptyText: number;
    healthy: number;
    healthPercentage: number;
  }> {
    const db = this._ensureDb();

    // Total messages
    const totalResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ? AND channel IN ('sms', 'imessage')
    `).get(userId) as { count: number };

    // With thread_id
    const withThreadIdResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ? AND channel IN ('sms', 'imessage') AND thread_id IS NOT NULL
    `).get(userId) as { count: number };

    // With NULL thread_id
    const withNullThreadIdResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ? AND channel IN ('sms', 'imessage') AND thread_id IS NULL
    `).get(userId) as { count: number };

    // DETERMINISTIC: Count messages that failed to parse (exact fallback messages)
    // No heuristics - only count messages where parser returned a known fallback
    const withGarbageResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ? AND channel IN ('sms', 'imessage')
      AND body_text IN (
        '[Unable to parse message]',
        '[Message text - parsing error]',
        '[Message text - unable to extract from rich format]'
      )
    `).get(userId) as { count: number };

    // With empty or very short text
    const withEmptyResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ? AND channel IN ('sms', 'imessage')
      AND (body_text IS NULL OR LENGTH(body_text) < 1)
    `).get(userId) as { count: number };

    // Calculate healthy (has thread_id, no garbage, has text)
    const healthy = totalResult.count - withNullThreadIdResult.count - withGarbageResult.count - withEmptyResult.count;
    const healthPercentage = totalResult.count > 0
      ? Math.round((healthy / totalResult.count) * 100 * 10) / 10
      : 100;

    return {
      total: totalResult.count,
      withThreadId: withThreadIdResult.count,
      withNullThreadId: withNullThreadIdResult.count,
      withGarbageText: withGarbageResult.count,
      withEmptyText: withEmptyResult.count,
      healthy: Math.max(0, healthy),
      healthPercentage,
    };
  }

  /**
   * Diagnostic: Get thread_id distribution for a contact
   * Shows which chats a contact appears in
   */
  async diagnosticGetThreadsForContact(userId: string, phoneDigits: string): Promise<{
    threads: Array<{ thread_id: string | null; message_count: number; participants_sample: string }>;
  }> {
    const db = this._ensureDb();

    const threads = db.prepare(`
      SELECT
        thread_id,
        COUNT(*) as message_count,
        (SELECT participants FROM messages m2
         WHERE m2.thread_id = messages.thread_id
         AND m2.user_id = ? LIMIT 1) as participants_sample
      FROM messages
      WHERE user_id = ?
        AND channel IN ('sms', 'imessage')
        AND participants_flat LIKE ?
      GROUP BY thread_id
      ORDER BY message_count DESC
    `).all(userId, userId, `%${phoneDigits}%`) as Array<{
      thread_id: string | null;
      message_count: number;
      participants_sample: string;
    }>;

    return { threads };
  }

  /**
   * Diagnostic: Detailed analysis of NULL thread_id messages
   * Groups by sender, channel, and month to identify patterns
   */
  async diagnosticNullThreadIdAnalysis(userId: string): Promise<{
    total: number;
    byChannel: Array<{ channel: string; count: number }>;
    bySender: Array<{ sender: string; count: number; sampleText: string }>;
    byMonth: Array<{ month: string; count: number }>;
    unknownRecipient: number;
  }> {
    const db = this._ensureDb();

    // Total NULL thread_id count
    const totalResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ? AND thread_id IS NULL AND channel IN ('sms', 'imessage')
    `).get(userId) as { count: number };

    // Breakdown by channel
    const byChannel = db.prepare(`
      SELECT channel, COUNT(*) as count FROM messages
      WHERE user_id = ? AND thread_id IS NULL AND channel IN ('sms', 'imessage')
      GROUP BY channel ORDER BY count DESC
    `).all(userId) as Array<{ channel: string; count: number }>;

    // Top 20 senders with counts
    const bySender = db.prepare(`
      SELECT
        CASE
          WHEN participants LIKE '%"from":"me"%' THEN
            json_extract(participants, '$.to[0]')
          ELSE
            json_extract(participants, '$.from')
        END as sender,
        COUNT(*) as count,
        (SELECT body_text FROM messages m2
         WHERE m2.user_id = ? AND m2.thread_id IS NULL
         AND m2.participants = messages.participants
         LIMIT 1) as sampleText
      FROM messages
      WHERE user_id = ? AND thread_id IS NULL AND channel IN ('sms', 'imessage')
      GROUP BY sender
      ORDER BY count DESC
      LIMIT 20
    `).all(userId, userId) as Array<{ sender: string; count: number; sampleText: string }>;

    // Distribution by month
    const byMonth = db.prepare(`
      SELECT
        strftime('%Y-%m', sent_at) as month,
        COUNT(*) as count
      FROM messages
      WHERE user_id = ? AND thread_id IS NULL AND channel IN ('sms', 'imessage')
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all(userId) as Array<{ month: string; count: number }>;

    // Count with unknown recipient
    const unknownResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ? AND thread_id IS NULL AND channel IN ('sms', 'imessage')
      AND participants LIKE '%"unknown"%'
    `).get(userId) as { count: number };

    return {
      total: totalResult.count,
      byChannel,
      bySender,
      byMonth,
      unknownRecipient: unknownResult.count,
    };
  }

  // ============================================
  // UTILITY OPERATIONS
  // ============================================

  async vacuum(): Promise<void> {
    vacuumDb();
  }

  async close(): Promise<void> {
    // Close and clear the shared connection in dbConnection module first
    // This also clears the module-level db reference used by db/* services
    await closeDb();
    this.db = null;
    this.encryptionKey = null;
    await logService.info("Database connection closed", "DatabaseService");
  }

  async rekeyDatabase(newKey: string): Promise<void> {
    const db = this._ensureDb();
    try {
      db.pragma(`rekey = "x'${newKey}'"`);
      this.encryptionKey = newKey;
      await logService.info("Database re-keyed successfully", "DatabaseService");
    } catch (error) {
      await logService.error("Failed to re-key database", "DatabaseService", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getEncryptionStatus(): Promise<{
    isEncrypted: boolean;
    keyMetadata: { keyId: string; createdAt: string; version: number } | null;
  }> {
    const keyMetadata = await databaseEncryptionService.getKeyMetadata();
    const isEncrypted = this.dbPath
      ? await databaseEncryptionService.isDatabaseEncrypted(this.dbPath)
      : false;
    return { isEncrypted, keyMetadata };
  }

  /**
   * Reindex all performance indexes
   * Recreates indexes that optimize query performance for contacts, communications, and messages.
   * This can help resolve slowness caused by fragmented or outdated indexes.
   *
   * @returns Object with reindex results including index count and duration
   */
  async reindexDatabase(): Promise<{
    success: boolean;
    indexesRebuilt: number;
    durationMs: number;
    error?: string;
  }> {
    const db = this._ensureDb();
    const startTime = Date.now();
    let indexesRebuilt = 0;

    try {
      await logService.info("Starting database reindex operation", "DatabaseService");

      // Performance indexes — drop and recreate to ensure fresh, optimized indexes
      const performanceIndexes = [
        // Contact indexes
        { name: "idx_contacts_user_id", sql: "CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)" },
        { name: "idx_contact_emails_contact_id", sql: "CREATE INDEX IF NOT EXISTS idx_contact_emails_contact_id ON contact_emails(contact_id)" },
        { name: "idx_contact_emails_email", sql: "CREATE INDEX IF NOT EXISTS idx_contact_emails_email ON contact_emails(email)" },
        { name: "idx_contact_phones_contact_id", sql: "CREATE INDEX IF NOT EXISTS idx_contact_phones_contact_id ON contact_phones(contact_id)" },
        // Communication indexes (pure junction table — no sender/sent_at columns)
        { name: "idx_communications_user_id", sql: "CREATE INDEX IF NOT EXISTS idx_communications_user_id ON communications(user_id)" },
        { name: "idx_communications_transaction", sql: "CREATE INDEX IF NOT EXISTS idx_communications_transaction ON communications(transaction_id)" },
        // Message indexes
        { name: "idx_messages_user_id", sql: "CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)" },
        { name: "idx_messages_sent_at", sql: "CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at)" },
        { name: "idx_messages_thread_id", sql: "CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)" },
        { name: "idx_messages_user_sent", sql: "CREATE INDEX IF NOT EXISTS idx_messages_user_sent ON messages(user_id, sent_at)" },
        { name: "idx_messages_channel", sql: "CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)" },
      ];

      // Use a transaction for consistency
      db.exec("BEGIN TRANSACTION");

      try {
        for (const index of performanceIndexes) {
          // Drop the existing index if it exists
          db.exec(`DROP INDEX IF EXISTS ${index.name}`);
          // Recreate the index
          db.exec(index.sql);
          indexesRebuilt++;
        }

        // Run ANALYZE to update statistics used by the query planner
        db.exec("ANALYZE");

        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      const durationMs = Date.now() - startTime;
      await logService.info(
        `Database reindex completed: ${indexesRebuilt} indexes rebuilt in ${durationMs}ms`,
        "DatabaseService"
      );

      return {
        success: true,
        indexesRebuilt,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logService.error("Database reindex failed", "DatabaseService", {
        error: errorMessage,
        indexesRebuilt,
        durationMs,
      });

      return {
        success: false,
        indexesRebuilt,
        durationMs,
        error: errorMessage,
      };
    }
  }
}

// Export singleton instance
export default new DatabaseService();
