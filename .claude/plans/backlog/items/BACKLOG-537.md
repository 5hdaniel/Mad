# BACKLOG-537: Contacts count mismatch - backend shows 27, UI shows 2

**Priority**: P2 (Functional bug affecting core feature)
**Category**: Bug - Data/Filtering
**Discovered**: SPRINT-062 testing (2026-01-27)
**Status**: New

## Problem

During SPRINT-062 testing, logs show "Found 27 imported contacts" but the UI only displays 2 contacts. There is a significant data/filtering discrepancy between what the backend retrieves and what the frontend renders.

## Expected Behavior

The UI should display all 27 contacts that the backend reports finding. The count shown in logs should match the count displayed in the UI.

## Symptoms

- Console/log output: "Found 27 imported contacts"
- UI display: Only 2 contacts visible
- Missing 25 contacts (92% data loss in display)

## Root Cause Analysis (Suspected)

Potential causes to investigate:
1. **Filtering logic** - UI may be applying undocumented filters (e.g., filtering by type, status, or validity)
2. **Pagination** - UI may only be showing first page without indicating more exist
3. **Data transformation** - Contact objects may be failing validation/parsing during render
4. **Query mismatch** - Backend query includes contacts that frontend query excludes
5. **Race condition** - UI renders before all contacts are loaded

## Investigation Steps

1. Check frontend contact query vs backend query
2. Review any filter/sort logic in contacts list component
3. Look for console errors during contact rendering
4. Compare contact data shapes (what backend returns vs what UI expects)
5. Check for pagination or virtualization issues

## Files to Investigate

- Contact list component(s)
- Contact service/API layer
- Contact data types/interfaces
- Any contact filtering utilities

## Acceptance Criteria

- [ ] All 27 contacts visible in UI
- [ ] Log count matches UI count
- [ ] No silent data filtering without user awareness
- [ ] If intentional filtering exists, UI should indicate "showing X of Y contacts"

## Related Items

None identified - standalone bug.

## Effort Estimate

~15-25K tokens (investigation + fix)
