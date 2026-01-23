# BACKLOG-416: Submitted Transactions Show as Active in Filter

**Created**: 2026-01-22
**Status**: Ready
**Priority**: P1 (High)
**Category**: Bug Fix
**Sprint**: SPRINT-051 (Status Realignment)
**Estimate**: ~15K tokens

---

## Problem

Transactions that have been submitted for review still appear in the "Active" filter tab. Users expect submitted transactions to appear under "Submitted" or "Under Review" tabs, not "Active".

## Root Cause

The filter logic uses `transaction.status` for some tabs and `transaction.submission_status` for others, but doesn't properly exclude submitted transactions from the "Active" tab.

Current behavior:
- A transaction with `status: "active"` and `submission_status: "submitted"` appears in BOTH "Active" and "Submitted" tabs

Expected behavior:
- Once submitted, transaction should NOT appear in "Active" tab
- Should only appear in the appropriate submission status tab

## Solution Options

### Option A: Mutually Exclusive Tabs
- "Active" = `status === 'active' AND submission_status IS NULL`
- "Submitted" = `submission_status === 'submitted'`
- etc.

### Option B: Status Hierarchy
- Submission status takes precedence over transaction status for filtering
- Active tab excludes any transaction with a submission_status

### Option C: Separate Tab Groups (SPRINT-051 recommendation)
- Transaction Status: All | Active | Closed
- Submission Status: Submitted | Under Review | Needs Changes | Approved
- Visual separator between groups

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transaction/hooks/useTransactionList.ts` | Update filter logic |
| `src/components/transaction/components/TransactionToolbar.tsx` | Possibly add visual separator |

## Acceptance Criteria

- [ ] Submitted transactions don't appear in "Active" tab
- [ ] Each transaction appears in only ONE filter tab
- [ ] Filter counts are accurate
- [ ] No transactions are "lost" (all appear somewhere)

## Related

- SPRINT-051: Transaction Status Architecture Realignment
- BACKLOG-412: Restore "Closed" Filter Tab
