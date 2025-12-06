/**
 * Database Service
 * Manages local SQLite database operations for Mad application
 * Handles user data, transactions, communications, and sessions
 *
 * SECURITY: Database is encrypted at rest using SQLCipher (AES-256)
 * Encryption key is stored in OS keychain via Electron safeStorage
 */

import Database from 'better-sqlite3-multiple-ciphers';
import type { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { app } from 'electron';
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
  QueryResult,
} from '../types';

import { DatabaseError, NotFoundError } from '../types';
import { databaseEncryptionService } from './databaseEncryptionService';
import logService from './logService';
import type { AuditLogEntry, AuditLogDbRow } from './auditService';

// Contact with activity metadata
interface ContactWithActivity extends Contact {
  last_communication_at?: string | null;
  communication_count?: number;
  address_mention_count?: number;
}

// Transaction contact association
interface TransactionContactData {
  contact_id: string;
  role?: string;
  role_category?: string;
  specific_role?: string;
  is_primary?: number | boolean;
  notes?: string;
}

// Transaction contact result with contact info
interface TransactionContactResult extends TransactionContactData {
  id: string;
  transaction_id: string;
  created_at: string;
  updated_at: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_company?: string;
  contact_title?: string;
}

// Transaction with roles for contact
interface TransactionWithRoles {
  id: string;
  property_address: string;
  closing_date?: string | null;
  transaction_type?: string | null;
  status: string;
  roles: string;
}

// Feedback data for submission
interface _FeedbackData {
  transaction_id: string;
  field_name: string;
  original_value?: string;
  corrected_value?: string;
  original_confidence?: number;
  feedback_type: 'correction' | 'confirmation' | 'rejection';
  source_communication_id?: string;
  user_notes?: string;
}

class DatabaseService implements IDatabaseService {
  private db: DatabaseType | null = null;
  private dbPath: string | null = null;
  private encryptionKey: string | null = null;

