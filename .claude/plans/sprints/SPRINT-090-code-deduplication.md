# SPRINT-090: Code Deduplication & Consolidation

**Created:** 2026-02-21
**Status:** Planning
**Base:** `develop`
**Deadline:** Monday 2026-02-23 (Phase 1 CRITICAL)

---

## Sprint Goal

Fix 4 remaining buggy `normalizePhone` implementations that destroy email handles (CRITICAL -- blocks Monday testing), then consolidate duplicated utility functions across renderer and export services, and investigate/split oversized service files where beneficial.

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
| BACKLOG-766 | sanitizeFilename() dedup (emailAttachmentService + enhancedExportService) | TASK-2031 | 3a | ~30K | - | Pending |
| BACKLOG-767 | Investigate and split oversized service files | TASK-2032 | 3b | ~80K | - | Pending |

**Total Estimated Tokens:** ~290K (engineering) + ~50K (SR review) = ~340K

---

## Out of Scope

- **sanitizeHtml()** -- 2 versions exist but differ by design (one strips cid: image refs). Not a bug. Leave as-is.
- **Adding new unit tests for renderer utilities** -- Not blocking; can be a follow-up sprint.
- **SQLite worker thread migration** (BACKLOG-497) -- May subsume databaseService refactor but is a separate, larger effort.
- **Full databaseService.ts refactor** (BACKLOG-193) -- If investigation shows it is a thin facade, defer to BACKLOG-193/497.

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

### Phase 3a: sanitizeFilename Dedup (Sequential after Phase 2)

```
Phase 3a: Filename Sanitization Dedup (after Phase 2 merged)
+-- TASK-2031: Extract sanitizeFilename() from 2 services (BACKLOG-766)
|   1. Read both implementations (emailAttachmentService.ts:63, enhancedExportService.ts:629)
|   2. Pick the more robust version
|   3. Extract to electron/utils/fileUtils.ts (or exportUtils.ts if it fits)
|   4. Update both services to import from shared module
|
+-- CI gate: type-check, lint, test pass
+-- SR review + merge
```

**Files modified (electron only):**
- emailAttachmentService.ts, enhancedExportService.ts
- New: electron/utils/fileUtils.ts (or addition to exportUtils.ts)

### Phase 3b: Investigate and Split Oversized Services (Sequential after 3a)

```
Phase 3b: Investigation-First Service Splitting (after TASK-2031 merged)
+-- TASK-2032: Investigate 5 oversized service files (BACKLOG-767)
|   PHASE 1 (Read-Only Investigation):
|   1. Assess folderExportService.ts (~2,599 lines)
|   2. Assess transactionService.ts (~2,083 lines)
|   3. Assess macOSMessagesImportService.ts (~1,966 lines)
|   4. Assess contactDbService.ts (~1,719 lines)
|   5. Assess databaseService.ts (~1,667 lines)
|   6. Document findings + recommendations
|   7. STOP -- report to PM before proceeding
|
|   PHASE 2 (Conditional Implementation):
|   8. Split only services approved by PM
|   9. Each split = separate commit
|   10. Maintain backward compat via index.ts re-exports
|
+-- CI gate: type-check, lint, test pass
+-- SR review + merge
```

**Why investigation-first:** These are high-risk refactors touching core services. Some may not need splitting after recent work (TASK-2030 reduced folderExportService, databaseService may be a thin facade). Stability before Monday testing is paramount.

**Files potentially modified (electron only):**
- folderExportService.ts, transactionService.ts, macOSMessagesImportService.ts
- contactDbService.ts, databaseService.ts
- New subdirectories for split services (conditional on investigation)

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
Phase 3a:
TASK-2031 (sanitizeFilename dedup)
  |
  v
PR review + merge
  |
  v
Phase 3b:
TASK-2032 (investigate + split oversized services)
  |
  +-- Phase 1: Investigation (read-only)
  |     |
  |     v
  |   PM checkpoint (approve/defer splits)
  |     |
  +-- Phase 2: Implementation (conditional)
  |
  v
PR review + merge
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
| 3a | TASK-2031 (sanitizeFilename dedup) | TASK-2029 + TASK-2030 merged | No |
| 3b | TASK-2032 (investigate oversized services) | TASK-2031 merged | No |

**Why 2a and 2b can be parallel:**
- TASK-2029 only touches `src/` renderer files
- TASK-2030 only touches `electron/` service files
- Zero file overlap between the two tasks
- No shared type definitions being modified

**Why 3a and 3b are sequential:**
- TASK-2031 modifies `enhancedExportService.ts` which TASK-2032 may also need to assess
- TASK-2032 investigation needs to see the post-TASK-2030/2031 state of services to get accurate line counts
- Both touch `electron/services/` files -- sequential avoids merge conflicts

