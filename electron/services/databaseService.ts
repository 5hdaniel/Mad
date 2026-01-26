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

  // Migration code stays in facade - see runMigrations() in original

  async runMigrations(): Promise<void> {
    const db = this._ensureDb();
    const schemaPath = path.join(__dirname, "../database/schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    try {
      await this._runPreSchemaMigrations();
      db.exec(schemaSql);
      await this._runAdditionalMigrations();
    } catch (error) {
      await logService.error("Failed to run migrations", "DatabaseService", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Pre-schema migrations helper
  private async _runPreSchemaMigrations(): Promise<void> {
    const db = this._ensureDb();

    const addMissingColumns = async (tableName: string, columns: { name: string; sql: string }[]) => {
      const tableExists = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
      ).get(tableName);
      if (!tableExists) return;

      const tableColumns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
      const columnNames = tableColumns.map(c => c.name);

      for (const col of columns) {
        if (!columnNames.includes(col.name)) {
          try {
            db.exec(col.sql);
          } catch { /* Column may already exist */ }
        }
      }
    };

    await addMissingColumns('contacts', [
      { name: 'display_name', sql: `ALTER TABLE contacts ADD COLUMN display_name TEXT` },
      { name: 'company', sql: `ALTER TABLE contacts ADD COLUMN company TEXT` },
      { name: 'title', sql: `ALTER TABLE contacts ADD COLUMN title TEXT` },
      { name: 'source', sql: `ALTER TABLE contacts ADD COLUMN source TEXT DEFAULT 'manual'` },
      { name: 'metadata', sql: `ALTER TABLE contacts ADD COLUMN metadata TEXT` },
      { name: 'last_inbound_at', sql: `ALTER TABLE contacts ADD COLUMN last_inbound_at DATETIME` },
      { name: 'last_outbound_at', sql: `ALTER TABLE contacts ADD COLUMN last_outbound_at DATETIME` },
      { name: 'total_messages', sql: `ALTER TABLE contacts ADD COLUMN total_messages INTEGER DEFAULT 0` },
      { name: 'tags', sql: `ALTER TABLE contacts ADD COLUMN tags TEXT` },
    ]);

    await addMissingColumns('transactions', [
      { name: 'stage', sql: `ALTER TABLE transactions ADD COLUMN stage TEXT` },
      { name: 'stage_source', sql: `ALTER TABLE transactions ADD COLUMN stage_source TEXT` },
      { name: 'stage_confidence', sql: `ALTER TABLE transactions ADD COLUMN stage_confidence REAL` },
      { name: 'stage_updated_at', sql: `ALTER TABLE transactions ADD COLUMN stage_updated_at DATETIME` },
      { name: 'listing_price', sql: `ALTER TABLE transactions ADD COLUMN listing_price REAL` },
      { name: 'sale_price', sql: `ALTER TABLE transactions ADD COLUMN sale_price REAL` },
      { name: 'earnest_money_amount', sql: `ALTER TABLE transactions ADD COLUMN earnest_money_amount REAL` },
      { name: 'mutual_acceptance_date', sql: `ALTER TABLE transactions ADD COLUMN mutual_acceptance_date DATE` },
      { name: 'inspection_deadline', sql: `ALTER TABLE transactions ADD COLUMN inspection_deadline DATE` },
      { name: 'financing_deadline', sql: `ALTER TABLE transactions ADD COLUMN financing_deadline DATE` },
      { name: 'closing_deadline', sql: `ALTER TABLE transactions ADD COLUMN closing_deadline DATE` },
      { name: 'export_status', sql: `ALTER TABLE transactions ADD COLUMN export_status TEXT DEFAULT 'not_exported'` },
      { name: 'export_format', sql: `ALTER TABLE transactions ADD COLUMN export_format TEXT` },
      { name: 'export_count', sql: `ALTER TABLE transactions ADD COLUMN export_count INTEGER DEFAULT 0` },
      { name: 'last_exported_at', sql: `ALTER TABLE transactions ADD COLUMN last_exported_at DATETIME` },
      { name: 'last_exported_on', sql: `ALTER TABLE transactions ADD COLUMN last_exported_on DATETIME` },
      // BACKLOG-396: Stored thread count for consistent display
      { name: 'text_thread_count', sql: `ALTER TABLE transactions ADD COLUMN text_thread_count INTEGER DEFAULT 0` },
    ]);

    await addMissingColumns('messages', [
      { name: 'external_id', sql: `ALTER TABLE messages ADD COLUMN external_id TEXT` },
      { name: 'thread_id', sql: `ALTER TABLE messages ADD COLUMN thread_id TEXT` },
      { name: 'participants_flat', sql: `ALTER TABLE messages ADD COLUMN participants_flat TEXT` },
      { name: 'message_id_header', sql: `ALTER TABLE messages ADD COLUMN message_id_header TEXT` },
      { name: 'content_hash', sql: `ALTER TABLE messages ADD COLUMN content_hash TEXT` },
      { name: 'duplicate_of', sql: `ALTER TABLE messages ADD COLUMN duplicate_of TEXT` },
    ]);

    // TASK-975: Add message_id reference column and link metadata to communications table
    // This transforms communications into a junction/reference table linking messages to transactions
    // Also add legacy columns that may be missing from old databases to prevent index creation failures
    await addMissingColumns('communications', [
      { name: 'message_id', sql: `ALTER TABLE communications ADD COLUMN message_id TEXT REFERENCES messages(id) ON DELETE CASCADE` },
      { name: 'link_source', sql: `ALTER TABLE communications ADD COLUMN link_source TEXT CHECK (link_source IN ('auto', 'manual', 'scan'))` },
      { name: 'link_confidence', sql: `ALTER TABLE communications ADD COLUMN link_confidence REAL` },
      { name: 'linked_at', sql: `ALTER TABLE communications ADD COLUMN linked_at DATETIME DEFAULT CURRENT_TIMESTAMP` },
      // Legacy columns - ensure they exist for index creation
      { name: 'sent_at', sql: `ALTER TABLE communications ADD COLUMN sent_at DATETIME` },
      { name: 'sender', sql: `ALTER TABLE communications ADD COLUMN sender TEXT` },
      { name: 'communication_type', sql: `ALTER TABLE communications ADD COLUMN communication_type TEXT DEFAULT 'email'` },
      // BACKLOG-506: Email reference column (must be added before schema.sql creates index)
      { name: 'email_id', sql: `ALTER TABLE communications ADD COLUMN email_id TEXT REFERENCES emails(id) ON DELETE CASCADE` },
    ]);

    // TASK-1110: Add external_message_id to attachments for stable message linking
    // This allows attachments to be linked to messages even when message_id changes on re-import
    await addMissingColumns('attachments', [
      { name: 'external_message_id', sql: `ALTER TABLE attachments ADD COLUMN external_message_id TEXT` },
    ]);

    // Populate display_name from name column if it exists
    const contactsExists = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='contacts'`
    ).get();
    if (contactsExists) {
      const contactColumns = db.prepare(`PRAGMA table_info(contacts)`).all() as { name: string }[];
      if (contactColumns.some(c => c.name === 'name')) {
        try {
          db.exec(`UPDATE contacts SET display_name = name WHERE display_name IS NULL AND name IS NOT NULL`);
        } catch { /* Ignore */ }
      }
    }
  }

  // Additional migrations - condensed version
  private async _runAdditionalMigrations(): Promise<void> {
    const db = this._ensureDb();

    // Helper to get column info
    const getColumns = (table: string) => {
      return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
    };

    // Helper to run SQL safely
    const runSafe = (sql: string) => {
      try { db.exec(sql); } catch { /* Ignore */ }
    };

    // Migration 1: User compliance columns
    const userColumns = getColumns('users_local');
    if (!userColumns.includes('terms_accepted_at')) runSafe(`ALTER TABLE users_local ADD COLUMN terms_accepted_at DATETIME`);
    if (!userColumns.includes('terms_version_accepted')) runSafe(`ALTER TABLE users_local ADD COLUMN terms_version_accepted TEXT`);
    if (!userColumns.includes('privacy_policy_accepted_at')) runSafe(`ALTER TABLE users_local ADD COLUMN privacy_policy_accepted_at DATETIME`);
    if (!userColumns.includes('privacy_policy_version_accepted')) runSafe(`ALTER TABLE users_local ADD COLUMN privacy_policy_version_accepted TEXT`);
    if (!userColumns.includes('email_onboarding_completed_at')) runSafe(`ALTER TABLE users_local ADD COLUMN email_onboarding_completed_at DATETIME`);
    if (!userColumns.includes('mobile_phone_type')) runSafe(`ALTER TABLE users_local ADD COLUMN mobile_phone_type TEXT`);

    // Migration 2: Transaction columns
    const txColumns = getColumns('transactions');
    const txMigrations = [
      { name: 'status', sql: `ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'active'` },
      { name: 'representation_start_date', sql: `ALTER TABLE transactions ADD COLUMN representation_start_date DATE` },
      { name: 'closing_date_verified', sql: `ALTER TABLE transactions ADD COLUMN closing_date_verified INTEGER DEFAULT 0` },
      { name: 'representation_start_confidence', sql: `ALTER TABLE transactions ADD COLUMN representation_start_confidence INTEGER` },
      { name: 'closing_date_confidence', sql: `ALTER TABLE transactions ADD COLUMN closing_date_confidence INTEGER` },
      { name: 'buyer_agent_id', sql: `ALTER TABLE transactions ADD COLUMN buyer_agent_id TEXT` },
      { name: 'seller_agent_id', sql: `ALTER TABLE transactions ADD COLUMN seller_agent_id TEXT` },
      { name: 'escrow_officer_id', sql: `ALTER TABLE transactions ADD COLUMN escrow_officer_id TEXT` },
      { name: 'inspector_id', sql: `ALTER TABLE transactions ADD COLUMN inspector_id TEXT` },
      { name: 'other_contacts', sql: `ALTER TABLE transactions ADD COLUMN other_contacts TEXT` },
    ];
    for (const m of txMigrations) {
      if (!txColumns.includes(m.name)) runSafe(m.sql);
    }

    runSafe(`CREATE TRIGGER IF NOT EXISTS update_transactions_timestamp AFTER UPDATE ON transactions BEGIN UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`);

    // Migration 3: Transaction contacts enhanced roles
    const tcColumns = getColumns('transaction_contacts');
    if (!tcColumns.includes('role_category')) runSafe(`ALTER TABLE transaction_contacts ADD COLUMN role_category TEXT`);
    if (!tcColumns.includes('specific_role')) runSafe(`ALTER TABLE transaction_contacts ADD COLUMN specific_role TEXT`);
    if (!tcColumns.includes('is_primary')) runSafe(`ALTER TABLE transaction_contacts ADD COLUMN is_primary INTEGER DEFAULT 0`);
    if (!tcColumns.includes('notes')) runSafe(`ALTER TABLE transaction_contacts ADD COLUMN notes TEXT`);
    if (!tcColumns.includes('updated_at')) runSafe(`ALTER TABLE transaction_contacts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);

    runSafe(`CREATE INDEX IF NOT EXISTS idx_transaction_contacts_specific_role ON transaction_contacts(specific_role)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_transaction_contacts_category ON transaction_contacts(role_category)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_transaction_contacts_primary ON transaction_contacts(is_primary)`);
    runSafe(`CREATE TRIGGER IF NOT EXISTS update_transaction_contacts_timestamp AFTER UPDATE ON transaction_contacts BEGIN UPDATE transaction_contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;`);

    // Migration 4: Export tracking
    if (!txColumns.includes('export_status')) {
      runSafe(`ALTER TABLE transactions ADD COLUMN export_status TEXT DEFAULT 'not_exported' CHECK (export_status IN ('not_exported', 'exported', 're_export_needed'))`);
      runSafe(`ALTER TABLE transactions ADD COLUMN export_format TEXT CHECK (export_format IN ('pdf', 'csv', 'json', 'txt_eml', 'excel'))`);
      runSafe(`ALTER TABLE transactions ADD COLUMN export_count INTEGER DEFAULT 0`);
      runSafe(`ALTER TABLE transactions ADD COLUMN last_exported_on DATETIME`);
      runSafe(`CREATE INDEX IF NOT EXISTS idx_transactions_export_status ON transactions(export_status)`);
      runSafe(`CREATE INDEX IF NOT EXISTS idx_transactions_last_exported_on ON transactions(last_exported_on)`);
    }

    // Migration 5-6: Contact import tracking
    const contactColumns = getColumns('contacts');
    if (!contactColumns.includes('display_name')) runSafe(`ALTER TABLE contacts ADD COLUMN display_name TEXT`);
    if (!contactColumns.includes('company')) runSafe(`ALTER TABLE contacts ADD COLUMN company TEXT`);
    if (!contactColumns.includes('title')) runSafe(`ALTER TABLE contacts ADD COLUMN title TEXT`);
    if (!contactColumns.includes('source')) runSafe(`ALTER TABLE contacts ADD COLUMN source TEXT DEFAULT 'manual'`);
    if (!contactColumns.includes('metadata')) runSafe(`ALTER TABLE contacts ADD COLUMN metadata TEXT`);
    if (!contactColumns.includes('is_imported')) {
      runSafe(`ALTER TABLE contacts ADD COLUMN is_imported INTEGER DEFAULT 1`);
      runSafe(`UPDATE contacts SET is_imported = 1 WHERE source IN ('manual', 'email')`);
      runSafe(`CREATE INDEX IF NOT EXISTS idx_contacts_is_imported ON contacts(is_imported)`);
      runSafe(`CREATE INDEX IF NOT EXISTS idx_contacts_user_imported ON contacts(user_id, is_imported)`);
    }

    // Migration 7: Audit logs table
    const auditTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'`).get();
    if (!auditTableExists) {
      db.exec(`
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          user_id TEXT NOT NULL,
          session_id TEXT,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          metadata TEXT,
          ip_address TEXT,
          user_agent TEXT,
          success INTEGER NOT NULL DEFAULT 1,
          error_message TEXT,
          synced_at DATETIME,
          CHECK (action IN ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'DATA_ACCESS', 'DATA_EXPORT', 'DATA_DELETE', 'TRANSACTION_CREATE', 'TRANSACTION_UPDATE', 'TRANSACTION_DELETE', 'CONTACT_CREATE', 'CONTACT_UPDATE', 'CONTACT_DELETE', 'SETTINGS_CHANGE', 'MAILBOX_CONNECT', 'MAILBOX_DISCONNECT')),
          CHECK (resource_type IN ('USER', 'SESSION', 'TRANSACTION', 'CONTACT', 'COMMUNICATION', 'EXPORT', 'MAILBOX', 'SETTINGS'))
        )
      `);
      runSafe(`CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)`);
      runSafe(`CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp)`);
      runSafe(`CREATE INDEX idx_audit_logs_action ON audit_logs(action)`);
      runSafe(`CREATE INDEX idx_audit_logs_synced ON audit_logs(synced_at)`);
      runSafe(`CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type)`);
      runSafe(`CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id)`);
      runSafe(`CREATE TRIGGER prevent_audit_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Audit logs cannot be modified'); END`);
      runSafe(`CREATE TRIGGER prevent_audit_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Audit logs cannot be deleted'); END`);
    }

    // Migration 8: Normalize transaction status
    runSafe(`UPDATE transactions SET status = 'closed' WHERE status = 'completed'`);
    runSafe(`UPDATE transactions SET status = 'active' WHERE status = 'pending'`);
    runSafe(`UPDATE transactions SET status = 'active' WHERE status = 'open'`);
    runSafe(`UPDATE transactions SET status = 'active' WHERE status IS NULL OR status = ''`);
    runSafe(`UPDATE transactions SET status = 'closed' WHERE status = 'cancelled'`);

    // Migration 9: Normalize contacts display_name
    runSafe(`UPDATE contacts SET display_name = name WHERE (display_name IS NULL OR display_name = '') AND name IS NOT NULL AND name != ''`);
    runSafe(`UPDATE contacts SET display_name = 'Unknown' WHERE display_name IS NULL OR display_name = ''`);

    // Migration 10: Remove orphaned tables
    const orphanedExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='extraction_metrics'`).get();
    if (orphanedExists) {
      runSafe(`DROP INDEX IF EXISTS idx_extraction_metrics_user_id`);
      runSafe(`DROP INDEX IF EXISTS idx_extraction_metrics_field`);
      runSafe(`DROP INDEX IF EXISTS idx_user_feedback_user_id`);
      runSafe(`DROP INDEX IF EXISTS idx_user_feedback_transaction_id`);
      runSafe(`DROP INDEX IF EXISTS idx_user_feedback_field_name`);
      runSafe(`DROP INDEX IF EXISTS idx_user_feedback_type`);
      runSafe(`DROP TRIGGER IF EXISTS update_extraction_metrics_timestamp`);
      runSafe(`DROP TABLE IF EXISTS extraction_metrics`);
      runSafe(`DROP TABLE IF EXISTS user_feedback`);
    }

    // Migration 11: AI Detection Fields
    const txDetectionColumns = getColumns('transactions');
    if (!txDetectionColumns.includes('detection_source')) {
      runSafe(`ALTER TABLE transactions ADD COLUMN detection_source TEXT DEFAULT 'manual' CHECK (detection_source IN ('manual', 'auto', 'hybrid'))`);
      runSafe(`ALTER TABLE transactions ADD COLUMN detection_status TEXT DEFAULT 'confirmed' CHECK (detection_status IN ('pending', 'confirmed', 'rejected'))`);
      runSafe(`ALTER TABLE transactions ADD COLUMN detection_confidence REAL`);
      runSafe(`ALTER TABLE transactions ADD COLUMN detection_method TEXT`);
      runSafe(`ALTER TABLE transactions ADD COLUMN suggested_contacts TEXT`);
      runSafe(`ALTER TABLE transactions ADD COLUMN reviewed_at DATETIME`);
      runSafe(`ALTER TABLE transactions ADD COLUMN rejection_reason TEXT`);
    }

    // Migration 11: LLM settings table
    const llmSettingsExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='llm_settings'`).get();
    if (!llmSettingsExists) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS llm_settings (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          openai_api_key_encrypted TEXT,
          anthropic_api_key_encrypted TEXT,
          preferred_provider TEXT DEFAULT 'openai' CHECK (preferred_provider IN ('openai', 'anthropic')),
          openai_model TEXT DEFAULT 'gpt-4o-mini',
          anthropic_model TEXT DEFAULT 'claude-3-haiku-20240307',
          tokens_used_this_month INTEGER DEFAULT 0,
          budget_limit_tokens INTEGER,
          budget_reset_date DATE,
          platform_allowance_tokens INTEGER DEFAULT 0,
          platform_allowance_used INTEGER DEFAULT 0,
          use_platform_allowance INTEGER DEFAULT 0,
          enable_auto_detect INTEGER DEFAULT 1,
          enable_role_extraction INTEGER DEFAULT 1,
          llm_data_consent INTEGER DEFAULT 0,
          llm_data_consent_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE
        )
      `);
      runSafe(`CREATE INDEX IF NOT EXISTS idx_llm_settings_user ON llm_settings(user_id)`);
    }

    // Migration 11: Add llm_analysis to messages
    const messagesColumns = getColumns('messages');
    if (!messagesColumns.includes('llm_analysis')) {
      runSafe(`ALTER TABLE messages ADD COLUMN llm_analysis TEXT`);
    }

    // Migration 12 (TASK-975): Create indexes for communications.message_id column
    // This supports the junction table pattern for linking messages to transactions
    runSafe(`CREATE INDEX IF NOT EXISTS idx_communications_message_id ON communications(message_id)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_communications_txn_msg ON communications(transaction_id, message_id)`);
    runSafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_communications_msg_txn_unique ON communications(message_id, transaction_id) WHERE message_id IS NOT NULL`);

    // Migration 13 (TASK-1110): Create index for attachments.external_message_id column
    // This supports stable attachment linking when message_id changes on re-import
    runSafe(`CREATE INDEX IF NOT EXISTS idx_attachments_external_message_id ON attachments(external_message_id)`);

    // Migration 14 (BACKLOG-396): Backfill text_thread_count for existing transactions
    // This only runs when the column is newly added (all values are 0)
    // Uses a simplified SQL approach to count unique thread_ids per transaction
    const needsBackfill = db.prepare(`
      SELECT COUNT(*) as count FROM transactions
      WHERE text_thread_count = 0
      AND id IN (
        SELECT DISTINCT c.transaction_id FROM communications c
        INNER JOIN messages m ON (c.message_id IS NOT NULL AND c.message_id = m.id)
                              OR (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
        WHERE m.channel IN ('text', 'sms', 'imessage')
      )
    `).get() as { count: number } | undefined;

    if (needsBackfill && needsBackfill.count > 0) {
      await logService.info(`BACKLOG-396: Backfilling text_thread_count for ${needsBackfill.count} transactions`, "DatabaseService");

      // Use a SQL-only approach for efficiency
      // This counts unique thread_ids using the same logic as groupMessagesByThread
      runSafe(`
        UPDATE transactions
        SET text_thread_count = (
          SELECT COUNT(DISTINCT COALESCE(m.thread_id, 'msg-' || m.id))
          FROM communications c
          INNER JOIN messages m ON (c.message_id IS NOT NULL AND c.message_id = m.id)
                                OR (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
          WHERE c.transaction_id = transactions.id
          AND m.channel IN ('text', 'sms', 'imessage')
        )
        WHERE text_thread_count = 0
        AND id IN (
          SELECT DISTINCT c.transaction_id FROM communications c
          INNER JOIN messages m ON (c.message_id IS NOT NULL AND c.message_id = m.id)
                                OR (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
          WHERE m.channel IN ('text', 'sms', 'imessage')
        )
      `);

      await logService.info("BACKLOG-396: text_thread_count backfill completed", "DatabaseService");
    }

    // Migration 15 (BACKLOG-390): B2B Submission Tracking
    // Add columns to track broker review workflow state
    const txSubmissionColumns = getColumns('transactions');
    if (!txSubmissionColumns.includes('submission_status')) {
      runSafe(`ALTER TABLE transactions ADD COLUMN submission_status TEXT DEFAULT 'not_submitted' CHECK (submission_status IN ('not_submitted', 'submitted', 'under_review', 'needs_changes', 'resubmitted', 'approved', 'rejected'))`);
      runSafe(`ALTER TABLE transactions ADD COLUMN submission_id TEXT`);
      runSafe(`ALTER TABLE transactions ADD COLUMN submitted_at DATETIME`);
      runSafe(`ALTER TABLE transactions ADD COLUMN last_review_notes TEXT`);
      runSafe(`CREATE INDEX IF NOT EXISTS idx_transactions_submission_status ON transactions(submission_status)`);
      runSafe(`CREATE INDEX IF NOT EXISTS idx_transactions_submission_id ON transactions(submission_id)`);
      await logService.info("BACKLOG-390: Added B2B submission tracking columns", "DatabaseService");
    }

    // Migration 16 (BACKLOG-426): License Type Support
    // Add columns for license-aware feature gating
    const userLicenseColumns = getColumns('users_local');
    if (!userLicenseColumns.includes('license_type')) {
      runSafe(`ALTER TABLE users_local ADD COLUMN license_type TEXT DEFAULT 'individual' CHECK (license_type IN ('individual', 'team', 'enterprise'))`);
      runSafe(`ALTER TABLE users_local ADD COLUMN ai_detection_enabled INTEGER DEFAULT 0`);
      runSafe(`ALTER TABLE users_local ADD COLUMN organization_id TEXT`);
      runSafe(`CREATE INDEX IF NOT EXISTS idx_users_local_license_type ON users_local(license_type)`);
      runSafe(`CREATE INDEX IF NOT EXISTS idx_users_local_organization ON users_local(organization_id)`);
      await logService.info("BACKLOG-426: Added license type columns to users_local", "DatabaseService");
    }

    // Migration 17: Backfill known missing contact emails
    // One-time fix for contacts imported before junction table was properly populated
    const danielHaimId = '33b96e25-d88b-418d-a1ac-1b46ca960ae7';
    const danielHaimEmailExists = db.prepare(
      "SELECT 1 FROM contact_emails WHERE contact_id = ? AND email = 'hd@berkeley.edu'"
    ).get(danielHaimId);
    if (!danielHaimEmailExists) {
      // Check if contact exists first
      const contactExists = db.prepare("SELECT 1 FROM contacts WHERE id = ?").get(danielHaimId);
      if (contactExists) {
        runSafe(`INSERT OR IGNORE INTO contact_emails (id, contact_id, email, is_primary, source, created_at)
                 VALUES ('${crypto.randomUUID()}', '${danielHaimId}', 'hd@berkeley.edu', 1, 'migration', CURRENT_TIMESTAMP)`);
        logService.info("Migration 17: Backfilled email for Daniel Haim contact", "DatabaseService");
      }
    }

    // Migration 18: Performance indexes to reduce UI freezes during queries
    // BACKLOG-497: Quick win before full worker thread refactor
    runSafe(`CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_contact_emails_contact_id ON contact_emails(contact_id)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_contact_emails_email ON contact_emails(email)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_contact_phones_contact_id ON contact_phones(contact_id)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_communications_user_id ON communications(user_id)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_communications_sender ON communications(sender)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_communications_sent_at ON communications(sent_at)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_communications_user_sent ON communications(user_id, sent_at)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_communications_transaction ON communications(transaction_id)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_messages_user_sent ON messages(user_id, sent_at)`);
    runSafe(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)`);

    // Migration 20: Add UNIQUE constraint on messages.external_id to prevent import duplicates
    // The import service uses INSERT OR IGNORE but without a unique constraint it does nothing!
    // First, delete duplicate messages keeping only the oldest one (by created_at or id)
    const dupMessagesCount = (db.prepare(`
      SELECT COUNT(*) as count FROM messages m1
      WHERE EXISTS (
        SELECT 1 FROM messages m2
        WHERE m2.user_id = m1.user_id
        AND m2.external_id = m1.external_id
        AND m2.external_id IS NOT NULL
        AND m2.id < m1.id
      )
    `).get() as { count: number })?.count || 0;

    if (dupMessagesCount > 0) {
      await logService.info(`Migration 20: Found ${dupMessagesCount} duplicate messages to clean up`, "DatabaseService");
      runSafe(`
        DELETE FROM messages
        WHERE id IN (
          SELECT m1.id FROM messages m1
          WHERE EXISTS (
            SELECT 1 FROM messages m2
            WHERE m2.user_id = m1.user_id
            AND m2.external_id = m1.external_id
            AND m2.external_id IS NOT NULL
            AND m2.id < m1.id
          )
        )
      `);
      await logService.info("Migration 20: Duplicate messages cleaned up", "DatabaseService");
    }

    // Now add the unique index so INSERT OR IGNORE actually works
    runSafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_user_external_id ON messages(user_id, external_id) WHERE external_id IS NOT NULL`);

    // Migration 21: Delete content-based duplicates (same body_text + sent_at)
    // This catches duplicates that have different external_ids but same content
    const contentDupCount = (db.prepare(`
      SELECT COUNT(*) as count FROM messages m1
      WHERE m1.channel IN ('sms', 'imessage')
      AND EXISTS (
        SELECT 1 FROM messages m2
        WHERE m2.user_id = m1.user_id
        AND m2.body_text = m1.body_text
        AND m2.sent_at = m1.sent_at
        AND m2.channel IN ('sms', 'imessage')
        AND m2.id < m1.id
      )
    `).get() as { count: number })?.count || 0;

    if (contentDupCount > 0) {
      await logService.info(`Migration 21: Found ${contentDupCount} content-duplicate messages to clean up`, "DatabaseService");
      runSafe(`
        DELETE FROM messages
        WHERE id IN (
          SELECT m1.id FROM messages m1
          WHERE m1.channel IN ('sms', 'imessage')
          AND EXISTS (
            SELECT 1 FROM messages m2
            WHERE m2.user_id = m1.user_id
            AND m2.body_text = m1.body_text
            AND m2.sent_at = m1.sent_at
            AND m2.channel IN ('sms', 'imessage')
            AND m2.id < m1.id
          )
        )
      `);
      await logService.info("Migration 21: Content-duplicate messages cleaned up", "DatabaseService");
    }

    // Migration 19: Clean up legacy communication records that cause duplicates
    // Legacy records stored content directly in body_plain without message_id reference.
    // When the same message was re-imported with proper message_id linking, both records
    // exist with the same content but different IDs, causing duplicate messages in the UI.
    // Since we have no users yet, we can safely delete the legacy records.
    // The proper junction records (with message_id) remain and link messages to transactions.
    const legacyCommsCount = (db.prepare(`
      SELECT COUNT(*) as count FROM communications
      WHERE body_plain IS NOT NULL
      AND message_id IS NULL
      AND communication_type IN ('text', 'sms', 'imessage')
    `).get() as { count: number })?.count || 0;

    if (legacyCommsCount > 0) {
      await logService.info(`Migration 19: Found ${legacyCommsCount} legacy text communication records to clean up`, "DatabaseService");
      runSafe(`
        DELETE FROM communications
        WHERE body_plain IS NOT NULL
        AND message_id IS NULL
        AND communication_type IN ('text', 'sms', 'imessage')
      `);
      await logService.info("Migration 19: Legacy text communications cleaned up - duplicates should be resolved", "DatabaseService");
    }

    // Migration 22: Create emails table and add email_id to communications (BACKLOG-506)
    const emailsTableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='emails'"
    ).get();

    if (!emailsTableExists) {
      await logService.info("Running migration 22: Create emails table", "DatabaseService");

      db.exec(`
        CREATE TABLE IF NOT EXISTS emails (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          external_id TEXT,
          source TEXT CHECK (source IN ('gmail', 'outlook')),
          account_id TEXT,
          direction TEXT CHECK (direction IN ('inbound', 'outbound')),
          subject TEXT,
          body_plain TEXT,
          body_html TEXT,
          sender TEXT,
          recipients TEXT,
          cc TEXT,
          bcc TEXT,
          thread_id TEXT,
          in_reply_to TEXT,
          references_header TEXT,
          sent_at DATETIME,
          received_at DATETIME,
          has_attachments INTEGER DEFAULT 0,
          attachment_count INTEGER DEFAULT 0,
          message_id_header TEXT,
          content_hash TEXT,
          labels TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE
        )
      `);

      // Create indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON emails(sent_at)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_external_id ON emails(external_id)`);
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_user_external ON emails(user_id, external_id) WHERE external_id IS NOT NULL`);
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_message_id_header ON emails(user_id, message_id_header) WHERE message_id_header IS NOT NULL`);

      await logService.info("Migration 22: emails table created", "DatabaseService");
    }

    // Add email_id column to communications table (if not exists)
    const commEmailIdExists = db.prepare(`
      SELECT COUNT(*) as count FROM pragma_table_info('communications') WHERE name='email_id'
    `).get() as { count: number };

    if (commEmailIdExists.count === 0) {
      await logService.info("Migration 22: Adding email_id column to communications", "DatabaseService");
      db.exec(`ALTER TABLE communications ADD COLUMN email_id TEXT REFERENCES emails(id) ON DELETE CASCADE`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_communications_email_id ON communications(email_id)`);
      await logService.info("Migration 22: email_id column added to communications", "DatabaseService");
    }

    // Migration 23: Recreate communications as pure junction table (BACKLOG-506 Phase 5)
    // This removes all legacy content columns (subject, body_plain, sender, etc.)
    // Content now lives in emails table (for emails) and messages table (for texts)
    const currentSchemaVersion = (db.prepare("SELECT version FROM schema_version WHERE id = 1").get() as { version: number } | undefined)?.version || 0;
    if (currentSchemaVersion < 23) {
      await logService.info("Running migration 23: Recreate communications as pure junction table", "DatabaseService");

      // Step 1: Create new table with clean schema (10 columns only)
      db.exec(`
        CREATE TABLE IF NOT EXISTS communications_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          transaction_id TEXT,
          message_id TEXT,
          email_id TEXT,
          thread_id TEXT,
          link_source TEXT CHECK (link_source IN ('auto', 'manual', 'scan')),
          link_confidence REAL,
          linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
          FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
          CHECK (message_id IS NOT NULL OR email_id IS NOT NULL OR thread_id IS NOT NULL)
        )
      `);

      // Step 2: Copy data from old table (only junction fields)
      // Filter: Only copy records that have at least one content reference
      // IMPORTANT: Deduplicate to avoid unique constraint violations
      // Use subqueries to get one row per unique combination
      db.exec(`
        INSERT INTO communications_new (
          id, user_id, transaction_id, message_id, email_id, thread_id,
          link_source, link_confidence, linked_at, created_at
        )
        SELECT
          id, user_id, transaction_id, message_id, email_id, thread_id,
          link_source, link_confidence, linked_at, created_at
        FROM communications
        WHERE (message_id IS NOT NULL OR email_id IS NOT NULL OR thread_id IS NOT NULL)
          AND id IN (
            -- Get first ID for each unique email_id + transaction_id
            SELECT MIN(id) FROM communications
            WHERE email_id IS NOT NULL
            GROUP BY email_id, transaction_id
            UNION
            -- Get first ID for each unique message_id + transaction_id
            SELECT MIN(id) FROM communications
            WHERE message_id IS NOT NULL
            GROUP BY message_id, transaction_id
            UNION
            -- Get first ID for each unique thread_id + transaction_id (without message/email)
            SELECT MIN(id) FROM communications
            WHERE thread_id IS NOT NULL AND message_id IS NULL AND email_id IS NULL
            GROUP BY thread_id, transaction_id
          )
      `);

      // Step 3: Drop old table
      db.exec(`DROP TABLE communications`);

      // Step 4: Rename new table
      db.exec(`ALTER TABLE communications_new RENAME TO communications`);

      // Step 5: Recreate indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_communications_user_id ON communications(user_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_communications_transaction_id ON communications(transaction_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_communications_message_id ON communications(message_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_communications_email_id ON communications(email_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_communications_thread_id ON communications(thread_id)`);
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_msg_txn ON communications(message_id, transaction_id) WHERE message_id IS NOT NULL`);
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_email_txn ON communications(email_id, transaction_id) WHERE email_id IS NOT NULL`);
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_thread_txn ON communications(thread_id, transaction_id) WHERE thread_id IS NOT NULL AND message_id IS NULL AND email_id IS NULL`);

      db.exec(`UPDATE schema_version SET version = 23, updated_at = CURRENT_TIMESTAMP WHERE id = 1`);
      await logService.info("Migration 23 complete: communications is now pure junction table (10 columns)", "DatabaseService");
    }

    // Finalize schema version (create table if missing for backwards compatibility)
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
        INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 23);
      `);
    } else {
      const finalVersion = (db.prepare("SELECT version FROM schema_version").get() as { version: number } | undefined)?.version || 0;
      if (finalVersion < 23) {
        db.exec("UPDATE schema_version SET version = 23");
      }
    }

    await logService.info("All database migrations completed successfully", "DatabaseService");
  }

  // ============================================
  // USER OPERATIONS (Delegate to userDbService)
  // ============================================

  async createUser(userData: NewUser): Promise<User> {
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

  async getContacts(filters?: ContactFilters): Promise<Contact[]> {
    return contactDb.getContacts(filters);
  }

  async getImportedContactsByUserId(userId: string): Promise<Contact[]> {
    return contactDb.getImportedContactsByUserId(userId);
  }

  async getUnimportedContactsByUserId(userId: string): Promise<Contact[]> {
    return contactDb.getUnimportedContactsByUserId(userId);
  }

  async markContactAsImported(contactId: string): Promise<void> {
    return contactDb.markContactAsImported(contactId);
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

  async getCommunicationsByTransaction(transactionId: string): Promise<Communication[]> {
    // TASK-992: Use getCommunicationsWithMessages to include direction from messages table
    return communicationDb.getCommunicationsWithMessages(transactionId);
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
   * Get unlinked emails from the communications table
   * These are emails not yet attached to any transaction
   * Note: Emails are stored in communications table, not messages table
   */
  async getUnlinkedEmails(userId: string, limit = 500): Promise<Communication[]> {
    const db = this._ensureDb();
    const sql = `
      SELECT id, user_id, transaction_id, subject, sender, sent_at, body_plain as body_preview
      FROM communications
      WHERE user_id = ?
        AND transaction_id IS NULL
        AND (communication_type = 'email' OR communication_type IS NULL)
      ORDER BY sent_at DESC
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

      // Performance indexes from Migration 18 (BACKLOG-497)
      // Drop and recreate to ensure fresh, optimized indexes
      const performanceIndexes = [
        // Contact indexes
        { name: "idx_contacts_user_id", sql: "CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)" },
        { name: "idx_contact_emails_contact_id", sql: "CREATE INDEX IF NOT EXISTS idx_contact_emails_contact_id ON contact_emails(contact_id)" },
        { name: "idx_contact_emails_email", sql: "CREATE INDEX IF NOT EXISTS idx_contact_emails_email ON contact_emails(email)" },
        { name: "idx_contact_phones_contact_id", sql: "CREATE INDEX IF NOT EXISTS idx_contact_phones_contact_id ON contact_phones(contact_id)" },
        // Communication indexes
        { name: "idx_communications_user_id", sql: "CREATE INDEX IF NOT EXISTS idx_communications_user_id ON communications(user_id)" },
        { name: "idx_communications_sender", sql: "CREATE INDEX IF NOT EXISTS idx_communications_sender ON communications(sender)" },
        { name: "idx_communications_sent_at", sql: "CREATE INDEX IF NOT EXISTS idx_communications_sent_at ON communications(sent_at)" },
        { name: "idx_communications_user_sent", sql: "CREATE INDEX IF NOT EXISTS idx_communications_user_sent ON communications(user_id, sent_at)" },
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
