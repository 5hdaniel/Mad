# TASK-2025: Merge Duplicate 1:1 Message Threads from Same Contact

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Sprint**       | SPRINT-089                                 |
| **Backlog Items**| BACKLOG-542, BACKLOG-748                   |
| **Type**         | Feature (Display-Layer)                    |
| **Priority**     | Medium                                     |
| **Status**       | In Progress                                |
| **Phase**        | 6                                          |
| **Estimated Tokens** | ~50K                                  |
| **Actual Tokens**    | -                                      |
| **Execution**    | Sequential (depends on Phase 5 TASK-2024)  |
| **Risk**         | Medium                                     |

---

## Problem Statement

iPhone users can text a contact via **phone number** (SMS) or **iCloud email** (iMessage). On the phone, these show as ONE conversation. Our app shows them as **separate threads**, causing the same contact to appear multiple times in the Messages tab.

**Two related backlog items:**

1. **BACKLOG-542:** SMS and iMessage from same contact split into separate threads (phone number used for both, different `service` type)
2. **BACKLOG-748:** iCloud email handle vs phone number handle for same contact create separate threads (different handle identifiers, same person)

Both result in the same user-facing problem: duplicate conversation threads for one real person.

### Example -- Current Behavior

| Thread | Handle | Service |
|--------|--------|---------|
| Madison (1:1) | +15551234567 | SMS |
| Madison (1:1) | +15551234567 | iMessage |
| Madison (1:1) | madison.jones@icloud.com | iMessage |

The auditor sees 3 threads when there should be 1.

### Example -- Desired Behavior

| Thread | Contains |
|--------|----------|
| Madison (1:1) | All messages from +15551234567 (SMS), +15551234567 (iMessage), and madison.jones@icloud.com (iMessage) |

## Branch Information

**Branch From:** develop (after Phase 5 TASK-2024 merged)
**Branch Into:** develop
**Branch Name:** feature/task-2025-merge-duplicate-threads

---

## Approach: Display-Layer Merge

**IMPORTANT:** This is a **display-layer merge only**. Do NOT modify the database schema or stored thread data. Group by contact at the UI level rather than altering import logic.

### Why Display-Layer?

- Lower risk -- no data migration needed
- Reversible -- can toggle off if issues arise
- No impact on existing data or exports (initially)
- Aligns with BACKLOG-748's recommendation for display-time merging

### How It Works

1. **Detect same-contact threads:** Use `contact_assignments` table or phone number matching to determine when two threads belong to the same contact
2. **Group by contact:** In the Messages tab, group messages by resolved contact ID instead of by `thread_id`
3. **Unified display:** Show one thread card per contact, with all messages from all handles in chronological order
4. **Handle indicator:** Optionally show which handle/channel each message came from within the merged view

---

## Investigation Phase (Read-Only)

Before implementing, the engineer should investigate these files:

### Files to Investigate

| File | What to Look For |
|------|-----------------|
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | How threads are currently grouped and rendered; where to inject merge logic |
| `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` | Thread card component -- how it receives and displays thread data |
| `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts` | How messages are fetched and grouped into threads; the grouping key |
| `electron/services/db/communicationDbService.ts` | Thread-related database queries; how `thread_id` is used |
| `electron/services/macOSMessagesImportService.ts` | How thread_id and contact_id are assigned during import |
| `electron/database/schema.sql` | Messages table structure, `contact_assignments` table |

### Key Questions

1. How are messages currently grouped into threads? By `thread_id`? By `handle`?
2. Is there a `contact_id` or `contact_assignments` relationship that links threads to contacts?
3. What does the `groupMessagesByThread` utility do (if it exists)?
4. How does `MessageThreadCard` receive its data -- does it take a thread_id or a list of messages?
5. Can the grouping be changed from thread_id to contact_id without breaking the card component?

---

## Implementation Plan

### Step 1: Contact-Based Thread Grouping Logic

Create a utility function that takes a list of messages/threads and groups them by resolved contact:

```typescript
// Pseudocode
function mergeThreadsByContact(threads: Thread[]): MergedThread[] {
  // 1. For each thread, resolve the contact (via contact_assignments or handle matching)
  // 2. Group threads that resolve to the same contact
  // 3. Merge their messages into a single chronological list
  // 4. Return merged threads with combined metadata
}
```

### Step 2: Contact Resolution

Determine how to match threads to the same contact:
- **Primary:** Use `contact_assignments` table if threads have assigned contacts
- **Fallback:** Match by phone number normalization (strip formatting, compare digits)
- **Edge case:** iCloud email handles -- match via contact record that has both email and phone

### Step 3: Update TransactionMessagesTab

