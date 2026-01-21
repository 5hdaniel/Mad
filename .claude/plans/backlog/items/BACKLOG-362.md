# BACKLOG-362: Increase Export Success Popup Visibility Duration

**Created**: 2026-01-21
**Priority**: Medium
**Category**: UI
**Status**: Pending

---

## Description

The popup message that appears after export completion (showing the link to open the audit folder in Finder) auto-dismisses too quickly. Users may miss the link before they can click it. Increase the display duration significantly.

## Current Behavior

- Success popup appears
- Auto-dismisses after ~3-5 seconds (estimated)
- User may miss the Finder link

## Expected Behavior

- Success popup appears
- Stays visible for much longer (15-30 seconds) OR
- Requires manual dismissal (preferred)
- User has plenty of time to click "Open in Finder" link

## Options

1. **Manual dismiss only**: Popup stays until user clicks X or "Got it"
2. **Extended timer**: 30 second auto-dismiss
3. **Hybrid**: 30 seconds with manual dismiss option

Recommendation: Manual dismiss only, since this is an important action point.

## Acceptance Criteria

- [ ] Success popup with Finder link visible for longer
- [ ] User has ample time to click the link
- [ ] Clear dismiss button/action
- [ ] Works for both PDF and Audit Package exports

## Related

- ExportModal.tsx
- BACKLOG-352 (export success flow improvements)
