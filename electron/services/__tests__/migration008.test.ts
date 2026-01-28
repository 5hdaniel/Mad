/**
 * @jest-environment node
 */

/**
 * Migration 008: AI Detection Support Schema
 * Tests for TASK-305 - verifies all Phase 1 schema changes are properly applied
 *
 * This tests verify the migration logic for:
 * - TASK-301: AI detection fields for transactions
 * - TASK-302: llm_settings table
 * - TASK-303: llm_analysis column for messages
 * - TASK-305: Schema version increment to 16
 */

import { jest } from "@jest/globals";

// Track which SQL statements were executed
const executedStatements: string[] = [];

// Mock PRAGMA results for column checks
// This simulates an existing database that needs migration (missing AI detection columns)
const mockColumnResults: Record<string, { name: string }[]> = {
  transactions: [
    { name: "id" },
    { name: "property_address" },
    { name: "status" },
  ],
  messages: [{ name: "id" }, { name: "subject" }],
  contacts: [{ name: "id" }, { name: "display_name" }, { name: "source" }],
  users_local: [{ name: "id" }, { name: "email" }],
  communications: [{ name: "id" }, { name: "transaction_id" }],
  attachments: [{ name: "id" }, { name: "message_id" }],
  transaction_contacts: [{ name: "id" }, { name: "transaction_id" }],
};

// Mock schema version (starts at 7)
let mockSchemaVersion = 7;

// Mock table existence check
let mockLlmSettingsExists = false;

// Mock statement
const mockStatement = {
  get: jest.fn((_params?: unknown) => {
    const sql = (mockStatement as unknown as { _sql: string })._sql;

    // Schema version query
    if (sql.includes("SELECT version FROM schema_version")) {
      return { version: mockSchemaVersion };
    }

    // Table existence checks
    if (sql.includes("SELECT name FROM sqlite_master") && sql.includes("type='table'")) {
      // llm_settings table existence
      if (sql.includes("llm_settings")) {
        return mockLlmSettingsExists ? { name: "llm_settings" } : undefined;
      }
      // For migration tests, assume transactions and messages tables exist
      // so that the migration logic checks their columns and adds missing ones
      if (sql.includes("transactions") || sql.includes("messages") ||
          sql.includes("contacts") || sql.includes("users_local") ||
          sql.includes("communications") || sql.includes("attachments") ||
          sql.includes("transaction_contacts") || sql.includes("schema_version") ||
          sql.includes("audit_logs")) {
        return { name: "table" };
      }
    }

    return undefined;
  }),
  all: jest.fn((_params?: unknown) => {
    const sql = (mockStatement as unknown as { _sql: string })._sql;

    // PRAGMA table_info queries
    if (sql.includes("PRAGMA table_info(transactions)")) {
      return mockColumnResults.transactions;
    }
    if (sql.includes("PRAGMA table_info(messages)")) {
      return mockColumnResults.messages;
    }
    if (sql.includes("PRAGMA table_info(contacts)")) {
      return mockColumnResults.contacts;
    }
    if (sql.includes("PRAGMA table_info(users_local)")) {
      return mockColumnResults.users_local;
    }
    if (sql.includes("PRAGMA table_info(communications)")) {
      return mockColumnResults.communications;
    }
    if (sql.includes("PRAGMA table_info(attachments)")) {
      return mockColumnResults.attachments;
    }
    if (sql.includes("PRAGMA table_info(transaction_contacts)")) {
      return mockColumnResults.transaction_contacts;
    }

    return [];
  }),
  run: jest.fn((_params?: unknown) => {
    const sql = (mockStatement as unknown as { _sql: string })._sql;
    executedStatements.push(sql);

    // Track state changes
    if (sql.includes("UPDATE schema_version SET version = 16")) {
      mockSchemaVersion = 16;
    }
    if (sql.includes("CREATE TABLE") && sql.includes("llm_settings")) {
      mockLlmSettingsExists = true;
    }

    // Track column additions
    if (sql.includes("ALTER TABLE transactions ADD COLUMN detection_source")) {
      mockColumnResults.transactions.push({ name: "detection_source" });
    }
    if (sql.includes("ALTER TABLE transactions ADD COLUMN detection_status")) {
      mockColumnResults.transactions.push({ name: "detection_status" });
    }
    if (sql.includes("ALTER TABLE messages ADD COLUMN llm_analysis")) {
      mockColumnResults.messages.push({ name: "llm_analysis" });
    }

    return { lastInsertRowid: 1, changes: 1 };
  }),
  _sql: "",
};

