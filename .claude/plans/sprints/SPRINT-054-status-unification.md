# Sprint Plan: SPRINT-054 - Transaction Status Unification & Notifications

**Created**: 2026-01-23
**Updated**: 2026-01-23
**Status**: Planning (Blocked by SPRINT-050)
**Goal**: Complete status unification between desktop and portal with dashboard notifications
**Dependencies**: SPRINT-050 (B2B Portal foundation must be complete)

---

## Sprint Goal

This sprint addresses the user's "Transaction Status Unification" requirement:

> Desktop app and web portal must use the SAME unified status
> - When agent clicks "Submit" -> status shows "Submitted"
> - When broker opens for review -> status shows "Under Review"
> - Broker can: Approve, Reject, or Request Changes (with notes)
> - Status changes must reflect in the agent's desktop app
> - Consider dashboard notifications for status changes

**Note**: This sprint depends on SPRINT-050 items (390, 391, 395, 400) being complete. Do not start until SPRINT-050 is finished.

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] Verify SPRINT-050 is complete (critical dependency)
- [ ] `git checkout develop && git pull origin develop`
- [ ] `npm install`
- [ ] `npm rebuild better-sqlite3-multiple-ciphers`
- [ ] `npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`
- [ ] Verify tests pass: `npm test`

---

## In Scope (6 Items)

### Phase 1: Schema Verification & Filter Fix (Sequential - Foundation)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-366 | Verify TransactionStatus Type/Schema Alignment | ~5K | TASK-TBD |
| BACKLOG-416 | Submitted Transactions Show as Active in Filter | ~15K | TASK-TBD |

### Phase 2: Filter Cleanup & UI Polish (Sequential)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-413 | Remove detection_status from Filter Logic | ~5K | TASK-TBD |
| BACKLOG-414 | Add Visual Separator Between Status Domains | ~5K | TASK-TBD |

### Phase 3: Under Review Status (Sequential)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-461 | Under Review Status When Broker Opens Submission | ~15K | TASK-1178 |

### Phase 4: Dashboard Notifications (Sequential - After Phase 3)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-460 | Dashboard Notifications for Status Changes | ~25K | TASK-1179 |

---

## User Requirements Reference

### Status Flow
```
not_submitted -> submitted -> under_review -> approved/rejected/changes_requested
```

### Status Triggers
| Action | Status | Triggered By |
|--------|--------|--------------|
| Agent clicks Submit | `submitted` | Desktop app |
| Broker opens submission | `under_review` | Portal (NEW in this sprint) |
| Broker approves | `approved` | Portal |
| Broker rejects | `rejected` | Portal |
| Broker requests changes | `changes_requested` | Portal |
| Agent resubmits | `submitted` (resets) | Desktop app |

### Notifications
> Agent should see notification when:
> - Broker starts reviewing (under_review)
> - Broker takes action (approved/rejected/changes_requested)

---

## SPRINT-050 Dependencies

This sprint requires the following SPRINT-050 items to be complete:

| SPRINT-050 Item | Why Required |
|-----------------|--------------|
| BACKLOG-390 | Desktop schema has submission_status |
| BACKLOG-391 | Desktop Submit UI exists |
| BACKLOG-395 | Desktop status sync works |
| BACKLOG-400 | Portal review actions work |

**Do not start SPRINT-054 until these are merged to develop.**

---

## Reprioritized Backlog

| Priority | ID | Title | Est. Tokens | Phase | Dependencies |
|----------|-----|-------|-------------|-------|--------------|
| 1 | BACKLOG-366 | Verify TransactionStatus Type/Schema Alignment | ~5K | 1 | None |
| 2 | BACKLOG-416 | Submitted Transactions Show as Active in Filter | ~15K | 1 | None |
| 3 | BACKLOG-413 | Remove detection_status from Filter Logic | ~5K | 2 | BACKLOG-366, BACKLOG-416 |
| 4 | BACKLOG-414 | Add Visual Separator Between Status Domains | ~5K | 2 | BACKLOG-416 |
| 5 | BACKLOG-461 | Under Review Status | ~15K | 3 | SPRINT-050, Phase 2 |
| 6 | BACKLOG-460 | Dashboard Notifications | ~25K | 4 | BACKLOG-461 |

**Total Estimated Tokens**: ~70K

---

## Phase Plan

### Phase 1: Schema Verification & Filter Fix

**Goal**: Ensure status types are aligned and fix submitted/active filter issue

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-TBD | Verify TransactionStatus Type/Schema Alignment | ~5K | Sequential |
| TASK-TBD | Fix Submitted Transactions Showing as Active | ~15K | Sequential |

**BACKLOG-366 - Schema Verification**:
- Verify TypeScript `TransactionStatus` matches schema CHECK constraint
- Both currently use: pending, active, closed, rejected
- Confirm no "archived" status exists anywhere

