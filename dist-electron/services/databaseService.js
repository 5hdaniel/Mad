"use strict";
/**
 * Database Service
 * Manages local SQLite database operations for Mad application
 * Handles user data, transactions, communications, and sessions
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const electron_1 = require("electron");
const types_1 = require("../types");
class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = null;
    }
    /**
     * Initialize database - creates DB file and tables if needed
     */
    async initialize() {
        try {
            // Get user data path
            const userDataPath = electron_1.app.getPath('userData');
            this.dbPath = path_1.default.join(userDataPath, 'mad.db');
            console.log('[DatabaseService] Initializing database at:', this.dbPath);
            // Ensure directory exists
            const dbDir = path_1.default.dirname(this.dbPath);
            if (!fs_1.default.existsSync(dbDir)) {
                fs_1.default.mkdirSync(dbDir, { recursive: true });
            }
            // Open database connection
            this.db = await this._openDatabase();
            // Run schema migrations
            await this.runMigrations();
            console.log('[DatabaseService] Database initialized successfully');
            return true;
        }
        catch (error) {
            console.error('[DatabaseService] Failed to initialize database:', error);
            throw error;
        }
    }
    /**
     * Open database connection
     */
    _openDatabase() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3_1.default.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    // Enable foreign keys
                    db.run('PRAGMA foreign_keys = ON;', (err) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve(db);
                        }
                    });
                }
            });
        });
    }
    /**
     * Run database migrations (execute schema.sql)
     */
    async runMigrations() {
        const schemaPath = path_1.default.join(__dirname, '../database/schema.sql');
        const schemaSql = fs_1.default.readFileSync(schemaPath, 'utf8');
        return new Promise((resolve, reject) => {
            this.db.exec(schemaSql, async (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    // Run additional migrations for existing databases
                    try {
                        await this._runAdditionalMigrations();
                        resolve();
                    }
                    catch (migrationErr) {
                        reject(migrationErr);
                    }
                }
            });
        });
    }
    /**
     * Run additional migrations for schema changes
     */
    async _runAdditionalMigrations() {
        console.log('[DatabaseService] 🔄 Starting database migrations...');
        try {
            // Migration 1: Add legal compliance columns to users_local
            console.log('[DatabaseService] Running Migration 1: User compliance columns');
            const userColumns = await this._all(`PRAGMA table_info(users_local)`);
            if (!userColumns.some(col => col.name === 'terms_accepted_at')) {
                console.log('[DatabaseService] Adding terms_accepted_at column to users_local');
                await this._run(`ALTER TABLE users_local ADD COLUMN terms_accepted_at DATETIME`);
            }
            if (!userColumns.some(col => col.name === 'terms_version_accepted')) {
                console.log('[DatabaseService] Adding terms_version_accepted column to users_local');
                await this._run(`ALTER TABLE users_local ADD COLUMN terms_version_accepted TEXT`);
            }
            if (!userColumns.some(col => col.name === 'privacy_policy_accepted_at')) {
                console.log('[DatabaseService] Adding privacy_policy_accepted_at column to users_local');
                await this._run(`ALTER TABLE users_local ADD COLUMN privacy_policy_accepted_at DATETIME`);
            }
            if (!userColumns.some(col => col.name === 'privacy_policy_version_accepted')) {
                console.log('[DatabaseService] Adding privacy_policy_version_accepted column to users_local');
                await this._run(`ALTER TABLE users_local ADD COLUMN privacy_policy_version_accepted TEXT`);
            }
            // Migration 2: Add new transaction columns
            console.log('[DatabaseService] Running Migration 2: Transaction columns');
            const transactionColumns = await this._all(`PRAGMA table_info(transactions)`);
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
                    console.log(`[DatabaseService] Adding ${migration.name} column to transactions`);
                    await this._run(migration.sql);
                }
            }
            // Create trigger for transactions timestamp (after ensuring updated_at column exists)
            await this._run(`
        CREATE TRIGGER IF NOT EXISTS update_transactions_timestamp
        AFTER UPDATE ON transactions
        BEGIN
          UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `);
            // Create index for status column (added by migration)
            await this._run(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`);
            // Migration 3: Enhanced contact roles for transaction_contacts
            console.log('[DatabaseService] Running Migration 3: Transaction contacts enhanced roles');
            const tcColumns = await this._all(`PRAGMA table_info(transaction_contacts)`);
            console.log('[DatabaseService] Current transaction_contacts columns:', tcColumns.map(c => c.name).join(', '));
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
                    console.log(`[DatabaseService] Adding ${migration.name} column to transaction_contacts`);
                    try {
                        await this._run(migration.sql);
                        console.log(`[DatabaseService] Successfully added ${migration.name} column`);
                    }
                    catch (err) {
                        console.error(`[DatabaseService] Failed to add ${migration.name} column:`, err.message);
                        throw err;
                    }
                }
            }
            // Create index for better performance
            await this._run(`CREATE INDEX IF NOT EXISTS idx_transaction_contacts_specific_role ON transaction_contacts(specific_role)`);
            await this._run(`CREATE INDEX IF NOT EXISTS idx_transaction_contacts_category ON transaction_contacts(role_category)`);
            await this._run(`CREATE INDEX IF NOT EXISTS idx_transaction_contacts_primary ON transaction_contacts(is_primary)`);
            // Create trigger for transaction_contacts timestamp updates
            await this._run(`
        CREATE TRIGGER IF NOT EXISTS update_transaction_contacts_timestamp
        AFTER UPDATE ON transaction_contacts
        BEGIN
          UPDATE transaction_contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `);
            // Verify all columns were added successfully
            const verifyTcColumns = await this._all(`PRAGMA table_info(transaction_contacts)`);
            const columnNames = verifyTcColumns.map(c => c.name);
            console.log('[DatabaseService] ✅ Migration 3 complete. Final transaction_contacts columns:', columnNames.join(', '));
            const requiredColumns = ['role_category', 'specific_role', 'is_primary', 'notes', 'updated_at'];
            const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
            if (missingColumns.length > 0) {
                console.error('[DatabaseService] ❌ ERROR: Missing required columns:', missingColumns.join(', '));
            }
            else {
                console.log('[DatabaseService] ✅ All required columns present');
            }
            // Migration 4: Add export tracking columns to transactions
            const exportStatusExists = transactionColumns.some(col => col.name === 'export_status');
            if (!exportStatusExists) {
                console.log('[DatabaseService] Adding export tracking columns to transactions');
                await this._run(`ALTER TABLE transactions ADD COLUMN export_status TEXT DEFAULT 'not_exported' CHECK (export_status IN ('not_exported', 'exported', 're_export_needed'))`);
                await this._run(`ALTER TABLE transactions ADD COLUMN export_format TEXT CHECK (export_format IN ('pdf', 'csv', 'json', 'txt_eml', 'excel'))`);
                await this._run(`ALTER TABLE transactions ADD COLUMN export_count INTEGER DEFAULT 0`);
                await this._run(`ALTER TABLE transactions ADD COLUMN last_exported_on DATETIME`);
                // Create indexes for better query performance
                await this._run(`CREATE INDEX IF NOT EXISTS idx_transactions_export_status ON transactions(export_status)`);
                await this._run(`CREATE INDEX IF NOT EXISTS idx_transactions_last_exported_on ON transactions(last_exported_on)`);
            }
            // Migration 5: User feedback and extraction metrics
            const feedbackTableExists = await this._get(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_feedback'`);
            if (!feedbackTableExists) {
                console.log('[DatabaseService] Creating user feedback tables');
                // User feedback table
                await this._run(`
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
                await this._run(`
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
                await this._run(`CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id)`);
                await this._run(`CREATE INDEX idx_user_feedback_transaction_id ON user_feedback(transaction_id)`);
                await this._run(`CREATE INDEX idx_user_feedback_field_name ON user_feedback(field_name)`);
                await this._run(`CREATE INDEX idx_user_feedback_type ON user_feedback(feedback_type)`);
                await this._run(`CREATE INDEX idx_extraction_metrics_user_id ON extraction_metrics(user_id)`);
                await this._run(`CREATE INDEX idx_extraction_metrics_field ON extraction_metrics(field_name)`);
                // Trigger
                await this._run(`
          CREATE TRIGGER update_extraction_metrics_timestamp
          AFTER UPDATE ON extraction_metrics
          BEGIN
            UPDATE extraction_metrics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END;
        `);
            }
            // Migration 6: Contact import tracking
            const contactColumns = await this._all(`PRAGMA table_info(contacts)`);
            if (!contactColumns.some(col => col.name === 'is_imported')) {
                console.log('[DatabaseService] Adding is_imported column to contacts');
                await this._run(`ALTER TABLE contacts ADD COLUMN is_imported INTEGER DEFAULT 1`);
                console.log('[DatabaseService] Successfully added is_imported column');
                // Mark all existing manual and email contacts as imported
                await this._run(`UPDATE contacts SET is_imported = 1 WHERE source IN ('manual', 'email')`);
                console.log('[DatabaseService] Marked existing contacts as imported');
                // Create index for better performance
                await this._run(`CREATE INDEX IF NOT EXISTS idx_contacts_is_imported ON contacts(is_imported)`);
                await this._run(`CREATE INDEX IF NOT EXISTS idx_contacts_user_imported ON contacts(user_id, is_imported)`);
                console.log('[DatabaseService] Created indexes for is_imported');
            }
            else {
                console.log('[DatabaseService] is_imported column already exists');
            }
            console.log('[DatabaseService] ✅ All database migrations completed successfully');
        }
        catch (error) {
            // Log full error details for debugging
            console.error('[DatabaseService] Migration failed:', error);
            console.error('[DatabaseService] Error stack:', error.stack);
        }
    }
    /**
     * Helper: Run a query that returns a single row
     */
    _get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
    }
    /**
     * Helper: Run a query that returns multiple rows
     */
    _all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    }
    /**
     * Helper: Run a query that modifies data (INSERT, UPDATE, DELETE)
     */
    _run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({ lastInsertRowid: this.lastID, changes: this.changes });
                }
            });
        });
    }
    // ============================================
    // USER OPERATIONS
    // ============================================
    /**
     * Create a new user
     */
    async createUser(userData) {
        const id = crypto_1.default.randomUUID();
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
        await this._run(sql, params);
        const user = await this.getUserById(id);
        if (!user) {
            throw new types_1.DatabaseError('Failed to create user');
        }
        return user;
    }
    /**
     * Get user by ID
     */
    async getUserById(userId) {
        const sql = 'SELECT * FROM users_local WHERE id = ?';
        const user = await this._get(sql, [userId]);
        return user || null;
    }
    /**
     * Get user by email
     */
    async getUserByEmail(email) {
        const sql = 'SELECT * FROM users_local WHERE email = ?';
        const user = await this._get(sql, [email]);
        return user || null;
    }
    /**
     * Get user by OAuth provider and ID
     */
    async getUserByOAuthId(provider, oauthId) {
        const sql = 'SELECT * FROM users_local WHERE oauth_provider = ? AND oauth_id = ?';
        const user = await this._get(sql, [provider, oauthId]);
        return user || null;
    }
    /**
     * Update user data
     */
    async updateUser(userId, updates) {
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
        ];
        const fields = [];
        const values = [];
        Object.keys(updates).forEach((key) => {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(updates[key]);
            }
        });
        if (fields.length === 0) {
            throw new types_1.DatabaseError('No valid fields to update');
        }
        values.push(userId);
        const sql = `UPDATE users_local SET ${fields.join(', ')} WHERE id = ?`;
        await this._run(sql, values);
    }
    /**
     * Delete user
     */
    async deleteUser(userId) {
        const sql = 'DELETE FROM users_local WHERE id = ?';
        await this._run(sql, [userId]);
    }
    /**
     * Update last login timestamp and increment login count
     */
    async updateLastLogin(userId) {
        const sql = `
      UPDATE users_local
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
        await this._run(sql, [userId]);
    }
    /**
     * Accept terms and conditions for a user
     */
    async acceptTerms(userId, termsVersion, privacyVersion) {
        const sql = `
      UPDATE users_local
      SET terms_accepted_at = CURRENT_TIMESTAMP,
          terms_version_accepted = ?,
          privacy_policy_accepted_at = CURRENT_TIMESTAMP,
          privacy_policy_version_accepted = ?
      WHERE id = ?
    `;
        await this._run(sql, [termsVersion, privacyVersion, userId]);
        const user = await this.getUserById(userId);
        if (!user) {
            throw new types_1.NotFoundError('User not found after accepting terms', 'User', userId);
        }
        return user;
    }
    // ============================================
    // SESSION OPERATIONS
    // ============================================
    /**
     * Create a new session for a user
     */
    async createSession(userId) {
        const id = crypto_1.default.randomUUID();
        const sessionToken = crypto_1.default.randomUUID();
        // Sessions expire after 7 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        const sql = `
      INSERT INTO sessions (id, user_id, session_token, expires_at)
      VALUES (?, ?, ?, ?)
    `;
        await this._run(sql, [id, userId, sessionToken, expiresAt.toISOString()]);
        return sessionToken;
    }
    /**
     * Validate a session token
     */
    async validateSession(sessionToken) {
        const sql = `
      SELECT s.*, u.*
      FROM sessions s
      JOIN users_local u ON s.user_id = u.id
      WHERE s.session_token = ?
    `;
        const session = await this._get(sql, [sessionToken]);
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
        await this._run('UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_token = ?', [sessionToken]);
        return session;
    }
    /**
     * Delete a session (logout)
     */
    async deleteSession(sessionToken) {
        const sql = 'DELETE FROM sessions WHERE session_token = ?';
        await this._run(sql, [sessionToken]);
    }
    /**
     * Delete all sessions for a user
     */
    async deleteAllUserSessions(userId) {
        const sql = 'DELETE FROM sessions WHERE user_id = ?';
        await this._run(sql, [userId]);
    }
    // ============================================
    // CONTACT OPERATIONS
    // ============================================
    /**
     * Create a new contact
     */
    async createContact(contactData) {
        const id = crypto_1.default.randomUUID();
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
        await this._run(sql, params);
        const contact = await this.getContactById(id);
        if (!contact) {
            throw new types_1.DatabaseError('Failed to create contact');
        }
        return contact;
    }
    /**
     * Get contact by ID
     */
    async getContactById(contactId) {
        const sql = 'SELECT * FROM contacts WHERE id = ?';
        const contact = await this._get(sql, [contactId]);
        return contact || null;
    }
    /**
     * Get all contacts for a user
     */
    async getContacts(filters) {
        let sql = 'SELECT * FROM contacts WHERE 1=1';
        const params = [];
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
        return await this._all(sql, params);
    }
    /**
     * Get only imported contacts for a user
     */
    async getImportedContactsByUserId(userId) {
        const sql = 'SELECT * FROM contacts WHERE user_id = ? AND is_imported = 1 ORDER BY name ASC';
        return await this._all(sql, [userId]);
    }
    /**
     * Get contacts sorted by recent communication and optionally by property address relevance
     */
    async getContactsSortedByActivity(userId, propertyAddress) {
        let sql = `
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
            return await this._all(sql, params);
        }
        catch (error) {
            console.error('[DatabaseService] Error getting sorted contacts:', error);
            console.error('[DatabaseService] SQL:', sql);
            console.error('[DatabaseService] Params:', params);
            throw error;
        }
    }
    /**
     * Search contacts by name or email
     */
    async searchContacts(query, userId) {
        const sql = `
      SELECT * FROM contacts
      WHERE user_id = ? AND (name LIKE ? OR email LIKE ?)
      ORDER BY name ASC
    `;
        const searchPattern = `%${query}%`;
        return await this._all(sql, [userId, searchPattern, searchPattern]);
    }
    /**
     * Update contact information
     */
    async updateContact(contactId, updates) {
        const allowedFields = ['name', 'email', 'phone', 'company', 'title'];
        const fields = [];
        const values = [];
        Object.keys(updates).forEach((key) => {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(updates[key]);
            }
        });
        if (fields.length === 0) {
            throw new types_1.DatabaseError('No valid fields to update');
        }
        values.push(contactId);
        const sql = `UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`;
        await this._run(sql, values);
    }
    /**
     * Get all transactions associated with a contact
     */
    async getTransactionsByContact(contactId) {
        const transactions = [];
        const transactionMap = new Map();
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
        const directResults = await this._all(directQuery, [
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
            }
            else {
                transactionMap.get(txn.id).roles.push(txn.role);
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
        const junctionResults = await this._all(junctionQuery, [contactId]);
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
            }
            else {
                transactionMap.get(txn.id).roles.push(role);
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
            const jsonResults = await this._all(jsonQuery, [contactId]);
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
                }
                else {
                    transactionMap.get(txn.id).roles.push('Other Contact');
                }
            });
        }
        catch (error) {
            console.warn('[DatabaseService] json_each not supported, using LIKE fallback:', error.message);
            // Fallback implementation using LIKE
            const fallbackQuery = `
        SELECT id, property_address, closing_date, transaction_type, status, other_contacts
        FROM transactions
        WHERE other_contacts LIKE ?
      `;
            const fallbackResults = await this._all(fallbackQuery, [`%"${contactId}"%`]);
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
                        }
                        else {
                            transactionMap.get(txn.id).roles.push('Other Contact');
                        }
                    }
                }
                catch (parseError) {
                    console.error('[DatabaseService] Error parsing other_contacts JSON:', parseError);
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
    async deleteContact(contactId) {
        const sql = 'DELETE FROM contacts WHERE id = ?';
        await this._run(sql, [contactId]);
    }
    /**
     * Remove a contact from local database (un-import)
     */
    async removeContact(contactId) {
        const sql = 'UPDATE contacts SET is_imported = 0 WHERE id = ?';
        await this._run(sql, [contactId]);
    }
    /**
     * Get or create contact from email address
     */
    async getOrCreateContactFromEmail(userId, email, name) {
        // Try to find existing contact
        let contact = await this._get('SELECT * FROM contacts WHERE user_id = ? AND email = ?', [userId, email]);
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
    async saveOAuthToken(userId, provider, purpose, tokenData) {
        const id = crypto_1.default.randomUUID();
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
        await this._run(sql, params);
        return id;
    }
    /**
     * Get OAuth token
     */
    async getOAuthToken(userId, provider, purpose) {
        const sql = `
      SELECT * FROM oauth_tokens
      WHERE user_id = ? AND provider = ? AND purpose = ? AND is_active = 1
    `;
        const token = await this._get(sql, [userId, provider, purpose]);
        if (token && token.scopes_granted && typeof token.scopes_granted === 'string') {
            token.scopes_granted = JSON.parse(token.scopes_granted);
        }
        return token || null;
    }
    /**
     * Update OAuth token
     */
    async updateOAuthToken(tokenId, updates) {
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
        const fields = [];
        const values = [];
        Object.keys(updates).forEach((key) => {
            if (allowedFields.includes(key)) {
                let value = updates[key];
                if (key === 'scopes_granted' && Array.isArray(value)) {
                    value = JSON.stringify(value);
                }
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });
        if (fields.length === 0) {
            throw new types_1.DatabaseError('No valid fields to update');
        }
        values.push(tokenId);
        const sql = `UPDATE oauth_tokens SET ${fields.join(', ')} WHERE id = ?`;
        await this._run(sql, values);
    }
    /**
     * Delete OAuth token
     */
    async deleteOAuthToken(userId, provider, purpose) {
        const sql = 'DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ? AND purpose = ?';
        await this._run(sql, [userId, provider, purpose]);
    }
    // ============================================
    // TRANSACTION OPERATIONS
    // ============================================
    /**
     * Create a new transaction
     */
    async createTransaction(transactionData) {
        const id = crypto_1.default.randomUUID();
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
        await this._run(sql, params);
        const transaction = await this.getTransactionById(id);
        if (!transaction) {
            throw new types_1.DatabaseError('Failed to create transaction');
        }
        return transaction;
    }
    /**
     * Get all transactions for a user
     */
    async getTransactions(filters) {
        let sql = 'SELECT * FROM transactions WHERE 1=1';
        const params = [];
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
        return await this._all(sql, params);
    }
    /**
     * Get transaction by ID
     */
    async getTransactionById(transactionId) {
        const sql = 'SELECT * FROM transactions WHERE id = ?';
        const transaction = await this._get(sql, [transactionId]);
        return transaction || null;
    }
    /**
     * Get transaction with associated contacts
     */
    async getTransactionWithContacts(transactionId) {
        const transaction = await this.getTransactionById(transactionId);
        if (!transaction) {
            return null;
        }
        const contacts = await this.getTransactionContactsWithRoles(transactionId);
        const result = {
            ...transaction,
            all_contacts: contacts.map(tc => ({
                id: tc.contact_id,
                user_id: transaction.user_id,
                name: tc.contact_name || '',
                email: tc.contact_email,
                phone: tc.contact_phone,
                company: tc.contact_company,
                title: tc.contact_title,
                source: 'manual',
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
                source: 'manual',
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
                source: 'manual',
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
                source: 'manual',
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
                source: 'manual',
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
    async updateTransaction(transactionId, updates) {
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
        const fields = [];
        const values = [];
        Object.keys(updates).forEach((key) => {
            if (allowedFields.includes(key)) {
                let value = updates[key];
                if (['property_coordinates', 'other_parties', 'key_dates', 'other_contacts'].includes(key) && typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });
        if (fields.length === 0) {
            throw new types_1.DatabaseError('No valid fields to update');
        }
        values.push(transactionId);
        const sql = `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`;
        await this._run(sql, values);
    }
    /**
     * Delete transaction
     */
    async deleteTransaction(transactionId) {
        const sql = 'DELETE FROM transactions WHERE id = ?';
        await this._run(sql, [transactionId]);
    }
    // ============================================
    // COMMUNICATION OPERATIONS
    // ============================================
    /**
     * Save communication (email) to database
     */
    async createCommunication(communicationData) {
        const id = crypto_1.default.randomUUID();
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
        await this._run(sql, params);
        const communication = await this.getCommunicationById(id);
        if (!communication) {
            throw new types_1.DatabaseError('Failed to create communication');
        }
        return communication;
    }
    /**
     * Get communication by ID
     */
    async getCommunicationById(communicationId) {
        const sql = 'SELECT * FROM communications WHERE id = ?';
        const communication = await this._get(sql, [communicationId]);
        return communication || null;
    }
    /**
     * Get communications with filters
     */
    async getCommunications(filters) {
        let sql = 'SELECT * FROM communications WHERE 1=1';
        const params = [];
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
        return await this._all(sql, params);
    }
    /**
     * Get communications for a transaction
     */
    async getCommunicationsByTransaction(transactionId) {
        const sql = `
      SELECT * FROM communications
      WHERE transaction_id = ?
      ORDER BY sent_at DESC
    `;
        return await this._all(sql, [transactionId]);
    }
    /**
     * Update communication
     */
    async updateCommunication(communicationId, updates) {
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
        const fields = [];
        const values = [];
        Object.keys(updates).forEach((key) => {
            if (allowedFields.includes(key)) {
                let value = updates[key];
                if (['attachment_metadata', 'keywords_detected', 'parties_involved'].includes(key) && typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });
        if (fields.length === 0) {
            throw new types_1.DatabaseError('No valid fields to update');
        }
        values.push(communicationId);
        const sql = `UPDATE communications SET ${fields.join(', ')} WHERE id = ?`;
        await this._run(sql, values);
    }
    /**
     * Delete communication
     */
    async deleteCommunication(communicationId) {
        const sql = 'DELETE FROM communications WHERE id = ?';
        await this._run(sql, [communicationId]);
    }
    /**
     * Link communication to transaction
     */
    async linkCommunicationToTransaction(communicationId, transactionId) {
        const sql = 'UPDATE communications SET transaction_id = ? WHERE id = ?';
        await this._run(sql, [transactionId, communicationId]);
    }
    /**
     * Save extracted transaction data (audit trail)
     */
    async saveExtractedData(transactionId, fieldName, fieldValue, sourceCommId, confidence) {
        const id = crypto_1.default.randomUUID();
        const sql = `
      INSERT INTO extracted_transaction_data (
        id, transaction_id, field_name, field_value,
        source_communication_id, extraction_method, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
        await this._run(sql, [
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
    async linkContactToTransaction(transactionId, contactId, role) {
        const id = crypto_1.default.randomUUID();
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
        await this._run(sql, params);
    }
    /**
     * Assign contact to transaction with detailed role data
     */
    async assignContactToTransaction(transactionId, data) {
        const id = crypto_1.default.randomUUID();
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
        await this._run(sql, params);
        return id;
    }
    /**
     * Get all contacts assigned to a transaction
     */
    async getTransactionContacts(transactionId) {
        const sql = `
      SELECT
        c.*
      FROM transaction_contacts tc
      LEFT JOIN contacts c ON tc.contact_id = c.id
      WHERE tc.transaction_id = ?
      ORDER BY tc.is_primary DESC, tc.created_at ASC
    `;
        return await this._all(sql, [transactionId]);
    }
    /**
     * Get all contacts assigned to a transaction with role details
     */
    async getTransactionContactsWithRoles(transactionId) {
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
        return await this._all(sql, [transactionId]);
    }
    /**
     * Get all contacts for a specific role in a transaction
     */
    async getTransactionContactsByRole(transactionId, role) {
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
        return await this._all(sql, [transactionId, role]);
    }
    /**
     * Update contact role information
     */
    async updateContactRole(transactionId, contactId, updates) {
        const allowedFields = ['role', 'role_category', 'specific_role', 'is_primary', 'notes'];
        const fields = [];
        const values = [];
        Object.keys(updates).forEach((key) => {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(updates[key]);
            }
        });
        if (fields.length === 0) {
            throw new types_1.DatabaseError('No valid fields to update');
        }
        values.push(transactionId, contactId);
        const sql = `
      UPDATE transaction_contacts
      SET ${fields.join(', ')}
      WHERE transaction_id = ? AND contact_id = ?
    `;
        await this._run(sql, values);
    }
    /**
     * Remove contact from transaction
     */
    async unlinkContactFromTransaction(transactionId, contactId) {
        const sql = 'DELETE FROM transaction_contacts WHERE transaction_id = ? AND contact_id = ?';
        await this._run(sql, [transactionId, contactId]);
    }
    /**
     * Check if contact is assigned to transaction
     */
    async isContactAssignedToTransaction(transactionId, contactId) {
        const sql = 'SELECT id FROM transaction_contacts WHERE transaction_id = ? AND contact_id = ? LIMIT 1';
        const result = await this._get(sql, [transactionId, contactId]);
        return !!result;
    }
    // ============================================
    // USER FEEDBACK OPERATIONS
    // ============================================
    /**
     * Submit user feedback on extracted data
     */
    async saveFeedback(feedbackData) {
        const id = crypto_1.default.randomUUID();
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
        await this._run(sql, params);
        const feedback = await this._get('SELECT * FROM user_feedback WHERE id = ?', [id]);
        if (!feedback) {
            throw new types_1.DatabaseError('Failed to save feedback');
        }
        return feedback;
    }
    /**
     * Get all feedback for a transaction
     */
    async getFeedbackByTransaction(transactionId) {
        const sql = `
      SELECT * FROM user_feedback
      WHERE transaction_id = ?
      ORDER BY created_at DESC
    `;
        return await this._all(sql, [transactionId]);
    }
    /**
     * Get feedback by field name
     */
    async getFeedbackByField(userId, fieldName, limit = 100) {
        const sql = `
      SELECT * FROM user_feedback
      WHERE user_id = ? AND field_name = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
        return await this._all(sql, [userId, fieldName, limit]);
    }
    // ============================================
    // UTILITY OPERATIONS
    // ============================================
    /**
     * Vacuum the database to reclaim space
     */
    async vacuum() {
        await this._run('VACUUM');
    }
    /**
     * Close database connection
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        console.log('[DatabaseService] Database connection closed');
                        resolve();
                    }
                });
            }
            else {
                resolve();
            }
        });
    }
}
// Export singleton instance
exports.default = new DatabaseService();
