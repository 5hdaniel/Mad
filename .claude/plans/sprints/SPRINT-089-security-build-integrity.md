# SPRINT-089: Security & Build Integrity

**Created:** 2026-02-20
**Status:** Completed
**Completed:** 2026-02-21
**Base:** `develop`

---

## Sprint Goal

Address security vulnerabilities and build integrity issues deferred from SPRINT-087, plus fix user-reported bugs (address autocomplete configuration, messages tab reactivity, group chat participant resolution) and message system improvements.

## Sprint Narrative

This sprint combines security/build hardening deferred from SPRINT-087's due diligence audit with user-reported bugs and message system improvements. Phase 1 and Phase 2 address build security (source map leakage) and dependency security (imessage-parser vulnerability chain). Phase 3 was an infrastructure-only fix (Google Places API billing). Phase 4 addresses a UI reactivity bug in the Messages tab. Phase 5 unifies the channel/communication_type naming inconsistency across the codebase. Phase 6 merges duplicate 1:1 message threads from the same contact (combining BACKLOG-542 and BACKLOG-748). Phase 7 fixes group chat participant resolution where missing participants and wrong sender attribution occur due to incomplete handle extraction and phone-only contact lookup. Phase 8 consolidates duplicate contact resolution methods across renderer and export services, and fixes a normalizePhone bug that caused email handles to be stripped to empty strings in exports.

All 8 phases are completed. Sprint closed 2026-02-21.

---

## In-Scope

