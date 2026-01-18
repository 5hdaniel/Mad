# TASK-1102: Simplify Dashboard Button Labels

**Backlog ID:** BACKLOG-288
**Sprint:** SPRINT-040
**Phase:** 2 (UI Polish - Sequential)
**Branch:** `feature/task-1102-dashboard-labels`
**Estimated Tokens:** ~15K (simple text changes, apply 1.0x multiplier)
**Token Cap:** 60K (4x estimate)

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-16 | **Status:** APPROVED

### Branch Information
- **Branch From:** develop (after Phase 1 PRs merged)
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1102-dashboard-labels`

### Execution Classification
- **Parallel Safe:** No - Phase 2 task
- **Depends On:** TASK-1100, TASK-1101 (must wait for Phase 1 to complete)
- **Blocks:** TASK-1103

### Shared File Analysis
- **Files Created:** None
- **Files Modified:** `src/components/Dashboard.tsx`
- **Conflicts With:** None (Dashboard.tsx is not touched by other tasks)

### Technical Considerations

1. **Dashboard.tsx Analysis:** Reviewed current implementation (442 lines):
   - Lines 252-254: "Start New Audit" heading
   - Lines 263-278: Footer with "Start Audit" span + arrow
   - Lines 306-308: "Browse Transactions" heading
   - Lines 311-326: Footer with "View All" span + arrow
   - Lines 355-357: "Manage Contacts" heading (already has arrow in row)

2. **Animation Transition:** Current cards use `group-hover:gap-4` on footer for arrow animation.
   - Moving arrow to heading requires: `group-hover:translate-x-1` on the SVG
   - This matches the existing Contacts card pattern (line 360)

3. **Pending Badge Preservation:** The pending count badge (lines 255-259) must remain visible:
   ```tsx
   {pendingCount > 0 && (
     <span className="...bg-indigo-100 text-indigo-800 animate-pulse">
       {pendingCount} new
     </span>
   )}
   ```

4. **Tour Attributes:** `data-tour` attributes must be preserved:
   - `data-tour="new-audit-card"` (line 230)
   - `data-tour="transactions-card"` (line 285)
   - `data-tour="contacts-card"` (line 336)

### Recommendations

1. **Simplify Implementation:** Since the changes are text-only with arrow relocation:
   - Remove the entire footer `<div className="mt-6 flex...">` block from each card
   - Add arrow SVG inline after heading text
   - Keep the `group` class on the parent button for hover effects

2. **Heading Structure Pattern:**
   ```tsx
   <div className="flex items-center gap-2 mb-3">
     <h2 className="text-2xl font-bold text-gray-900">New Audit</h2>
     {pendingCount > 0 && <span className="...">...</span>}
     <svg className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform">...</svg>
   </div>
   ```

3. **Token Estimate:** 15K is generous for this scope:
   - Only 1 file modified
   - Text changes + structural simplification
   - No new tests needed (existing tests cover navigation)
   - Likely 8-12K actual

---

## Objective

Simplify the dashboard button labels for a cleaner UI:
- "Start New Audit" becomes "New Audit"
- "Browse Transactions" becomes "All Audits"
- "Manage Contacts" becomes "Contacts"

Additionally, remove redundant footer action text and move the arrow icon next to the heading.

---

## Context

### Current State

The Dashboard component (`src/components/Dashboard.tsx`) has three main action cards:
1. **Start New Audit** - with "Start Audit" + arrow in footer
2. **Browse Transactions** - with "View All" + arrow in footer
3. **Manage Contacts** - with arrow icon

The current labels are verbose. The footer text duplicates the card's purpose since the entire card is clickable.

### Goal

Create cleaner, more concise labels that reduce visual clutter while maintaining clear affordances.

---

## Requirements

### Must Do:

1. **Update heading labels:**

   | Current | New |
   |---------|-----|
   | "Start New Audit" | "New Audit" |
   | "Browse Transactions" | "All Audits" |
   | "Manage Contacts" | "Contacts" |

2. **Remove footer action text:**
   - Remove `<span>Start Audit</span>` from "Start New Audit" card footer
   - Remove `<span>View All</span>` from "Browse Transactions" card footer
   - Keep the arrow SVG icon

3. **Move arrow next to heading:**
   - Place the chevron arrow (`M9 5l7 7-7 7`) directly after the h2 heading text
   - Remove the arrow from the footer div
   - Add appropriate spacing between heading text and arrow

4. **Verify visual result:**
   ```
   Before:
   ┌─────────────────────────┐
   │ Start New Audit          │
   │ description text        │
   │ [Start Audit →]         │  <- remove this text, keep arrow
   └─────────────────────────┘

   After:
   ┌─────────────────────────┐
   │ New Audit →              │  <- arrow next to heading
   │ description text        │
   └─────────────────────────┘
   ```

5. **Update any ARIA labels if needed:**
   - Check if buttons have explicit aria-label attributes
   - Update to match new display text if different

### Must NOT Do:

- Do NOT change button functionality or click handlers
- Do NOT modify the card layout/styling beyond label changes
- Do NOT remove the pending count badge on "New Audit" card
- Do NOT modify the tour attributes (`data-tour`)
- Do NOT change the Sync iPhone card (secondary action row)

---

## Acceptance Criteria

- [ ] "Start New Audit" heading displays "New Audit"
- [ ] "Browse Transactions" heading displays "All Audits"
- [ ] "Manage Contacts" heading displays "Contacts"
- [ ] "Start Audit" span text removed from footer
- [ ] "View All" span text removed from footer
- [ ] Arrow SVG icon moved next to h2 headings
- [ ] Arrow animates on hover (group-hover:gap-4 transition still works)
- [ ] Pending count badge still displays on "New Audit" card
- [ ] Button click handlers unchanged
- [ ] Tour attributes unchanged
- [ ] Existing tests pass
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Files to Modify

- `src/components/Dashboard.tsx` - Update labels and layout

## Files to Read (for context)

- `src/components/Dashboard.tsx` - Current implementation

---

## Implementation Notes

### Current Code Structure (relevant sections)

```tsx
{/* Start New Audit Card - line ~250 */}
<h2 className="text-2xl font-bold text-gray-900">
  Start New Audit