Modify the Messages tab to use the merged thread grouping instead of raw thread_id grouping.

### Step 4: Update MessageThreadCard

Ensure the thread card component can display a merged thread:
- Show all messages from multiple handles in chronological order
- Optionally indicate which handle/channel each message came from
- Thread card header shows the contact name (not the handle)

---

## Files Likely to Change

| File | Expected Change |
|------|----------------|
| `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts` | Add contact-based thread merging logic |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Use merged threads for rendering |
| `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` | Support merged thread data structure |
| New: `src/utils/threadMergeUtils.ts` (or similar) | Contact-based thread merge utility |
| Possibly: `electron/services/db/communicationDbService.ts` | Query to resolve contacts for threads |

---

## Acceptance Criteria

- [ ] Messages from same contact (via phone number SMS, phone number iMessage, iCloud email iMessage) appear as a single thread in the Messages tab
- [ ] Thread list shows one entry per contact, not one per handle/service combination
- [ ] Messages within the merged thread are in chronological order
- [ ] No database schema or stored data modifications (display-layer only)
- [ ] Existing thread links to transactions are not broken
- [ ] Non-merged threads (contacts with only one handle) are unaffected
- [ ] Group chats are NOT affected (only 1:1 threads)
- [ ] Type-check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)

## Testing Requirements

| Type | Requirement |
|------|-------------|
| **Unit** | Test `mergeThreadsByContact` utility with mock data: same phone different service, phone + iCloud email, no match |
| **Unit** | Test that group chats are excluded from merging |
| **Unit** | Test chronological ordering within merged thread |
| **Regression** | Existing message display tests still pass |
| **Manual** | Contact with SMS + iMessage threads shows as one thread |
| **Manual** | Contact with phone + iCloud email threads shows as one thread |
| **Manual** | Contacts with only one handle are unaffected |
| **Manual** | Group chats display unchanged |

---

## Estimated Effort

| Category | Base | Multiplier | Estimate |
|----------|------|------------|----------|
| Investigation | ~10K | x1.0 | ~10K |
| Contact resolution logic | ~15K | x1.0 | ~15K |
| UI updates (tab + card) | ~10K | x1.0 | ~10K |
| Testing | ~10K | x1.0 | ~10K |
| SR Review | ~5K | x1.0 | ~5K |
| **Total** | | | **~50K** |

**Soft Cap:** ~200K (4x estimate -- PM will check at this threshold)

---

## Dependencies

- **TASK-2024 (Phase 5):** Must be merged first. TASK-2024 introduces `isTextMessage()` helper which this task should use for channel identification instead of raw comparisons.
- **TASK-2023 (Phase 4):** Must be merged first. TASK-2023 fixes Messages tab reactivity -- this task builds on a working Messages tab.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Contact resolution mismatches (false positive merge) | High | Low | Only merge when contact_assignment exists OR phone numbers match exactly |
| Performance degradation with many threads | Medium | Low | Profile before/after; lazy merge computation |
| Breaking existing thread-to-transaction links | High | Low | Display-layer only -- database links unchanged |
| Edge cases with shared phone numbers (family plans) | Medium | Medium | Only merge 1:1 threads; require same contact name match |

---

## Implementation Summary

| Field | Value |
|-------|-------|
| **Agent ID** | engineer-task-2025 |
| **Files Changed** | 3 (1 new utility, 1 modified component, 1 new test file) |
| **Tests Added** | 11 unit tests for mergeThreadsByContact utility |
| **PR** | TBD |
| **Branch** | feature/task-2025-merge-duplicate-threads |
| **Merged** | No |

### Approach
Display-layer thread merge using contact name resolution. After `groupMessagesByThread()` produces per-chat threads, a new `mergeThreadsByContact()` utility groups 1:1 threads that resolve to the same contact name (or same normalized phone number). Group chats are excluded. Messages in merged threads are sorted chronologically (newest first). Unlink operations work on all original thread IDs in a merged group.

### Files Changed
1. `src/utils/threadMergeUtils.ts` -- NEW: Contact-based thread merge utility
2. `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` -- MODIFIED: Applies merge after grouping; updated unlink handling for merged threads
3. `src/utils/__tests__/threadMergeUtils.test.ts` -- NEW: 11 unit tests covering merge, group chat exclusion, chronological ordering, edge cases

### Engineer Checklist
- [x] Type-check passes
- [x] Lint passes
- [x] Tests pass (11 new + 176 existing TransactionMessagesTab tests)
- [x] No database schema changes
- [x] Group chats excluded from merging
- [x] Uses `isTextMessage()` pattern (channel helpers used in parent hook)
- [x] Display-layer only -- no modification to stored thread data

**Issues/Blockers:** None
