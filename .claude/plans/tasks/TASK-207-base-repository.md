# TASK-207: Create Base Repository Infrastructure

**Backlog ID:** BACKLOG-058
**Sprint:** TECHDEBT-2024-01
**Phase:** 3A (DB Split - Foundation)
**Branch:** `refactor/task-207-base-repo`
**Depends On:** Phase 1 complete
**Estimated Turns:** 12-18

---

## Objective

Create the foundational infrastructure for domain-specific repositories that will replace the monolithic databaseService.ts.

---

## Context

Current state:
- `electron/services/databaseService.ts` = 3,342 lines
- Contains ALL database operations (users, contacts, transactions, messages, etc.)
- Hard to test, hard to modify, high coupling

Target state:
- `electron/services/db/BaseRepository.ts` = shared utilities
- `electron/services/db/UserRepository.ts` = ~200-300 lines
- `electron/services/db/ContactRepository.ts` = ~300-400 lines
- etc.

---

## Requirements

### 1. Directory Structure

Create:
```
electron/services/db/
├── index.ts              # Re-exports all repositories
├── BaseRepository.ts     # Shared utilities
├── types.ts              # Shared types
└── __tests__/
    └── BaseRepository.test.ts
```

### 2. BaseRepository Implementation

```typescript
// electron/services/db/BaseRepository.ts

import Database from 'better-sqlite3-multiple-ciphers';

export class BaseRepository {
  protected db: Database.Database | null = null;

  /**
   * Set the database connection (called once during app init)
   */
  setDatabase(database: Database.Database): void {
    this.db = database;
  }

  /**
   * Ensure database is initialized, throw if not
   */
  protected ensureDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call setDatabase() first.');
    }
    return this.db;
  }

  /**
   * Execute a write operation (INSERT, UPDATE, DELETE)
   */
  protected run(sql: string, params: unknown[] = []): Database.RunResult {
    return this.ensureDb().prepare(sql).run(...params);
  }

  /**
   * Get a single row
   */
  protected get<T>(sql: string, params: unknown[] = []): T | undefined {
    return this.ensureDb().prepare(sql).get(...params) as T | undefined;
  }

  /**
   * Get all matching rows
   */
  protected all<T>(sql: string, params: unknown[] = []): T[] {
    return this.ensureDb().prepare(sql).all(...params) as T[];
  }

  /**
   * Execute operations in a transaction
   */
  protected transaction<T>(fn: () => T): T {
    const db = this.ensureDb();
    return db.transaction(fn)();
  }
}

// Singleton instance for sharing database connection
let sharedDb: Database.Database | null = null;

export function setSharedDatabase(db: Database.Database): void {
  sharedDb = db;
}

export function getSharedDatabase(): Database.Database {
  if (!sharedDb) {
    throw new Error('Shared database not initialized');
  }
  return sharedDb;
}
```

### 3. Shared Types

```typescript
// electron/services/db/types.ts

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
}
```

### 4. Index Re-exports

```typescript
// electron/services/db/index.ts

export { BaseRepository, setSharedDatabase, getSharedDatabase } from './BaseRepository';
export * from './types';

// Future repositories will be added here:
// export { UserRepository } from './UserRepository';
// export { ContactRepository } from './ContactRepository';
```

### Must NOT Do:
- Move any actual domain logic yet (that's TASK-208+)
- Modify databaseService.ts (keep it working)
- Break existing functionality

---

## Acceptance Criteria

- [ ] `electron/services/db/` directory exists with all files
- [ ] BaseRepository class has all utility methods
- [ ] Shared database connection pattern works
- [ ] Unit tests for BaseRepository pass
- [ ] `npm run type-check` passes
- [ ] Existing databaseService still works (no breaking changes)

---

## Testing Requirements

Add tests for:
1. `ensureDb()` throws when database not set
2. `run()` executes write operations
3. `get()` returns single row or undefined
4. `all()` returns array of rows
5. `transaction()` commits on success, rolls back on error

Use an in-memory SQLite database for tests:
```typescript
import Database from 'better-sqlite3-multiple-ciphers';

const testDb = new Database(':memory:');
testDb.exec('CREATE TABLE test (id TEXT, value TEXT)');
```

---

## Files to Create

- `electron/services/db/BaseRepository.ts`
- `electron/services/db/types.ts`
- `electron/services/db/index.ts`
- `electron/services/db/__tests__/BaseRepository.test.ts`

---

## Integration Note

This task creates the **foundation only**. The actual migration of domain code happens in:
- TASK-208: UserRepository
- TASK-209: ContactRepository
- TASK-210: TransactionRepository
- TASK-211: CommunicationRepository
- TASK-212: Final cleanup

---

## Implementation Summary Template

```markdown
## Implementation Summary

### Created:
- `db/BaseRepository.ts` - Base class with utilities
- `db/types.ts` - Shared type definitions
- `db/index.ts` - Module exports

### Utility Methods:
- `ensureDb()` - Connection validation
- `run()` - Write operations
- `get()` - Single row queries
- `all()` - Multi-row queries
- `transaction()` - Transaction wrapper

### Tests:
- [X] Connection validation
- [X] Query operations
- [X] Transaction commit/rollback

### Verified:
- [ ] Existing databaseService still works
- [ ] Type check passes
- [ ] All tests pass
```
