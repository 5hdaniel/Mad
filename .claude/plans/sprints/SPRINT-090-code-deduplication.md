# SPRINT-090: Code Deduplication & Consolidation

**Created:** 2026-02-21
**Status:** Planning
**Base:** `develop`
**Deadline:** Monday 2026-02-23 (Phase 1 CRITICAL)

---

## Sprint Goal

Fix 4 remaining buggy `normalizePhone` implementations that destroy email handles (CRITICAL -- blocks Monday testing), then consolidate duplicated utility functions across renderer and export services.

## Sprint Narrative

During SPRINT-089 Phase 8 (TASK-2027), the shared `normalizePhone()` in `contactResolutionService.ts` was fixed to preserve email handles. However, 4 other implementations of the same function across the codebase still have the email-destroying bug (`email.replace(/\D/g, '') -> ""`). The most dangerous is in `messageMatchingService.ts`, which powers auto-linking of messages to transactions.

Beyond the critical phone normalization fix, SPRINT-089 closure identified 9 cosmetic duplication issues across renderer components and export services. These are low risk but reduce maintainability. Phase 2 addresses them in two parallel tasks (renderer vs electron), grouped to avoid file conflicts.

---

## In-Scope

| ID | Title | Task | Phase | Est Tokens | Actual Tokens | Status |
|----|-------|------|-------|-----------|---------------|--------|
| BACKLOG-756 | Fix normalizePhone email bug in 4 remaining implementations | TASK-2028 | 1 | ~60K | - | Pending |
| BACKLOG-757, 762, 763, 764, 765 | Renderer-side utility deduplication | TASK-2029 | 2a | ~60K | - | Pending |
| BACKLOG-758, 759, 760, 761 | Export service utility deduplication | TASK-2030 | 2b | ~60K | - | Pending |

**Total Estimated Tokens:** ~180K (engineering) + ~30K (SR review) = ~210K

---

## Out of Scope

- **sanitizeHtml()** -- 2 versions exist but differ by design (one strips cid: image refs). Not a bug. Leave as-is.
- **Refactoring export services into smaller files** -- Related but different scope (see BACKLOG-738).
- **Adding new unit tests for renderer utilities** -- Not blocking; can be a follow-up sprint.

---

## Phase Plan

### Phase 1: Fix normalizePhone Email Bug (CRITICAL -- Before Monday)

```
Phase 1: Critical Bug Fix (Sequential)
+-- TASK-2028: Fix 4 remaining normalizePhone implementations (BACKLOG-756)
|   1. electron/utils/phoneUtils.ts normalizePhoneNumber() -- add email guard
|   2. electron/utils/phoneNormalization.ts normalizePhoneNumber() -- add email guard
|   3. electron/services/messageMatchingService.ts normalizePhone() -- add email guard
|   4. src/utils/threadMergeUtils.ts normalizePhone() -- add email guard
|   5. Update existing unit tests (phoneUtils.test.ts, phoneNormalization.test.ts, messageMatchingService.test.ts)
|   6. Add email handle test cases to each
|
+-- CI gate: type-check, lint, test pass
+-- SR review + merge
```

**Why Phase 1 is CRITICAL:** `messageMatchingService.ts` powers `autoLinkService.ts`. When auto-linking processes a transaction contact whose iMessage handle is an email, `normalizePhone("user@icloud.com")` returns `null` (after stripping to empty string), causing the message to silently fail to auto-link. This is a data integrity issue that must be fixed before Monday testing.

### Phase 2a: Renderer-Side Utility Deduplication (Parallel with 2b)

```
Phase 2a: Renderer Deduplication (after Phase 1 merged)
+-- TASK-2029: Extract duplicated renderer utilities (BACKLOG-757, 762, 763, 764, 765)
|   1. Create src/utils/formatUtils.ts -- formatFileSize()
|   2. Create src/utils/dateRangeUtils.ts -- formatDateRangeLabel(), formatDateRange()
|   3. Create src/utils/emailParticipantUtils.ts -- filterSelfFromParticipants(), formatParticipants()
|   4. Create src/utils/messageFormatUtils.ts -- isEmptyOrReplacementChar(), formatMessageTime()
|   5. Extract getAvatarInitial() into src/utils/avatarUtils.ts
|   6. Update all consuming components to import from shared modules
|
+-- CI gate: type-check, lint, test pass
+-- SR review + merge
```

**Files modified (renderer only -- no electron files):**
- AttachmentCard.tsx, EmailViewModal.tsx, AttachmentPreviewModal.tsx, EmailThreadViewModal.tsx
- TransactionMessagesTab.tsx, ConversationViewModal.tsx
- AttachEmailsModal.tsx, EmailThreadCard.tsx
- MessageBubble.tsx, MessageThreadCard.tsx

### Phase 2b: Export Service Utility Deduplication (Parallel with 2a)

