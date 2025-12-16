/**
 * Database Services Barrel Export
 *
 * This module provides a unified export point for all database sub-services.
 * Import from here to access any database functionality.
 */

// Core database connection and helpers
export {
  isInitialized,
  getDbPath,
  getEncryptionKey,
  ensureDb,
  getRawDatabase,
  openDatabase,
  setDb,
  setDbPath,
  setEncryptionKey,
  initializePaths,
  closeDb,
  vacuumDb,
  dbGet,
  dbAll,
  dbRun,
  dbExec,
  dbTransaction,
} from "./core/dbConnection";

// Domain services - Phase 2
export * from "./userDbService";
export * from "./sessionDbService";
export * from "./oauthTokenDbService";

// Domain services - Phase 3
export * from "./contactDbService";
export * from "./transactionDbService";
export * from "./transactionContactDbService";
// export * from './communicationDbService';
// export * from './feedbackDbService';
// export * from './auditLogDbService';
