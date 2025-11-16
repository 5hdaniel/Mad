/**
 * Database Service
 * Manages local SQLite database operations for Mad application
 * Handles user data, transactions, communications, and sessions
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app } = require('electron');

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
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'mad.db');

      console.log('[DatabaseService] Initializing database at:', this.dbPath);

      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Open database connection
      this.db = await this._openDatabase();

      // Run schema migrations
      await this._runMigrations();

      console.log('[DatabaseService] Database initialized successfully');
      return true;
    } catch (error) {
      console.error('[DatabaseService] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Open database connection
   * @private
   */
  _openDatabase() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          // Enable foreign keys
          db.run('PRAGMA foreign_keys = ON;', (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(db);
            }
          });
        }
      });
    });
  }

  /**
   * Run database migrations (execute schema.sql)
   * @private
   */
  async _runMigrations() {
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    return new Promise((resolve, reject) => {
      this.db.exec(schemaSql, async (err) => {
        if (err) {
          reject(err);
        } else {
          // Run additional migrations for existing databases
          try {
            await this._runAdditionalMigrations();
            resolve();
          } catch (migrationErr) {
            reject(migrationErr);
          }
        }
      });
    });
  }

  /**
   * Run additional migrations for schema changes
   * @private
   */
  async _runAdditionalMigrations() {
    try {
      // Migration 1: Add terms_accepted_at column to users_local
      const userColumns = await this._all(`PRAGMA table_info(users_local)`);
      if (!userColumns.some(col => col.name === 'terms_accepted_at')) {
        console.log('[DatabaseService] Adding terms_accepted_at column to users_local');
        await this._run(`ALTER TABLE users_local ADD COLUMN terms_accepted_at DATETIME`);
      }

      // Migration 2: Add new transaction columns
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

      // Migration 3: Enhanced contact roles for transaction_contacts
      const tcColumns = await this._all(`PRAGMA table_info(transaction_contacts)`);
      const tcMigrations = [
        {
          name: 'role_category',
          sql: `ALTER TABLE transaction_contacts ADD COLUMN role_category TEXT CHECK (role_category IN (
            'client', 'agent', 'lending', 'inspection', 'title_escrow', 'legal', 'support', 'property_management', 'insurance'
          ))`
        },
        {
          name: 'specific_role',
          sql: `ALTER TABLE transaction_contacts ADD COLUMN specific_role TEXT CHECK (specific_role IN (
            'client', 'buyer_agent', 'seller_agent', 'listing_agent', 'appraiser', 'inspector',
            'title_company', 'escrow_officer', 'mortgage_broker', 'lender', 'real_estate_attorney',
            'transaction_coordinator', 'insurance_agent', 'surveyor', 'hoa_management', 'condo_management', 'other'
          ))`
        },
        { name: 'is_primary', sql: `ALTER TABLE transaction_contacts ADD COLUMN is_primary INTEGER DEFAULT 0` },
        { name: 'notes', sql: `ALTER TABLE transaction_contacts ADD COLUMN notes TEXT` },
        { name: 'updated_at', sql: `ALTER TABLE transaction_contacts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP` }
      ];

      for (const migration of tcMigrations) {
        if (!tcColumns.some(col => col.name === migration.name)) {
          console.log(`[DatabaseService] Adding ${migration.name} column to transaction_contacts`);
          await this._run(migration.sql);
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

    } catch (error) {
      // Log but don't fail on migration errors
      console.log('[DatabaseService] Migration check:', error.message);
    }
  }

  /**
   * Helper: Run a query that returns a single row
   * @private
   */
  _get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Helper: Run a query that returns multiple rows
   * @private
   */
  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Helper: Run a query that modifies data (INSERT, UPDATE, DELETE)
   * @private
   */
  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
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

    await this._run(sql, params);
    return id;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const sql = 'SELECT * FROM users_local WHERE id = ?';
    return await this._get(sql, [userId]);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    const sql = 'SELECT * FROM users_local WHERE email = ?';
    return await this._get(sql, [email]);
  }

  /**
   * Get user by OAuth provider and ID
   */
  async getUserByOAuthId(provider, oauthId) {
    const sql = 'SELECT * FROM users_local WHERE oauth_provider = ? AND oauth_id = ?';
    return await this._get(sql, [provider, oauthId]);
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
      throw new Error('No valid fields to update');
    }

    values.push(userId);

    const sql = `UPDATE users_local SET ${fields.join(', ')} WHERE id = ?`;
    await this._run(sql, values);

    return await this.getUserById(userId);
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
  async acceptTerms(userId) {
    const sql = `
      UPDATE users_local
      SET terms_accepted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await this._run(sql, [userId]);
    return await this.getUserById(userId);
  }

  // ============================================
  // SESSION OPERATIONS
  // ============================================

  /**
   * Create a new session for a user
   * @returns {string} session token
   */
  async createSession(userId) {
    const id = crypto.randomUUID();
    const sessionToken = crypto.randomUUID();

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
   * @returns {Object|null} session data with user info, or null if invalid
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
    await this._run(
      'UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_token = ?',
      [sessionToken]
    );

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
  async createContact(userId, contactData) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO contacts (
        id, user_id, name, email, phone, company, title, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      userId,
      contactData.name,
      contactData.email || null,
      contactData.phone || null,
      contactData.company || null,
      contactData.title || null,
      contactData.source || 'manual',
    ];

    await this._run(sql, params);
    return await this.getContactById(id);
  }

  /**
   * Get contact by ID
   */
  async getContactById(contactId) {
    const sql = 'SELECT * FROM contacts WHERE id = ?';
    return await this._get(sql, [contactId]);
  }

  /**
   * Get all contacts for a user
   */
  async getContactsByUserId(userId) {
    const sql = 'SELECT * FROM contacts WHERE user_id = ? ORDER BY name ASC';
    return await this._all(sql, [userId]);
  }

  /**
   * Search contacts by name or email
   */
  async searchContacts(userId, query) {
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
      throw new Error('No valid fields to update');
    }

    values.push(contactId);
    const sql = `UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`;
    await this._run(sql, values);

    return await this.getContactById(contactId);
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId) {
    const sql = 'DELETE FROM contacts WHERE id = ?';
    await this._run(sql, [contactId]);
  }

  /**
   * Get or create contact from email address
   */
  async getOrCreateContactFromEmail(userId, email, name = null) {
    // Try to find existing contact
    let contact = await this._get(
      'SELECT * FROM contacts WHERE user_id = ? AND email = ?',
      [userId, email]
    );

    if (!contact) {
      // Create new contact
      contact = await this.createContact(userId, {
        name: name || email.split('@')[0],
        email: email,
        source: 'email',
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

    if (token && token.scopes_granted) {
      token.scopes_granted = JSON.parse(token.scopes_granted);
    }

    return token;
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
      throw new Error('No valid fields to update');
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
  async createTransaction(userId, transactionData) {
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
      userId,
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
    return id;
  }

  /**
   * Get all transactions for a user
   */
  async getTransactionsByUserId(userId) {
    const sql = `
      SELECT * FROM transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;
    return await this._all(sql, [userId]);
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId) {
    const sql = 'SELECT * FROM transactions WHERE id = ?';
    return await this._get(sql, [transactionId]);
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
      throw new Error('No valid fields to update');
    }

    values.push(transactionId);

    const sql = `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`;
    await this._run(sql, values);

    return await this.getTransactionById(transactionId);
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
  async saveCommunication(userId, communicationData) {
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
      userId,
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
    return id;
  }

  /**
   * Get communications for a transaction
   */
  async getCommunicationsByTransactionId(transactionId) {
    const sql = `
      SELECT * FROM communications
      WHERE transaction_id = ?
      ORDER BY sent_at DESC
    `;
    return await this._all(sql, [transactionId]);
  }

  /**
   * Get communications for a user
   */
  async getCommunicationsByUserId(userId, limit = 100) {
    const sql = `
      SELECT * FROM communications
      WHERE user_id = ?
      ORDER BY sent_at DESC
      LIMIT ?
    `;
    return await this._all(sql, [userId, limit]);
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
    const id = crypto.randomUUID();

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
  async assignContactToTransaction(transactionId, data) {
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
      data.is_primary || 0,
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
      throw new Error('No valid fields to update');
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
  async removeContactFromTransaction(transactionId, contactId) {
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

  /**
   * Get all transactions for a specific contact
   */
  async getTransactionsByContact(contactId) {
    const sql = `
      SELECT t.*, tc.specific_role, tc.is_primary
      FROM transactions t
      INNER JOIN transaction_contacts tc ON t.id = tc.transaction_id
      WHERE tc.contact_id = ?
      ORDER BY t.created_at DESC
    `;

    return await this._all(sql, [contactId]);
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('[DatabaseService] Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

// Export singleton instance
module.exports = new DatabaseService();