const mockDb = {
  pragma: jest.fn().mockReturnValue([]),
  exec: jest.fn((sql: string) => {
    // Capture exec statements for verification
    executedStatements.push(sql);

    // Track state changes from exec calls
    if (sql.includes("UPDATE schema_version SET version = 16")) {
      mockSchemaVersion = 16;
    }
    if (sql.includes("CREATE TABLE") && sql.includes("llm_settings")) {
      mockLlmSettingsExists = true;
    }
    if (sql.includes("ALTER TABLE transactions ADD COLUMN detection_source")) {
      mockColumnResults.transactions.push({ name: "detection_source" });
    }
    if (sql.includes("ALTER TABLE transactions ADD COLUMN detection_status")) {
      mockColumnResults.transactions.push({ name: "detection_status" });
    }
    if (sql.includes("ALTER TABLE messages ADD COLUMN llm_analysis")) {
      mockColumnResults.messages.push({ name: "llm_analysis" });
    }
  }),
  prepare: jest.fn((sql: string) => {
    (mockStatement as unknown as { _sql: string })._sql = sql;
    return mockStatement;
  }),
  close: jest.fn(),
  serialize: jest.fn((callback: () => void) => callback()),
  run: jest.fn(
    (
      _sql: string,
      _params: unknown[],
      callback?: (err: Error | null) => void
    ) => {
      if (callback) callback(null);
      return mockDb;
    }
  ),
  transaction: jest.fn((callback: () => void) => {
    return () => callback();
  }),
};

// Mock better-sqlite3-multiple-ciphers
jest.mock("better-sqlite3-multiple-ciphers", () => {
  return jest.fn(() => mockDb);
});

// Mock Electron
jest.mock("electron", () => ({
  app: {
    getPath: jest.fn(() => "/mock/user/data"),
  },
}));

// Mock fs
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue("-- schema SQL"),
  writeSync: jest.fn(),
  fsyncSync: jest.fn(),
  closeSync: jest.fn(),
  openSync: jest.fn(),
  unlinkSync: jest.fn(),
  copyFileSync: jest.fn(),
  renameSync: jest.fn(),
  statSync: jest.fn(() => ({ size: 1024 })),
}));

// Mock crypto
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "test-uuid-1234"),
  randomBytes: jest.fn(() => Buffer.from("random-bytes-for-testing")),
}));

// Mock databaseEncryptionService
jest.mock("../databaseEncryptionService", () => ({
  databaseEncryptionService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getEncryptionKey: jest.fn().mockResolvedValue("test-encryption-key-hex"),
    isDatabaseEncrypted: jest.fn().mockResolvedValue(false),
  },
  default: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getEncryptionKey: jest.fn().mockResolvedValue("test-encryption-key-hex"),
    isDatabaseEncrypted: jest.fn().mockResolvedValue(false),
  },
}));

// Mock logService
jest.mock("../logService", () => {
  const mockFns = {
    info: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
  };
  return {
    __esModule: true,
    default: mockFns,
    logService: mockFns,
  };
});

