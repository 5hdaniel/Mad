# TASK-2032: Investigate and Split Oversized Service Files

**Backlog ID:** BACKLOG-767
**Sprint:** SPRINT-090
**Phase:** 3b (Sequential after TASK-2031)
**Branch:** `refactor/task-2032-split-oversized-services`
**Estimated Tokens:** ~80K
**Token Cap:** ~320K (4x estimate)

---

## Objective

Investigate 5 oversized service files to determine which genuinely need splitting after recent refactoring work, then implement splits for those that do. This is a pure refactoring task -- no logic changes.

**IMPORTANT:** This task uses the investigation-first pattern. Phase 1 is read-only assessment. Implementation only proceeds for services that clearly need splitting.

---

## Context

SPRINT-089 closure identified 5 services exceeding maintainability thresholds. However, several may already be partially addressed:

- `databaseService.ts` was noted as "already refactored into facade pattern" in SPRINT-089
- `folderExportService.ts` just had utilities extracted by TASK-2030
- BACKLOG-738 covers the same split for 3 of these services
- BACKLOG-497 (SQLite worker thread) may subsume `databaseService.ts` refactor
- BACKLOG-193 targeted `databaseService.ts` when it was 1,223 lines

**Risk:** These are core services with many consumers. Stability before Monday testing is paramount. If a split is too risky, defer it.

---

## Prerequisites

**Depends on:** TASK-2031 (sanitizeFilename dedup) must be merged first to avoid branch conflicts on `enhancedExportService.ts`.

**Conditional:** Individual service splits may be SKIPPED if investigation finds:
- The service is already manageable after recent refactoring
- The service is a facade with low complexity per method
- The split would create too many tiny files without clear benefit
- Test coverage is insufficient to safely refactor

---

## Requirements

### Phase 1: Investigation (Read-Only)

For each of the 5 services, document:

| Assessment Item | How to Check |
|-----------------|--------------|
| Current line count | `wc -l <file>` |
| Number of exported functions/methods | `grep -c "export\|public\|async " <file>` |
| Number of consumers (importers) | `grep -r "from.*<service>" --include="*.ts" \| wc -l` |
| Existing test coverage | Check for `<service>.test.ts` |
| Distinct concern groups | Read the file, identify logical groupings |
| Recent changes from TASK-2030 | Check if line count reduced |
| Risk level (High/Medium/Low) | Based on consumers + test coverage |

**Services to investigate:**

1. **`electron/services/folderExportService.ts`** (~2,599 lines)
   - Concerns: Export orchestration + contact resolution + PDF generation + attachment manifest
   - Check: How much was removed by TASK-2030?

2. **`electron/services/transactionService.ts`** (~2,083 lines)
   - Concerns: CRUD + email fetch + message parsing + extraction
   - Check: Is it a facade? What are the logical groups?

3. **`electron/services/macOSMessagesImportService.ts`** (~1,966 lines)
   - Concerns: Chat.db parsing + filtering + validation + DB persistence
   - Check: Is the parsing tightly coupled to persistence?

4. **`electron/services/contactDbService.ts`** (~1,719 lines)
   - Concerns: CRUD + phone/email lookup + dedup + activity tracking
   - Check: Natural split points between CRUD and lookup logic?

5. **`electron/services/databaseService.ts`** (~1,667 lines)
   - Concerns: Catch-all facade over specialized db services
   - Check: If it is truly a facade (thin delegation), it may not need splitting
   - Note: BACKLOG-193 and BACKLOG-497 may be better vehicles for this refactor

### Phase 1 Output

Create an investigation summary in this task file's Implementation Summary section with a recommendation table:

```markdown
| Service | Current Lines | Risk | Recommendation | Reason |
|---------|--------------|------|----------------|--------|
| folderExportService | XXXX | High/Med/Low | Split / Defer / Skip | ... |
| transactionService | XXXX | High/Med/Low | Split / Defer / Skip | ... |
| ... | ... | ... | ... | ... |
```

**STOP HERE** and report findings to PM before proceeding to Phase 2.

### Phase 2: Implementation (Conditional)

For each service recommended for splitting:

1. **Each service split is its own commit** (allows individual revert if needed)
2. **Create sub-modules** in a subdirectory pattern:
   ```
   electron/services/folderExport/
     index.ts           (re-exports, maintains backward compatibility)
     exportOrchestrator.ts
     contactResolver.ts
     attachmentManifest.ts
   ```
3. **Maintain backward compatibility** -- the original import path must still work via `index.ts` re-exports
4. **Run CI after each split** (`npm run type-check && npm run lint && npm test`)

### Must NOT Do:

- Do NOT change any function logic or behavior
- Do NOT modify any `src/` renderer files
- Do NOT rename public API functions
- Do NOT change function signatures
- Do NOT combine this with any feature work
- Do NOT split a service if investigation shows it is manageable
- Do NOT split `databaseService.ts` if it is truly a thin facade (defer to BACKLOG-193/497)

---

## Acceptance Criteria

### Phase 1 (Investigation):
- [ ] All 5 services assessed with current line counts
- [ ] Consumer count documented for each service
- [ ] Risk level assigned to each service
- [ ] Recommendation table completed in Implementation Summary
- [ ] PM notified of findings before proceeding

### Phase 2 (Implementation -- conditional):
- [ ] Only services approved by PM after investigation are split
- [ ] Each split is a separate commit
- [ ] Original import paths still work (backward compatibility via index.ts)
- [ ] `npm run type-check` passes after each split
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No functional changes -- pure file reorganization

---

## Files to Read (Phase 1)

| File | Why |
|------|-----|
| `electron/services/folderExportService.ts` | Assess current state, line count, concerns |
| `electron/services/transactionService.ts` | Assess current state, line count, concerns |
| `electron/services/macOSMessagesImportService.ts` | Assess current state, line count, concerns |
| `electron/services/contactDbService.ts` | Assess current state, line count, concerns |
| `electron/services/databaseService.ts` | Assess facade pattern, actual complexity |

---

## Implementation Notes

### Investigation Approach

For each service, answer these questions:

1. **Is it truly oversized, or is it a well-organized large file?**
   - A 2000-line file with 40 related methods may be fine
   - A 1500-line file mixing 4 unrelated concerns needs splitting

2. **What is the test coverage?**
   - High coverage = safer to split
   - No tests = risky refactor, consider deferring

3. **How many files import from this service?**
   - Many consumers = higher risk of breaking changes
   - Few consumers = safer to refactor

4. **Are there natural split boundaries?**
   - Clear concern groups = easy split
   - Tightly coupled methods = difficult split, may not be worth it

### Recommended Split Patterns

**Subdirectory pattern (preferred for large splits):**
```
electron/services/transactionService/
  index.ts              # Re-exports everything for backward compat
  transactionCrud.ts    # Create, read, update, delete
  emailFetch.ts         # Email fetching and sync
  messageParsing.ts     # Message parsing and extraction
```

**Companion file pattern (for smaller splits):**
```
electron/services/contactDbService.ts        # Core CRUD
electron/services/contactLookupService.ts    # Phone/email lookup + dedup
```

### Deferral Criteria

Defer a service split if ANY of these are true:
- The service has 0 test files
- The service has > 20 consumers
- Recent refactoring (TASK-2030) has already reduced it below ~1,500 lines
- The service is a thin facade with < 10 lines per method on average
- A better backlog item exists for a more comprehensive refactor (e.g., BACKLOG-497 for worker threads)

---

## Testing Expectations

### Phase 1 (Investigation)
- No tests needed -- read-only

### Phase 2 (Implementation)
- **Required:** All existing tests still pass after each split
- **Required:** `npm run type-check` passes after each split
- **Optional:** Add a simple smoke test for each new sub-module's exports
- **Critical:** Run full CI after each service split, before proceeding to the next

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `refactor: split oversized service files into focused sub-modules`
- **Branch:** `refactor/task-2032-split-oversized-services`
- **Target:** `develop`

If investigation results in fewer than 5 splits, adjust PR title to reflect actual scope (e.g., `refactor: split folderExportService and transactionService into sub-modules`).

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Phase 1: Investigation Results

| Service | Current Lines | Exports | Consumers | Tests | Risk | Recommendation | Reason |
|---------|--------------|---------|-----------|-------|------|----------------|--------|
| folderExportService | - | - | - | - | - | - | - |
| transactionService | - | - | - | - | - | - | - |
| macOSMessagesImportService | - | - | - | - | - | - | - |
| contactDbService | - | - | - | - | - | - | - |
| databaseService | - | - | - | - | - | - | - |

**PM Approval:** [ ] Approved to proceed with: ___

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Phase 1 (Investigation):
- [ ] All 5 services assessed
- [ ] Investigation table completed above
- [ ] PM notified with findings
- [ ] PM approved scope

Phase 2 (Implementation):
- [ ] Service splits implemented (per PM approval)
- [ ] Each split is a separate commit
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: ~80K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Any service has 0 test files and > 10 consumers (high-risk split)
- Investigation shows a service is tightly coupled with no clear split boundaries
- `databaseService.ts` turns out to NOT be a facade (more complex than expected)
- Phase 1 findings suggest ALL 5 services should be deferred
- Phase 1 findings suggest a service needs feature-level changes, not just file splitting
- You discover circular dependencies between services
- Any split causes > 5 test failures
- You encounter blockers not covered in the task file