**BACKLOG-416 - Filter Fix**:
- Submitted transactions should NOT appear in "Active" tab
- Implement Option C from backlog: separate tab groups
  - Transaction Status: All | Active | Closed
  - Submission Status: Submitted | Under Review | Needs Changes | Approved

**Files to Modify**:
- `src/components/transaction/hooks/useTransactionList.ts`
- `src/components/transaction/components/TransactionToolbar.tsx`

**Integration checkpoint**: Each transaction appears in only ONE filter tab.

---

### Phase 2: Filter Cleanup & UI Polish

**Goal**: Remove outdated filter logic and add visual clarity

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-TBD | Remove detection_status from Filter Logic | ~5K | Sequential |
| TASK-TBD | Add Visual Separator Between Status Domains | ~5K | Can be parallel |

**BACKLOG-413 - Remove detection_status**:
- NOTE: Schema shows `detection_status` DOES exist (lines 356-362 in schema.sql)
- Task description is outdated - need to verify if filter logic is actually broken
- See clarification note in BACKLOG-413

**BACKLOG-414 - Visual Separator**:
```
[All] [Active] [Closed] | [Submitted] [Under Review] [Needs Changes] [Approved]
                        ^
                     separator
```

**Integration checkpoint**: Clean filter UI with no console errors.

---

### Phase 3: Under Review Status

**Goal**: Auto-set status to "under_review" when broker views submission

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-1178 | Under Review Status When Broker Opens | ~15K | Sequential |

**Dependencies**: SPRINT-050 complete, Phase 1 & 2 of this sprint complete

**Implementation**:

1. **Portal Side** (broker-portal):
```typescript
// When broker views submission detail
useEffect(() => {
  if (submission.status === 'submitted') {
    await updateSubmissionStatus(submissionId, 'under_review');
  }
}, [submissionId]);
```

2. **Supabase**:
- Ensure `under_review` is valid status enum value
- Update happens server-side with RLS check

3. **Desktop Side**:
- Existing sync (BACKLOG-395) picks up the change
- UI shows "Under Review" badge

**Files to Modify**:
- `broker-portal/app/submissions/[id]/page.tsx`
- `broker-portal/lib/submissions.ts`
- `shared/types/submissions.ts` (if status enum needs update)
- `supabase/migrations/XXXX_add_under_review_status.sql` (if needed)

**Integration checkpoint**: Opening submission in portal changes status to "Under Review" visible in desktop.

---

### Phase 4: Dashboard Notifications

**Goal**: Show notification banner when submission status changes

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-1179 | Dashboard Notifications for Status Changes | ~25K | After Phase 3 |

**Implementation**:

1. **Status Change Detection**:
```typescript
const useStatusNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Check for status changes on load
    const changes = await getRecentStatusChanges();
    setNotifications(changes);
  }, []);

  return { notifications, dismissNotification };
};
```

2. **Notification Banner**:
```
┌─────────────────────────────────────────────────────────┐
│ [!] 2 transactions need attention                        │
│     - 123 Main St: Changes Requested                     │
│     - 456 Oak Ave: Approved                              │
│                                        [View All] [x]    │
└─────────────────────────────────────────────────────────┘
```

3. **Notification Types**:
| Status | Style | Priority |
|--------|-------|----------|
| `under_review` | Info (blue) | Low |
| `approved` | Success (green) | Medium |
| `rejected` | Error (red) | High |
| `changes_requested` | Warning (yellow) | High |

**Files to Modify**:
- `src/components/Dashboard/Dashboard.tsx`
- `src/components/Dashboard/StatusNotificationBanner.tsx` (new)
- `src/hooks/useStatusNotifications.ts` (new)
- `electron/services/transactionService.ts`

**Integration checkpoint**: Dashboard shows notifications for status changes, clicking navigates to transaction.

---

## Merge Plan

- **Main branch**: `develop`
- **Feature branch format**: `feature/TASK-XXXX-description`

### Merge Order (Sequential)

```
Phase 1:
1. TASK-1178 -> develop (PR)

Phase 2:
2. TASK-1179 -> develop (PR, after 1178 merged)
```

---

## Dependency Graph (YAML)

```yaml
dependency_graph:
  nodes:
    - id: SPRINT-050
      type: sprint
      title: "B2B Broker Portal Foundation"
      status: must_be_complete
    - id: TASK-1178
      type: task
      phase: 1
      title: "Under Review Status"
      backlog: BACKLOG-461
    - id: TASK-1179
      type: task
      phase: 2
      title: "Dashboard Notifications"
      backlog: BACKLOG-460

  edges:
    - from: SPRINT-050
      to: TASK-1178
      type: depends_on
      reason: "Requires portal and status sync from SPRINT-050"
    - from: TASK-1178
      to: TASK-1179
      type: depends_on
      reason: "Notifications include under_review status from Phase 1"
```

---

## File Conflict Matrix

