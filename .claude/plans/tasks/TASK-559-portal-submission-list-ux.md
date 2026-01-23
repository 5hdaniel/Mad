# Task TASK-559: Broker Portal Submission List UX Tweaks

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Two UX improvements for the broker portal submission list: make entire row clickable and remove unnecessary columns.

## Non-Goals

- Do NOT change submission detail page
- Do NOT modify data fetching
- Do NOT add new features to the list

## Deliverables

1. Update: `broker-portal/components/SubmissionList.tsx`

## Acceptance Criteria

- [ ] Clicking anywhere on a row navigates to submission detail
- [ ] Row has hover state and pointer cursor
- [ ] Messages/Docs column removed from table
- [ ] Review button/Actions column removed (row click replaces it)
- [ ] Table headers updated to match new columns
- [ ] `npm run type-check` passes (in broker-portal)

## Implementation Notes

### Row Click Navigation

```tsx
<tr
  key={submission.id}
  className="hover:bg-gray-50 cursor-pointer"
  onClick={() => router.push(`/dashboard/submissions/${submission.id}`)}
>
  {/* columns */}
</tr>
```

### Columns to Remove

**Before:**
| Property | Agent | Status | Messages | Actions |
| 123 Oak  | John  | Pending| 15 msgs  | [Review] |

**After:**
| Property | Agent | Status | Submitted |
| 123 Oak  | John  | Pending| Jan 22    |

### Add Submitted Date Column

Replace Messages column with submission date:

```tsx
<td>{format(new Date(submission.created_at), 'MMM d')}</td>
```

## Integration Notes

- Depends on: TASK-558, Phase 3 (desktop UX updates)
- Used by: TASK-560 (E2E testing)

## Do / Don't

### Do:
- Add visual feedback on row hover
- Ensure keyboard navigation still works
- Test on mobile/touch devices

### Don't:
- Change data model
- Add new columns
- Modify detail page

## When to Stop and Ask

- If row click conflicts with other click handlers in row

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update any existing SubmissionList tests

### CI Requirements

- [ ] Type checking passes
- [ ] Build succeeds

## PR Preparation

- **Title**: `feat(portal): make submission list rows clickable, simplify columns`
- **Labels**: `ux`, `portal`
- **Depends on**: Phase 4 complete

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~6K-10K

**Token Cap:** 40K

**Confidence:** High

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Verification

- [ ] Row click works
- [ ] Hover state visible
- [ ] Columns removed
- [ ] Submitted date displays

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
