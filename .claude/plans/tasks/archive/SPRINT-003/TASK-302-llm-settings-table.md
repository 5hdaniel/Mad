# Task TASK-302: Create llm_settings Table

## Goal

Create a new `llm_settings` table to store user LLM configuration including encrypted API keys, provider preferences, usage tracking, and consent flags.

## Non-Goals

- Do NOT implement the encryption logic (use existing databaseEncryptionService)
- Do NOT create the LLM config service (that's TASK-311)
- Do NOT add IPC handlers (that's TASK-312)
- Do NOT create UI components

## Deliverables

1. Update: `electron/services/databaseService.ts` - Add llm_settings table creation in Migration 008
2. New file: `electron/services/db/llmSettingsDbService.ts` - CRUD operations
3. Update: `electron/types/models.ts` - Add LLMSettings interface

## Acceptance Criteria

- [ ] Table created with all columns as specified
- [ ] Foreign key to users_local works correctly
- [ ] TypeScript LLMSettings interface added
- [ ] CRUD service created with basic operations
- [ ] npm run type-check passes
- [ ] npm run lint passes

## Implementation Notes

### Migration SQL

Add to Migration 008 in databaseService.ts:

```typescript
// Migration 008: AI Detection Fields (Part 2 - LLM Settings)
if (currentVersion < 8) {
  // Create llm_settings table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      -- Provider Config
      openai_api_key_encrypted TEXT,
      anthropic_api_key_encrypted TEXT,
      preferred_provider TEXT DEFAULT 'openai' CHECK (preferred_provider IN ('openai', 'anthropic')),
      openai_model TEXT DEFAULT 'gpt-4o-mini',
      anthropic_model TEXT DEFAULT 'claude-3-haiku-20240307',
      -- Usage Tracking
      tokens_used_this_month INTEGER DEFAULT 0,
      budget_limit_tokens INTEGER,
      budget_reset_date DATE,
      -- Platform Allowance
      platform_allowance_tokens INTEGER DEFAULT 0,
      platform_allowance_used INTEGER DEFAULT 0,
      use_platform_allowance INTEGER DEFAULT 0,
      -- Feature Flags
      enable_auto_detect INTEGER DEFAULT 1,
      enable_role_extraction INTEGER DEFAULT 1,
      -- Consent (Security Option C)
      llm_data_consent INTEGER DEFAULT 0,
      llm_data_consent_at DATETIME,
      -- Timestamps
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE
    );
  `);

  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_llm_settings_user ON llm_settings(user_id);
  `);
}
```

### TypeScript Interface

Add to `electron/types/models.ts`:

```typescript
export interface LLMSettings {
  id: string;
  user_id: string;
  // Provider Config
  openai_api_key_encrypted?: string;
  anthropic_api_key_encrypted?: string;
  preferred_provider: 'openai' | 'anthropic';
  openai_model: string;
  anthropic_model: string;
  // Usage Tracking
  tokens_used_this_month: number;
  budget_limit_tokens?: number;
  budget_reset_date?: string;
  // Platform Allowance
  platform_allowance_tokens: number;
  platform_allowance_used: number;
  use_platform_allowance: boolean;
  // Feature Flags
  enable_auto_detect: boolean;
  enable_role_extraction: boolean;
  // Consent
  llm_data_consent: boolean;
  llm_data_consent_at?: string;
  // Timestamps
  created_at: string;
  updated_at: string;
}
```

### DB Service

Create `electron/services/db/llmSettingsDbService.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';
import { LLMSettings } from '../../types/models';

export class LLMSettingsDbService {
  constructor(private db: any) {}

  getByUserId(userId: string): LLMSettings | null {
    const row = this.db.prepare(`
      SELECT * FROM llm_settings WHERE user_id = ?
    `).get(userId);
    return row ? this.mapRow(row) : null;
  }

  create(userId: string): LLMSettings {
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO llm_settings (id, user_id) VALUES (?, ?)
    `).run(id, userId);
    return this.getByUserId(userId)!;
  }

  update(userId: string, updates: Partial<LLMSettings>): LLMSettings {
    // Build dynamic update query
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'user_id');
    if (fields.length === 0) return this.getByUserId(userId)!;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as any)[f]);

    this.db.prepare(`
      UPDATE llm_settings
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(...values, userId);

    return this.getByUserId(userId)!;
  }

  incrementTokenUsage(userId: string, tokens: number): void {
    this.db.prepare(`
      UPDATE llm_settings
      SET tokens_used_this_month = tokens_used_this_month + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(tokens, userId);
  }

  resetMonthlyUsage(userId: string): void {
    this.db.prepare(`
      UPDATE llm_settings
      SET tokens_used_this_month = 0,
          budget_reset_date = DATE('now'),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(userId);
  }

  private mapRow(row: any): LLMSettings {
    return {
      ...row,
      use_platform_allowance: Boolean(row.use_platform_allowance),
      enable_auto_detect: Boolean(row.enable_auto_detect),
      enable_role_extraction: Boolean(row.enable_role_extraction),
      llm_data_consent: Boolean(row.llm_data_consent),
    };
  }
}
```

### Important Details

- API keys are stored encrypted - encryption happens in the config service (TASK-311)
- `use_platform_allowance` is INTEGER (0/1) in SQLite, boolean in TypeScript
- Monthly usage reset should be triggered by a scheduled task or on first request of new month
- Foreign key ON DELETE CASCADE ensures cleanup when user deleted

## Integration Notes

- Imports from: `electron/types/models.ts`
- Exports to: Used by TASK-311 (LLM Config Service)
- Used by: TASK-308 (Token Counting), TASK-311 (Config Service)
- Depends on: None (can start immediately)

## Do / Don't

### Do:
- Use existing db service patterns (check `electron/services/db/` for examples)
- Store API keys only in encrypted form
- Use INTEGER for booleans (SQLite standard)
- Add proper null checks in service methods

### Don't:
- Don't store plaintext API keys
- Don't expose encrypted keys in logs
- Don't implement encryption here (use existing service)
- Don't add IPC handlers (TASK-312)

## When to Stop and Ask

- If users_local table doesn't exist or has different structure
- If there's an existing llm_settings or similar table
- If the db service pattern differs from documented
- If encryption service is not available

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `llmSettingsDbService.test.ts` - CRUD operations, token increment, reset
- Existing tests to update: None

### Coverage

- Coverage impact: New service must have >60% coverage

### Integration / Feature Tests

- Required scenarios:
  - Create settings for new user
  - Update settings
  - Increment token usage
  - Reset monthly usage

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-302-llm-settings-table`
- **Title**: `feat(db): create llm_settings table and service`
- **Labels**: `database`, `ai-mvp`, `sprint-004`
- **Depends on**: None

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
- [ ] electron/services/db/llmSettingsDbService.ts
- [ ] electron/services/db/__tests__/llmSettingsDbService.test.ts

Files modified:
- [ ] electron/services/databaseService.ts
- [ ] electron/types/models.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
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

---

## SR Engineer Review Notes

**Review Date:** 2025-12-17 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** int/schema-foundation
- **Suggested Branch Name:** feature/TASK-302-llm-settings-table

### Execution Classification
- **Parallel Safe:** Yes (with TASK-301, TASK-303, TASK-304)
- **Depends On:** None
- **Blocks:** TASK-305 (Migration Testing), TASK-308 (Token Tracking), TASK-311 (Config Service)

### Shared File Analysis
- Files modified:
  - `electron/services/databaseService.ts` (Migration 008 - llm_settings table)
  - `electron/types/models.ts` (LLMSettings interface)
- Files created:
  - `electron/services/db/llmSettingsDbService.ts`
  - `electron/services/db/__tests__/llmSettingsDbService.test.ts`
- Conflicts with:
  - TASK-301: Both modify `databaseService.ts` (Migration 008) - **MERGE ORDER CRITICAL**
  - TASK-303: Both modify `databaseService.ts` (Migration 008) - **MERGE ORDER CRITICAL**
  - TASK-301, TASK-303: All modify `models.ts` - Additive, low conflict risk

### Technical Considerations
- New llm_settings table with foreign key to users_local
- API keys stored encrypted - encryption happens in config service (TASK-311)
- SQLite booleans as INTEGER (0/1), mapped to boolean in TypeScript
- llmSettingsDbService requires >60% test coverage per sprint requirements
- Monthly usage reset logic included in service methods
- **Merge Order:** Can merge in any order with 301-304, but must resolve databaseService.ts conflicts during integration merge

### Integration Branch Note
- Integration branch `int/schema-foundation` must be created from `develop` before parallel execution begins