**Why 3b depends on 3a (not just Phase 2):**
- TASK-2031 extracts `sanitizeFilename()` from `enhancedExportService.ts`, changing its line count
- TASK-2032 needs accurate line counts for its investigation phase
- Prevents the investigation from assessing stale data

---

## Merge Plan

| Task | Branch Name | Base | Target | PR | Status |
|------|-------------|------|--------|-----|--------|
| TASK-2028 | `fix/task-2028-normalize-phone-email-bug` | develop | develop | - | Pending |
| TASK-2029 | `refactor/task-2029-renderer-dedup` | develop | develop | - | Pending |
| TASK-2030 | `refactor/task-2030-export-dedup` | develop | develop | - | Pending |
| TASK-2031 | `refactor/task-2031-sanitize-filename-dedup` | develop | develop | - | Pending |
| TASK-2032 | `refactor/task-2032-split-oversized-services` | develop | develop | - | Pending |

**Merge order:** TASK-2028 first (CRITICAL), then TASK-2029 and TASK-2030 in any order (parallel-safe), then TASK-2031, then TASK-2032.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| normalizePhone fix breaks phone matching | High | Low | All 4 implementations get the same email guard pattern; existing phone tests still pass |
| messageMatchingService email guard breaks auto-link | High | Low | The guard returns email as-is; phone paths unchanged |
| Renderer utility extraction breaks imports | Low | Low | Vite handles src/ imports cleanly; type-check catches |
| Export escapeHtml consolidation changes output | Medium | Low | Both versions produce identical output for standard HTML entities |
| Parallel merge conflict between 2a and 2b | None | None | Zero file overlap verified |
| sanitizeFilename implementations differ materially | Low | Low | Read both before extracting; pick the more robust version |
| Oversized service split breaks consumers | High | Medium | Investigation-first pattern; PM checkpoint before implementation; each split is a separate commit for easy revert |
| Oversized service split destabilizes Monday testing | High | Low | Phase 3 is after Phases 1-2; investigation may result in deferring all splits |
| Investigation finds no services need splitting | Low | Low | Valid outcome; document reasoning and defer to existing backlog items |

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-2028 | Update phoneUtils.test.ts, phoneNormalization.test.ts, messageMatchingService.test.ts with email handle cases | N/A | Auto-link with email-handle contact still works |
| TASK-2029 | Existing component tests still pass; add tests for new utility modules | N/A | UI renders correctly; no visual regression |
| TASK-2030 | Existing export tests still pass; add tests for exportUtils | N/A | Export output identical before/after |
| TASK-2031 | Existing tests still pass | N/A | Email attachment + export filenames unchanged |
| TASK-2032 | All existing service tests still pass after each split; CI between splits | N/A | Core service behavior unchanged; imports still resolve |

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
| TASK-2031 | refactor | ~30K | x1.0 | ~30K | ~5K |
| TASK-2032 | refactor | ~80K | x1.0 | ~80K | ~15K |
| **Totals** | | | | **~280K** | **~50K** |

**Grand total: ~330K estimated billable tokens.**

Note: Minimum ~50K estimate per agent task (lesson from SPRINT-088). TASK-2031 is estimated at ~30K because it is a single-function extraction touching only 2 files. TASK-2032 is estimated at ~80K because investigation across 5 services takes significant read time, plus conditional implementation of splits. If investigation results in deferring most splits, actual may be closer to ~40K.

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

Phase 1 (TASK-2028) MUST be merged before Monday 2026-02-23 to avoid email-handle auto-linking failures during user testing. Phases 2a and 2b are desirable but not blocking Monday testing. Phase 3 is best-effort before Monday -- if time is tight, defer TASK-2032 implementation to a follow-up sprint and keep only the investigation findings.

### Phase 3: Consolidation Items (Added 2026-02-21)

Two additional consolidation items identified during sprint planning:

- **TASK-2031 (Small):** `sanitizeFilename()` is duplicated in `emailAttachmentService.ts` and `enhancedExportService.ts`. Simple extraction to shared utility.

- **TASK-2032 (Large, Investigation-First):** 5 services exceed maintainability thresholds but some may already be manageable after recent refactoring. Uses investigation-first pattern -- read-only assessment before any implementation. Related to BACKLOG-738, BACKLOG-497, BACKLOG-193 which may overlap or supersede.

### Related Backlog Items

| Backlog Item | Relationship to Phase 3 |
|--------------|-------------------------|
| BACKLOG-738 | Split oversized service files -- overlaps with TASK-2032 |
| BACKLOG-497 | SQLite worker thread -- may subsume databaseService refactor |
| BACKLOG-193 | Refactor databaseService.ts -- may be deferred in favor of BACKLOG-497 |
