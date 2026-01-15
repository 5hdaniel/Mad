# SPRINT-036: Deterministic Message Parsing Refactor

**Created:** 2026-01-13
**Status:** PLANNING
**Branch:** `project/deterministic-message-parsing` (from `develop`)

---

## Sprint Goal

Eliminate garbage text (5.3% of messages) and prevent incorrect chat merging (7.2% NULL thread_id) by refactoring the message parser from heuristic-based to deterministic format detection. This is critical for compliance audit reliability.

## Problem Statement

### Current State (Heuristic Approach)

The current `messageParser.ts` uses guessing:
1. Try `message.text` field
2. If "looks like garbage" (heuristic: 30% unusual chars) -> try `attributedBody`
3. Try multiple encodings (UTF-8, UTF-16 LE, Latin-1) - **GUESSING**
4. Use threshold checks (20% unusual chars) - **GUESSING**
5. Fall back to heuristic extraction - **GUESSING**

**Result:** 35,834 messages (5.3%) contain garbage text like `"streamtyped..."`

### Required State (Deterministic Approach)

```
1. Check attributedBody magic bytes (100% deterministic)
2. "bplist00" -> Binary plist parser (NSKeyedArchiver)
3. "streamtyped" -> Typedstream parser
4. Neither -> Plain UTF-8 text
5. Parser failed -> Return "[Unable to parse]" - NEVER GUESS
```

**Expected Result:** 0 garbage messages; unparseable messages get clear placeholder

### Database Health Snapshot

| Metric | Current | Target |
|--------|---------|--------|
| Total Messages | 674,822 | 674,822 |
| Healthy | 590,468 (87.5%) | >95% |
| Garbage Text | 35,834 (5.3%) | 0 |
| NULL thread_id | 48,514 (7.2%) | Preserved (data issue) |

---

## Scope

### In-Scope

1. **Deterministic Format Detection** - Magic byte detection for bplist00 and streamtyped
2. **Binary Plist Parser Refactor** - Clean NSKeyedArchiver extraction without heuristics
3. **Typedstream Parser Refactor** - Handle both regular (0x94) and mutable (0x95) preambles
4. **Remove Encoding Guessing** - No more "try UTF-8, try UTF-16, try Latin-1"
5. **Clear Fallback** - Return `"[Unable to parse message]"` instead of garbage
6. **Thread ID Validation** - Ensure thread_id is never NULL for valid chats
7. **Comprehensive Testing** - Unit tests for all parser paths
8. **User Verification** - Manual verification checkpoint with user

### Out-of-Scope (Deferred)

- **NULL thread_id data fix** - This is a data issue, not a parsing issue (48,514 messages)
- **Historical data migration** - Reimport will handle this; no in-place updates
- **UI changes** - MessageThreadCard grouping logic unchanged
- **Performance optimization** - Focus on correctness first

---

## Phase Plan

### Phase 1: Foundation (Sequential)

**Goal:** Build deterministic format detection and individual parsers without touching existing flow.

| Task | Description | Est. Tokens | Depends On |
|------|-------------|-------------|------------|
| TASK-1046 | Deterministic format detection with magic bytes | ~15K | - |
| TASK-1047 | Refactor binary plist parser (remove heuristics) | ~20K | TASK-1046 |
| TASK-1048 | Refactor typedstream parser (handle both preambles) | ~25K | TASK-1046 |

**Rationale for Sequential:** All three tasks modify `messageParser.ts`. Must be sequential to avoid merge conflicts.

### Phase 2: Integration (Sequential)

**Goal:** Wire up deterministic parsers and remove heuristic fallbacks.

| Task | Description | Est. Tokens | Depends On |
|------|-------------|-------------|------------|
| TASK-1049 | Parser integration and fallback removal | ~25K | TASK-1047, TASK-1048 |
| TASK-1050 | Thread ID fix for import service | ~15K | TASK-1049 |

**Rationale for Sequential:** TASK-1049 depends on both parsers being complete. TASK-1050 validates the full pipeline.

### Phase 3: Verification (Sequential)

**Goal:** Comprehensive testing and user verification.

| Task | Description | Est. Tokens | Depends On |
|------|-------------|-------------|------------|
| TASK-1051 | Comprehensive test suite for message parsing | ~30K | TASK-1049 |
| TASK-1052 | User verification and deployment | ~10K | TASK-1050, TASK-1051 |

**User Checkpoint:** TASK-1052 requires user to:
1. Run reimport on their database
2. Verify garbage text count is 0
3. Verify specific chat IDs from test data
4. Approve for merge to develop

---

## Dependency Graph

```
TASK-1046 (Format Detection)
    |
    +---> TASK-1047 (Binary Plist) --+
    |                                 |
    +---> TASK-1048 (Typedstream) ---+
                                      |
                                      v
                              TASK-1049 (Integration)
                                      |
                                      +---> TASK-1050 (Thread ID Fix)
                                      |
                                      +---> TASK-1051 (Test Suite)
                                                    |
                                                    v
                                            TASK-1052 (User Verification)
```

