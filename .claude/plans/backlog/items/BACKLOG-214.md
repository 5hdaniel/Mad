# BACKLOG-214: Auto-Link Communications Not Working (TASK-1031 Regression)

**Status:** Needs Verification
**Priority:** HIGH
**Category:** bug/regression
**Created:** 2026-01-12
**Related Task:** TASK-1031 (merged PR #407)
**Related Backlog:** BACKLOG-207

---

## Problem Statement

User reports that after adding contacts to a transaction, communications (emails and text messages) are NOT automatically linked. The user still has to manually attach chats to the transaction.

This is a potential regression or incomplete implementation of TASK-1031 which was supposed to implement this exact functionality.

---

## Symptoms

- Add contact to transaction
- Expected: Related emails and iMessages should auto-link
- Actual: No communications are linked
- User must manually go to Messages tab and attach chats

---

## Investigation Required

### 1. Verify Implementation

Check if auto-link code is actually being called:

```typescript
// transactionService.ts - assignContactToTransaction
// Should call autoLinkCommunicationsForContact() after contact save
```

### 2. Check for Silent Failures

The auto-link may be running but silently failing. Check:
- Are there matching communications to link?
- Is the date range filter too restrictive?
- Are there errors in the main process logs?

### 3. Test Scenarios

| Scenario | Expected | Actual |
|----------|----------|--------|
| Add contact with email | Emails linked | ? |
| Add contact with phone | Messages linked | ? |
| Add contact with both | Both linked | ? |
| Contact with no communications | Nothing linked (not an error) | ? |

### 4. Compare Against TASK-1031 PR

Review PR #407 changes to ensure implementation matches requirements:
- `feature/task-1031-auto-link-communications` branch
- Files: transactionService.ts, transactionDbService.ts, etc.

---

## Potential Root Causes

| Cause | Likelihood | Investigation |
|-------|------------|---------------|
| Auto-link not wired up at call site | Medium | Check assignContactToTransaction() |
| Query returns no results (date range) | Medium | Log query results |
| Phone number format mismatch | High | +1, spaces, dashes normalization |
| Email case sensitivity | Medium | Lowercase comparison |
| Error swallowed in try/catch | Medium | Add error logging |
| IPC handler not returning results | Low | Check renderer callback |

---

## Acceptance Criteria

- [ ] When contact is added to transaction, related emails auto-link
- [ ] When contact is added to transaction, related iMessages auto-link
- [ ] User notification shows count of linked communications
- [ ] Works for contacts with multiple email addresses
- [ ] Works for contacts with multiple phone numbers
- [ ] Root cause documented

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-207 | Auto-link communications | Original feature request |
| TASK-1031 | Implement auto-link | Merged implementation (may have regression) |
| PR #407 | feat(auto-link) | Merged PR to review |

---

## Estimated Effort

**Category:** fix/regression
**Estimated Tokens:** ~30K (investigation + fix)
**Token Cap:** 120K

---

## Changelog

- 2026-01-12: Created from user testing feedback
