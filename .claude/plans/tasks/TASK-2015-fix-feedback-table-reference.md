# TASK-2015: Fix feedbackService table reference mismatch

**Backlog ID:** BACKLOG-365
**Sprint:** SPRINT-088
**Phase:** Phase 1 (Parallel - service file, no overlap with other tasks)
**Branch:** `fix/task-2015-fix-feedback-table-reference`
**Estimated Tokens:** ~8K

---

## Objective

Fix `feedbackDbService.ts` which queries a non-existent `user_feedback` table. The actual table in `schema.sql` is `classification_feedback`. All SQL queries in the service must be updated to reference the correct table and column names.

---

## Context

### Investigation Findings

**Service file references `user_feedback` (does not exist):**
- `electron/services/db/feedbackDbService.ts` line 20: `INSERT INTO user_feedback`
- `electron/services/db/feedbackDbService.ts` line 41: `SELECT * FROM user_feedback WHERE id = ?`
- `electron/services/db/feedbackDbService.ts` line 58: `SELECT * FROM user_feedback`
- `electron/services/db/feedbackDbService.ts` line 75: `SELECT * FROM user_feedback`
- `electron/services/db/feedbackDbService.ts` line 92: `SELECT * FROM user_feedback`
- `electron/services/db/feedbackDbService.ts` line 107: `SELECT * FROM user_feedback WHERE id = ?`
- `electron/services/db/feedbackDbService.ts` line 116: `DELETE FROM user_feedback WHERE id = ?`

**Higher-level service also mentions `user_feedback`:**
- `electron/services/feedbackService.ts` line 8: `* This service adapts to the existing user_feedback table schema:`
- `electron/services/feedbackService.ts` line 247: `* Queries user_feedback table filtering by LLM-specific field_names`

**Actual table in schema (line 616):** `classification_feedback`
- Columns: `id`, `user_id`, `message_id`, `attachment_id`, `transaction_id`, `contact_id`, `feedback_type`, `original_value`, `corrected_value`, `reason`, `created_at`

**Other files referencing `classification_feedback` correctly:**
- `electron/handlers/sessionHandlers.ts` line 612 (reset handler)

### Column Name Alignment Risk

The `feedbackDbService.ts` INSERT statement (line 20) may use column names that don't match the `classification_feedback` schema. Engineer must compare the INSERT columns with the actual table definition at schema.sql line 616-643.

---

## Requirements

### Must Do

1. **Replace all `user_feedback` references** in `feedbackDbService.ts` with `classification_feedback`
2. **Verify column name alignment:** Compare INSERT/SELECT column names in feedbackDbService.ts against the `classification_feedback` table definition in schema.sql
3. **Update comments** in `feedbackService.ts` (lines 8, 247) that mention `user_feedback`
4. **Search entire codebase** for any other `user_feedback` references and update them
5. **Add or verify a basic test** that the feedback service can insert and query

### Must NOT Do

- Do NOT rename the `classification_feedback` table
- Do NOT modify the schema table definition
- Do NOT change the public API of feedbackService

### Acceptance Criteria

- [ ] Zero references to `user_feedback` in production code
- [ ] All feedbackDbService queries reference `classification_feedback`
- [ ] Column names in queries match schema definition
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/db/feedbackDbService.ts` | Replace all `user_feedback` with `classification_feedback`, verify columns |
| `electron/services/feedbackService.ts` | Update comments mentioning `user_feedback` |

---

## Implementation Summary

_To be filled by Engineer after implementation._

| Field | Value |
|-------|-------|
| Agent ID | |
| Branch | |
| PR | |
| Files Changed | |
| Tests Added/Modified | |
| Actual Tokens | |