| File/Area | Tasks | Conflict Risk | Resolution |
|-----------|-------|---------------|------------|
| `broker-portal/app/submissions/[id]/page.tsx` | 1178 | None | Single task |
| `broker-portal/lib/submissions.ts` | 1178 | None | Single task |
| `src/components/Dashboard/Dashboard.tsx` | 1179 | None | Single task |
| `src/hooks/useStatusNotifications.ts` | 1179 | None | New file |
| `shared/types/submissions.ts` | 1178 | Low | Type update |

---

## Testing & Quality Plan

### TASK-1178 Test Scenarios

1. **Broker Opens Submitted Transaction**:
   - [ ] Status changes from `submitted` to `under_review`
   - [ ] Desktop sync shows new status
   - [ ] Multiple opens don't reset status after action

2. **Resubmission Flow**:
   - [ ] After changes_requested, resubmit -> `submitted`
   - [ ] Broker opens again -> `under_review`

### TASK-1179 Test Scenarios

1. **Status Change Detection**:
   - [ ] Status change creates notification
   - [ ] Multiple changes shown in order

2. **Notification Interactions**:
   - [ ] Click notification -> navigate to transaction
   - [ ] Dismiss notification -> removed from list
   - [ ] View transaction -> notification auto-dismissed

3. **Notification Styles**:
   - [ ] `changes_requested` shows warning style
   - [ ] `rejected` shows error style
   - [ ] `approved` shows success style

### CI / CD Quality Gates

- [ ] Unit tests
- [ ] Type checking (`npm run type-check`)
- [ ] Linting (`npm run lint`)
- [ ] Build step (`npm run build`)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SPRINT-050 not complete | High | Critical | Block until complete |
| Status enum mismatch | Medium | Medium | Verify shared types |
| Notification state persistence | Medium | Medium | Store in local DB |
| Race condition on status update | Low | Medium | Optimistic update + sync |

---

## Estimated Effort Summary

| Phase | Tasks | Est. Tokens | Execution |
|-------|-------|-------------|-----------|
| Phase 1: Schema/Filter Fix | BACKLOG-366, 416 | ~20K | Sequential |
| Phase 2: Filter Cleanup | BACKLOG-413, 414 | ~10K | Sequential |
| Phase 3: Under Review | TASK-1178 | ~15K | Sequential |
| Phase 4: Notifications | TASK-1179 | ~25K | Sequential |
| **Total** | **6 tasks** | **~70K** | - |

**SR Review Overhead**: Add ~15K for reviews
**Contingency**: ~10K (14%)

**Sprint Total**: ~95K tokens

---

## SR Engineer Review Checklist

Before execution, SR Engineer must validate:

- [ ] SPRINT-050 is complete
- [ ] Status enum includes `under_review`
- [ ] RLS policies allow status update
- [ ] Notification design aligns with existing UI patterns
- [ ] File conflict matrix is complete

---

## Task Execution Status

| Phase | Task | Backlog | Status | Engineer | PR | Actual Tokens |
|-------|------|---------|--------|----------|-----|---------------|
| 1 | TASK-TBD | BACKLOG-366 | Pending | - | - | - |
| 1 | TASK-TBD | BACKLOG-416 | Pending | - | - | - |
| 2 | TASK-TBD | BACKLOG-413 | Blocked | - | - | - |
| 2 | TASK-TBD | BACKLOG-414 | Blocked | - | - | - |
| 3 | TASK-1178 | BACKLOG-461 | Blocked | - | - | - |
| 4 | TASK-1179 | BACKLOG-460 | Blocked | - | - | - |

**Blockers**:
- Phase 1: Can start after SPRINT-053 Phase 1 (schema alignment)
- Phase 2: Blocked by Phase 1 completion
- Phase 3: Blocked by SPRINT-050 and Phase 2
- Phase 4: Blocked by Phase 3

---

## End-of-Sprint Validation Checklist

- [ ] All tasks merged to develop
- [ ] All CI checks passing

**Under Review Status (TASK-1178):**
- [ ] Broker opening submission triggers `under_review`
- [ ] Desktop shows "Under Review" status
- [ ] Status only changes if current is `submitted`
- [ ] Resubmission -> opens -> under_review flow works

**Dashboard Notifications (TASK-1179):**
- [ ] Notification banner visible when status changes
- [ ] Click navigates to transaction
- [ ] Dismiss removes notification
- [ ] Appropriate styling per status type
- [ ] No notifications for already-viewed changes

---

## Related Documentation

- **SPRINT-050**: B2B Broker Portal (prerequisite)
- **SPRINT-051**: License System
- **BACKLOG-395**: Desktop Status Sync
- **BACKLOG-400**: Portal Review Actions
- **Engineer Workflow**: `.claude/docs/ENGINEER-WORKFLOW.md`
- **PR-SOP**: `.claude/docs/PR-SOP.md`