| ID | Title | Task | Phase | Est Tokens | Actual Tokens | Status |
|----|-------|------|-------|-----------|---------------|--------|
| BACKLOG-734 | Prevent source map leakage | TASK-2018 | 1 | ~50K | - | Completed (PR #900 merged) |
| BACKLOG-723 | Remove imessage-parser dependency | TASK-2019 | 2 | ~50K | - | Completed (PR #901 merged) |
| BACKLOG-751 | Google Places address autocomplete | TASK-2022 | 3 | 0 | 0 | Completed (infra fix) |
| BACKLOG-733 | Migrate Google OAuth to PKCE | TASK-2020 | 3.5 | ~30K | - | Completed (PR #902 merged) |
| BACKLOG-752 | Messages tab doesn't update after linking | TASK-2023 | 4 | ~40K | - | Completed (PR #903 merged) |
| BACKLOG-754 | Unify channel/communication_type naming | TASK-2024 | 5 | ~30K | - | Completed (PR #904 merged) |
| BACKLOG-542 + BACKLOG-748 | Merge duplicate 1:1 message threads | TASK-2025 | 6 | ~50K | - | Completed (PR #905 merged) |
| BACKLOG-755 | Extract ContactResolutionService + fix group chat participants | TASK-2026 | 7 | ~80K | - | Completed (PR #906 merged) |
| BACKLOG-755, BACKLOG-756 | Consolidate contact resolution + fix normalizePhone export bug | TASK-2027 | 8 | ~50K | - | Completed (PR #907 merged) |

**Total Estimated Tokens:** ~310K (engineering) + ~15K (SR review Phases 1-2) + ~25K (SR review Phases 4-8) = ~350K

---

## Phase Plan

### Phase 1: Source Map Leakage Fix (Sequential)

```
Phase 1: Build Security
+-- TASK-2018: Prevent source map leakage (BACKLOG-734)
|   1. Add deleteSourceMaps() custom Vite plugin to vite.config.js
|   2. closeBundle hook unconditionally removes .js.map files
|   3. No new dependencies (uses fs.readdirSync with { recursive: true })
|
+-- CI gate: type-check, lint, test pass
+-- SR review: PR #900
```

**Status:** Completed. PR #900 merged.
**Branch:** `fix/task-2018-source-map-leakage`
**Worktree:** Removed.

### Phase 2: Dependency Security (Sequential)

```
Phase 2: Dependency Vulnerability Removal
+-- TASK-2019: Remove imessage-parser dependency (BACKLOG-723)
|   1. Remove imessage-parser from package.json
|   2. Replace with direct implementation or alternative
|   3. Verify iPhone sync still works
|   4. npm audit should show reduced vulnerabilities
|
+-- CI gate: type-check, lint, test pass
+-- SR review: PR #901
```

**Status:** Completed. PR #901 merged.
**Branch:** `fix/task-2019-remove-imessage-parser`
**Worktree:** Removed.

**Why sequential with Phase 1:** Both modify dependency/build configuration. Merging sequentially avoids potential package-lock.json conflicts.

### Phase 3: Address Autocomplete (Completed -- Infrastructure Fix)

```
Phase 3: Google Places API Fix
+-- TASK-2022: Enable billing on Google Cloud (BACKLOG-751)
|   Resolution: User enabled billing at console.cloud.google.com
|   No code change required
|
+-- Verified: Address autocomplete working
```

**Status:** Completed. No PR needed.

### Phase 4: Messages Tab Reactivity Fix (Completed)

```
Phase 4: UI Reactivity Fix (depends on Phases 1-3 merged)
+-- TASK-2023: Fix Messages tab not updating after linking (BACKLOG-752)
|   Investigation-first approach:
|   A. Read useTransactionMessages hook -- how are messages fetched?
|   B. Compare with TransactionEmailsTab -- what pattern does it use?
|   C. Check AttachMessagesModal -- does it trigger refresh callback?
|   D. Implement fix following the Emails tab pattern
|
+-- CI gate: type-check, lint, test pass
+-- SR review: PR #903
+-- Manual test: link message -> tab updates immediately
```

**Status:** Completed. PR #903 merged.
**Branch:** `fix/task-2023-messages-tab-refresh`
**Worktree:** Removed.

### Phase 5: Channel Naming Unification (Completed)

```
Phase 5: Refactor -- Channel/Communication Type Unification (depends on Phase 4 merged)
+-- TASK-2024: Unify channel/communication_type naming (BACKLOG-754)
|   1. Create isTextMessage() and isEmailMessage() helpers in shared utils
|   2. Update ~10 files in src/ and electron/services/ to use helpers
|   3. Remove all direct communication_type string comparisons
|   4. Add unit tests for helpers
|
+-- CI gate: type-check, lint, test pass
+-- SR review
```

**Status:** Completed. PR #904 merged.
**Branch:** `fix/task-2024-unify-channel-naming`
**Task file:** `.claude/plans/tasks/TASK-2024-unify-channel-naming.md`

### Phase 6: Merge Duplicate Message Threads (Completed)

```
Phase 6: Feature -- Merge Duplicate 1:1 Threads (depends on Phase 5 merged)
+-- TASK-2025: Merge duplicate threads from same contact (BACKLOG-542 + BACKLOG-748)
|   1. Investigate current thread grouping logic
|   2. Create contact-based thread merge utility (display-layer only)
|   3. Update TransactionMessagesTab to use merged threads
|   4. Update MessageThreadCard to support merged thread data
|   5. Add unit tests for merge utility
|
+-- CI gate: type-check, lint, test pass
+-- SR review
+-- Manual test: same contact with multiple handles shows as one thread
```

**Status:** Completed. PR #905 merged.
**Branch:** `feature/task-2025-merge-duplicate-threads`
**Task file:** `.claude/plans/tasks/TASK-2025-merge-duplicate-threads.md`

**Files to investigate:**
- `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx`
- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`
- `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts`
- `electron/services/db/communicationDbService.ts`
- `electron/services/macOSMessagesImportService.ts`

**Why depends on Phase 5:** TASK-2025 should use the `isTextMessage()` helpers introduced in TASK-2024 rather than introducing new raw channel comparisons. Both tasks touch `useTransactionMessages.ts`.

### Phase 7: Group Chat Participant Resolution Fix (Pending)

```
Phase 7: Bug Fix -- Group Chat Participants (depends on Phase 5 TASK-2024 merged)
+-- TASK-2026: Fix group chat participant resolution (BACKLOG-755)
|   1. Update extractAllPhones() to also extract from chat_members array
|   2. Update getContactNamesByPhones() to resolve email handles via contact_emails table
|   3. Fix getSenderPhone() in MessageThreadCard and ConversationViewModal for email handles
|   4. Verify formatParticipantNames() and isGroupChat() work with populated contactNames
|
+-- CI gate: type-check, lint, test pass
+-- SR review
+-- Manual test: group chat shows all participants; correct sender attribution
```

**Status:** Completed. PR #906 merged.
**Branch:** `fix/task-2026-group-chat-participants`
**Task file:** `.claude/plans/tasks/TASK-2026-fix-group-chat-participants.md`

**Why depends on Phase 5:** TASK-2026 should use the `isTextMessage()` helper introduced in TASK-2024. Both TASK-2025 (Phase 6) and TASK-2026 touch `TransactionMessagesTab.tsx`, so Phase 7 runs after Phase 6 to avoid merge conflicts.

### Phase 8: Consolidate Contact Resolution & Fix normalizePhone Export Bug (Completed)

```
Phase 8: Refactor + Bug Fix -- Contact Resolution Consolidation (depends on Phase 7 TASK-2026 merged)
+-- TASK-2027: Consolidate duplicate contact resolution methods + fix normalizePhone export bug (BACKLOG-755, BACKLOG-756)
|   Phase 1: Extract renderer-side phone normalization utilities into shared module
|   Phase 2: Delegate export service private methods to shared contactResolutionService
|   Phase 3: Fix normalizePhone() email handle bug in shared service + all 11 vulnerable call sites
|
+-- CI gate: type-check, lint, test pass
+-- SR review: PR #907
+-- Manual test: export merges phone + email threads for same contact
```

**Status:** Completed. PR #907 merged.
**Branch:** `fix/task-2027-consolidate-contact-resolution`
**Task file:** `.claude/plans/tasks/TASK-2027-consolidate-contact-resolution.md`

**Why depends on Phase 7:** TASK-2027 delegates export service methods to the shared `contactResolutionService.ts` created in TASK-2026. Must be merged first.

---

## Dependency Graph

```
Phase 1:
TASK-2018 (source map leakage) -----> PR #900 review + merge  [DONE]
                                         |
                                         v
Phase 2:
TASK-2019 (imessage-parser) --------> PR #901 review + merge  [DONE]
                                         |
                                         v
Phase 3:                            (Already complete)         [DONE]
TASK-2022 (address autocomplete)       No PR needed
                                         |
                                         v
Phase Gate: Regression Check (PM)                              [DONE]
  type-check -> lint -> test -> dev spot-check
                                         |
                                         v
Phase 4:
TASK-2023 (messages tab refresh) ----> PR #903 review + merge  [DONE]
                                         |
                                         v
Phase 5:
TASK-2024 (channel naming unify) ----> PR #904 review + merge          [DONE]
                                         |
                                         v
Phase 6:
TASK-2025 (merge dup threads) -------> Branch, implement, PR, review, merge
                                         |
                                         v
Phase 7:
TASK-2026 (group chat participants) -> PR #906 review + merge  [DONE]
                                         |
                                         v
Phase 8:
TASK-2027 (consolidate contact res) -> PR #907 review + merge  [DONE]
                                         |
                                         v
Sprint Complete                                                 [DONE]
```

**Execution Order:**

| Order | Task | Depends On | Parallel? |
|-------|------|------------|-----------|
| 1 | TASK-2018 (source map) | None | No |
| 2 | TASK-2019 (imessage-parser) | TASK-2018 merged | No |
| 3 | TASK-2022 (address autocomplete) | N/A (completed) | N/A |
| 4 | TASK-2023 (messages tab refresh) | Phase 1-2 merged + Phase Gate | No |
| 5 | TASK-2024 (channel naming unify) | Phase 4 PR #903 merged | No |
| 6 | TASK-2025 (merge dup threads) | Phase 5 TASK-2024 merged | No |
| 7 | TASK-2026 (group chat participants) | Phase 6 TASK-2025 merged | No |
| 8 | TASK-2027 (consolidate contact res) | Phase 7 TASK-2026 merged | No |

---

## Merge Plan

| Task | Branch Name | Base | Target | PR | Status |
|------|-------------|------|--------|-----|--------|
| TASK-2018 | `fix/task-2018-source-map-leakage` | develop | develop | #900 | Merged |
| TASK-2019 | `fix/task-2019-remove-imessage-parser` | develop | develop | #901 | Merged |
| TASK-2020 | `feature/task-2020-google-pkce-service` | develop | develop | #902 | Merged |
| TASK-2022 | N/A | N/A | N/A | N/A | Completed (infra) |
| TASK-2023 | `fix/task-2023-messages-tab-refresh` | develop | develop | #903 | Merged |
| TASK-2024 | `fix/task-2024-unify-channel-naming` | develop | develop | #904 | Merged |
| TASK-2025 | `feature/task-2025-merge-duplicate-threads` | develop | develop | #905 | Merged |
| TASK-2026 | `fix/task-2026-group-chat-participants` | develop | develop | #906 | Merged |
| TASK-2027 | `fix/task-2027-consolidate-contact-resolution` | develop | develop | #907 | Merged |

**Merge order:** TASK-2018 -> TASK-2019 -> TASK-2023 -> TASK-2024 -> TASK-2025 -> TASK-2026 -> TASK-2027 (sequential).

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Source map deletion breaks dev mode | Low | Low | closeBundle only runs in production build |
| imessage-parser removal breaks iPhone message sync | High | Medium | Verify with manual test before merge |
| Messages tab fix introduces regression in other tabs | Medium | Low | Test all tabs after fix; follow existing Emails tab pattern |
| Package-lock conflicts between Phase 1 and 2 | Low | Low | Sequential merge order prevents this |
| Channel helper misidentifies message type | Medium | Low | Thorough unit tests covering all channel/communication_type combinations |
| Thread merge false positive (different people merged) | High | Low | Only merge when contact_assignment exists or exact phone match; exclude group chats |
| Performance degradation from thread merge computation | Medium | Low | Profile before/after; lazy computation |
| Email handle lookup returns wrong contact (common email) | Medium | Low | Match by exact email; verify against contact record |
| chat_members field missing from older participants JSON | Medium | Medium | Gracefully fall back to existing from/to extraction |

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
| Phase gate passed | Update sprint narrative | PM runs regression check |

**Valid CSV statuses:** `Pending`, `In Progress`, `Testing`, `Completed`, `Deferred`

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-2018 | N/A (build config) | N/A | Verify .js.map files absent from dist/ |
| TASK-2019 | Verify existing message tests pass | N/A | iPhone message sync still works |
| TASK-2022 | N/A (infra) | N/A | Address autocomplete works (verified) |
| TASK-2023 | Update useTransactionMessages tests | N/A | Link message -> tab updates immediately |
| TASK-2024 | Unit tests for isTextMessage/isEmailMessage helpers | N/A | Messages display correctly; export categorizes correctly |
| TASK-2025 | Unit tests for mergeThreadsByContact utility | N/A | Same contact with multiple handles shows as one thread |
| TASK-2026 | Unit tests for extractAllHandles and email lookup fallback | N/A | Group chat shows all participants; correct sender attribution |
| TASK-2027 | 7 unit tests for normalizePhone (email handles, edge cases) | N/A | Export merges phone + email threads; no duplicate PDFs |

### CI Gates

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No regressions in existing tests

---

## Task Sizing Rationale

| Task | Category | Base Est | Multiplier | Final Est | SR Overhead |
|------|----------|----------|------------|-----------|-------------|
| TASK-2018 | build fix | ~50K | x1.0 | ~50K | ~5K |
| TASK-2019 | dependency removal | ~50K | x1.0 | ~50K | ~5K |
| TASK-2022 | infra fix | 0 | N/A | 0 | 0 |
| TASK-2023 | UI bug fix | ~40K | x1.0 | ~40K | ~5K |
| TASK-2024 | refactor | ~30K | x1.0 | ~30K | ~5K |
| TASK-2025 | feature (display-layer) | ~50K | x1.0 | ~50K | ~5K |
| TASK-2026 | UI bug fix | ~40K | x1.0 | ~40K | ~5K |
| TASK-2027 | refactor + bug fix | ~50K | x1.0 | ~50K | ~5K |
| **Totals** | | | | **~310K** | **~35K** |

**Grand total: ~345K estimated billable tokens.**

Note: Minimum ~50K estimate per agent task (lesson from SPRINT-088 where small estimates were 10-17x off due to agent overhead).

---

## Notes

### Connection to SPRINT-087

SPRINT-087 (Repo Polish for Due Diligence) deferred these items:
- BACKLOG-723 (imessage-parser) -- "Dependency chain surgery, may break iPhone sync, needs dedicated investigation"
- BACKLOG-734 (source map leakage) -- Build security issue identified during audit

### New Items Added Mid-Sprint

- BACKLOG-751 (address autocomplete) -- Reported by user, immediately resolved via infra fix
- BACKLOG-752 (messages tab refresh) -- Reported by user, added as Phase 4
- BACKLOG-754 (channel naming unification) -- Discovered during Phase 4 investigation, added as Phase 5
- BACKLOG-542 + BACKLOG-748 (merge duplicate threads) -- Long-standing backlog items, added as Phase 6
- BACKLOG-755 (group chat participant missing / wrong sender) -- Reported by user, added as Phase 7

### Active Worktrees

All worktrees removed. Sprint complete.

| Task | Worktree Path |
|------|---------------|
| TASK-2018 | Removed (PR #900 merged) |
| TASK-2019 | Removed (PR #901 merged) |
| TASK-2020 | Removed (PR #902 merged) |
| TASK-2023 | Removed (PR #903 merged) |
| TASK-2024 | Removed (PR #904 merged) |
| TASK-2025 | Removed (PR #905 merged) |
| TASK-2026 | Removed (PR #906 merged) |
| TASK-2027 | Removed (PR #907 merged) |
