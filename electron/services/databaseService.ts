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
import log from "electron-log";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { app, dialog } from "electron";
import * as Sentry from "@sentry/electron/main";
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
  Attachment,
} from "../types";

import { DatabaseError } from "../types";
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
import * as messageDb from "./db/messageDbService";
import * as diagnosticDb from "./db/diagnosticDbService";
import * as attachmentDb from "./db/attachmentDbService";
import * as submissionDb from "./db/submissionDbService";
import * as syncDb from "./db/syncDbService";
import * as maintenanceDb from "./db/maintenanceDbService";

// Re-export types for backward compatibility
export type { ContactAssignmentOperation } from "./db/transactionContactDbService";
export type {
  TransactionContactData,
  TransactionContactResult,
} from "./db/transactionContactDbService";
export type { ContactWithActivity, TransactionWithRoles } from "./db/contactDbService";

/** Result of a dry-run migration check */
export interface MigrationPlan {
  currentVersion: number;
  targetVersion: number;
  pendingMigrations: { version: number; description: string }[];
  wouldRunCount: number;
}

/** Internal migration definition */
interface MigrationEntry {
  version: number;
  description: string;
  migrate: (d: DatabaseType) => void;
}

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

      // Safety check: ensure failure_log table exists even if migration v31 failed
      // (e.g., disk full during migration). Fixes Sentry ELECTRON-2P / ELECTRON-2X.
      this._ensureFailureLogTable(this.db);

      try {
        await this.runMigrations();
      } catch (migrationError) {
        // Migration failed -- attempt auto-restore from pre-migration backup
        log.error("[DatabaseService] Migration FAILED:", migrationError instanceof Error ? migrationError.message : String(migrationError));
        await logService.error("Migration failed, attempting auto-restore", "DatabaseService", {
          error: migrationError instanceof Error ? migrationError.message : String(migrationError),
        });

        const restoreResult = await this._attemptAutoRestore(migrationError);

        // Report to Sentry with migration failure tags
        Sentry.captureException(migrationError, {
          tags: {
            service: "database-service",
            operation: "runMigrations",
            migration_failure: "true",
            auto_restore: restoreResult.autoRestoreStatus,
            backup_integrity: restoreResult.backupIntegrity,
          },
        });

        // Ensure app is ready before showing dialog
        if (!app.isReady()) {
          await app.whenReady();
        }

        if (restoreResult.restored) {
          dialog.showMessageBox({
            type: "warning",
            title: "Database Update Notice",
            message: "A database update failed, but your data has been restored.",
            detail: "The app will continue with your existing data. Please contact support if this happens again.",
            buttons: ["OK"],
          });
        } else {
          dialog.showMessageBox({
            type: "error",
            title: "Database Update Failed",
            message: "A database update failed and could not be automatically fixed.",
            detail: "Please contact support. Your data may need manual recovery.",
            buttons: ["OK"],
          });
        }
      }

      await logService.debug("Database initialized successfully with encryption", "DatabaseService");
      return true;
    } catch (error) {
      await logService.error("Failed to initialize database", "DatabaseService", {
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error, {
        tags: { service: "database-service", operation: "initialize" },
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

    const openedDb = new Database(this.dbPath);
    openedDb.pragma(`key = "x'${this.encryptionKey}'"`);
    openedDb.pragma("cipher_compatibility = 4");
    openedDb.pragma("foreign_keys = ON");

    try {
      openedDb.pragma("cipher_integrity_check");
    } catch {
      throw new DatabaseError("Failed to decrypt database. Encryption key may be invalid.");
    }

    return openedDb;
  }

  /**
   * Safety check: ensure the failure_log table exists.
   *
   * If migration v31 failed (e.g., disk full), this table may not exist,
   * causing "no such table: failure_log" errors (Sentry ELECTRON-2P, ELECTRON-2X).
   * This runs BEFORE migrations so that any migration error logging that
   * touches failure_log will not crash.
   */
  private _ensureFailureLogTable(currentDb: DatabaseType): void {
    try {
      currentDb.exec(`
        CREATE TABLE IF NOT EXISTS failure_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          operation TEXT NOT NULL,
          error_message TEXT NOT NULL,
          metadata TEXT,
          acknowledged INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_failure_log_timestamp ON failure_log(timestamp);
        CREATE INDEX IF NOT EXISTS idx_failure_log_acknowledged ON failure_log(acknowledged);
      `);
      log.info("[DatabaseService] failure_log table safety check passed");
    } catch (err) {
      // Log but do not throw -- this is a safety net, not a hard requirement
      log.warn(
        "[DatabaseService] failure_log safety check failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
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
      Sentry.captureException(error, {
        tags: { service: "database-service", operation: "_migrateToEncryptedDatabase" },
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
      const fd = fs.openSync(filePath, "r+");
      try {
        const stats = fs.fstatSync(fd);
        for (let pass = 0; pass < 3; pass++) {
          const randomData = crypto.randomBytes(stats.size);
          fs.writeSync(fd, randomData, 0, randomData.length, 0);
          fs.fsyncSync(fd);
        }
      } finally {
        fs.closeSync(fd);
      }
      fs.unlinkSync(filePath);
    } catch {
      try { fs.unlinkSync(filePath); } catch { /* file already gone */ }
    }
  }

  // ============================================
  // MIGRATION FAILURE AUTO-RESTORE (TASK-2057)
  // ============================================

  private async _attemptAutoRestore(
    _migrationError: unknown
  ): Promise<{
    restored: boolean;
    autoRestoreStatus: "succeeded" | "failed" | "no_backup";
    backupIntegrity: "valid" | "corrupt" | "missing";
  }> {
    if (!this.dbPath || !this.encryptionKey) {
      return { restored: false, autoRestoreStatus: "no_backup", backupIntegrity: "missing" };
    }

    const dbDir = path.dirname(this.dbPath);
    const dbName = path.basename(this.dbPath, ".db");

    let backupFiles: string[] = [];
    try {
      backupFiles = fs
        .readdirSync(dbDir)
        .filter((f) => f.startsWith(`${dbName}-backup-`) && f.endsWith(".db"))
        .sort()
        .reverse();
    } catch {
      // Cannot read directory
    }

    if (backupFiles.length === 0) {
      await logService.warn("No backup files found for auto-restore", "DatabaseService");
      return { restored: false, autoRestoreStatus: "no_backup", backupIntegrity: "missing" };
    }

    const latestBackupPath = path.join(dbDir, backupFiles[0]);

    const isValid = this._verifyBackupIntegrity(latestBackupPath, this.encryptionKey);
    if (!isValid) {
      await logService.error("Backup file failed integrity check, cannot auto-restore", "DatabaseService", {
        backupPath: latestBackupPath,
      });
      return { restored: false, autoRestoreStatus: "failed", backupIntegrity: "corrupt" };
    }

    await logService.info("Backup integrity verified, proceeding with auto-restore", "DatabaseService", {
      backupPath: latestBackupPath,
    });

    try {
      if (this.db) {
        try { this.db.close(); } catch { /* May already be in a bad state */ }
        this.db = null;
      }

      fs.copyFileSync(latestBackupPath, this.dbPath);
      await logService.info("Backup file restored over main database", "DatabaseService");

      const newDb = this._openDatabase();
      this.db = newDb;

      setDb(newDb);
      setDbPath(this.dbPath);
      setEncryptionKey(this.encryptionKey);

      try {
        const probe = newDb.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
        if (!probe || probe.ok !== 1) {
          throw new Error("Post-restore connectivity check returned unexpected result");
        }
      } catch (probeError) {
        await logService.error("Post-restore connectivity check failed", "DatabaseService", {
          error: probeError instanceof Error ? probeError.message : String(probeError),
        });
        return { restored: false, autoRestoreStatus: "failed", backupIntegrity: "valid" };
      }

      await logService.info("Auto-restore completed successfully", "DatabaseService");
      return { restored: true, autoRestoreStatus: "succeeded", backupIntegrity: "valid" };
    } catch (restoreError) {
      await logService.error("Auto-restore failed during file replacement or reopening", "DatabaseService", {
        error: restoreError instanceof Error ? restoreError.message : String(restoreError),
      });
      return { restored: false, autoRestoreStatus: "failed", backupIntegrity: "valid" };
    }
  }

  private _verifyBackupIntegrity(backupPath: string, key: string): boolean {
    let testDb: DatabaseType | null = null;
    try {
      if (!fs.existsSync(backupPath)) return false;

      testDb = new Database(backupPath, { readonly: true });
      testDb.pragma(`key = "x'${key}'"`);
      testDb.pragma("cipher_compatibility = 4");

      const result = testDb.pragma("integrity_check") as Array<{ integrity_check: string }>;
      return result[0]?.integrity_check === "ok";
    } catch {
      return false;
    } finally {
      if (testDb) {
        try { testDb.close(); } catch { /* Ignore close errors */ }
      }
    }
  }

  // ============================================
  // MIGRATIONS (Version-based runner)
  // ============================================

  async runMigrations(): Promise<void> {
    const currentDb = this._ensureDb();
    const schemaPath = path.join(__dirname, "../database/schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    // Pre-migration backup (TASK-1969)
    if (this.dbPath && fs.existsSync(this.dbPath)) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
        const bkPath = this.dbPath.replace(".db", `-backup-${timestamp}.db`);

        try { currentDb.pragma("wal_checkpoint(TRUNCATE)"); } catch { /* WAL may not be enabled */ }

        fs.copyFileSync(this.dbPath, bkPath);
        await logService.info(`Pre-migration backup created: ${bkPath}`, "DatabaseService");
      } catch (backupError) {
        await logService.warn("Pre-migration backup failed", "DatabaseService", { error: backupError instanceof Error ? backupError.message : String(backupError) });
        Sentry.captureException(backupError, {
          tags: { service: "database-service", operation: "runMigrations.backup" },
        });
      }
    }

    try {
      currentDb.exec(schemaSql);
      await this._runVersionedMigrations();
    } catch (error) {
      await logService.error("Failed to run migrations", "DatabaseService", {
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error, {
        tags: { service: "database-service", operation: "runMigrations" },
      });
      throw error;
    }

    // Backup retention: keep last 3, delete older
    if (this.dbPath) {
      try {
        const dbDir = path.dirname(this.dbPath);
        const dbName = path.basename(this.dbPath, ".db");
        const backupFiles = fs
          .readdirSync(dbDir)
          .filter((f) => f.startsWith(`${dbName}-backup-`) && f.endsWith(".db"))
          .sort()
          .reverse();

        for (const old of backupFiles.slice(3)) {
          fs.unlinkSync(path.join(dbDir, old));
          await logService.info(`Removed old backup: ${old}`, "DatabaseService");
        }
      } catch {
        // Cleanup failures must not affect the app
      }
    }
  }

  /** Baseline version -- schema.sql contains everything through migration 28 */
  static readonly BASELINE_VERSION = 29;

  static readonly MIGRATIONS: MigrationEntry[] = [
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
    {
      version: 31,
      description: "Add failure_log table for offline diagnostics (TASK-2058)",
      migrate: (d) => {
        d.exec(`
          CREATE TABLE IF NOT EXISTS failure_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            operation TEXT NOT NULL,
            error_message TEXT NOT NULL,
            metadata TEXT,
            acknowledged INTEGER NOT NULL DEFAULT 0
          );
          CREATE INDEX IF NOT EXISTS idx_failure_log_timestamp ON failure_log(timestamp);
          CREATE INDEX IF NOT EXISTS idx_failure_log_acknowledged ON failure_log(acknowledged);
        `);
      },
    },
    {
      version: 32,
      description: "Add sync_session_id columns and indexes for ACID rollback on cancelled iPhone sync (TASK-2110)",
      migrate: (d) => {
        const columns: [string, string][] = [
          ["messages", "sync_session_id"],
          ["attachments", "sync_session_id"],
          ["external_contacts", "sync_session_id"],
        ];
        for (const [table, col] of columns) {
          const info = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
          if (!info.some((c) => c.name === col)) {
            d.exec(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`);
          }
        }
        d.exec(`
          CREATE INDEX IF NOT EXISTS idx_messages_sync_session ON messages(user_id, sync_session_id);
          CREATE INDEX IF NOT EXISTS idx_attachments_sync_session ON attachments(sync_session_id);
          CREATE INDEX IF NOT EXISTS idx_external_contacts_sync_session ON external_contacts(user_id, sync_session_id);
        `);
      },
    },
  ];

  static validateNoDuplicateVersions(migrations: MigrationEntry[]): void {
    const seen = new Set<number>();
    const duplicates: number[] = [];
    for (const m of migrations) {
      if (seen.has(m.version)) duplicates.push(m.version);
      seen.add(m.version);
    }
    if (duplicates.length > 0) {
      throw new Error(`Duplicate migration versions detected: ${[...new Set(duplicates)].join(", ")}`);
    }
  }

  static validateNoVersionGaps(migrations: MigrationEntry[]): void {
    if (migrations.length === 0) return;
    const versions = migrations.map((m) => m.version).sort((a, b) => a - b);
    for (let i = 1; i < versions.length; i++) {
      if (versions[i] !== versions[i - 1] + 1) {
        const gap = `Missing migration version ${versions[i - 1] + 1} (found ${versions[i - 1]} -> ${versions[i]})`;
        throw new Error(`Migration sequence error: ${gap}`);
      }
    }
  }

  _ensureSchemaVersionTable(currentDb: DatabaseType): void {
    const schemaVersionExists = currentDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
    ).get();

    if (!schemaVersionExists) {
      currentDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          version INTEGER NOT NULL DEFAULT 1,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          migrated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, ${DatabaseService.BASELINE_VERSION});
      `);
    } else {
      const columns = currentDb.prepare("PRAGMA table_info(schema_version)").all() as Array<{ name: string }>;
      const hasMigratedAt = columns.some((c) => c.name === "migrated_at");
      if (!hasMigratedAt) {
        currentDb.exec("ALTER TABLE schema_version ADD COLUMN migrated_at TEXT");
      }
    }
  }

  async _runVersionedMigrations(dryRun: boolean = false): Promise<MigrationPlan | void> {
    const currentDb = this._ensureDb();
    const migrations = DatabaseService.MIGRATIONS;

    DatabaseService.validateNoDuplicateVersions(migrations);
    DatabaseService.validateNoVersionGaps(migrations);

    this._ensureSchemaVersionTable(currentDb);

    const currentVersion = (
      currentDb.prepare("SELECT version FROM schema_version WHERE id = 1").get() as
        { version: number } | undefined
    )?.version || 0;

    if (currentVersion > 0 && currentVersion < DatabaseService.BASELINE_VERSION) {
      await logService.warn(
        `DB version ${currentVersion} is below baseline ${DatabaseService.BASELINE_VERSION}. Schema.sql should handle this.`,
        "DatabaseService"
      );
    }

    const pendingMigrations = migrations.filter((m) => m.version > currentVersion);
    const targetVersion = pendingMigrations.length > 0
      ? pendingMigrations[pendingMigrations.length - 1].version
      : currentVersion;

    if (dryRun) {
      return {
        currentVersion,
        targetVersion,
        pendingMigrations: pendingMigrations.map((m) => ({
          version: m.version,
          description: m.description,
        })),
        wouldRunCount: pendingMigrations.length,
      };
    }

    if (pendingMigrations.length > 0 && this.dbPath && fs.existsSync(this.dbPath)) {
      const dbDir = path.dirname(this.dbPath);
      const dbName = path.basename(this.dbPath, ".db");
      const backupFiles = fs.existsSync(dbDir)
        ? fs.readdirSync(dbDir).filter((f) => f.startsWith(`${dbName}-backup-`) && f.endsWith(".db"))
        : [];

      if (backupFiles.length === 0) {
        await logService.error(
          "No pre-migration backup found. Refusing to run migrations.",
          "DatabaseService"
        );
        throw new Error("Pre-migration backup required but not found");
      }
    }

    for (const m of pendingMigrations) {
      await logService.info(`Running migration ${m.version}: ${m.description}`, "DatabaseService");
      try {
        const runInTransaction = currentDb.transaction(() => {
          m.migrate(currentDb);
          currentDb.prepare(
            "UPDATE schema_version SET version = ?, updated_at = CURRENT_TIMESTAMP, migrated_at = datetime('now') WHERE id = 1"
          ).run(m.version);
        });
        runInTransaction();
        await logService.info(`Migration ${m.version} completed: ${m.description}`, "DatabaseService");
      } catch (error) {
        await logService.error(
          `Migration ${m.version} FAILED: ${m.description}`,
          "DatabaseService",
          { error: error instanceof Error ? error.message : String(error) }
        );
        throw new Error(
          `Migration ${m.version} (${m.description}) failed: ${error instanceof Error ? error.message : String(error)}. ` +
          `Database remains at version ${m.version - 1}. Pre-migration backup available.`
        );
      }
    }

    if (currentVersion < DatabaseService.BASELINE_VERSION) {
      currentDb.exec(
        `UPDATE schema_version SET version = ${DatabaseService.BASELINE_VERSION}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
      );
    }

    await logService.info("All database migrations completed successfully", "DatabaseService");
  }

  // ============================================
  // USER OPERATIONS (Delegate to userDbService)
  // ============================================

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

  async migrateUserIdForUnification(oldUserId: string, newUserId: string): Promise<void> {
    return userDb.migrateUserIdForUnification(oldUserId, newUserId);
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
  // CONTACT OPERATIONS (Delegate to contactDbService + messageDbService)
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

  getLastMessageDateForPhone(userId: string, normalizedPhone: string): string | null {
    return messageDb.getLastMessageDateForPhone(userId, normalizedPhone);
  }

  getLastMessageDatesForPhones(userId: string, phones: string[]): Map<string, string> {
    return messageDb.getLastMessageDatesForPhones(userId, phones);
  }

  async backfillPhoneLastMessageTable(userId: string): Promise<number> {
    return messageDb.backfillPhoneLastMessageTable(userId);
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

  getPendingTransactionCount(userId: string): number {
    return transactionDb.getPendingTransactionCount(userId);
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
  // LLM ANALYSIS OPERATIONS (Delegate to messageDbService)
  // ============================================

  async getMessagesForLLMAnalysis(userId: string, limit = 100): Promise<Message[]> {
    return messageDb.getMessagesForLLMAnalysis(userId, limit);
  }

  async getPendingLLMAnalysisCount(userId: string): Promise<number> {
    return messageDb.getPendingLLMAnalysisCount(userId);
  }

  // ============================================
  // MESSAGES TABLE OPERATIONS (Delegate to messageDbService)
  // ============================================

  async getUnlinkedTextMessages(userId: string, limit = 1000): Promise<Message[]> {
    return messageDb.getUnlinkedTextMessages(userId, limit);
  }

  async getUnlinkedEmails(userId: string, limit = 500): Promise<Communication[]> {
    return messageDb.getUnlinkedEmails(userId, limit);
  }

  async getMessageContacts(userId: string): Promise<{ contact: string; messageCount: number; lastMessageAt: string }[]> {
    return messageDb.getMessageContacts(userId);
  }

  async getMessagesByContact(userId: string, contact: string): Promise<Message[]> {
    return messageDb.getMessagesByContact(userId, contact);
  }

  async updateMessage(messageId: string, updates: Partial<Message>): Promise<void> {
    return messageDb.updateMessage(messageId, updates);
  }

  async linkMessageToTransaction(messageId: string, transactionId: string): Promise<void> {
    return messageDb.linkMessageToTransaction(messageId, transactionId);
  }

  async unlinkMessageFromTransaction(messageId: string): Promise<void> {
    return messageDb.unlinkMessageFromTransaction(messageId);
  }

  async getMessagesByTransaction(transactionId: string): Promise<Message[]> {
    return messageDb.getMessagesByTransaction(transactionId);
  }

  async getMessageById(messageId: string): Promise<Message | null> {
    return messageDb.getMessageById(messageId);
  }

  // ============================================
  // DIAGNOSTIC OPERATIONS (Delegate to diagnosticDbService)
  // ============================================

  async diagnosticGetMessagesWithNullThreadId(userId: string) {
    return diagnosticDb.diagnosticGetMessagesWithNullThreadId(userId);
  }

  async diagnosticUnknownRecipientMessages(userId: string) {
    return diagnosticDb.diagnosticUnknownRecipientMessages(userId);
  }

  async diagnosticGetMessagesWithGarbageText(userId: string) {
    return diagnosticDb.diagnosticGetMessagesWithGarbageText(userId);
  }

  async diagnosticMessageHealthReport(userId: string) {
    return diagnosticDb.diagnosticMessageHealthReport(userId);
  }

  async diagnosticGetThreadsForContact(userId: string, phoneDigits: string) {
    return diagnosticDb.diagnosticGetThreadsForContact(userId, phoneDigits);
  }

  async diagnosticNullThreadIdAnalysis(userId: string) {
    return diagnosticDb.diagnosticNullThreadIdAnalysis(userId);
  }

  // ============================================
  // UTILITY OPERATIONS (Keep in facade)
  // ============================================

  async vacuum(): Promise<void> {
    vacuumDb();
  }

  async close(): Promise<void> {
    await closeDb();
    this.db = null;
    this.encryptionKey = null;
    await logService.info("Database connection closed", "DatabaseService");
  }

  async rekeyDatabase(newKey: string): Promise<void> {
    const currentDb = this._ensureDb();
    try {
      currentDb.pragma(`rekey = "x'${newKey}'"`);
      this.encryptionKey = newKey;
      await logService.info("Database re-keyed successfully", "DatabaseService");
    } catch (error) {
      await logService.error("Failed to re-key database", "DatabaseService", {
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error, {
        tags: { service: "database-service", operation: "rekeyDatabase" },
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

  // ============================================
  // MAINTENANCE OPERATIONS (Delegate to maintenanceDbService)
  // ============================================

  async reindexDatabase(): Promise<{
    success: boolean;
    indexesRebuilt: number;
    durationMs: number;
    error?: string;
  }> {
    return maintenanceDb.reindexDatabase();
  }

  // ============================================
  // CONTACT RESOLUTION QUERIES (Delegate to attachmentDbService)
  // ============================================

  getContactNamesByPhoneDigits(normalizedPhones: string[]) {
    return attachmentDb.getContactNamesByPhoneDigits(normalizedPhones);
  }

  getContactNamesByEmails(lowerEmails: string[]) {
    return attachmentDb.getContactNamesByEmails(lowerEmails);
  }

  getContactNameByAppleIdPrefix(appleIdLower: string) {
    return attachmentDb.getContactNameByAppleIdPrefix(appleIdLower);
  }

  // ============================================
  // EMAIL ATTACHMENT QUERIES (Delegate to attachmentDbService)
  // ============================================

  getAttachmentStoragePaths() {
    return attachmentDb.getAttachmentStoragePaths();
  }

  hasAttachmentForEmail(emailId: string, filename: string) {
    return attachmentDb.hasAttachmentForEmail(emailId, filename);
  }

  createAttachmentRecord(params: Parameters<typeof attachmentDb.createAttachmentRecord>[0]) {
    return attachmentDb.createAttachmentRecord(params);
  }

  getAttachmentsByEmailId(emailId: string) {
    return attachmentDb.getAttachmentsByEmailId(emailId);
  }

  // ============================================
  // FOLDER EXPORT ATTACHMENT QUERIES (Delegate to attachmentDbService)
  // ============================================

  getAttachmentsForMessageWithFallback(messageId: string, externalId?: string) {
    return attachmentDb.getAttachmentsForMessageWithFallback(messageId, externalId);
  }

  getAttachmentsForEmailExport(emailId: string) {
    return attachmentDb.getAttachmentsForEmailExport(emailId);
  }

  getAttachmentsForExportBulk(messageIds: string[], externalIds: string[], emailIds: string[]) {
    return attachmentDb.getAttachmentsForExportBulk(messageIds, externalIds, emailIds);
  }

  // ============================================
  // SUBMISSION QUERIES (Delegate to submissionDbService)
  // ============================================

  getTransactionMessages(transactionId: string, auditStartDate?: Date | null, auditEndDate?: Date | null) {
    return submissionDb.getTransactionMessages(transactionId, auditStartDate, auditEndDate);
  }

  getTransactionEmails(transactionId: string, auditStartDate?: Date | null, auditEndDate?: Date | null) {
    return submissionDb.getTransactionEmails(transactionId, auditStartDate, auditEndDate);
  }

  getTransactionAttachments(transactionId: string, auditStartDate?: Date | null, auditEndDate?: Date | null) {
    return submissionDb.getTransactionAttachments(transactionId, auditStartDate, auditEndDate);
  }

  getTransactionBySubmissionId(submissionId: string) {
    return submissionDb.getTransactionBySubmissionId(submissionId);
  }

  getSubmittedTransactionById(transactionId: string) {
    return submissionDb.getSubmittedTransactionById(transactionId);
  }

  getActiveSubmittedTransactions() {
    return submissionDb.getActiveSubmittedTransactions();
  }

  updateTransactionSubmissionStatus(transactionId: string, submissionStatus: string, lastReviewNotes: string | null) {
    return submissionDb.updateTransactionSubmissionStatus(transactionId, submissionStatus, lastReviewNotes);
  }

  // ============================================
  // iPHONE SYNC QUERIES (Delegate to syncDbService)
  // ============================================

  getExistingMessageExternalIds(userId: string) {
    return syncDb.getExistingMessageExternalIds(userId);
  }

  batchInsertMessages(
    messages: Parameters<typeof syncDb.batchInsertMessages>[0],
    batchSize: number,
    sessionId?: string,
    cancelSignal?: { cancelled: boolean }
  ) {
    return syncDb.batchInsertMessages(messages, batchSize, sessionId, cancelSignal);
  }

  getMessageIdMap(userId: string) {
    return syncDb.getMessageIdMap(userId);
  }

  getExistingAttachmentRecords() {
    return syncDb.getExistingAttachmentRecords();
  }

  insertAttachment(params: Parameters<typeof syncDb.insertAttachment>[0]) {
    return syncDb.insertAttachment(params);
  }

  // ============================================
  // SYNC SESSION ROLLBACK (Delegate to syncDbService)
  // ============================================

  deleteMessagesBySessionId(userId: string, sessionId: string) {
    return syncDb.deleteMessagesBySessionId(userId, sessionId);
  }

  deleteAttachmentsBySessionId(sessionId: string) {
    return syncDb.deleteAttachmentsBySessionId(sessionId);
  }

  deleteContactsBySessionId(userId: string, sessionId: string) {
    return syncDb.deleteContactsBySessionId(userId, sessionId);
  }

  // ============================================
  // EMAIL DEDUPLICATION (TASK-2100)
  // ============================================

  getDatabaseForDeduplication(): DatabaseType {
    return this._ensureDb();
  }
}

// Export singleton instance
export default new DatabaseService();