describe("Migration 008: AI Detection Support Schema", () => {
  let databaseService: typeof import("../databaseService").default;

  beforeEach(async () => {
    // Reset state before each test
    executedStatements.length = 0;
    mockSchemaVersion = 7;
    mockLlmSettingsExists = false;
    mockColumnResults.transactions = [
      { name: "id" },
      { name: "property_address" },
      { name: "status" },
    ];
    mockColumnResults.messages = [{ name: "id" }, { name: "subject" }];

    jest.clearAllMocks();
    jest.resetModules();

    // Re-import to get fresh instance
    const module = await import("../databaseService");
    databaseService = module.default;
  });

  describe("TASK-301: Transaction detection fields", () => {
    it("should add detection_source column when missing", async () => {
      await databaseService.initialize();

      const hasDetectionSource = executedStatements.some((sql) =>
        sql.includes("ALTER TABLE transactions ADD COLUMN detection_source")
      );
      expect(hasDetectionSource).toBe(true);
    });

    it("should add detection_status column with CHECK constraint", async () => {
      await databaseService.initialize();

      const hasDetectionStatus = executedStatements.some(
        (sql) =>
          sql.includes(
            "ALTER TABLE transactions ADD COLUMN detection_status"
          ) && sql.includes("CHECK")
      );
      expect(hasDetectionStatus).toBe(true);
    });

    it("should add all 7 detection columns", async () => {
      await databaseService.initialize();

      const expectedColumns = [
        "detection_source",
        "detection_status",
        "detection_confidence",
        "detection_method",
        "suggested_contacts",
        "reviewed_at",
        "rejection_reason",
      ];

      expectedColumns.forEach((col) => {
        const hasColumn = executedStatements.some((sql) =>
          sql.includes(`ALTER TABLE transactions ADD COLUMN ${col}`)
        );
        expect(hasColumn).toBe(true);
      });
    });
  });

  describe("TASK-302: llm_settings table", () => {
    it("should create llm_settings table when not exists", async () => {
      await databaseService.initialize();

      const hasCreateTable = executedStatements.some(
        (sql) => sql.includes("CREATE TABLE") && sql.includes("llm_settings")
      );
      expect(hasCreateTable).toBe(true);
    });

    it("should include all required columns in llm_settings", async () => {
      await databaseService.initialize();

      const createStatement = executedStatements.find(
        (sql) => sql.includes("CREATE TABLE") && sql.includes("llm_settings")
      );

      expect(createStatement).toBeDefined();
      expect(createStatement).toContain("user_id");
      expect(createStatement).toContain("preferred_provider");
      expect(createStatement).toContain("tokens_used_this_month");
      expect(createStatement).toContain("llm_data_consent");
    });

    it("should create index on user_id", async () => {
      await databaseService.initialize();

      const hasIndex = executedStatements.some(
        (sql) =>
          sql.includes("CREATE INDEX") && sql.includes("idx_llm_settings_user")
      );
      expect(hasIndex).toBe(true);
    });
  });

  describe("TASK-303: Messages llm_analysis column", () => {
    it("should add llm_analysis column to messages", async () => {
      await databaseService.initialize();

      const hasLlmAnalysis = executedStatements.some((sql) =>
        sql.includes("ALTER TABLE messages ADD COLUMN llm_analysis")
      );
      expect(hasLlmAnalysis).toBe(true);
    });
  });

  describe("TASK-305: Schema version increment", () => {
    it("should increment schema version to 16", async () => {
      await databaseService.initialize();

      const hasVersionUpdate = executedStatements.some((sql) =>
        sql.includes("UPDATE schema_version SET version = 16")
      );
      expect(hasVersionUpdate).toBe(true);
    });

    it("should only increment version when current version < 16", async () => {
      // Set version to 8 (already migrated)
      mockSchemaVersion = 16;

      // Also mark all columns/tables as existing to skip migrations
      mockLlmSettingsExists = true;
      mockColumnResults.transactions.push(
        { name: "detection_source" },
        { name: "detection_status" },
        { name: "detection_confidence" },
        { name: "detection_method" },
        { name: "suggested_contacts" },
        { name: "reviewed_at" },
        { name: "rejection_reason" }
      );
      mockColumnResults.messages.push({ name: "llm_analysis" });

      await databaseService.initialize();

      // Should not update version again
      const versionUpdates = executedStatements.filter((sql) =>
        sql.includes("UPDATE schema_version SET version = 16")
      );
      expect(versionUpdates.length).toBe(0);
    });
  });

  describe("Idempotency", () => {
    it("should not add columns that already exist", async () => {
      // Simulate columns already existing
      mockColumnResults.transactions.push(
        { name: "detection_source" },
        { name: "detection_status" }
      );
      mockColumnResults.messages.push({ name: "llm_analysis" });
      mockLlmSettingsExists = true;
      mockSchemaVersion = 16;

      await databaseService.initialize();

      // Should not attempt to add existing columns
      const hasNewAlters = executedStatements.some(
        (sql) =>
          sql.includes(
            "ALTER TABLE transactions ADD COLUMN detection_source"
          ) || sql.includes("ALTER TABLE messages ADD COLUMN llm_analysis")
      );
      expect(hasNewAlters).toBe(false);

      // Should not create existing table
      const hasNewCreate = executedStatements.some(
        (sql) => sql.includes("CREATE TABLE") && sql.includes("llm_settings")
      );
      expect(hasNewCreate).toBe(false);
    });
  });

  describe("Migration order", () => {
    it("should run migrations in correct order", async () => {
      await databaseService.initialize();

      // Find indices of key operations
      const txDetectionIdx = executedStatements.findIndex((sql) =>
        sql.includes("detection_source")
      );
      const llmSettingsIdx = executedStatements.findIndex(
        (sql) => sql.includes("CREATE TABLE") && sql.includes("llm_settings")
      );
      const llmAnalysisIdx = executedStatements.findIndex((sql) =>
        sql.includes("llm_analysis")
      );
      const versionUpdateIdx = executedStatements.findIndex((sql) =>
        sql.includes("UPDATE schema_version SET version = 16")
      );

      // Version update should come after all other migrations
      expect(versionUpdateIdx).toBeGreaterThan(txDetectionIdx);
      expect(versionUpdateIdx).toBeGreaterThan(llmSettingsIdx);
      expect(versionUpdateIdx).toBeGreaterThan(llmAnalysisIdx);
    });
  });
});
