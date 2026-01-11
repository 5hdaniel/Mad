# Sprint Plan: SPRINT-030 - Message & Transaction UX Improvements

## Sprint Goal

Fix critical app freeze when adding contacts with extensive message history, improve group chat UX, and address message-related bugs and features.

## Sprint Status: COMPLETE

**Created:** 2026-01-10
**Completed:** 2026-01-11
**Target Branch:** develop

---

## Context

### Recent Sprint History

| Sprint | Status | Focus | Outcome |
|--------|--------|-------|---------|
| SPRINT-029 | Complete | UX Improvements | Start new audit redesign, message attachments display |
| SPRINT-028 | Complete | Stability & UX Polish | 6 tasks, message parser fix, sync UI redesign |
| SPRINT-027 | Complete | Messages & Contacts Polish | Thread-based display, manual attach |

### Critical Issue

**BACKLOG-190** is the top priority because the app freezes when users add contacts with extensive message history. The root cause is unbounded message linking - ALL messages from a contact are linked instead of filtering by transaction date range.

---

## In Scope

| Task | Backlog | Title | Est. Tokens | Phase |
|------|---------|-------|-------------|-------|
| TASK-1013 | BACKLOG-190 | Transaction Date Range for Message Linking | ~20K | 1 |
| TASK-1014 | BACKLOG-180 | Show Sender Name on Group Chat Messages | ~25K | 1 |
| TASK-1015 | BACKLOG-188 | Fix Scan Lookback Period Setting Persistence | ~15K | 1 |
| TASK-1016 | BACKLOG-187 | Display Attachments (Images/GIFs) in Messages | ~55K | 2 (stretch) |

**Total Estimated (implementation):** ~115K tokens
**SR Review Overhead:** +20K (4 tasks)
**Buffer (10%):** ~12K
**Grand Total:** ~147K tokens

---

## Out of Scope / Deferred

| Backlog | Title | Reason |
|---------|-------|--------|
| BACKLOG-189 | Configurable Attachment Size Limit | Depends on BACKLOG-187; defer to next sprint |

---

## Phase Plan

### Phase 1: Critical Fixes & UX (Parallel Safe)

```
Phase 1 (Parallel)
├── TASK-1013: Transaction Date Range for Message Linking (CRITICAL)
├── TASK-1014: Show Sender Name on Group Chat Messages
└── TASK-1015: Fix Scan Lookback Period Setting Persistence
```

**Why parallel is safe:**
- TASK-1013 modifies: `AddressVerificationStep.tsx`, `useAuditTransaction.ts`, `messageMatchingService.ts`, `schema.sql`
- TASK-1014 modifies: `MessageBubble.tsx`, `ConversationViewModal.tsx`, `ThreadListItem.tsx`
- TASK-1015 modifies: `Settings.tsx`, `preference-handlers.ts`
- **No shared file conflicts** - each task touches different files

**Integration checkpoint:** All Phase 1 PRs must pass CI before Phase 2

### Phase 2: Attachment Display (Stretch Goal)

```
Phase 2 (Sequential - after Phase 1)
└── TASK-1016: Display Attachments (Images/GIFs) in Messages
```

**Why sequential:**
- Large feature (~50K tokens)
- Requires schema changes
- Touches import service that may be affected by Phase 1 stability

**Note:** This is a stretch goal. If Phase 1 takes longer than expected, TASK-1016 may be deferred.

---

## Dependency Graph

```mermaid
graph TD
    subgraph Phase1[Phase 1: Critical Fixes & UX]
        TASK1013[TASK-1013: Date Range Filter - CRITICAL]
        TASK1014[TASK-1014: Sender Names]
        TASK1015[TASK-1015: Lookback Period Bug]
    end

    subgraph Phase2[Phase 2: Attachments - Stretch]
        TASK1016[TASK-1016: Attachment Display]
    end

    TASK1013 --> TASK1016
    TASK1014 --> TASK1016
    TASK1015 --> TASK1016
```

### YAML Edges

```yaml
dependency_graph:
  nodes:
    - id: TASK-1013
      type: task
      phase: 1
      title: "Transaction Date Range for Message Linking"
      priority: critical
    - id: TASK-1014
      type: task
      phase: 1
      title: "Show Sender Name on Group Chat Messages"
      priority: high
    - id: TASK-1015
      type: task
      phase: 1
      title: "Fix Scan Lookback Period Setting Persistence"
      priority: medium
    - id: TASK-1016
      type: task
      phase: 2
      title: "Display Attachments in Messages"
      priority: stretch

  edges:
    - from: TASK-1013
      to: TASK-1016
      type: depends_on
      reason: "Phase 2 starts after Phase 1 complete"
    - from: TASK-1014
      to: TASK-1016
      type: depends_on
      reason: "Phase 2 starts after Phase 1 complete"
    - from: TASK-1015
      to: TASK-1016
      type: depends_on
      reason: "Phase 2 starts after Phase 1 complete"
```

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] `git checkout develop && git pull origin develop`
- [ ] `npm install`
- [ ] `npm rebuild better-sqlite3-multiple-ciphers`
- [ ] `npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`
- [ ] Verify tests pass: `npm test`