**Execution Order:**
1. TASK-1046 (must complete first)
2. TASK-1047, TASK-1048 (can run in parallel after 1046, but same file - run sequential)
3. TASK-1049 (after both parsers complete)
4. TASK-1050, TASK-1051 (can run in parallel after 1049)
5. TASK-1052 (after all others, requires user)

---

## Testing & Quality Plan

### Unit Tests Required

| Component | Test Coverage | Owner |
|-----------|---------------|-------|
| Format detection (magic bytes) | isBinaryPlist, isTypedstream | TASK-1046 |
| Binary plist extraction | NSKeyedArchiver paths, edge cases | TASK-1047 |
| Typedstream extraction | Regular + mutable preambles | TASK-1048 |
| Integration flow | Full extractTextFromAttributedBody | TASK-1049 |
| Thread ID generation | Import service validation | TASK-1050 |
| Regression suite | All test data samples | TASK-1051 |

### Test Data

Located at: `.claude/plans/test-data/message-parsing-test-data.md`

**Sample Message IDs for Testing:**
- Garbage text: `137fcf4a-493b-4048-a84d-87fba1b22403` (macos-chat-2004)
- NULL thread_id: `0deecf46-3988-4829-bff3-c86c3e223eb1`

### CI Requirements

All PRs must pass:
- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Linting (npm run lint)
- [ ] Build (npm run build)

### User Verification Checkpoints

**TASK-1052 Verification Checklist:**
- [ ] Run `diagnosticMessageHealth()` - garbage count should be 0
- [ ] Check `macos-chat-2004` - messages should be readable or placeholder
- [ ] Check `macos-chat-2742` - messages should be readable or placeholder
- [ ] Verify no Chinese characters in English conversations
- [ ] Verify legitimate Chinese/Japanese messages still work (if any)

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Deterministic parser misses edge cases | Medium | Medium | Comprehensive test suite with real samples |
| Performance regression from new parser | Low | Low | Profile before/after; async yielding preserved |
| Legitimate messages marked unparseable | High | Low | Return clear placeholder; log for analysis |
| Thread ID fix creates data inconsistency | Medium | Low | Validate against existing thread grouping |

---

## Decision Log

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Use magic bytes for format detection | 100% deterministic; no guessing | 2026-01-13 |
| 2 | Return placeholder instead of garbage | User sees "Unable to parse" vs garbage; can investigate | 2026-01-13 |
| 3 | Sequential execution for parser tasks | All modify messageParser.ts; avoid merge conflicts | 2026-01-13 |
| 4 | Require user verification before merge | Compliance app - user must validate fix works | 2026-01-13 |
| 5 | Preserve NULL thread_id count | Data issue, not parsing issue; out of scope | 2026-01-13 |

---

## Files Affected

| File | Changes |
|------|---------|
| `electron/utils/messageParser.ts` | Major refactor - deterministic detection |
| `electron/utils/encodingUtils.ts` | May simplify; remove encoding guessing |
| `electron/services/macOSMessagesImportService.ts` | Thread ID validation |
| `electron/constants.ts` | New FALLBACK_MESSAGES constant |
| `electron/utils/__tests__/messageParser.test.ts` | Comprehensive test suite |

---

## Metrics Tracking

### Token Estimates by Phase

| Phase | Tasks | Est. Tokens | Category Multiplier | Adjusted |
|-------|-------|-------------|---------------------|----------|
| Phase 1 | 3 | ~60K | refactor 0.5x | ~30K |
| Phase 2 | 2 | ~40K | service 0.5x | ~20K |
| Phase 3 | 2 | ~40K | test 0.9x | ~36K |
| **Total** | **7** | **~140K** | - | **~86K** |

**SR Review Overhead:** +25K per phase = +75K
**Sprint Total Estimate:** ~160K tokens

---

## Task Files

- `.claude/plans/tasks/TASK-1046-deterministic-format-detection.md`
- `.claude/plans/tasks/TASK-1047-binary-plist-parser-refactor.md`
- `.claude/plans/tasks/TASK-1048-typedstream-parser-refactor.md`
- `.claude/plans/tasks/TASK-1049-parser-integration.md`
- `.claude/plans/tasks/TASK-1050-thread-id-validation.md`
- `.claude/plans/tasks/TASK-1051-message-parsing-test-suite.md`
- `.claude/plans/tasks/TASK-1052-user-verification.md`

---

## Sprint Review Criteria

### Definition of Done

- [ ] All 7 tasks merged to project branch
- [ ] User verification complete (TASK-1052)
- [ ] Garbage text count = 0 after reimport
- [ ] No regressions in message display
- [ ] CI green on all PRs
- [ ] Phase retro report created
- [ ] Project branch merged to develop

### Success Metrics

| Metric | Target |
|--------|--------|
| Garbage messages | 0 (from 35,834) |
| Health percentage | >95% (from 87.5%) |
| Unparseable (placeholder) | <1% |
| User satisfaction | Explicit approval |
