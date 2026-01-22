# SPRINT-049: Manual Transaction Flow Polish

**Created**: 2026-01-21
**Status**: Planning
**Goal**: Make the manual transaction creation, editing, and export flow FLAWLESS

---

## Sprint Overview

This sprint focuses on polishing the manual transaction workflow from start to finish:
- Creating transactions manually
- Assigning contacts to transactions
- Linking emails/texts to transactions
- Transaction details view (all tabs)
- Syncing communications
- Export functionality (PDF, audit package)

---

## Phase 1: Critical Bug Fixes

**Estimated Total**: ~75K tokens

| Task | Backlog Item | Title | Priority | Est. Tokens |
|------|--------------|-------|----------|-------------|
| TASK-TBD | BACKLOG-211 | Email Onboarding State Mismatch (includes BACKLOG-380) | High | ~35K |
| TASK-TBD | BACKLOG-379 | Continue Setup Button Fix (goToEmailOnboarding) | High | ~15K |
| TASK-TBD | BACKLOG-222 | Contact Changes Not Saving When Editing | High | ~30K |

**Note**: BACKLOG-220 (Unlink UI) is deferred to Phase 3 as it requires schema refactor work.

---

## Phase 2: Core UX Improvements

**Estimated Total**: ~80K tokens

| Task | Backlog Item | Title | Priority | Est. Tokens |
|------|--------------|-------|----------|-------------|
| TASK-TBD | BACKLOG-357 | Filter Text Messages by Audit Dates with Toggle | High | ~25K |
| TASK-TBD | BACKLOG-363 | Reorganize Transaction Details Tabs | High | ~25K |
| TASK-TBD | BACKLOG-335 | Enforce Transaction Start Date | High | ~30K |

**Note**: BACKLOG-190 (Transaction Date Range) is covered by BACKLOG-335.

---

## Phase 3: Export Polish

**Estimated Total**: ~60K tokens

| Task | Backlog Item | Title | Priority | Est. Tokens |
|------|--------------|-------|----------|-------------|
| TASK-TBD | BACKLOG-352 | Export Success Message with Finder Link | High | ~15K |
| TASK-TBD | BACKLOG-360 | Default Export to Audit Package | High | ~10K |
| TASK-TBD | BACKLOG-362 | Increase Export Success Popup Duration | Medium | ~5K |
| TASK-TBD | BACKLOG-332 | Audit Package Missing Attachments/Texts | High | ~30K |

---

## Phase 4: UI Cleanup (If Time Permits)

**Estimated Total**: ~40K tokens

| Task | Backlog Item | Title | Priority | Est. Tokens |
|------|--------------|-------|----------|-------------|
| TASK-TBD | BACKLOG-356 | Redesign Text Conversation Cards | Medium | ~15K |
| TASK-TBD | BACKLOG-354 | Remove Phone Number in 1:1 Chat Exports | Low | ~5K |
| TASK-TBD | BACKLOG-355 | Add Back to Email Threads Link | Medium | ~10K |
| TASK-TBD | BACKLOG-167 | Restrict Status Options for Manual Transactions | Low | ~10K |

---

## Deferred Items

These items need more investigation or depend on larger changes:

| Backlog Item | Title | Reason |
|--------------|-------|--------|
| BACKLOG-220 | Unlink Communications UI | Requires thread-based schema refactor (BACKLOG-296) |
| BACKLOG-228 | UI Freeze When Viewing Messages | Needs performance profiling |
| BACKLOG-371 | Contact Update Sync | Feature scope too large for this sprint |
| BACKLOG-358 | Deleted Messages Tab | Depends on iOS backup parser enhancements |

---

## Duplicates Resolved

| Obsolete | Kept | Reason |
|----------|------|--------|
| BACKLOG-171 | BACKLOG-210 | Same issue - contacts not pre-populating |
| BACKLOG-344 | BACKLOG-360 | BACKLOG-360 supersedes |
| BACKLOG-380 | BACKLOG-211 | BACKLOG-211 is more comprehensive |

---

## Success Criteria

- [ ] All critical bugs in Phase 1 resolved
- [ ] User can create manual transaction with contacts that persist
- [ ] Email connection state is accurate and consistent
- [ ] Transaction details tabs are reorganized and clear
- [ ] Text messages can be filtered by audit date range
- [ ] Export completes with proper success message and Finder link
- [ ] Audit package is default export option

---

## Dependencies

- BACKLOG-296 (Database Schema Alignment) - For BACKLOG-220
- No blocking dependencies for Phase 1-3

---

## Risks

| Risk | Mitigation |
|------|------------|
| Email state fix may affect other flows | Test all auth/connection paths |
| Tab reorganization may break existing URLs/links | Add redirects if needed |
| Export changes may affect existing user workflows | Keep backward compatibility |

---

## Technical Notes

### Email State Issue (BACKLOG-211 + BACKLOG-379 + BACKLOG-380)

These three issues are interconnected:
1. `hasEmailConnected` returns false when it should be true
2. `goToEmailOnboarding()` is a no-op
3. Email onboarding state flag vs token existence mismatch

**Recommended fix order**: BACKLOG-211 first (backend), then BACKLOG-379 (navigation).

### Contact Edit Save Issue (BACKLOG-222)

Likely in the save handler not collecting updated contact state. Check:
- `EditTransactionModal.tsx` save handler
- State being passed to save function
- Database update function

### Tab Reorganization (BACKLOG-363)

Current: [Details] [Messages] [Contacts]
New: [Overview] [Messages] [Emails] [Contacts]

Key changes:
- Extract emails from Details tab to new Emails tab
- Rename Details to Overview
- Add audit dates and contacts summary to Overview