  /**
   * Initialize database - creates DB file and tables if needed
   * Handles encryption and migration from unencrypted databases
   */
  async initialize(): Promise<boolean> {
    // Prevent double initialization
    if (this.db) {
      await logService.debug('Database already initialized, skipping', 'DatabaseService');
      return true;
    }

    try {
      // Get user data path
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'mad.db');

      await logService.info('Initializing database', 'DatabaseService', { path: this.dbPath });

      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize encryption service and get key
      await databaseEncryptionService.initialize();
      this.encryptionKey = await databaseEncryptionService.getEncryptionKey();

      // Check if migration from unencrypted database is needed
      const needsMigration = await this._checkMigrationNeeded();

      if (needsMigration) {
        await logService.info('Migrating existing database to encrypted storage', 'DatabaseService');
        await this._migrateToEncryptedDatabase();
      }

      // Open database connection with encryption
      this.db = this._openDatabase();

      // Run schema migrations
      await this.runMigrations();

      await logService.info('Database initialized successfully with encryption', 'DatabaseService');
      return true;
    } catch (error) {
      await logService.error(
        'Failed to initialize database',
        'DatabaseService',
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  /**
   * Check if database is initialized
   * Used to determine if we can perform database operations
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Ensure database is initialized and return it
   * @private
   * @throws {DatabaseError} If database is not initialized
   */
  private _ensureDb(): DatabaseType {
    if (!this.db) {
      throw new DatabaseError('Database is not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Open database connection with encryption
   */
  private _openDatabase(): DatabaseType {
    if (!this.dbPath) {
      throw new DatabaseError('Database path is not set');
    }
    if (!this.encryptionKey) {
      throw new DatabaseError('Encryption key is not set');
    }

    const db = new Database(this.dbPath);

    // Configure SQLCipher encryption
    db.pragma(`key = "x'${this.encryptionKey}'"`);
    db.pragma('cipher_compatibility = 4');

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Verify database is accessible (will throw if key is wrong)
    try {
      db.pragma('cipher_integrity_check');
    } catch (error) {
      throw new DatabaseError('Failed to decrypt database. Encryption key may be invalid.');
    }

    return db;
  }

  /**
   * Check if migration from unencrypted to encrypted database is needed
   */
  private async _checkMigrationNeeded(): Promise<boolean> {
    if (!this.dbPath || !fs.existsSync(this.dbPath)) {
      return false; // New database, will be created encrypted
    }

    const isEncrypted = await databaseEncryptionService.isDatabaseEncrypted(this.dbPath);
    return !isEncrypted;
  }

  /**
   * Migrate existing unencrypted database to encrypted format
   * Uses table-by-table copy approach for compatibility
   */
  private async _migrateToEncryptedDatabase(): Promise<void> {
    if (!this.dbPath || !this.encryptionKey) {
      throw new DatabaseError('Database path or encryption key not set');
    }

    const unencryptedPath = this.dbPath;
    const backupPath = `${this.dbPath}.backup`;
    const encryptedPath = `${this.dbPath}.encrypted`;

    try {
      await logService.info('Starting database encryption migration', 'DatabaseService');

      // Create backup of original database
      fs.copyFileSync(unencryptedPath, backupPath);
      await logService.debug('Created backup of unencrypted database', 'DatabaseService');

      // Open the unencrypted database (read-only)
      const oldDb = new Database(unencryptedPath, { readonly: true });

      // Get all table names from the old database
      const tables = oldDb.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];

      // Get all index definitions
      const indexes = oldDb.prepare(`
        SELECT sql FROM sqlite_master
        WHERE type='index' AND sql IS NOT NULL
      `).all() as { sql: string }[];

      // Get all trigger definitions
      const triggers = oldDb.prepare(`
        SELECT sql FROM sqlite_master
        WHERE type='trigger' AND sql IS NOT NULL
      `).all() as { sql: string }[];

      // Create new encrypted database
      const newDb = new Database(encryptedPath);
      newDb.pragma(`key = "x'${this.encryptionKey}'"`);

      // Copy schema and data for each table
      for (const { name: tableName } of tables) {
        // Get table schema
        const tableInfo = oldDb.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tableName) as { sql: string } | undefined;
        if (tableInfo?.sql) {
          newDb.exec(tableInfo.sql);

          // Copy data
          const rows = oldDb.prepare(`SELECT * FROM "${tableName}"`).all();
          if (rows.length > 0) {
            const columns = Object.keys(rows[0] as object);
            const placeholders = columns.map(() => '?').join(', ');
            const insertStmt = newDb.prepare(`INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`);

            const insertMany = newDb.transaction((data: unknown[]) => {
              for (const row of data) {
                insertStmt.run(...columns.map(col => (row as Record<string, unknown>)[col]));
              }
            });
            insertMany(rows);
          }
        }
      }

      // Recreate indexes
      for (const { sql } of indexes) {
        try {
          newDb.exec(sql);
        } catch {
          // Index may already exist from table creation
        }
      }

      // Recreate triggers
      for (const { sql } of triggers) {
        try {
          newDb.exec(sql);
        } catch {
          // Trigger may already exist
        }
      }

      oldDb.close();
      newDb.close();

      await logService.debug('Exported data to encrypted database', 'DatabaseService');

      // Securely delete the unencrypted database
      await this._secureDelete(unencryptedPath);

      // Rename encrypted to original name
      fs.renameSync(encryptedPath, unencryptedPath);

      // Remove backup after successful migration
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      await logService.info('Database encryption migration completed successfully', 'DatabaseService');
    } catch (error) {
      await logService.error(
        'Database encryption migration failed',
        'DatabaseService',
        { error: error instanceof Error ? error.message : String(error) }
      );

      // Restore from backup if migration failed
      if (fs.existsSync(backupPath)) {
        await logService.warn('Restoring database from backup', 'DatabaseService');
        if (fs.existsSync(unencryptedPath)) {
          fs.unlinkSync(unencryptedPath);
        }
        fs.renameSync(backupPath, unencryptedPath);
      }

      // Clean up encrypted file if it exists
      if (fs.existsSync(encryptedPath)) {
        fs.unlinkSync(encryptedPath);
      }

      throw error;
    }
  }

  /**
   * Securely delete a file by overwriting with random data before unlinking
   */
  private async _secureDelete(filePath: string): Promise<void> {
    try {
      const stats = fs.statSync(filePath);
      const fd = fs.openSync(filePath, 'r+');

      // Overwrite with random data (3 passes)
      for (let pass = 0; pass < 3; pass++) {
        const randomData = crypto.randomBytes(stats.size);
        fs.writeSync(fd, randomData, 0, randomData.length, 0);
        fs.fsyncSync(fd);
      }

      fs.closeSync(fd);
      fs.unlinkSync(filePath);

      await logService.debug('Securely deleted file', 'DatabaseService', { filePath });
    } catch (error) {
      await logService.warn(
        'Secure delete failed, using standard delete',
        'DatabaseService',
        { filePath, error: error instanceof Error ? error.message : String(error) }
      );
      // Fall back to standard delete
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  /**
   * Run database migrations (execute schema.sql)
   */
  async runMigrations(): Promise<void> {
    const db = this._ensureDb();
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    try {
      db.exec(schemaSql);
      // Run additional migrations for existing databases
      await this._runAdditionalMigrations();
    } catch (error) {
      await logService.error(
        'Failed to run migrations',
        'DatabaseService',
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  /**
   * Run additional migrations for schema changes
   */
  private async _runAdditionalMigrations(): Promise<void> {
    await logService.info('Starting database migrations', 'DatabaseService');
    try {
      // Migration 1: Add legal compliance columns to users_local
      await logService.debug('Running Migration 1: User compliance columns', 'DatabaseService');
      const userColumns = this._all<{ name: string }>(`PRAGMA table_info(users_local)`);
      if (!userColumns.some(col => col.name === 'terms_accepted_at')) {
        await logService.debug('Adding terms_accepted_at column to users_local', 'DatabaseService');
        this._run(`ALTER TABLE users_local ADD COLUMN terms_accepted_at DATETIME`);
      }
      if (!userColumns.some(col => col.name === 'terms_version_accepted')) {
        await logService.debug('Adding terms_version_accepted column to users_local', 'DatabaseService');
        this._run(`ALTER TABLE users_local ADD COLUMN terms_version_accepted TEXT`);
      }
      if (!userColumns.some(col => col.name === 'privacy_policy_accepted_at')) {
        await logService.debug('Adding privacy_policy_accepted_at column to users_local', 'DatabaseService');
        this._run(`ALTER TABLE users_local ADD COLUMN privacy_policy_accepted_at DATETIME`);
      }
      if (!userColumns.some(col => col.name === 'privacy_policy_version_accepted')) {
        await logService.debug('Adding privacy_policy_version_accepted column to users_local', 'DatabaseService');
        this._run(`ALTER TABLE users_local ADD COLUMN privacy_policy_version_accepted TEXT`);
      }
      if (!userColumns.some(col => col.name === 'email_onboarding_completed_at')) {
        await logService.debug('Adding email_onboarding_completed_at column to users_local', 'DatabaseService');
        this._run(`ALTER TABLE users_local ADD COLUMN email_onboarding_completed_at DATETIME`);
      }
      if (!userColumns.some(col => col.name === 'mobile_phone_type')) {
        await logService.debug('Adding mobile_phone_type column to users_local', 'DatabaseService');
        this._run(`ALTER TABLE users_local ADD COLUMN mobile_phone_type TEXT`);
      }

      // Migration 2: Add new transaction columns
      await logService.debug('Running Migration 2: Transaction columns', 'DatabaseService');
      const transactionColumns = this._all<{ name: string }>(`PRAGMA table_info(transactions)`);
      const transactionMigrations = [
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

      for (const migration of transactionMigrations) {
        if (!transactionColumns.some(col => col.name === migration.name)) {
          await logService.debug(`Adding ${migration.name} column to transactions`, 'DatabaseService');
          this._run(migration.sql);
        }
      }

      // Create trigger for transactions timestamp (after ensuring updated_at column exists)
      this._run(`
        CREATE TRIGGER IF NOT EXISTS update_transactions_timestamp
        AFTER UPDATE ON transactions
        BEGIN
          UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `);

      // Create index for status column (added by migration)
      this._run(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`);

      // Migration 3: Enhanced contact roles for transaction_contacts
      await logService.debug('Running Migration 3: Transaction contacts enhanced roles', 'DatabaseService');
      const tcColumns = this._all<{ name: string }>(`PRAGMA table_info(transaction_contacts)`);
      await logService.debug(
        'Current transaction_contacts columns',
        'DatabaseService',
        { columns: tcColumns.map(c => c.name).join(', ') }
      );
      const tcMigrations = [
        {
          name: 'role_category',
          sql: `ALTER TABLE transaction_contacts ADD COLUMN role_category TEXT`
        },
        {
          name: 'specific_role',
          sql: `ALTER TABLE transaction_contacts ADD COLUMN specific_role TEXT`
        },
        { name: 'is_primary', sql: `ALTER TABLE transaction_contacts ADD COLUMN is_primary INTEGER DEFAULT 0` },
        { name: 'notes', sql: `ALTER TABLE transaction_contacts ADD COLUMN notes TEXT` },
        { name: 'updated_at', sql: `ALTER TABLE transaction_contacts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP` }
      ];

      for (const migration of tcMigrations) {
        if (!tcColumns.some(col => col.name === migration.name)) {
          await logService.debug(`Adding ${migration.name} column to transaction_contacts`, 'DatabaseService');
          try {
            this._run(migration.sql);
            await logService.debug(`Successfully added ${migration.name} column`, 'DatabaseService');
          } catch (err) {
            await logService.error(
              `Failed to add ${migration.name} column`,
              'DatabaseService',
              { error: (err as Error).message }
            );
            throw err;
          }
        }
      }

      // Create index for better performance
      this._run(`CREATE INDEX IF NOT EXISTS idx_transaction_contacts_specific_role ON transaction_contacts(specific_role)`);
      this._run(`CREATE INDEX IF NOT EXISTS idx_transaction_contacts_category ON transaction_contacts(role_category)`);
      this._run(`CREATE INDEX IF NOT EXISTS idx_transaction_contacts_primary ON transaction_contacts(is_primary)`);

      // Create trigger for transaction_contacts timestamp updates
      this._run(`
        CREATE TRIGGER IF NOT EXISTS update_transaction_contacts_timestamp
        AFTER UPDATE ON transaction_contacts
        BEGIN
          UPDATE transaction_contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `);

      // Verify all columns were added successfully
      const verifyTcColumns = this._all<{ name: string }>(`PRAGMA table_info(transaction_contacts)`);
      const columnNames = verifyTcColumns.map(c => c.name);
      await logService.debug(
        'Migration 3 complete. Final transaction_contacts columns',
        'DatabaseService',
        { columns: columnNames.join(', ') }
      );

      const requiredColumns = ['role_category', 'specific_role', 'is_primary', 'notes', 'updated_at'];
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      if (missingColumns.length > 0) {
        await logService.error('Missing required columns after migration', 'DatabaseService', { missingColumns });
      } else {
        await logService.debug('All required columns present', 'DatabaseService');
      }

      // Migration 4: Add export tracking columns to transactions
      const exportStatusExists = transactionColumns.some(col => col.name === 'export_status');
      if (!exportStatusExists) {
        await logService.debug('Adding export tracking columns to transactions', 'DatabaseService');
        this._run(`ALTER TABLE transactions ADD COLUMN export_status TEXT DEFAULT 'not_exported' CHECK (export_status IN ('not_exported', 'exported', 're_export_needed'))`);
        this._run(`ALTER TABLE transactions ADD COLUMN export_format TEXT CHECK (export_format IN ('pdf', 'csv', 'json', 'txt_eml', 'excel'))`);
        this._run(`ALTER TABLE transactions ADD COLUMN export_count INTEGER DEFAULT 0`);
        this._run(`ALTER TABLE transactions ADD COLUMN last_exported_on DATETIME`);

        // Create indexes for better query performance
        this._run(`CREATE INDEX IF NOT EXISTS idx_transactions_export_status ON transactions(export_status)`);
        this._run(`CREATE INDEX IF NOT EXISTS idx_transactions_last_exported_on ON transactions(last_exported_on)`);
      }

      // Migration 5: User feedback and extraction metrics
      const feedbackTableExists = this._get<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_feedback'`);
      if (!feedbackTableExists) {
        await logService.debug('Creating user feedback tables', 'DatabaseService');

        // User feedback table
        this._run(`
          CREATE TABLE user_feedback (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            transaction_id TEXT NOT NULL,
            field_name TEXT NOT NULL,
            original_value TEXT,
            corrected_value TEXT,
            original_confidence INTEGER,
            feedback_type TEXT CHECK (feedback_type IN ('correction', 'confirmation', 'rejection')),
            source_communication_id TEXT,
            user_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
            FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
            FOREIGN KEY (source_communication_id) REFERENCES communications(id) ON DELETE SET NULL
          )
        `);

        // Extraction metrics table
        this._run(`
          CREATE TABLE extraction_metrics (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            field_name TEXT NOT NULL,
            total_extractions INTEGER DEFAULT 0,
            confirmed_correct INTEGER DEFAULT 0,
            user_corrected INTEGER DEFAULT 0,
            completely_wrong INTEGER DEFAULT 0,
            avg_confidence INTEGER,
            high_confidence_count INTEGER DEFAULT 0,
            medium_confidence_count INTEGER DEFAULT 0,
            low_confidence_count INTEGER DEFAULT 0,
            period_start DATETIME,
            period_end DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
            UNIQUE(user_id, field_name, period_start)
          )
        `);

        // Indexes
        this._run(`CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id)`);
        this._run(`CREATE INDEX idx_user_feedback_transaction_id ON user_feedback(transaction_id)`);
        this._run(`CREATE INDEX idx_user_feedback_field_name ON user_feedback(field_name)`);
        this._run(`CREATE INDEX idx_user_feedback_type ON user_feedback(feedback_type)`);
        this._run(`CREATE INDEX idx_extraction_metrics_user_id ON extraction_metrics(user_id)`);
        this._run(`CREATE INDEX idx_extraction_metrics_field ON extraction_metrics(field_name)`);

        // Trigger
        this._run(`
          CREATE TRIGGER update_extraction_metrics_timestamp
          AFTER UPDATE ON extraction_metrics
          BEGIN
            UPDATE extraction_metrics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END;
        `);
      }

      // Migration 6: Contact import tracking
      const contactColumns = this._all<{ name: string }>(`PRAGMA table_info(contacts)`);
      if (!contactColumns.some(col => col.name === 'is_imported')) {
        await logService.debug('Adding is_imported column to contacts', 'DatabaseService');
        this._run(`ALTER TABLE contacts ADD COLUMN is_imported INTEGER DEFAULT 1`);
        await logService.debug('Successfully added is_imported column', 'DatabaseService');
        // Mark all existing manual and email contacts as imported
        this._run(`UPDATE contacts SET is_imported = 1 WHERE source IN ('manual', 'email')`);
        await logService.debug('Marked existing contacts as imported', 'DatabaseService');
        // Create index for better performance
        this._run(`CREATE INDEX IF NOT EXISTS idx_contacts_is_imported ON contacts(is_imported)`);
        this._run(`CREATE INDEX IF NOT EXISTS idx_contacts_user_imported ON contacts(user_id, is_imported)`);
        await logService.debug('Created indexes for is_imported', 'DatabaseService');
      } else {
        await logService.debug('is_imported column already exists', 'DatabaseService');
      }

      // Migration 7: Audit logs table (immutable)
      const auditTableExists = this._get<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'`);
      if (!auditTableExists) {
        await logService.info('Running Migration 7: Creating audit_logs table', 'DatabaseService');

        // Create the audit_logs table
        this._run(`
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

            CHECK (action IN (
              'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
              'DATA_ACCESS', 'DATA_EXPORT', 'DATA_DELETE',
              'TRANSACTION_CREATE', 'TRANSACTION_UPDATE', 'TRANSACTION_DELETE',
              'CONTACT_CREATE', 'CONTACT_UPDATE', 'CONTACT_DELETE',
              'SETTINGS_CHANGE', 'MAILBOX_CONNECT', 'MAILBOX_DISCONNECT'
            )),

            CHECK (resource_type IN (
              'USER', 'SESSION', 'TRANSACTION', 'CONTACT',
              'COMMUNICATION', 'EXPORT', 'MAILBOX', 'SETTINGS'
            ))
          )
        `);

        // Create indexes
        this._run(`CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)`);
        this._run(`CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp)`);
        this._run(`CREATE INDEX idx_audit_logs_action ON audit_logs(action)`);
        this._run(`CREATE INDEX idx_audit_logs_synced ON audit_logs(synced_at)`);
        this._run(`CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type)`);
        this._run(`CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id)`);

        // Create immutability triggers
        this._run(`
          CREATE TRIGGER prevent_audit_update
          BEFORE UPDATE ON audit_logs
          BEGIN
            SELECT RAISE(ABORT, 'Audit logs cannot be modified');
          END
        `);

        this._run(`
          CREATE TRIGGER prevent_audit_delete
          BEFORE DELETE ON audit_logs
          BEGIN
            SELECT RAISE(ABORT, 'Audit logs cannot be deleted');
          END
        `);

        await logService.info('Audit logs table created with immutability constraints', 'DatabaseService');
      }

      await logService.info('All database migrations completed successfully', 'DatabaseService');

    } catch (error) {
      await logService.error(
        'Migration failed',
        'DatabaseService',
        {
          error: (error as Error).message,
          stack: (error as Error).stack
        }
      );
    }
  }

  /**
   * Helper: Run a query that returns a single row
   * Uses better-sqlite3's synchronous API
   */
  private _get<T = any>(sql: string, params: any[] = []): T | undefined {
    const db = this._ensureDb();
    const stmt = db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  /**
   * Helper: Run a query that returns multiple rows
   * Uses better-sqlite3's synchronous API
   */
  private _all<T = any>(sql: string, params: any[] = []): T[] {
    const db = this._ensureDb();
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Helper: Run a query that modifies data (INSERT, UPDATE, DELETE)
   * Uses better-sqlite3's synchronous API
   */
  private _run(sql: string, params: any[] = []): QueryResult {
    const db = this._ensureDb();
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return {
      lastInsertRowid: result.lastInsertRowid as number,
      changes: result.changes
    };
  }

  // ============================================
  // USER OPERATIONS
  // ============================================

  /**
   * Create a new user
   */
  async createUser(userData: NewUser): Promise<User> {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO users_local (
        id, email, first_name, last_name, display_name, avatar_url,
        oauth_provider, oauth_id, subscription_tier, subscription_status,
        trial_ends_at, timezone, theme, company, job_title
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      userData.email,
      userData.first_name || null,
      userData.last_name || null,
      userData.display_name || null,
      userData.avatar_url || null,
      userData.oauth_provider,
      userData.oauth_id,
      userData.subscription_tier || 'free',
      userData.subscription_status || 'trial',
      userData.trial_ends_at || null,
      userData.timezone || 'America/Los_Angeles',
      userData.theme || 'light',
      userData.company || null,
      userData.job_title || null,
    ];

    this._run(sql, params);
    const user = await this.getUserById(id);
    if (!user) {
      throw new DatabaseError('Failed to create user');
    }
    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const sql = 'SELECT * FROM users_local WHERE id = ?';
    const user = this._get<User>(sql, [userId]);
    return user || null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const sql = 'SELECT * FROM users_local WHERE email = ?';
    const user = this._get<User>(sql, [email]);
    return user || null;
  }

  /**
   * Get user by OAuth provider and ID
   */
  async getUserByOAuthId(provider: OAuthProvider, oauthId: string): Promise<User | null> {
    const sql = 'SELECT * FROM users_local WHERE oauth_provider = ? AND oauth_id = ?';
    const user = this._get<User>(sql, [provider, oauthId]);
    return user || null;
  }

  /**
   * Update user data
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const allowedFields = [
      'email',
      'first_name',
      'last_name',
      'display_name',
      'avatar_url',
      'subscription_tier',
      'subscription_status',
      'trial_ends_at',
      'timezone',
      'theme',
      'notification_preferences',
      'company',
      'job_title',
      'last_cloud_sync_at',
      'terms_accepted_at',
      'privacy_policy_accepted_at',
      'terms_version_accepted',
      'privacy_policy_version_accepted',
      'email_onboarding_completed_at',
      'mobile_phone_type',
    ];

    const fields: string[] = [];
    const values: any[] = [];

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push((updates as any)[key]);
      }
    });

    if (fields.length === 0) {
      throw new DatabaseError('No valid fields to update');
    }

    values.push(userId);

    const sql = `UPDATE users_local SET ${fields.join(', ')} WHERE id = ?`;
    this._run(sql, values);
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    const sql = 'DELETE FROM users_local WHERE id = ?';
    this._run(sql, [userId]);
  }

  /**
   * Update last login timestamp and increment login count
   */
  async updateLastLogin(userId: string): Promise<void> {
    const sql = `
      UPDATE users_local
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    this._run(sql, [userId]);
  }

  /**
   * Accept terms and conditions for a user
   */
  async acceptTerms(userId: string, termsVersion: string, privacyVersion: string): Promise<User> {
    const sql = `
      UPDATE users_local
      SET terms_accepted_at = CURRENT_TIMESTAMP,
          terms_version_accepted = ?,
          privacy_policy_accepted_at = CURRENT_TIMESTAMP,
          privacy_policy_version_accepted = ?
      WHERE id = ?
    `;
    this._run(sql, [termsVersion, privacyVersion, userId]);
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found after accepting terms', 'User', userId);
    }
    return user;
  }

  /**
   * Mark email onboarding as completed for a user
   */
  async completeEmailOnboarding(userId: string): Promise<void> {
    const sql = `
      UPDATE users_local
      SET email_onboarding_completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    this._run(sql, [userId]);
  }

  /**
   * Check if user has completed email onboarding
   */
  async hasCompletedEmailOnboarding(userId: string): Promise<boolean> {
    const sql = `
      SELECT email_onboarding_completed_at
      FROM users_local
      WHERE id = ?
    `;
    const result = this._get<{ email_onboarding_completed_at: string | null }>(sql, [userId]);
    return result?.email_onboarding_completed_at !== null && result?.email_onboarding_completed_at !== undefined;
  }

  // ============================================
  // SESSION OPERATIONS
  // ============================================

  /**
   * Create a new session for a user
   */
  async createSession(userId: string): Promise<string> {
    const id = crypto.randomUUID();
    const sessionToken = crypto.randomUUID();

    // Sessions expire after 24 hours (security hardened)
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + 24 * 60 * 60 * 1000);

    const sql = `
      INSERT INTO sessions (id, user_id, session_token, expires_at)
      VALUES (?, ?, ?, ?)
    `;

    this._run(sql, [id, userId, sessionToken, expiresAt.toISOString()]);
    return sessionToken;
  }

  /**
   * Validate a session token
   */
  async validateSession(sessionToken: string): Promise<Session & User | null> {
    const sql = `
      SELECT s.*, u.*
      FROM sessions s
      JOIN users_local u ON s.user_id = u.id
      WHERE s.session_token = ?
    `;

    const session = this._get<Session & User>(sql, [sessionToken]);

    if (!session) {
      return null;
    }

    // Check if expired
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      await this.deleteSession(sessionToken);
      return null;
    }

    // Update last accessed time
    this._run(
      'UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_token = ?',
      [sessionToken]
    );

    return session;
  }

  /**
   * Delete a session (logout)
   */
  async deleteSession(sessionToken: string): Promise<void> {
    const sql = 'DELETE FROM sessions WHERE session_token = ?';
    this._run(sql, [sessionToken]);
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    const sql = 'DELETE FROM sessions WHERE user_id = ?';
    this._run(sql, [userId]);
  }

  /**
   * Clear all sessions (for session-only OAuth on app startup)
   * This forces all users to re-authenticate each app launch
   */
  async clearAllSessions(): Promise<void> {
    const sql = 'DELETE FROM sessions';
    this._run(sql, []);
    console.log('[DatabaseService] Cleared all sessions for session-only OAuth');
  }

  /**
   * Clear all OAuth tokens (for session-only OAuth on app startup)
   * This forces all users to re-authenticate each app launch
   */
  async clearAllOAuthTokens(): Promise<void> {
    const sql = 'DELETE FROM oauth_tokens';
    this._run(sql, []);
    console.log('[DatabaseService] Cleared all OAuth tokens for session-only OAuth');
  }

  // ============================================
  // CONTACT OPERATIONS
  // ============================================

  /**
   * Create a new contact
   */
  async createContact(contactData: NewContact): Promise<Contact> {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO contacts (
        id, user_id, name, email, phone, company, title, source, is_imported
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      contactData.user_id,
      contactData.name,
      contactData.email || null,
      contactData.phone || null,
      contactData.company || null,
      contactData.title || null,
      contactData.source || 'manual',
      contactData.is_imported !== undefined ? (contactData.is_imported ? 1 : 0) : 1,
    ];

    this._run(sql, params);
    const contact = await this.getContactById(id);
    if (!contact) {
      throw new DatabaseError('Failed to create contact');
    }
    return contact;
  }

  /**
   * Get contact by ID
   */
  async getContactById(contactId: string): Promise<Contact | null> {
    const sql = 'SELECT * FROM contacts WHERE id = ?';
    const contact = this._get<Contact>(sql, [contactId]);
    return contact || null;
  }

  /**
   * Get all contacts for a user
   */
  async getContacts(filters?: ContactFilters): Promise<Contact[]> {
    let sql = 'SELECT * FROM contacts WHERE 1=1';
    const params: any[] = [];

    if (filters?.user_id) {
      sql += ' AND user_id = ?';
      params.push(filters.user_id);
    }

    if (filters?.source) {
      sql += ' AND source = ?';
      params.push(filters.source);
    }

    if (filters?.is_imported !== undefined) {
      sql += ' AND is_imported = ?';
      params.push(filters.is_imported ? 1 : 0);
    }

    sql += ' ORDER BY name ASC';

    return this._all<Contact>(sql, params);
  }

  /**
   * Get only imported contacts for a user
   */
  async getImportedContactsByUserId(userId: string): Promise<Contact[]> {
    const sql = 'SELECT * FROM contacts WHERE user_id = ? AND is_imported = 1 ORDER BY name ASC';
    return this._all<Contact>(sql, [userId]);
  }

  /**
   * Get contacts sorted by recent communication and optionally by property address relevance
   */
  async getContactsSortedByActivity(userId: string, propertyAddress?: string): Promise<ContactWithActivity[]> {
    const sql = `
      SELECT
        c.*,
        MAX(comm.sent_at) as last_communication_at,
        COUNT(comm.id) as communication_count,
        ${propertyAddress ? `
          SUM(CASE
            WHEN comm.subject LIKE ? OR comm.body_plain LIKE ? OR comm.body LIKE ?
            THEN 1 ELSE 0
          END) as address_mention_count
        ` : '0 as address_mention_count'}
      FROM contacts c
      LEFT JOIN communications comm ON (
        c.email IS NOT NULL
        AND (comm.sender = c.email OR comm.recipients LIKE '%' || c.email || '%')
        AND comm.user_id = c.user_id
      )
      WHERE c.user_id = ? AND c.is_imported = 1
      GROUP BY c.id
      ORDER BY
        ${propertyAddress ? 'address_mention_count DESC,' : ''}
        CASE WHEN last_communication_at IS NULL THEN 1 ELSE 0 END,
        last_communication_at DESC,
        c.name ASC
    `;

    const params = propertyAddress
      ? [`%${propertyAddress}%`, `%${propertyAddress}%`, `%${propertyAddress}%`, userId]
      : [userId];

    try {
      return this._all<ContactWithActivity>(sql, params);
    } catch (error) {
      logService.error(
        'Error getting sorted contacts',
        'DatabaseService',
        { error: (error as Error).message, sql, params }
      );
      throw error;
    }
  }

  /**
   * Search contacts by name or email
   */
  async searchContacts(query: string, userId: string): Promise<Contact[]> {
    const sql = `
      SELECT * FROM contacts
      WHERE user_id = ? AND (name LIKE ? OR email LIKE ?)
      ORDER BY name ASC
    `;
    const searchPattern = `%${query}%`;
    return this._all<Contact>(sql, [userId, searchPattern, searchPattern]);
  }

  /**
   * Update contact information
   */
  async updateContact(contactId: string, updates: Partial<Contact>): Promise<void> {
    const allowedFields = ['name', 'email', 'phone', 'company', 'title'];
    const fields: string[] = [];
    const values: any[] = [];

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push((updates as any)[key]);
      }
    });

    if (fields.length === 0) {
      throw new DatabaseError('No valid fields to update');
    }

    values.push(contactId);
    const sql = `UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`;
    this._run(sql, values);
  }

  /**
   * Get all transactions associated with a contact
   */
  async getTransactionsByContact(contactId: string): Promise<TransactionWithRoles[]> {
    const transactionMap = new Map<string, { id: string; property_address: string; closing_date?: string | null; transaction_type?: string | null; status: string; roles: string[] }>();

    // 1. Check direct FK references
    const directQuery = `
      SELECT DISTINCT
        id,
        property_address,
        closing_date,
        transaction_type,
        status,
        CASE
          WHEN buyer_agent_id = ? THEN 'Buyer Agent'
          WHEN seller_agent_id = ? THEN 'Seller Agent'
          WHEN escrow_officer_id = ? THEN 'Escrow Officer'
          WHEN inspector_id = ? THEN 'Inspector'
        END as role
      FROM transactions
      WHERE buyer_agent_id = ?
         OR seller_agent_id = ?
         OR escrow_officer_id = ?
         OR inspector_id = ?
    `;

    const directResults = this._all<{ id: string; property_address: string; closing_date?: string | null; transaction_type?: string | null; status: string; role: string }>(directQuery, [
      contactId, contactId, contactId, contactId,
      contactId, contactId, contactId, contactId
    ]);

    directResults.forEach(txn => {
      if (!transactionMap.has(txn.id)) {
        transactionMap.set(txn.id, {
          id: txn.id,
          property_address: txn.property_address,
          closing_date: txn.closing_date,
          transaction_type: txn.transaction_type,
          status: txn.status,
          roles: [txn.role]
        });
      } else {
        transactionMap.get(txn.id)?.roles.push(txn.role);
      }
    });

    // 2. Check junction table (transaction_contacts)
    const junctionQuery = `
      SELECT DISTINCT
        t.id,
        t.property_address,
        t.closing_date,
        t.transaction_type,
        t.status,
        tc.specific_role,
        tc.role_category
      FROM transaction_contacts tc
      JOIN transactions t ON tc.transaction_id = t.id
      WHERE tc.contact_id = ?
    `;

    const junctionResults = this._all<{ id: string; property_address: string; closing_date?: string | null; transaction_type?: string | null; status: string; specific_role?: string; role_category?: string }>(junctionQuery, [contactId]);

    junctionResults.forEach(txn => {
      const role = txn.specific_role || txn.role_category || 'Associated Contact';
      if (!transactionMap.has(txn.id)) {
        transactionMap.set(txn.id, {
          id: txn.id,
          property_address: txn.property_address,
          closing_date: txn.closing_date,
          transaction_type: txn.transaction_type,
          status: txn.status,
          roles: [role]
        });
      } else {
        transactionMap.get(txn.id)?.roles.push(role);
      }
    });

    // 3. Check JSON array (other_contacts)
    try {
      const jsonQuery = `
        SELECT DISTINCT
          t.id,
          t.property_address,
          t.closing_date,
          t.transaction_type,
          t.status
        FROM transactions t, json_each(t.other_contacts) j
        WHERE j.value = ?
      `;

      const jsonResults = this._all<{ id: string; property_address: string; closing_date?: string | null; transaction_type?: string | null; status: string }>(jsonQuery, [contactId]);

      jsonResults.forEach(txn => {
        if (!transactionMap.has(txn.id)) {
          transactionMap.set(txn.id, {
            id: txn.id,
            property_address: txn.property_address,
            closing_date: txn.closing_date,
            transaction_type: txn.transaction_type,
            status: txn.status,
            roles: ['Other Contact']
          });
        } else {
          transactionMap.get(txn.id)?.roles.push('Other Contact');
        }
      });
    } catch (error) {
      logService.warn(
        'json_each not supported, using LIKE fallback',
        'DatabaseService',
        { error: (error as Error).message }
      );
      // Fallback implementation using LIKE
      const fallbackQuery = `
        SELECT id, property_address, closing_date, transaction_type, status, other_contacts
        FROM transactions
        WHERE other_contacts LIKE ?
      `;

      const fallbackResults = this._all<{ id: string; property_address: string; closing_date?: string | null; transaction_type?: string | null; status: string; other_contacts?: string }>(fallbackQuery, [`%"${contactId}"%`]);

      fallbackResults.forEach(txn => {
        try {
          const contacts = JSON.parse(txn.other_contacts || '[]');
          if (contacts.includes(contactId)) {
            if (!transactionMap.has(txn.id)) {
              transactionMap.set(txn.id, {
                id: txn.id,
                property_address: txn.property_address,
                closing_date: txn.closing_date,
                transaction_type: txn.transaction_type,
                status: txn.status,
                roles: ['Other Contact']
              });
            } else {
              transactionMap.get(txn.id)?.roles.push('Other Contact');
            }
          }
        } catch (parseError) {
          logService.error(
            'Error parsing other_contacts JSON',
            'DatabaseService',
            { error: (parseError as Error).message }
          );
        }
      });
    }

    // Convert map to array and format roles
    return Array.from(transactionMap.values()).map(txn => ({
      ...txn,
      roles: [...new Set(txn.roles)].join(', ')
    }));
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId: string): Promise<void> {
    const sql = 'DELETE FROM contacts WHERE id = ?';
    this._run(sql, [contactId]);
  }

  /**
   * Remove a contact from local database (un-import)
   */
  async removeContact(contactId: string): Promise<void> {
    const sql = 'UPDATE contacts SET is_imported = 0 WHERE id = ?';
    this._run(sql, [contactId]);
  }

  /**
   * Get or create contact from email address
   */
  async getOrCreateContactFromEmail(userId: string, email: string, name?: string): Promise<Contact> {
    // Try to find existing contact
    let contact = this._get<Contact>(
      'SELECT * FROM contacts WHERE user_id = ? AND email = ?',
      [userId, email]
    );

    if (!contact) {
      // Create new contact
      contact = await this.createContact({
        user_id: userId,
        name: name || email.split('@')[0],
        email: email,
        source: 'email',
        is_imported: true,
      });
    }

    return contact;
  }

  // ============================================
  // OAUTH TOKEN OPERATIONS
  // ============================================

  /**
   * Save OAuth token (encrypted)
   */
  async saveOAuthToken(userId: string, provider: OAuthProvider, purpose: OAuthPurpose, tokenData: Partial<OAuthToken>): Promise<string> {
    const id = crypto.randomUUID();

    const sql = `
      INSERT INTO oauth_tokens (
        id, user_id, provider, purpose,
        access_token, refresh_token, token_expires_at, scopes_granted,
        connected_email_address, mailbox_connected, permissions_granted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider, purpose) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        scopes_granted = excluded.scopes_granted,
        connected_email_address = excluded.connected_email_address,
        mailbox_connected = excluded.mailbox_connected,
        permissions_granted_at = excluded.permissions_granted_at,
        is_active = 1,
        token_last_refreshed_at = CURRENT_TIMESTAMP
    `;

    const params = [
      id,
      userId,
      provider,
      purpose,
      tokenData.access_token || null,
      tokenData.refresh_token || null,
      tokenData.token_expires_at || null,
      tokenData.scopes_granted ? JSON.stringify(tokenData.scopes_granted) : null,
      tokenData.connected_email_address || null,
      tokenData.mailbox_connected ? 1 : 0,
      tokenData.permissions_granted_at || new Date().toISOString(),
    ];

    this._run(sql, params);
    return id;
  }

  /**
   * Get OAuth token
   */
  async getOAuthToken(userId: string, provider: OAuthProvider, purpose: OAuthPurpose): Promise<OAuthToken | null> {
    const sql = `
      SELECT * FROM oauth_tokens
      WHERE user_id = ? AND provider = ? AND purpose = ? AND is_active = 1
    `;
    const token = this._get<OAuthToken & { scopes_granted?: string }>(sql, [userId, provider, purpose]);

    if (token && token.scopes_granted && typeof token.scopes_granted === 'string') {
      (token as any).scopes_granted = JSON.parse(token.scopes_granted);
    }

    return token || null;
  }

  /**
   * Update OAuth token
   */
  async updateOAuthToken(tokenId: string, updates: Partial<OAuthToken>): Promise<void> {
    const allowedFields = [
      'access_token',
      'refresh_token',
      'token_expires_at',
      'scopes_granted',
      'connected_email_address',
      'mailbox_connected',
      'token_last_refreshed_at',
      'token_refresh_failed_count',
      'last_sync_at',
      'last_sync_error',
      'is_active',
    ];

    const fields: string[] = [];
    const values: any[] = [];

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        let value = (updates as any)[key];
        if (key === 'scopes_granted' && Array.isArray(value)) {
          value = JSON.stringify(value);
        }
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      throw new DatabaseError('No valid fields to update');
    }

    values.push(tokenId);

    const sql = `UPDATE oauth_tokens SET ${fields.join(', ')} WHERE id = ?`;
    this._run(sql, values);
  }

  /**
   * Delete OAuth token
   */
  async deleteOAuthToken(userId: string, provider: OAuthProvider, purpose: OAuthPurpose): Promise<void> {
    const sql = 'DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ? AND purpose = ?';
    this._run(sql, [userId, provider, purpose]);
  }

  // ============================================
  // TRANSACTION OPERATIONS
  // ============================================

  /**
   * Create a new transaction
   */
  async createTransaction(transactionData: NewTransaction): Promise<Transaction> {
    const id = crypto.randomUUID();

    const sql = `
      INSERT INTO transactions (
        id, user_id, property_address, property_street, property_city,
        property_state, property_zip, property_coordinates,
        transaction_type, transaction_status, closing_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      transactionData.user_id,
      transactionData.property_address,
      transactionData.property_street || null,
      transactionData.property_city || null,
      transactionData.property_state || null,
      transactionData.property_zip || null,
      transactionData.property_coordinates
        ? JSON.stringify(transactionData.property_coordinates)
        : null,
      transactionData.transaction_type || null,
      transactionData.transaction_status || 'completed',
      transactionData.closing_date || null,
    ];

    this._run(sql, params);
    const transaction = await this.getTransactionById(id);
    if (!transaction) {
      throw new DatabaseError('Failed to create transaction');
    }
    return transaction;
  }

  /**
   * Get all transactions for a user
   */
  async getTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params: any[] = [];

    if (filters?.user_id) {
      sql += ' AND user_id = ?';
      params.push(filters.user_id);
    }

    if (filters?.transaction_type) {
      sql += ' AND transaction_type = ?';
      params.push(filters.transaction_type);
    }

    if (filters?.transaction_status) {
      sql += ' AND transaction_status = ?';
      params.push(filters.transaction_status);
    }

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.export_status) {
      sql += ' AND export_status = ?';
      params.push(filters.export_status);
    }

    if (filters?.start_date) {
      sql += ' AND closing_date >= ?';
      params.push(filters.start_date);
    }

    if (filters?.end_date) {
      sql += ' AND closing_date <= ?';
      params.push(filters.end_date);
    }

    if (filters?.property_address) {
      sql += ' AND property_address LIKE ?';
      params.push(`%${filters.property_address}%`);
    }

    sql += ' ORDER BY created_at DESC';

    return this._all<Transaction>(sql, params);
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId: string): Promise<Transaction | null> {
    const sql = 'SELECT * FROM transactions WHERE id = ?';
    const transaction = this._get<Transaction>(sql, [transactionId]);
    return transaction || null;
  }

  /**
   * Get transaction with associated contacts
   */
  async getTransactionWithContacts(transactionId: string): Promise<TransactionWithContacts | null> {
    const transaction = await this.getTransactionById(transactionId);
    if (!transaction) {
      return null;
    }

    const contacts = await this.getTransactionContactsWithRoles(transactionId);

    const result: TransactionWithContacts = {
      ...transaction,
      all_contacts: contacts.map(tc => ({
        id: tc.contact_id,
        user_id: transaction.user_id,
        name: tc.contact_name || '',
        email: tc.contact_email,
        phone: tc.contact_phone,
        company: tc.contact_company,
        title: tc.contact_title,
        source: 'manual' as const,
        is_imported: true,
        created_at: tc.created_at,
        updated_at: tc.updated_at,
      })),
    };

    // Find specific role contacts
    const buyerAgent = contacts.find(c => c.specific_role === 'Buyer Agent');
    const sellerAgent = contacts.find(c => c.specific_role === 'Seller Agent');
    const escrowOfficer = contacts.find(c => c.specific_role === 'Escrow Officer');
    const inspector = contacts.find(c => c.specific_role === 'Inspector');

    if (buyerAgent) {
      result.buyer_agent = {
        id: buyerAgent.contact_id,
        user_id: transaction.user_id,
        name: buyerAgent.contact_name || '',
        email: buyerAgent.contact_email,
        phone: buyerAgent.contact_phone,
        company: buyerAgent.contact_company,
        title: buyerAgent.contact_title,
        source: 'manual' as const,
        is_imported: true,
        created_at: buyerAgent.created_at,
        updated_at: buyerAgent.updated_at,
      };
    }

    if (sellerAgent) {
      result.seller_agent = {
        id: sellerAgent.contact_id,
        user_id: transaction.user_id,
        name: sellerAgent.contact_name || '',
        email: sellerAgent.contact_email,
        phone: sellerAgent.contact_phone,
        company: sellerAgent.contact_company,
        title: sellerAgent.contact_title,
        source: 'manual' as const,
        is_imported: true,
        created_at: sellerAgent.created_at,
        updated_at: sellerAgent.updated_at,
      };
    }

    if (escrowOfficer) {
      result.escrow_officer = {
        id: escrowOfficer.contact_id,
        user_id: transaction.user_id,
        name: escrowOfficer.contact_name || '',
        email: escrowOfficer.contact_email,
        phone: escrowOfficer.contact_phone,
        company: escrowOfficer.contact_company,
        title: escrowOfficer.contact_title,
        source: 'manual' as const,
        is_imported: true,
        created_at: escrowOfficer.created_at,
        updated_at: escrowOfficer.updated_at,
      };
    }

    if (inspector) {
      result.inspector = {
        id: inspector.contact_id,
        user_id: transaction.user_id,
        name: inspector.contact_name || '',
        email: inspector.contact_email,
        phone: inspector.contact_phone,
        company: inspector.contact_company,
        title: inspector.contact_title,
        source: 'manual' as const,
        is_imported: true,
        created_at: inspector.created_at,
        updated_at: inspector.updated_at,
      };
    }

    return result;
  }

  /**
   * Update transaction
   */
  async updateTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void> {
    const allowedFields = [
      'property_address',
      'property_street',
      'property_city',
      'property_state',
      'property_zip',
      'property_coordinates',
      'transaction_type',
      'transaction_status',
      'status',
      'closing_date',
      'representation_start_date',
      'closing_date_verified',
      'representation_start_confidence',
      'closing_date_confidence',
      'buyer_agent_id',
      'seller_agent_id',
      'escrow_officer_id',
      'inspector_id',
      'other_contacts',
      'export_generated_at',
      'export_status',
      'export_format',
      'export_count',
      'last_exported_on',
      'communications_scanned',
      'extraction_confidence',
      'first_communication_date',
      'last_communication_date',
      'total_communications_count',
      'mutual_acceptance_date',
      'earnest_money_amount',
      'earnest_money_delivered_date',
      'listing_price',
      'sale_price',
      'other_parties',
      'offer_count',
      'failed_offers_count',
      'key_dates',
    ];

    const fields: string[] = [];
    const values: any[] = [];

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        let value = (updates as any)[key];
        if (['property_coordinates', 'other_parties', 'key_dates', 'other_contacts'].includes(key) && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      throw new DatabaseError('No valid fields to update');
    }

    values.push(transactionId);

    const sql = `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`;
    this._run(sql, values);
  }

  /**
   * Delete transaction
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    const sql = 'DELETE FROM transactions WHERE id = ?';
    this._run(sql, [transactionId]);
  }

  // ============================================
  // COMMUNICATION OPERATIONS
  // ============================================

  /**
   * Save communication (email) to database
   */
  async createCommunication(communicationData: NewCommunication): Promise<Communication> {
    const id = crypto.randomUUID();

    const sql = `
      INSERT INTO communications (
        id, user_id, transaction_id, communication_type, source,
        email_thread_id, sender, recipients, cc, bcc,
        subject, body, body_plain, sent_at, received_at,
        has_attachments, attachment_count, attachment_metadata,
        keywords_detected, parties_involved, communication_category,
        relevance_score, is_compliance_related
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      communicationData.user_id,
      communicationData.transaction_id || null,
      communicationData.communication_type || 'email',
      communicationData.source || null,
      communicationData.email_thread_id || null,
      communicationData.sender || null,
      communicationData.recipients || null,
      communicationData.cc || null,
      communicationData.bcc || null,
      communicationData.subject || null,
      communicationData.body || null,
      communicationData.body_plain || null,
      communicationData.sent_at || null,
      communicationData.received_at || null,
      communicationData.has_attachments ? 1 : 0,
      communicationData.attachment_count || 0,
      communicationData.attachment_metadata ? JSON.stringify(communicationData.attachment_metadata) : null,
      communicationData.keywords_detected ? JSON.stringify(communicationData.keywords_detected) : null,
      communicationData.parties_involved ? JSON.stringify(communicationData.parties_involved) : null,
      communicationData.communication_category || null,
      communicationData.relevance_score || null,
      communicationData.is_compliance_related ? 1 : 0,
    ];

    this._run(sql, params);
    const communication = await this.getCommunicationById(id);
    if (!communication) {
      throw new DatabaseError('Failed to create communication');
    }
    return communication;
  }

  /**
   * Get communication by ID
   */
  async getCommunicationById(communicationId: string): Promise<Communication | null> {
    const sql = 'SELECT * FROM communications WHERE id = ?';
    const communication = this._get<Communication>(sql, [communicationId]);
    return communication || null;
  }

  /**
   * Get communications with filters
   */
  async getCommunications(filters?: CommunicationFilters): Promise<Communication[]> {
    let sql = 'SELECT * FROM communications WHERE 1=1';
    const params: any[] = [];

    if (filters?.user_id) {
      sql += ' AND user_id = ?';
      params.push(filters.user_id);
    }

    if (filters?.transaction_id) {
      sql += ' AND transaction_id = ?';
      params.push(filters.transaction_id);
    }

    if (filters?.communication_type) {
      sql += ' AND communication_type = ?';
      params.push(filters.communication_type);
    }

    if (filters?.start_date) {
      sql += ' AND sent_at >= ?';
      params.push(filters.start_date);
    }

    if (filters?.end_date) {
      sql += ' AND sent_at <= ?';
      params.push(filters.end_date);
    }

    if (filters?.has_attachments !== undefined) {
      sql += ' AND has_attachments = ?';
      params.push(filters.has_attachments ? 1 : 0);
    }

    sql += ' ORDER BY sent_at DESC';

    return this._all<Communication>(sql, params);
  }

  /**
   * Get communications for a transaction
   */
  async getCommunicationsByTransaction(transactionId: string): Promise<Communication[]> {
    const sql = `
      SELECT * FROM communications
      WHERE transaction_id = ?
      ORDER BY sent_at DESC
    `;
    return this._all<Communication>(sql, [transactionId]);
  }

  /**
   * Update communication
   */
  async updateCommunication(communicationId: string, updates: Partial<Communication>): Promise<void> {
    const allowedFields = [
      'transaction_id',
      'communication_type',
      'source',
      'email_thread_id',
      'sender',
      'recipients',
      'cc',
      'bcc',
      'subject',
      'body',
      'body_plain',
      'sent_at',
      'received_at',
      'has_attachments',
      'attachment_count',
      'attachment_metadata',
      'keywords_detected',
      'parties_involved',
      'communication_category',
      'relevance_score',
      'flagged_for_review',
      'is_compliance_related',
    ];

    const fields: string[] = [];
    const values: any[] = [];

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        let value = (updates as any)[key];
        if (['attachment_metadata', 'keywords_detected', 'parties_involved'].includes(key) && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      throw new DatabaseError('No valid fields to update');
    }

    values.push(communicationId);

    const sql = `UPDATE communications SET ${fields.join(', ')} WHERE id = ?`;
    this._run(sql, values);
  }

  /**
   * Delete communication
   */
  async deleteCommunication(communicationId: string): Promise<void> {
    const sql = 'DELETE FROM communications WHERE id = ?';
    this._run(sql, [communicationId]);
  }

  /**
   * Link communication to transaction
   */
  async linkCommunicationToTransaction(communicationId: string, transactionId: string): Promise<void> {
    const sql = 'UPDATE communications SET transaction_id = ? WHERE id = ?';
    this._run(sql, [transactionId, communicationId]);
  }

  /**
   * Save extracted transaction data (audit trail)
   */
  async saveExtractedData(transactionId: string, fieldName: string, fieldValue: string, sourceCommId?: string, confidence?: number): Promise<string> {
    const id = crypto.randomUUID();

    const sql = `
      INSERT INTO extracted_transaction_data (
        id, transaction_id, field_name, field_value,
        source_communication_id, extraction_method, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    this._run(sql, [
      id,
      transactionId,
      fieldName,
      fieldValue,
      sourceCommId || null,
      'pattern_matching',
      confidence || null,
    ]);

    return id;
  }

  // ============================================
  // TRANSACTION CONTACT OPERATIONS
  // ============================================

  /**
   * Assign contact to transaction with role
   */
  async linkContactToTransaction(transactionId: string, contactId: string, role?: string): Promise<void> {
    const id = crypto.randomUUID();

    const sql = `
      INSERT INTO transaction_contacts (
        id, transaction_id, contact_id, role, role_category, specific_role, is_primary, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      transactionId,
      contactId,
      role || null,
      null,
      role || null,
      0,
      null,
    ];

    this._run(sql, params);
  }

  /**
   * Assign contact to transaction with detailed role data
   */
  async assignContactToTransaction(transactionId: string, data: TransactionContactData): Promise<string> {
    const id = crypto.randomUUID();

    const sql = `
      INSERT INTO transaction_contacts (
        id, transaction_id, contact_id, role, role_category, specific_role, is_primary, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      transactionId,
      data.contact_id,
      data.role || null,
      data.role_category || null,
      data.specific_role || null,
      data.is_primary ? 1 : 0,
      data.notes || null,
    ];

    this._run(sql, params);
    return id;
  }

  /**
   * Get all contacts assigned to a transaction
   */
  async getTransactionContacts(transactionId: string): Promise<Contact[]> {
    const sql = `
      SELECT
        c.*
      FROM transaction_contacts tc
      LEFT JOIN contacts c ON tc.contact_id = c.id
      WHERE tc.transaction_id = ?
      ORDER BY tc.is_primary DESC, tc.created_at ASC
    `;

    return this._all<Contact>(sql, [transactionId]);
  }

  /**
   * Get all contacts assigned to a transaction with role details
   */
  async getTransactionContactsWithRoles(transactionId: string): Promise<TransactionContactResult[]> {
    const sql = `
      SELECT
        tc.*,
        c.name as contact_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.company as contact_company,
        c.title as contact_title
      FROM transaction_contacts tc
      LEFT JOIN contacts c ON tc.contact_id = c.id
      WHERE tc.transaction_id = ?
      ORDER BY tc.is_primary DESC, tc.created_at ASC
    `;

    return this._all<TransactionContactResult>(sql, [transactionId]);
  }

  /**
   * Get all contacts for a specific role in a transaction
   */
  async getTransactionContactsByRole(transactionId: string, role: string): Promise<TransactionContactResult[]> {
    const sql = `
      SELECT
        tc.*,
        c.name as contact_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.company as contact_company,
        c.title as contact_title
      FROM transaction_contacts tc
      LEFT JOIN contacts c ON tc.contact_id = c.id
      WHERE tc.transaction_id = ? AND tc.specific_role = ?
      ORDER BY tc.is_primary DESC
    `;

    return this._all<TransactionContactResult>(sql, [transactionId, role]);
  }

  /**
   * Update contact role information
   */
  async updateContactRole(transactionId: string, contactId: string, updates: Partial<TransactionContactData>): Promise<void> {
    const allowedFields = ['role', 'role_category', 'specific_role', 'is_primary', 'notes'];
    const fields: string[] = [];
    const values: any[] = [];

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push((updates as any)[key]);
      }
    });

    if (fields.length === 0) {
      throw new DatabaseError('No valid fields to update');
    }

    values.push(transactionId, contactId);

    const sql = `
      UPDATE transaction_contacts
      SET ${fields.join(', ')}
      WHERE transaction_id = ? AND contact_id = ?
    `;

    this._run(sql, values);
  }

  /**
   * Remove contact from transaction
   */
  async unlinkContactFromTransaction(transactionId: string, contactId: string): Promise<void> {
    const sql = 'DELETE FROM transaction_contacts WHERE transaction_id = ? AND contact_id = ?';
    this._run(sql, [transactionId, contactId]);
  }

  /**
   * Check if contact is assigned to transaction
   */
  async isContactAssignedToTransaction(transactionId: string, contactId: string): Promise<boolean> {
    const sql = 'SELECT id FROM transaction_contacts WHERE transaction_id = ? AND contact_id = ? LIMIT 1';
    const result = this._get(sql, [transactionId, contactId]);
    return !!result;
  }

  // ============================================
  // USER FEEDBACK OPERATIONS
  // ============================================

  /**
   * Submit user feedback on extracted data
   */
  async saveFeedback(feedbackData: Omit<UserFeedback, 'id' | 'created_at'>): Promise<UserFeedback> {
    const id = crypto.randomUUID();

    const sql = `
      INSERT INTO user_feedback (
        id, user_id, transaction_id, communication_id, feedback_type,
        field_name, original_value, corrected_value, feedback_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      feedbackData.user_id,
      feedbackData.transaction_id || null,
      feedbackData.communication_id || null,
      feedbackData.feedback_type,
      feedbackData.field_name || null,
      feedbackData.original_value || null,
      feedbackData.corrected_value || null,
      feedbackData.feedback_text || null,
    ];

    this._run(sql, params);

    const feedback = this._get<UserFeedback>('SELECT * FROM user_feedback WHERE id = ?', [id]);
    if (!feedback) {
      throw new DatabaseError('Failed to save feedback');
    }

    return feedback;
  }

  /**
   * Get all feedback for a transaction
   */
  async getFeedbackByTransaction(transactionId: string): Promise<UserFeedback[]> {
    const sql = `
      SELECT * FROM user_feedback
      WHERE transaction_id = ?
      ORDER BY created_at DESC
    `;

    return this._all<UserFeedback>(sql, [transactionId]);
  }

  /**
   * Get feedback by field name
   */
  async getFeedbackByField(userId: string, fieldName: string, limit: number = 100): Promise<UserFeedback[]> {
    const sql = `
      SELECT * FROM user_feedback
      WHERE user_id = ? AND field_name = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    return this._all<UserFeedback>(sql, [userId, fieldName, limit]);
  }

  // ============================================
  // AUDIT LOG OPERATIONS
  // ============================================

  /**
   * Insert an audit log entry (append-only)
   * Note: The audit_logs table has triggers that prevent UPDATE and DELETE
   */
  async insertAuditLog(entry: AuditLogEntry): Promise<void> {
    const sql = `
      INSERT INTO audit_logs (
        id, timestamp, user_id, session_id, action, resource_type,
        resource_id, metadata, ip_address, user_agent, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      entry.id,
      entry.timestamp.toISOString(),
      entry.userId,
      entry.sessionId || null,
      entry.action,
      entry.resourceType,
      entry.resourceId || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.ipAddress || null,
      entry.userAgent || null,
      entry.success ? 1 : 0,
      entry.errorMessage || null,
    ];

    await this._run(sql, params);
  }

  /**
   * Get audit logs that haven't been synced to cloud
   */
  async getUnsyncedAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    const sql = `
      SELECT * FROM audit_logs
      WHERE synced_at IS NULL
      ORDER BY timestamp ASC
      LIMIT ?
    `;

    const rows = await this._all<AuditLogDbRow>(sql, [limit]);
    return rows.map(this._mapAuditLogRowToEntry);
  }

  /**
   * Mark audit logs as synced (only updates synced_at field)
   * This is the ONLY allowed update to audit_logs - we need a special approach
   * because the table has triggers preventing normal updates
   */
  async markAuditLogsSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    // We need to temporarily disable the trigger for this specific update
    // This is safe because we're only updating the synced_at timestamp
    const db = this._ensureDb();
    const syncedAt = new Date().toISOString();

    try {
      // Disable the update trigger temporarily
      db.exec('DROP TRIGGER IF EXISTS prevent_audit_update');

      // Update synced_at for the specified IDs
      const placeholders = ids.map(() => '?').join(',');
      const sql = `UPDATE audit_logs SET synced_at = ? WHERE id IN (${placeholders})`;
      db.prepare(sql).run(syncedAt, ...ids);

      // Recreate the trigger
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS prevent_audit_update
        BEFORE UPDATE ON audit_logs
        WHEN NEW.synced_at IS NULL OR OLD.synced_at IS NOT NULL
        BEGIN
          SELECT RAISE(ABORT, 'Audit logs cannot be modified');
        END
      `);
    } catch (error) {
      // Ensure trigger is recreated even on error
      try {
        db.exec(`
          CREATE TRIGGER IF NOT EXISTS prevent_audit_update
          BEFORE UPDATE ON audit_logs
          WHEN NEW.synced_at IS NULL OR OLD.synced_at IS NOT NULL
          BEGIN
            SELECT RAISE(ABORT, 'Audit logs cannot be modified');
          END
        `);
      } catch {
        // Ignore trigger recreation errors
      }
      throw error;
    }
  }

  /**
   * Get audit logs for a user with optional filters
   */
  async getAuditLogs(filters: {
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: (string | number)[] = [];

    if (filters.userId) {
      sql += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.action) {
      sql += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.resourceType) {
      sql += ' AND resource_type = ?';
      params.push(filters.resourceType);
    }

    if (filters.startDate) {
      sql += ' AND timestamp >= ?';
      params.push(filters.startDate.toISOString());
    }

    if (filters.endDate) {
      sql += ' AND timestamp <= ?';
      params.push(filters.endDate.toISOString());
    }

    sql += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    const rows = await this._all<AuditLogDbRow>(sql, params);
    return rows.map(this._mapAuditLogRowToEntry);
  }

  /**
   * Map database row to AuditLogEntry
   */
  private _mapAuditLogRowToEntry(row: AuditLogDbRow): AuditLogEntry {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      userId: row.user_id,
      sessionId: row.session_id || undefined,
      action: row.action as AuditLogEntry['action'],
      resourceType: row.resource_type as AuditLogEntry['resourceType'],
      resourceId: row.resource_id || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
      success: row.success === 1,
      errorMessage: row.error_message || undefined,
      syncedAt: row.synced_at ? new Date(row.synced_at) : undefined,
    };
  }

  // ============================================
  // UTILITY OPERATIONS
  // ============================================

  /**
   * Vacuum the database to reclaim space
   */
  async vacuum(): Promise<void> {
    this._run('VACUUM');
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      await logService.info('Database connection closed', 'DatabaseService');
    }
    this.db = null;
    this.encryptionKey = null;
  }

  /**
   * Re-key the database with a new encryption key (for key rotation)
   * @param newKey - The new encryption key to use
   */
  async rekeyDatabase(newKey: string): Promise<void> {
    const db = this._ensureDb();

    try {
      // Use SQLCipher's rekey pragma to change the encryption key
      db.pragma(`rekey = "x'${newKey}'"`);
      this.encryptionKey = newKey;
      await logService.info('Database re-keyed successfully', 'DatabaseService');
    } catch (error) {
      await logService.error(
        'Failed to re-key database',
        'DatabaseService',
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  /**
   * Create a suggested transaction
   */
  async createSuggestedTransaction(data: any): Promise<any> {
    const id = crypto.randomUUID();

    const sql = `
      INSERT INTO suggested_transactions (
        id, user_id, property_address, property_street, property_city,
        property_state, property_zip, transaction_type, closing_date,
        first_communication_date, last_communication_date, communications_count,
        extraction_confidence, sale_price, listing_price, earnest_money_amount,
        other_parties, detected_contacts, source_communication_ids, status,
        reviewed_by_user, user_edits
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      data.user_id,
      data.property_address || null,
      data.property_street || null,
      data.property_city || null,
      data.property_state || null,
      data.property_zip || null,
      data.transaction_type || null,
      data.closing_date || null,
      data.first_communication_date || null,
      data.last_communication_date || null,
      data.communications_count || 1,
      data.extraction_confidence || null,
      data.sale_price || null,
      data.listing_price || null,
      data.earnest_money_amount || null,
      data.other_parties ? JSON.stringify(data.other_parties) : null,
      data.detected_contacts ? JSON.stringify(data.detected_contacts) : null,
      data.source_communication_ids ? JSON.stringify(data.source_communication_ids) : null,
      data.status || 'pending',
      data.reviewed_by_user ? 1 : 0,
      data.user_edits ? JSON.stringify(data.user_edits) : null,
    ];

    this._run(sql, params);
    return this.getSuggestedTransactionById(id);
  }

  /**
   * Get suggested transaction by ID
   */
  async getSuggestedTransactionById(id: string): Promise<any> {
    const sql = 'SELECT * FROM suggested_transactions WHERE id = ?';
    const result = this._get(sql, [id]);

    if (!result) return null;

    return this._parseSuggestedTransaction(result);
  }

  /**
   * Get all suggested transactions for a user
   */
  async getSuggestedTransactions(userId: string, status?: string): Promise<any[]> {
    let sql = 'SELECT * FROM suggested_transactions WHERE user_id = ?';
    const params: any[] = [userId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const results = this._all(sql, params);
    return results.map((r: any) => this._parseSuggestedTransaction(r));
  }

  /**
   * Update suggested transaction
   */
  async updateSuggestedTransaction(id: string, updates: any): Promise<any> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.property_address !== undefined) {
      fields.push('property_address = ?');
      params.push(updates.property_address);
    }
    if (updates.property_street !== undefined) {
      fields.push('property_street = ?');
      params.push(updates.property_street);
    }
    if (updates.property_city !== undefined) {
      fields.push('property_city = ?');
      params.push(updates.property_city);
    }
    if (updates.property_state !== undefined) {
      fields.push('property_state = ?');
      params.push(updates.property_state);
    }
    if (updates.property_zip !== undefined) {
      fields.push('property_zip = ?');
      params.push(updates.property_zip);
    }
    if (updates.transaction_type !== undefined) {
      fields.push('transaction_type = ?');
      params.push(updates.transaction_type);
    }
    if (updates.closing_date !== undefined) {
      fields.push('closing_date = ?');
      params.push(updates.closing_date);
    }
    if (updates.sale_price !== undefined) {
      fields.push('sale_price = ?');
      params.push(updates.sale_price);
    }
    if (updates.listing_price !== undefined) {
      fields.push('listing_price = ?');
      params.push(updates.listing_price);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.reviewed_by_user !== undefined) {
      fields.push('reviewed_by_user = ?');
      params.push(updates.reviewed_by_user ? 1 : 0);
    }
    if (updates.user_edits !== undefined) {
      fields.push('user_edits = ?');
      params.push(JSON.stringify(updates.user_edits));
    }
    if (updates.reviewed_at !== undefined) {
      fields.push('reviewed_at = ?');
      params.push(updates.reviewed_at);
    }

    if (fields.length === 0) return this.getSuggestedTransactionById(id);

    params.push(id);
    const sql = `UPDATE suggested_transactions SET ${fields.join(', ')} WHERE id = ?`;
    this._run(sql, params);

    return this.getSuggestedTransactionById(id);
  }

  /**
   * Approve a suggested transaction (convert to confirmed)
   */
  async approveSuggestedTransaction(suggestedId: string, transactionData: NewTransaction): Promise<Transaction> {
    // Create the confirmed transaction
    const transaction = await this.createTransaction(transactionData);

    // Mark suggested transaction as approved
    await this.updateSuggestedTransaction(suggestedId, {
      status: 'approved',
      reviewed_by_user: true,
      reviewed_at: new Date().toISOString(),
    });

    return transaction;
  }

  /**
   * Reject a suggested transaction
   */
  async rejectSuggestedTransaction(id: string, reason?: string): Promise<void> {
    const updates: any = {
      status: 'rejected',
      reviewed_by_user: true,
      reviewed_at: new Date().toISOString(),
    };

    if (reason) {
      updates.user_edits = { rejection_reason: reason };
    }

    await this.updateSuggestedTransaction(id, updates);
  }

  /**
   * Parse suggested transaction from database row
   */
  private _parseSuggestedTransaction(row: any): any {
    return {
      ...row,
      other_parties: row.other_parties ? JSON.parse(row.other_parties) : undefined,
      detected_contacts: row.detected_contacts ? JSON.parse(row.detected_contacts) : undefined,
      source_communication_ids: row.source_communication_ids ? JSON.parse(row.source_communication_ids) : [],
      user_edits: row.user_edits ? JSON.parse(row.user_edits) : undefined,
      reviewed_by_user: row.reviewed_by_user === 1,
    };
  }

  /**
   * Get database encryption status
   * @returns Object containing encryption status information
   */
  async getEncryptionStatus(): Promise<{
    isEncrypted: boolean;
    keyMetadata: { keyId: string; createdAt: string; version: number } | null;
  }> {
    const keyMetadata = await databaseEncryptionService.getKeyMetadata();
    const isEncrypted = this.dbPath
      ? await databaseEncryptionService.isDatabaseEncrypted(this.dbPath)
      : false;

    return {
      isEncrypted,
      keyMetadata,
    };
  }
}

// Export singleton instance
export default new DatabaseService();
