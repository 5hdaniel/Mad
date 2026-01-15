/**
 * Mock for sqlite3 native module
 * Used by contactsService.ts for reading macOS Contacts database
 */

const mockDatabase = {
  all: jest.fn((sql, params, callback) => {
    if (typeof params === "function") {
      callback = params;
      params = [];
    }
    if (callback) callback(null, []);
    return mockDatabase;
  }),
  get: jest.fn((sql, params, callback) => {
    if (typeof params === "function") {
      callback = params;
      params = [];
    }
    if (callback) callback(null, null);
    return mockDatabase;
  }),
  run: jest.fn((sql, params, callback) => {
    if (typeof params === "function") {
      callback = params;
      params = [];
    }
    if (callback) callback(null);
    return mockDatabase;
  }),
  close: jest.fn((callback) => {
    if (callback) callback(null);
    return mockDatabase;
  }),
  serialize: jest.fn((callback) => {
    if (callback) callback();
    return mockDatabase;
  }),
  parallelize: jest.fn((callback) => {
    if (callback) callback();
    return mockDatabase;
  }),
  exec: jest.fn((sql, callback) => {
    if (callback) callback(null);
    return mockDatabase;
  }),
  prepare: jest.fn(() => ({
    run: jest.fn((params, callback) => {
      if (typeof params === "function") {
        callback = params;
        params = [];
      }
      if (callback) callback(null);
    }),
    finalize: jest.fn((callback) => {
      if (callback) callback(null);
    }),
  })),
  on: jest.fn(),
};

const Database = jest.fn((filename, mode, callback) => {
  if (typeof mode === "function") {
    callback = mode;
    mode = undefined;
  }
  if (callback) {
    // Call async to simulate the real behavior
    setTimeout(() => callback(null), 0);
  }
  return mockDatabase;
});

// Expose internals for test assertions
Database._mockDatabase = mockDatabase;

// sqlite3 constants
Database.OPEN_READONLY = 1;
Database.OPEN_READWRITE = 2;
Database.OPEN_CREATE = 4;
Database.OPEN_FULLMUTEX = 0x00010000;
Database.OPEN_URI = 0x00000040;
Database.OPEN_SHAREDCACHE = 0x00020000;
Database.OPEN_PRIVATECACHE = 0x00040000;

// Mock verbose function that returns the same module
const verbose = jest.fn(() => ({
  Database,
  OPEN_READONLY: Database.OPEN_READONLY,
  OPEN_READWRITE: Database.OPEN_READWRITE,
  OPEN_CREATE: Database.OPEN_CREATE,
  OPEN_FULLMUTEX: Database.OPEN_FULLMUTEX,
  OPEN_URI: Database.OPEN_URI,
  OPEN_SHAREDCACHE: Database.OPEN_SHAREDCACHE,
  OPEN_PRIVATECACHE: Database.OPEN_PRIVATECACHE,
  verbose,
}));

module.exports = {
  Database,
  verbose,
  OPEN_READONLY: Database.OPEN_READONLY,
  OPEN_READWRITE: Database.OPEN_READWRITE,
  OPEN_CREATE: Database.OPEN_CREATE,
  OPEN_FULLMUTEX: Database.OPEN_FULLMUTEX,
  OPEN_URI: Database.OPEN_URI,
  OPEN_SHAREDCACHE: Database.OPEN_SHAREDCACHE,
  OPEN_PRIVATECACHE: Database.OPEN_PRIVATECACHE,
};