```
Phase 2b: Export Service Deduplication (after Phase 1 merged)
+-- TASK-2030: Extract duplicated export utilities (BACKLOG-758, 759, 760, 761)
|   1. Create electron/utils/exportUtils.ts -- escapeHtml(), formatCurrency(), formatDate(), formatDateTime()
|   2. Update pdfExportService.ts to import from shared module
|   3. Update folderExportService.ts to import from shared module
|   4. Consolidate getContactNamesByPhones() inline SQL into shared helper
|
+-- CI gate: type-check, lint, test pass
+-- SR review + merge
```

**Files modified (electron only -- no renderer files):**
- pdfExportService.ts, folderExportService.ts
- New: electron/utils/exportUtils.ts

---

## Dependency Graph

```
Phase 1:
TASK-2028 (fix normalizePhone x4) -----> PR review + merge    [CRITICAL]
                                            |
                  +-------------------------+
                  |                         |
                  v                         v
Phase 2a:                          Phase 2b:
TASK-2029 (renderer dedup)         TASK-2030 (export dedup)
  |                                  |
  v                                  v
PR review + merge                  PR review + merge
  |                                  |
  +----------------+-----------------+
                   |
                   v
            Sprint Complete
```

**Execution Order:**

| Order | Task | Depends On | Parallel? |
|-------|------|------------|-----------|
| 1 | TASK-2028 (normalizePhone fix) | None | No |
| 2a | TASK-2029 (renderer dedup) | TASK-2028 merged | Yes (with 2b) |
| 2b | TASK-2030 (export dedup) | TASK-2028 merged | Yes (with 2a) |

**Why 2a and 2b can be parallel:**
- TASK-2029 only touches `src/` renderer files
- TASK-2030 only touches `electron/` service files
- Zero file overlap between the two tasks
- No shared type definitions being modified

---

## Merge Plan

| Task | Branch Name | Base | Target | PR | Status |
|------|-------------|------|--------|-----|--------|
| TASK-2028 | `fix/task-2028-normalize-phone-email-bug` | develop | develop | - | Pending |
| TASK-2029 | `refactor/task-2029-renderer-dedup` | develop | develop | - | Pending |
| TASK-2030 | `refactor/task-2030-export-dedup` | develop | develop | - | Pending |

**Merge order:** TASK-2028 first (CRITICAL), then TASK-2029 and TASK-2030 in any order (parallel-safe).

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| normalizePhone fix breaks phone matching | High | Low | All 4 implementations get the same email guard pattern; existing phone tests still pass |
| messageMatchingService email guard breaks auto-link | High | Low | The guard returns email as-is; phone paths unchanged |
| Renderer utility extraction breaks imports | Low | Low | Vite handles src/ imports cleanly; type-check catches |
| Export escapeHtml consolidation changes output | Medium | Low | Both versions produce identical output for standard HTML entities |
| Parallel merge conflict between 2a and 2b | None | None | Zero file overlap verified |

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-2028 | Update phoneUtils.test.ts, phoneNormalization.test.ts, messageMatchingService.test.ts with email handle cases | N/A | Auto-link with email-handle contact still works |
| TASK-2029 | Existing component tests still pass; add tests for new utility modules | N/A | UI renders correctly; no visual regression |
| TASK-2030 | Existing export tests still pass; add tests for exportUtils | N/A | Export output identical before/after |

### CI Gates

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No regressions in existing tests

---

## Task Sizing Rationale

| Task | Category | Base Est | Multiplier | Final Est | SR Overhead |
|------|----------|----------|------------|-----------|-------------|
| TASK-2028 | bug fix | ~50K | x1.0 | ~50K | ~10K |
| TASK-2029 | refactor | ~60K | x1.0 | ~60K | ~10K |
| TASK-2030 | refactor | ~60K | x1.0 | ~60K | ~10K |
| **Totals** | | | | **~170K** | **~30K** |

**Grand total: ~200K estimated billable tokens.**

Note: Minimum ~50K estimate per agent task (lesson from SPRINT-088). Phase 2 tasks each touch 5-10 files across multiple utility extractions, justifying the ~60K estimate.

---

## PM Status Update Checkpoints

PM updates status at each transition across ALL three locations:

1. `.claude/plans/backlog/data/backlog.csv` -- status column (source of truth)
2. `.claude/plans/backlog/items/BACKLOG-XXX.md` -- if detail file exists, update status there too
3. This sprint file -- In-Scope table Status column

| When | Status | Trigger |
|------|--------|---------|
| Engineer agent assigned | In Progress | PM kicks off engineer |
| PR created + CI passes | Testing | SR notifies PM |
| PR merged | Completed | SR confirms merge |

**Valid CSV statuses:** `Pending`, `In Progress`, `Testing`, `Completed`, `Deferred`

---

## Notes

### Connection to SPRINT-089

SPRINT-089 Phase 8 (TASK-2027) fixed `normalizePhone` in `contactResolutionService.ts` and consolidated some duplication. However, 4 other implementations of the same function were not updated, and 9 cosmetic duplication issues were identified during sprint closure but deferred to this sprint.

### Monday Testing Deadline

Phase 1 (TASK-2028) MUST be merged before Monday 2026-02-23 to avoid email-handle auto-linking failures during user testing. Phases 2a and 2b are desirable but not blocking Monday testing.
