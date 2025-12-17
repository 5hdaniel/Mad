# BACKLOG-073: AI MVP Phase 0 - Schema Foundation

**Priority:** Critical
**Type:** Database / Architecture
**Sprint:** SPRINT-004 (after SPRINT-003 completes)
**Estimated Effort:** 22 turns (~1.5h)
**Dependencies:** BACKLOG-038, BACKLOG-039 (must complete first)

---

## Description

Add database schema foundation for AI Transaction Auto-Detection MVP. This phase creates the necessary tables and fields for LLM integration, detection tracking, and user consent.

**Note:** ~40% of originally planned schema work is already done. This backlog item covers only net-new implementations.

---

## Tasks

### S01: Add Detection Fields to Transactions Table (Partial)
**Estimated:** 5 turns

Add columns for AI detection tracking:
```sql
ALTER TABLE transactions ADD COLUMN detection_source TEXT DEFAULT 'manual'
  CHECK (detection_source IN ('manual', 'auto', 'hybrid'));
ALTER TABLE transactions ADD COLUMN detection_status TEXT DEFAULT 'confirmed'
  CHECK (detection_status IN ('pending', 'confirmed', 'rejected'));
ALTER TABLE transactions ADD COLUMN detection_confidence REAL;
ALTER TABLE transactions ADD COLUMN detection_method TEXT;
ALTER TABLE transactions ADD COLUMN suggested_contacts TEXT;  -- JSON
ALTER TABLE transactions ADD COLUMN reviewed_at DATETIME;
ALTER TABLE transactions ADD COLUMN rejection_reason TEXT;
```

**Acceptance Criteria:**
- [ ] Migration adds all columns with proper defaults
- [ ] Existing transactions unaffected (default: manual, confirmed)
- [ ] TypeScript types updated in `electron/types/models.ts`

### S02: Create llm_settings Table
**Estimated:** 5 turns

New table for API key management and usage tracking:
```sql
CREATE TABLE llm_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  openai_api_key_encrypted TEXT,
  anthropic_api_key_encrypted TEXT,
  preferred_provider TEXT DEFAULT 'openai',
  openai_model TEXT DEFAULT 'gpt-4o-mini',
  anthropic_model TEXT DEFAULT 'claude-3-haiku-20240307',
  tokens_used_this_month INTEGER DEFAULT 0,
  budget_limit_tokens INTEGER,
  budget_reset_date DATE,
  platform_allowance_tokens INTEGER DEFAULT 0,
  platform_allowance_used INTEGER DEFAULT 0,
  use_platform_allowance INTEGER DEFAULT 0,
  enable_auto_detect INTEGER DEFAULT 1,
  enable_role_extraction INTEGER DEFAULT 1,
  llm_data_consent INTEGER DEFAULT 0,
  llm_data_consent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE
);
```

**Acceptance Criteria:**
- [ ] Table created with all columns
- [ ] Foreign key to users_local works
- [ ] TypeScript LLMSettings interface added

### S05-Partial: Add llm_analysis Field to Messages
**Estimated:** 3 turns

Add single column for storing full LLM analysis response:
```sql
ALTER TABLE messages ADD COLUMN llm_analysis TEXT;  -- JSON
```

**Note:** Other classification fields already exist (`classification_method`, `classification_confidence`).

**Acceptance Criteria:**
- [ ] Column added to messages table
- [ ] Existing messages unaffected

### S07: Supabase Platform Allowance Schema
**Estimated:** 3 turns

Add to Supabase users table (cloud migration):
```sql
ALTER TABLE users ADD COLUMN llm_monthly_allowance INTEGER DEFAULT 50000;
ALTER TABLE users ADD COLUMN llm_allowance_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN llm_allowance_reset_date DATE;
```

**Acceptance Criteria:**
- [ ] Supabase migration created
- [ ] Fields accessible via Supabase client

### S08: Migration Testing
**Estimated:** 6 turns

Test Migration 008 on both fresh and existing databases.

**Acceptance Criteria:**
- [ ] Migration runs without errors on fresh database
- [ ] Migration runs without errors on database with existing transactions
- [ ] All new columns have proper defaults
- [ ] Rollback tested (if applicable)

---

## Already Implemented (Skipped)

| Original Task | Status | Location |
|---------------|--------|----------|
| S03: classification_feedback table | EXISTS | `user_feedback` table covers this use case |
| S04: attachments table | EXISTS | `has_attachments` field + metadata pattern |
| S05: communications classification | EXISTS | `classification_method`, `classification_confidence` on messages |
| S06: contacts engagement fields | EXISTS | `last_inbound_at`, `last_outbound_at`, `total_messages`, `tags` |

---

## Quality Gate: Schema Ready

Before marking complete, verify:
- [ ] Migration 008 runs on fresh DB
- [ ] Migration 008 runs on existing DB with data
- [ ] All new columns have proper defaults
- [ ] TypeScript types match database schema exactly
- [ ] No regression in existing functionality

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/databaseService.ts` | Add Migration 008 |
| `electron/types/models.ts` | Add detection types, LLMSettings interface |
| `electron/database/schema.sql` | Document new schema (reference) |

## Files to Create

| File | Purpose |
|------|---------|
| `electron/services/db/llmSettingsDbService.ts` | CRUD for llm_settings table |

---

## Security Considerations

- API keys must be encrypted using `databaseEncryptionService`
- `llm_data_consent` flag required before sending data to LLM providers
- Consent timestamp (`llm_data_consent_at`) for compliance audit trail

---

## Metrics Tracking

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation | - | - | - |
| PR Review | - | - | - |
| Debugging/Fixes | - | - | - |
| **Total** | - | - | - |

*Fill in after completion*
