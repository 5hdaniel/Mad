# TASK-1796: Add iCloud Attachment Limitation UX Message

**Backlog ID:** BACKLOG-603
**Sprint:** SPRINT-068
**Phase:** UX Enhancement
**Branch:** `sprint/SPRINT-068-windows-ios-contacts`
**Estimated Turns:** 2-3
**Estimated Tokens:** 6K-10K

---

## Objective

Add an informational message to the sync completion screen explaining why most iPhone attachments are unavailable (iCloud limitation).

---

## Context

After iPhone sync, users see very few attachments stored (e.g., 14 out of 59,375). SR Engineer confirmed this is an Apple platform limitation - attachments stored in iCloud are not available in local backups. Users need to understand this is not a bug.

---

## Requirements

### Must Do:
1. Add info box to sync completion in `SyncProgress.tsx`
2. Only show when iPhone sync with high attachment skip ratio (>90%)
3. Explain iCloud limitation clearly
4. Provide actionable suggestions (disable iCloud Photos, re-sync)
5. Style consistently with other info boxes

### Must NOT Do:
- Show message for macOS sync
- Show message when skip ratio is low
- Make the message alarming (it's informational, not an error)
- Change attachment extraction behavior

---

## Acceptance Criteria

- [ ] Info box appears after iPhone sync with >90% attachment skip ratio
- [ ] Message explains iCloud limitation
- [ ] User understands this is Apple limitation, not app bug
- [ ] Info box doesn't appear for macOS sync
- [ ] Info box doesn't appear when skip ratio is <90%
- [ ] Styling consistent with other info boxes
- [ ] TypeScript compiles without errors

---

## Files to Modify

- `src/components/sync/SyncProgress.tsx` - Add conditional info box

## Files to Read (for context)

- Existing info box styling in the app
- Sync result data structure to access skip counts

---

## Suggested UI

```
┌──────────────────────────────────────────────────────────────┐
│ ℹ️ About iPhone Attachments                                   │
│                                                              │
│ Most iPhone attachments are stored in iCloud and aren't      │
│ included in local backups. To view more attachments:         │
│ • Disable iCloud Photos on your iPhone                       │
│ • Wait for photos to download to device                      │
│ • Create a new backup and sync again                         │
│                                                              │
│ This is a limitation of how Apple stores data, not a bug     │
│ in Magic Audit.                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **New tests to write:** None
- **Existing tests to update:** None

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(BACKLOG-603): add iCloud attachment limitation info message`
- **Branch:** `sprint/SPRINT-068-windows-ios-contacts`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: No explanation for missing attachments
- **After**: Clear info message explains iCloud limitation
- **Actual Turns**: X (Est: 2-3)
- **Actual Tokens**: ~XK (Est: 6K-10K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Sync result doesn't include attachment counts
- Info box styling is unclear
- You encounter blockers not covered in the task file
