/**
 * Mock for better-sqlite3-multiple-ciphers native module
 * Used by databaseService.ts for encrypted SQLite database operations
 *
 * This mock provides the synchronous API that better-sqlite3 uses,
 * as opposed to the callback-based API of node-sqlite3.
 */

const mockStatement = {
  get: jest.fn(),
  all: jest.fn(() => []),
  run: jest.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
  bind: jest.fn(function () {
    return this;
  }),
  pluck: jest.fn(function () {
    return this;
  }),
  expand: jest.fn(function () {
    return this;
  }),
  raw: jest.fn(function () {
    return this;
  }),
  columns: jest.fn(() => []),
  safeIntegers: jest.fn(function () {
    return this;
  }),
};

const mockDb = {
  pragma: jest.fn(() => []),
  exec: jest.fn(),
  prepare: jest.fn(() => mockStatement),
  close: jest.fn(),
  serialize: jest.fn((callback) => {
    if (callback) callback();
  }),
  run: jest.fn((_sql, _params, callback) => {
    if (callback) callback(null);
    return mockDb;
  }),
  transaction: jest.fn((callback) => {
    return function transactionWrapper(...args) {
      return callback(...args);
    };
  }),
  backup: jest.fn(() => ({
    step: jest.fn(() => true),
    finish: jest.fn(),
    close: jest.fn(),
  })),
  function: jest.fn(),
  aggregate: jest.fn(),
  table: jest.fn(),
  loadExtension: jest.fn(),
  defaultSafeIntegers: jest.fn(),
  unsafeMode: jest.fn(),
  inTransaction: false,
  open: true,
  memory: false,
  readonly: false,
  name: ":memory:",
};

// Create a constructor function that returns the mock database
function Database(_filename, _options) {
  // Return the mock database instance
  return mockDb;
}

// Expose internals for test assertions
Database._mockDb = mockDb;
Database._mockStatement = mockStatement;

// Static properties/methods
Database.SqliteError = class SqliteError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "SqliteError";
    this.code = code;
  }
};

module.exports = Database;