---

## Testing & Quality Plan

### TASK-1013 (Date Range Filter)
- **Unit Tests:** Filter logic in messageMatchingService.ts
- **Integration:** Verify transaction date range persists
- **Manual:** Add contact with 1000+ messages, verify no freeze

### TASK-1014 (Sender Names)
- **Unit Tests:** Sender name extraction logic
- **Integration:** Group chat message display
- **Manual:** Verify names show correctly in group threads

### TASK-1015 (Lookback Period)
- **Unit Tests:** Preference persistence
- **Integration:** Setting survives app restart
- **Manual:** Change setting, restart, verify persisted

### TASK-1016 (Attachments)
- **Unit Tests:** Attachment import and storage
- **Integration:** Attachment display in message bubbles
- **Manual:** Verify images/GIFs render correctly

### CI Requirements
- All PRs must pass: `npm test`, `npm run type-check`, `npm run lint`
- No regressions in existing test coverage

---

## Progress Tracking

| Task | Phase | Status | Agent ID | Tokens | Duration | PR |
|------|-------|--------|----------|--------|----------|-----|
| TASK-1013 | 1 | COMPLETE | - | - | - | #376 |
| Hotfixes | - | COMPLETE | - | - | - | #377-381 |
| TASK-1014 | 1 | COMPLETE | a2545fc | ~18K | ~180s | #382 |
| TASK-1015 | 1 | COMPLETE | a64f575 | ~12K | ~150s | #383 |
| TASK-1016 | 2 | DEFERRED | - | - | - | - |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Date range filter doesn't fully solve freeze | High | Low | Test with real user data before merge |
| Attachment feature exceeds token budget | Medium | Medium | Mark as stretch, defer if needed |
| Settings persistence requires backend debug | Low | Medium | Log all persistence calls for diagnosis |

---

## Success Criteria

1. **Critical:** App no longer freezes when adding contacts with many messages
2. **UX:** Group chat messages show sender names
3. **Bug Fix:** Lookback period setting persists correctly
4. **Feature (stretch):** Images/GIFs display inline in messages
5. **Quality:** All tests passing, no regressions

---

## End-of-Sprint Validation Checklist

- [x] All tasks merged to develop (TASK-1013 #376, TASK-1014 #382, TASK-1015 #383)
- [x] All CI checks passing
- [x] All acceptance criteria verified
- [x] Testing requirements met
- [x] No unresolved conflicts
- [ ] Documentation updated (sprint plan, backlog INDEX)

---

## Unplanned Work Log

| Task | Source | Root Cause | Added Date | Est. Tokens | Actual Tokens |
|------|--------|------------|------------|-------------|---------------|
| Hotfixes #377-381 | User report | "00" hex prefix in messages, NSKeyedArchiver parsing | 2026-01-10 | - | ~15K |

---

## Completed Work Details

### TASK-1013: Transaction Date Range (PR #376)

**Summary:** Added transaction start/end date fields to prevent app freeze when adding contacts with extensive message history.

**Key Changes:**
- Added date pickers to "Transaction Details" step
- Message linking now filters by transaction date range
- Performance: No longer loads all 1000+ messages for contacts

### Message Display Hotfixes (PRs #377-381)

**Summary:** Fixed "00" hex prefix appearing in message text and group chat linking issues.

**Root Cause:** NSKeyedArchiver length prefix bytes were being extracted as text during attributedBody parsing.

**Key Changes:**
- Enhanced `sanitizeMessageText()` in ConversationViewModal
- Fixed root cause in `messageParser.ts` extractFromNSString()
- Fixed group chat message linking (chat_members array)
- Documented in `.claude/docs/shared/imessage-attributedbody-parsing.md`

### TASK-1014: Sender Names in Group Chats (PR #382)

**Summary:** Display sender name on each inbound message in group chats.

**Key Changes:**
- Added `getGroupChatTitle()` helper to show participant names in header (up to 3, then "+X more")
- Updated header to use group title instead of just "(Group)"
- Added 6 new tests in MessageBubble.test.tsx
- Added 7 new tests in ConversationViewModal.test.tsx

### TASK-1015: Lookback Period Persistence (PR #383)

**Summary:** Fixed the scan lookback period setting not persisting when changed.

**Root Cause:** Silent error handling in `supabaseService.getPreferences()` was returning `{}` on ANY error, masking failures and causing preferences to appear lost.

**Key Changes:**
- Modified `getPreferences()` to throw errors on database failures
- Changed truthy check to proper type check for lookbackMonths
- Added 5 new tests for preference merge scenarios
