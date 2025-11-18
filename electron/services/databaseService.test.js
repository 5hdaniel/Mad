/**
 * Database Service Migration Tests
 * Tests for database migrations and schema integrity
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { app } = require('electron');

// Mock electron app for testing
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test-mad-db'),
  },
}));

const DatabaseService = require('./databaseService');

describe('DatabaseService Migrations', () => {
  let dbService;
  let testDbPath;

  beforeEach(async () => {
    // Create temp directory for test database
    testDbPath = '/tmp/test-mad-db';
    if (!fs.existsSync(testDbPath)) {
      fs.mkdirSync(testDbPath, { recursive: true });
    }

    dbService = new DatabaseService();
  });

  afterEach(async () => {
    // Close database and cleanup
    if (dbService && dbService.db) {
      await new Promise((resolve) => {
        dbService.db.close(() => resolve());
      });
    }

    // Remove test database
    const dbFile = path.join(testDbPath, 'mad.db');
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
  });

  describe('Fresh Database Initialization', () => {
    it('should create database and run all migrations successfully', async () => {
      await dbService.initialize();

      expect(dbService.db).toBeDefined();
      expect(dbService.dbPath).toBe(path.join(testDbPath, 'mad.db'));
    });

    it('should create all required tables', async () => {
      await dbService.initialize();

      const tables = await dbService._all(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      );

      const tableNames = tables.map((t) => t.name);

      // Core tables
      expect(tableNames).toContain('users_local');
      expect(tableNames).toContain('transactions');
      expect(tableNames).toContain('transaction_contacts');
      expect(tableNames).toContain('communications');
      expect(tableNames).toContain('contacts');
      expect(tableNames).toContain('user_feedback');
      expect(tableNames).toContain('extraction_metrics');
    });
  });

  describe('Migration 3: Transaction Contacts Enhanced Roles', () => {
    it('should add all required columns to transaction_contacts', async () => {
      await dbService.initialize();

      const columns = await dbService._all(
        `PRAGMA table_info(transaction_contacts)`
      );
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('role_category');
      expect(columnNames).toContain('specific_role');
      expect(columnNames).toContain('is_primary');
      expect(columnNames).toContain('notes');
      expect(columnNames).toContain('updated_at');
    });

    it('should create indexes for better performance', async () => {
      await dbService.initialize();

      const indexes = await dbService._all(
        `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='transaction_contacts'`
      );
      const indexNames = indexes.map((i) => i.name);

      expect(indexNames).toContain('idx_transaction_contacts_specific_role');
      expect(indexNames).toContain('idx_transaction_contacts_category');
      expect(indexNames).toContain('idx_transaction_contacts_primary');
    });

    it('should create timestamp trigger for transaction_contacts', async () => {
      await dbService.initialize();

      const triggers = await dbService._all(
        `SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='transaction_contacts'`
      );
      const triggerNames = triggers.map((t) => t.name);

      expect(triggerNames).toContain('update_transaction_contacts_timestamp');
    });
  });

  describe('Migration 4: Export Tracking', () => {
    it('should add export tracking columns to transactions', async () => {
      await dbService.initialize();

      const columns = await dbService._all(`PRAGMA table_info(transactions)`);
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('export_status');
      expect(columnNames).toContain('export_format');
      expect(columnNames).toContain('export_count');
      expect(columnNames).toContain('last_exported_on');
    });

    it('should create export tracking indexes', async () => {
      await dbService.initialize();

      const indexes = await dbService._all(
        `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='transactions'`
      );
      const indexNames = indexes.map((i) => i.name);

      expect(indexNames).toContain('idx_transactions_export_status');
      expect(indexNames).toContain('idx_transactions_last_exported_on');
    });
  });

  describe('Migration 6: Contact Import Tracking', () => {
    it('should add is_imported column to contacts', async () => {
      await dbService.initialize();

      const columns = await dbService._all(`PRAGMA table_info(contacts)`);
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('is_imported');
    });

    it('should create import tracking indexes', async () => {
      await dbService.initialize();

      const indexes = await dbService._all(
        `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='contacts'`
      );
      const indexNames = indexes.map((i) => i.name);

      expect(indexNames).toContain('idx_contacts_is_imported');
      expect(indexNames).toContain('idx_contacts_user_imported');
    });
  });

  describe('Migration Idempotency', () => {
    it('should safely run migrations multiple times', async () => {
      // First initialization
      await dbService.initialize();

      const firstColumns = await dbService._all(
        `PRAGMA table_info(transaction_contacts)`
      );

      // Close and reinitialize
      await new Promise((resolve) => dbService.db.close(() => resolve()));

      dbService = new DatabaseService();
      await dbService.initialize();

      const secondColumns = await dbService._all(
        `PRAGMA table_info(transaction_contacts)`
      );

      // Should have same columns
      expect(firstColumns.length).toBe(secondColumns.length);
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should enforce foreign key constraints', async () => {
      await dbService.initialize();

      // Check if foreign keys are enabled
      const fkStatus = await dbService._get('PRAGMA foreign_keys');
      expect(fkStatus.foreign_keys).toBe(1);
    });

    it('should cascade delete transaction_contacts when transaction is deleted', async () => {
      await dbService.initialize();

      // Create test user
      await dbService._run(
        `INSERT INTO users_local (id, email, name) VALUES ('test-user', 'test@example.com', 'Test User')`
      );

      // Create test transaction
      await dbService._run(
        `INSERT INTO transactions (id, user_id, property_address, transaction_type)
         VALUES ('test-txn', 'test-user', '123 Test St', 'purchase')`
      );

      // Create test contact
      await dbService._run(
        `INSERT INTO contacts (id, user_id, name, email)
         VALUES ('test-contact', 'test-user', 'Test Contact', 'contact@example.com')`
      );

      // Create transaction_contact
      await dbService._run(
        `INSERT INTO transaction_contacts (id, transaction_id, contact_id, specific_role)
         VALUES ('test-tc', 'test-txn', 'test-contact', 'client')`
      );

      // Delete transaction
      await dbService._run(`DELETE FROM transactions WHERE id = 'test-txn'`);

      // Check that transaction_contact was also deleted
      const remainingContacts = await dbService._all(
        `SELECT * FROM transaction_contacts WHERE transaction_id = 'test-txn'`
      );

      expect(remainingContacts.length).toBe(0);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data integrity for contact assignments', async () => {
      await dbService.initialize();

      // Create test data
      await dbService._run(
        `INSERT INTO users_local (id, email, name) VALUES ('user1', 'user@test.com', 'User')`
      );
      await dbService._run(
        `INSERT INTO transactions (id, user_id, property_address, transaction_type)
         VALUES ('txn1', 'user1', '456 Test Ave', 'sale')`
      );
      await dbService._run(
        `INSERT INTO contacts (id, user_id, name, email) VALUES ('contact1', 'user1', 'Contact 1', 'c1@test.com')`
      );

      // Insert contact assignment with all new fields
      await dbService._run(
        `INSERT INTO transaction_contacts
         (id, transaction_id, contact_id, role_category, specific_role, is_primary, notes)
         VALUES ('tc1', 'txn1', 'contact1', 'client_agent', 'client', 1, 'Primary client')`
      );

      const assignment = await dbService._get(
        `SELECT * FROM transaction_contacts WHERE id = 'tc1'`
      );

      expect(assignment.role_category).toBe('client_agent');
      expect(assignment.specific_role).toBe('client');
      expect(assignment.is_primary).toBe(1);
      expect(assignment.notes).toBe('Primary client');
      expect(assignment.updated_at).toBeDefined();
    });

    it('should update timestamp when transaction_contact is modified', async () => {
      await dbService.initialize();

      // Create test data
      await dbService._run(
        `INSERT INTO users_local (id, email, name) VALUES ('user2', 'user2@test.com', 'User 2')`
      );
      await dbService._run(
        `INSERT INTO transactions (id, user_id, property_address, transaction_type)
         VALUES ('txn2', 'user2', '789 Test Blvd', 'purchase')`
      );
      await dbService._run(
        `INSERT INTO contacts (id, user_id, name, email) VALUES ('contact2', 'user2', 'Contact 2', 'c2@test.com')`
      );
      await dbService._run(
        `INSERT INTO transaction_contacts (id, transaction_id, contact_id, specific_role)
         VALUES ('tc2', 'txn2', 'contact2', 'inspector')`
      );

      const before = await dbService._get(
        `SELECT updated_at FROM transaction_contacts WHERE id = 'tc2'`
      );

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update the record
      await dbService._run(
        `UPDATE transaction_contacts SET notes = 'Updated notes' WHERE id = 'tc2'`
      );

      const after = await dbService._get(
        `SELECT updated_at FROM transaction_contacts WHERE id = 'tc2'`
      );

      // Timestamp should have changed
      expect(after.updated_at).not.toBe(before.updated_at);
    });
  });
});
