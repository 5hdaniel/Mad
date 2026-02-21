# TASK-2023: Fix Messages Tab Not Updating After Linking Messages

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Sprint**       | SPRINT-089                                 |
| **Backlog Item** | BACKLOG-752                                |
| **Type**         | Bug Fix                                    |
| **Priority**     | Critical                                   |
| **Status**       | Pending                                    |
| **Phase**        | 4                                          |
| **Estimated Tokens** | ~40K                                  |
| **Actual Tokens**    | -                                      |
| **Execution**    | Sequential (depends on Phase 1-3 merged)   |
| **Risk**         | Medium                                     |

---

## Problem Statement

When messages (emails or texts) are linked to a transaction, the Messages tab in Transaction Details does not display the newly linked messages until the user closes and reopens the transaction details. The data saves correctly to the database, but the UI component does not re-render.

## Branch Information

**Branch From:** develop (after Phase 1-3 PRs merged)
**Branch Into:** develop
**Branch Name:** fix/task-2023-messages-tab-refresh

---

## Investigation-First Approach

This task uses the investigation-first pattern. The engineer should complete the investigation phase before implementing any changes.

### Phase A: Investigation (Read-Only)

1. **Read `useTransactionMessages.ts`** -- Understand how messages are fetched for the tab
   - `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts`
   - Does it fetch on mount only, or subscribe to changes?
   - Does it expose a `refetch` or `refresh` function?

2. **Read `TransactionMessagesTab.tsx`** -- Understand how the tab renders and when it re-fetches
   - `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx`
   - Does it call `useTransactionMessages`? Does it receive data as props?
   - Is there a mechanism to trigger re-render after linking?

3. **Read `TransactionEmailsTab.tsx`** -- Compare the working pattern
   - `src/components/transactionDetailsModule/components/TransactionEmailsTab.tsx`
   - How does the Emails tab handle refresh after linking emails?
   - Does it use `useTransactionCommunications` or its own hook?

4. **Read `AttachMessagesModal.tsx`** -- Understand the linking flow
   - `src/components/transactionDetailsModule/components/modals/AttachMessagesModal.tsx`
   - After a message is linked, does it trigger a callback/event that the Messages tab listens to?

5. **Read `useTransactionCommunications.ts`** -- Check the shared communications hook
   - `src/components/transactionDetailsModule/hooks/useTransactionCommunications.ts`
   - Does this provide cross-tab refresh capabilities?

6. **Read `TransactionDetails.tsx`** -- Check parent component state flow
   - `src/components/TransactionDetails.tsx`
   - Does the parent pass a refresh signal to child tabs?

### Phase B: Implementation

Based on investigation findings, implement the fix. Likely patterns:

**Pattern 1: Missing callback after link operation**
- `AttachMessagesModal` completes the link but doesn't notify the Messages tab
- Fix: Add an `onSuccess` callback that triggers re-fetch in `useTransactionMessages`

**Pattern 2: Hook doesn't subscribe to changes**
- `useTransactionMessages` fetches once on mount but never re-fetches
- Fix: Add dependency on a "linked messages count" or listen for a refetch signal

**Pattern 3: State not lifted properly**
- Parent component doesn't pass updated state to Messages tab
- Fix: Lift state or add a shared context/event for tab refresh

**Follow the Emails tab pattern** -- whatever mechanism the Emails tab uses for refresh after `AttachEmailsModal` is the correct pattern to replicate.

---

## Files to Investigate

| File | Purpose | Priority |
|------|---------|----------|
| `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts` | Messages data hook | High |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Messages tab component | High |
| `src/components/transactionDetailsModule/components/TransactionEmailsTab.tsx` | Emails tab (reference pattern) | High |
| `src/components/transactionDetailsModule/components/modals/AttachMessagesModal.tsx` | Message linking modal | High |
| `src/components/transactionDetailsModule/hooks/useTransactionCommunications.ts` | Shared communications hook | Medium |
| `src/components/TransactionDetails.tsx` | Parent component | Medium |
| `src/components/transactionDetailsModule/hooks/useTransactionDetails.ts` | Transaction details hook | Low |
| `src/components/transactionDetailsModule/components/modals/AttachEmailsModal.tsx` | Email linking modal (reference) | Medium |

## Files Likely to Change

| File | Expected Change |
|------|----------------|
| `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts` | Add refetch/subscription mechanism |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Wire up refresh trigger |
| `src/components/transactionDetailsModule/components/modals/AttachMessagesModal.tsx` | Add onSuccess callback |
| Possibly: `src/components/transactionDetailsModule/components/modals/UnlinkMessageModal.tsx` | Same refresh for unlink |

---

## Acceptance Criteria

- [ ] After linking a message to a transaction, the Messages tab updates immediately without navigation
- [ ] After unlinking a message (via UnlinkMessageModal), the Messages tab updates immediately
- [ ] No regression in the Emails tab or other Transaction Details tabs
- [ ] Pattern is consistent with how the Emails tab handles refresh after AttachEmailsModal
- [ ] Existing tests pass (`npm test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)

## Testing Requirements

| Type | Requirement |
|------|-------------|
| **Unit** | Update `useTransactionMessages.test.ts` to cover refetch/refresh behavior |
| **Unit** | Update `TransactionMessagesTab.test.tsx` if component interface changes |
| **Manual** | Link a message to a transaction -> Messages tab updates without reopening |
| **Manual** | Unlink a message -> Messages tab updates without reopening |
| **Manual** | Emails tab still refreshes correctly after linking emails |

---

## Estimated Effort

| Category | Base | Multiplier | Estimate |
|----------|------|------------|----------|
| Investigation | ~10K | x1.0 | ~10K |
| Implementation | ~15K | x1.0 | ~15K |
| Testing | ~10K | x1.0 | ~10K |
| SR Review | ~5K | x1.0 | ~5K |
| **Total** | | | **~40K** |

**Soft Cap:** ~160K (4x estimate -- PM will check at this threshold)
