# Task TASK-305: Migration 008 Testing

## Goal

Finalize Migration 008 by incrementing the schema version and thoroughly testing the migration on both fresh databases and existing databases with data.

## Non-Goals

- Do NOT add new schema changes (those are in TASK-301-304)
- Do NOT implement application logic
- Do NOT add UI components
- Do NOT test LLM functionality (schema only)

## Deliverables

1. Update: `electron/services/databaseService.ts` - Increment schema version to 8
2. New file: `electron/services/__tests__/migration008.test.ts` - Migration tests
3. Document: Rollback procedure (if needed)

## Acceptance Criteria

- [ ] Schema version incremented to 8
- [ ] Migration runs without errors on fresh database
- [ ] Migration runs without errors on database with existing transactions/messages
- [ ] All new columns have proper defaults verified
- [ ] Existing data preserved after migration
- [ ] Idempotent (running twice doesn't cause errors)
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes

## Implementation Notes

### Finalize Migration 008

In `electron/services/databaseService.ts`, after all Phase 1 column additions:

```typescript
// Migration 008: AI Detection Support (Final)
if (currentVersion < 8) {
  // All column additions from TASK-301, 302, 303 should be above this

  // Increment version
  db.prepare('UPDATE schema_version SET version = 8').run();
  console.log('Migration 008 completed: AI Detection Support');
}
```

### Test File Structure

Create `electron/services/__tests__/migration008.test.ts`:

```typescript
import Database from 'better-sqlite3-multiple-ciphers';
import { DatabaseService } from '../databaseService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Migration 008: AI Detection Support', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    dbPath = path.join(tempDir, 'test.db');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Fresh database', () => {
    it('should create all new tables and columns', async () => {
      // Initialize fresh database
      const dbService = new DatabaseService(dbPath, 'test-key');
      await dbService.initialize();

      const db = dbService.getDb();

      // Verify transactions detection columns
      const txColumns = db.pragma('table_info(transactions)');
      const txColumnNames = txColumns.map((c: any) => c.name);

      expect(txColumnNames).toContain('detection_source');
      expect(txColumnNames).toContain('detection_status');
      expect(txColumnNames).toContain('detection_confidence');
      expect(txColumnNames).toContain('detection_method');
      expect(txColumnNames).toContain('suggested_contacts');
      expect(txColumnNames).toContain('reviewed_at');
      expect(txColumnNames).toContain('rejection_reason');

      // Verify llm_settings table
      const llmSettingsExists = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='llm_settings'
      `).get();
      expect(llmSettingsExists).toBeTruthy();

      // Verify messages llm_analysis column
      const msgColumns = db.pragma('table_info(messages)');
      const msgColumnNames = msgColumns.map((c: any) => c.name);
      expect(msgColumnNames).toContain('llm_analysis');

      // Verify schema version
      const version = db.prepare('SELECT version FROM schema_version').get();
      expect(version.version).toBe(8);

      await dbService.close();
    });
  });

  describe('Existing database with data', () => {
    it('should preserve existing transactions', async () => {
      // Create database at version 7 with data
      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE schema_version (version INTEGER);
        INSERT INTO schema_version VALUES (7);

        CREATE TABLE transactions (
          id TEXT PRIMARY KEY,
          property_address TEXT,
          status TEXT DEFAULT 'active'
        );

        INSERT INTO transactions (id, property_address) VALUES
          ('tx-1', '123 Main St'),
          ('tx-2', '456 Oak Ave');

        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          subject TEXT
        );

        INSERT INTO messages (id, subject) VALUES
          ('msg-1', 'Test email');

        CREATE TABLE users_local (
          id TEXT PRIMARY KEY
        );
      `);
      db.close();

      // Run migration
      const dbService = new DatabaseService(dbPath, 'test-key');
      await dbService.initialize();
      const migratedDb = dbService.getDb();

      // Verify existing data preserved
      const transactions = migratedDb.prepare('SELECT * FROM transactions').all();
      expect(transactions).toHaveLength(2);
      expect(transactions[0].property_address).toBe('123 Main St');

      // Verify new columns have defaults
      expect(transactions[0].detection_source).toBe('manual');
      expect(transactions[0].detection_status).toBe('confirmed');

      // Verify messages preserved
      const messages = migratedDb.prepare('SELECT * FROM messages').all();
      expect(messages).toHaveLength(1);
      expect(messages[0].llm_analysis).toBeNull();

      await dbService.close();
    });

    it('should be idempotent (safe to run twice)', async () => {
      // First run
      const dbService1 = new DatabaseService(dbPath, 'test-key');
      await dbService1.initialize();
      await dbService1.close();

      // Second run - should not error
      const dbService2 = new DatabaseService(dbPath, 'test-key');
      await expect(dbService2.initialize()).resolves.not.toThrow();

      const db = dbService2.getDb();
      const version = db.prepare('SELECT version FROM schema_version').get();
      expect(version.version).toBe(8);

      await dbService2.close();
    });
  });

  describe('Default values', () => {
    it('should apply correct defaults to detection columns', async () => {
      const dbService = new DatabaseService(dbPath, 'test-key');
      await dbService.initialize();
      const db = dbService.getDb();

      // Insert transaction without specifying new columns
      db.prepare(`
        INSERT INTO transactions (id, property_address)
        VALUES ('tx-test', '789 Test St')
      `).run();

      const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get('tx-test');

      expect(tx.detection_source).toBe('manual');
      expect(tx.detection_status).toBe('confirmed');
      expect(tx.detection_confidence).toBeNull();
      expect(tx.detection_method).toBeNull();
      expect(tx.suggested_contacts).toBeNull();
      expect(tx.reviewed_at).toBeNull();
      expect(tx.rejection_reason).toBeNull();

      await dbService.close();
    });

    it('should apply correct defaults to llm_settings', async () => {
      const dbService = new DatabaseService(dbPath, 'test-key');
      await dbService.initialize();
      const db = dbService.getDb();

      // Need users_local entry first
      db.prepare(`INSERT INTO users_local (id) VALUES ('user-1')`).run();

      // Insert minimal llm_settings
      db.prepare(`
        INSERT INTO llm_settings (id, user_id) VALUES ('ls-1', 'user-1')
      `).run();

      const settings = db.prepare('SELECT * FROM llm_settings WHERE id = ?').get('ls-1');

      expect(settings.preferred_provider).toBe('openai');
      expect(settings.openai_model).toBe('gpt-4o-mini');
      expect(settings.anthropic_model).toBe('claude-3-haiku-20240307');
      expect(settings.tokens_used_this_month).toBe(0);
      expect(settings.enable_auto_detect).toBe(1);
      expect(settings.llm_data_consent).toBe(0);

      await dbService.close();
    });
  });
});
```

### Rollback Procedure

Document in case rollback needed:

```sql
-- Rollback Migration 008 (if needed)
-- WARNING: This will lose any data stored in new columns

-- Remove transactions detection columns
ALTER TABLE transactions DROP COLUMN detection_source;
ALTER TABLE transactions DROP COLUMN detection_status;
ALTER TABLE transactions DROP COLUMN detection_confidence;
ALTER TABLE transactions DROP COLUMN detection_method;
ALTER TABLE transactions DROP COLUMN suggested_contacts;
ALTER TABLE transactions DROP COLUMN reviewed_at;
ALTER TABLE transactions DROP COLUMN rejection_reason;

-- Remove messages column
ALTER TABLE messages DROP COLUMN llm_analysis;

-- Drop llm_settings table
DROP TABLE IF EXISTS llm_settings;

-- Revert version
UPDATE schema_version SET version = 7;
```

**Note:** SQLite doesn't support DROP COLUMN in older versions. May need to recreate table.

## Integration Notes

- Imports from: DatabaseService
- Exports to: None
- Used by: All subsequent tasks depend on migration success
- Depends on: TASK-301, TASK-302, TASK-303, TASK-304 (all schema changes)

## Do / Don't

### Do:
- Test with realistic data scenarios
- Verify all defaults are correct
- Document rollback procedure
- Test idempotency

### Don't:
- Don't skip testing on existing databases
- Don't assume migration always succeeds
- Don't forget to increment schema version
- Don't test destructive rollback on production

## When to Stop and Ask

- If migration fails on existing database
- If default values behave unexpectedly
- If there are constraint violations with existing data
- If test infrastructure differs from documented

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Fresh database migration test
  - Existing database migration test
  - Idempotency test
  - Default values test
- Existing tests to update: None

### Coverage

- Coverage impact: Increases coverage for migration code

### Integration / Feature Tests

- Required scenarios:
  - App starts after migration
  - Existing transactions accessible
  - New transactions can be created

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)
- [ ] Build (npm run build)

## PR Preparation

- **Branch**: `feature/TASK-305-migration-008-testing`
- **Title**: `feat(db): finalize and test Migration 008`
- **Labels**: `database`, `testing`, `ai-mvp`, `sprint-004`
- **Depends on**: TASK-301, TASK-302, TASK-303, TASK-304

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] electron/services/__tests__/migration008.test.ts

Files modified:
- [ ] electron/services/databaseService.ts (version increment)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] App starts successfully after migration
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any deviations, explain what and why>

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues and resolutions>

**Reviewer notes:**
<Anything reviewer should pay attention to>
