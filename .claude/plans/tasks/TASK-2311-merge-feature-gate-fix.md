# TASK-2311: Merge Feature Gate Fix PR #1400

**Backlog ID:** BACKLOG-1339
**Sprint:** SPRINT-O
**Branch:** `fix/feature-gate-no-org-failopen` (existing)
**Estimated Tokens:** ~1K (merge only)

---

## Objective

Merge PR #1400 which fixes the fail-open feature gate that allows non-org trial users to see team-only features (specifically the "Submit for Review" button).

---

## Context

- PR #1400 is already open, reviewed, and targets `int/identity-provisioning`
- The fix is in `electron/handlers/featureGateHandlers.ts`
- The feature gate currently fails open when a user has no org membership, incorrectly showing team features
- This is a security/authorization fix -- trial users without an org should NOT see Submit for Review

---

## Requirements

### Must Do:
1. User tests PR #1400 on the `fix/feature-gate-no-org-failopen` branch
2. Verify the Submit for Review button is hidden for trial/non-org users
3. Merge PR #1400 into `int/identity-provisioning`

### Must NOT Do:
- Do not merge without user testing confirmation
- Do not squash merge -- use traditional merge

---

## Acceptance Criteria

- [ ] PR #1400 merged into `int/identity-provisioning`
- [ ] Non-org trial users cannot see Submit for Review button
- [ ] Org users with proper feature gates still see Submit for Review

---

## Files to Modify

- None (merge only)

---

## Testing Expectations

### Manual Testing
- Log in as trial user without org membership
- Verify Submit for Review button is NOT visible
- Log in as org user with team features enabled
- Verify Submit for Review button IS visible

### CI Requirements
- [ ] CI passes on PR #1400

---

## PR Preparation

- **Title:** Already created: `fix: restrict team features for users without org membership (BACKLOG-1339)`
- **PR:** #1400
- **Target:** `int/identity-provisioning`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*N/A -- merge-only task*

---

## Guardrails

**STOP and ask PM if:**
- CI fails on PR #1400
- Merge conflicts arise with `int/identity-provisioning`