</h2>
{/* ... */}
<div className="mt-6 flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-4 transition-all">
  <span>Start Audit</span>
  <svg ...> {/* arrow */} </svg>
</div>

{/* Browse Transactions Card - line ~305 */}
<h2 className="text-2xl font-bold text-gray-900 mb-3">
  Browse Transactions
</h2>
{/* ... */}
<div className="mt-6 flex items-center gap-2 text-green-600 font-semibold group-hover:gap-4 transition-all">
  <span>View All</span>
  <svg ...> {/* arrow */} </svg>
</div>

{/* Manage Contacts Card - line ~355 */}
<h3 className="text-lg font-bold text-gray-900 mb-1">
  Manage Contacts
</h3>
```

### Target Code Structure

```tsx
{/* New Audit Card */}
<div className="flex items-center gap-2 mb-3">
  <h2 className="text-2xl font-bold text-gray-900">
    New Audit
  </h2>
  {pendingCount > 0 && (
    <span className="...badge...">{pendingCount} new</span>
  )}
  <svg className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" ...>
    {/* arrow */}
  </svg>
</div>
{/* Remove footer div with "Start Audit" span */}

{/* All Audits Card */}
<div className="flex items-center gap-2 mb-3">
  <h2 className="text-2xl font-bold text-gray-900">
    All Audits
  </h2>
  <svg className="w-5 h-5 text-green-600 group-hover:translate-x-1 transition-transform" ...>
    {/* arrow */}
  </svg>
</div>
{/* Remove footer div with "View All" span */}

{/* Contacts Card (already has arrow in header row) */}
<h3 className="text-lg font-bold text-gray-900 mb-1">
  Contacts
</h3>
```

### Animation Adjustment

The current footer has `gap-2 group-hover:gap-4` for the arrow animation. Since we're moving the arrow to the heading row, use `group-hover:translate-x-1` on the arrow SVG for a similar effect.

---

## Testing Expectations

### Unit Tests

**Required:** No new tests needed

**Existing tests to verify:**
- Dashboard renders correctly
- Navigation handlers work

The existing tests should continue to pass - this is a visual change only.

### Manual Testing

- [ ] Dashboard displays new labels
- [ ] Arrow appears next to headings
- [ ] Arrow animates on card hover
- [ ] Clicking cards navigates correctly
- [ ] Pending count badge displays correctly
- [ ] Tour works correctly (data-tour attributes unchanged)

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `ui(dashboard): simplify button labels and move arrows to headings`
- **Branch:** `feature/task-1102-dashboard-labels`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Agent ID

**Record this immediately when starting:**
```
Engineer Agent ID: <agent_id from session>
```

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

- **Before**: Verbose labels ("Start New Audit", "Browse Transactions", "Manage Contacts") with redundant footer text
- **After**: Clean labels ("New Audit", "All Audits", "Contacts") with arrow next to heading
- **Actual Tokens**: ~XK (Est: 15K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- You're unsure about the exact position of the arrow relative to the heading
- You find i18n/localization strings that need updating
- The hover animation doesn't look right with the new layout
- You encounter blockers not covered in the task file
