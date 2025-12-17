## Summary
<!-- Brief description of what this PR does -->

## Changes
<!-- List specific changes made -->

## Task Reference
- **Task ID**: TASK-XXX
- **Sprint**:
- **Branch**:

---

## Engineer Pre-PR Checklist

**REQUIRED: Complete ALL items before requesting review**

### 1. Branch & Setup
- [ ] Created branch from `develop` (not from feature branch)
- [ ] Branch follows naming: `fix/task-XXX-*` or `feature/task-XXX-*`

### 2. Plan-First Protocol (MANDATORY)
- [ ] Plan agent invoked before implementation
- [ ] Plan reviewed and approved
- [ ] Plan agent metrics recorded in metrics table below

### 3. Implementation
- [ ] All acceptance criteria met
- [ ] Tests pass locally: `npm test`
- [ ] Type check passes: `npm run type-check`
- [ ] Lint passes: `npm run lint`

### 4. Task File Updated
- [ ] Implementation Summary section completed in task file
- [ ] Deviations documented (if any)
- [ ] Issues encountered documented (if any)

### 5. Metrics Tracked
- [ ] Start time noted
- [ ] Turns counted (Planning, Implementation, Debugging)
- [ ] Time calculated
- [ ] Engineer Metrics section below is complete

---

## Engineer Metrics: TASK-XXX

**MANDATORY: PRs without complete metrics will be rejected by CI.**

**Engineer Start Time:**
**Engineer End Time:**

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) |  | ~K |  min |
| Implementation (Impl) |  | ~K |  min |
| Debugging (Debug) |  | ~K |  min |
| **Engineer Total** |  | ~K |  min |

**Planning Notes:**
<!-- Key decisions from planning phase, revisions if any -->

**Implementation Notes:**
<!-- Summary of approach -->

**Estimated vs Actual:**
- Est: X turns, XK tokens
- Actual: X turns, ~XK tokens (Plan: X, Impl: X, Debug: X)

---

## Test Plan
<!-- How to verify this change works -->
- [ ]

---

## SR Engineer Review Section

**DO NOT EDIT BELOW - For SR Engineer only**

### SR Engineer Checklist

**BLOCKING - Verify before reviewing code:**
- [ ] Engineer Metrics section is complete (not placeholders)
- [ ] Plan-First Protocol checkboxes are checked
- [ ] Planning (Plan) row has actual values (not "X" or empty)
- [ ] Implementation Summary in task file is complete

**Code Review:**
- [ ] CI passes
- [ ] Code quality acceptable
- [ ] Architecture compliance verified
- [ ] No security concerns

### SR Engineer Metrics: TASK-XXX

**SR Review Start:**
**SR Review End:**

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) |  | ~K |  min |
| PR Review (PR) |  | ~K |  min |
| **SR Total** |  | ~K |  min |

**Planning Notes:**
<!-- Review strategy decisions, plan revisions if any -->

**Review Notes:**
<!-- Architecture concerns, security review, approval rationale -->

---

**After SR approval and merge, PM will record metrics in INDEX.md**

---

## Automated Validation

This PR will be automatically validated by CI for:
- Presence of Engineer Metrics section
- Presence of Plan-First Protocol section
- Metrics table with Planning row
- Estimated vs Actual comparison

PRs missing these elements will fail the PR Metrics Validation check.
