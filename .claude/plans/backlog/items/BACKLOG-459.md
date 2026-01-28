# BACKLOG-459: Team License Export After Submission

**Created**: 2026-01-23
**Status**: Completed
**Priority**: P0 (Critical)
**Category**: Feature / License Gating
**Sprint**: SPRINT-053
**Estimate**: ~20K tokens
**Resolved**: PR #569 (2026-01-25)

---

## Problem

Current license gating in BACKLOG-427 shows:
- Individual license: Export button only
- Team license: Submit button only

User requirement specifies Team licenses should have **both** options:
- Primary: Submit for Review button
- Secondary: Export options (available after submission OR as alternative)

## User Story

**As a** Team license user (real estate agent with broker oversight)
**I want** to see Submit options first, then Export options after submission
**So that** I can submit to my broker for review AND export for my own records

## Current Behavior (BACKLOG-427)

```
Individual License:
  [Export] button shown

Team License:
  [Submit for Review] button shown
```

## Expected Behavior

```
Individual License:
  [Export] button shown

Team License:
  [Submit for Review] button shown (primary)
  [Export] dropdown shown (secondary, always available)

  After submission:
  Status badge shows: "Submitted" / "Under Review" / "Approved" / "Rejected"
  [Export] remains available for agent's records
```

## Implementation

### Option A: Dual Buttons (Recommended)
Show both buttons for Team users:
- Submit for Review (primary, outlined)
- Export (secondary, text/icon button)

### Option B: Combined Dropdown
Single dropdown with grouped actions:
- Review: Submit for Review
- Export: PDF, Folder, etc.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transactionDetailsModule/TransactionDetailsHeader.tsx` | Add export button alongside submit for Team |
| `src/contexts/LicenseContext.tsx` | Add `canExportAsTeam` computed flag (always true) |
| `src/components/common/LicenseGate.tsx` | May need `requiresAny` prop |

## Acceptance Criteria

- [ ] Team users see Submit for Review as primary action
- [ ] Team users see Export as secondary action (not hidden)
- [ ] Export is available before and after submission
- [ ] Individual users see only Export (unchanged)
- [ ] TypeScript compiles
- [ ] Tests pass

## Dependencies

- BACKLOG-427: License-Aware UI Components (completed)
- BACKLOG-428: License Context Provider (completed)

## Related

- BACKLOG-395: Desktop - Status Sync (shows submission status)
- BACKLOG-391: Desktop - Submit for Review UI
