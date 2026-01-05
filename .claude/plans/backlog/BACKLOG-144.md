# BACKLOG-144: Enforce SR Engineer Review Before PR Merge

**Priority:** High
**Category:** process / workflow
**Status:** Pending
**Created:** 2026-01-04
**Source:** SPRINT-022 Retrospective - PRs merged without SR Engineer review

---

## Problem Statement

During SPRINT-022, three PRs (#310, #311, #312) were merged to develop without proper SR Engineer review. The PR template includes an SR Engineer section, but nothing enforces that it must be completed before merge.

### Root Cause

1. Engineer agents complete work and create PRs
2. CI passes (tests, lint, type-check)
3. No gate exists to verify SR Engineer review was performed
4. PRs get merged based on CI passing + manual testing

### Impact

- Architecture concerns may be missed
- Security review skipped
- Metrics not captured properly
- Process violations go undetected

---

## Proposed Solutions

### Option A: CI Validation Check (Recommended)

Add validation to existing PR Metrics workflow:

```yaml
# Check SR Engineer section is filled (not placeholder)
if grep -q "SR Engineer Agent ID: <paste" <<< "$PR_BODY"; then
  echo "::error::SR Engineer review section not completed"
  exit 1
fi
```

**Pros:** Automated, blocks merge, clear error
**Cons:** Requires workflow modification

### Option B: Engineer Agent Handoff Requirement

Modify engineer agent to block until SR Engineer invoked.

**Pros:** Natural workflow
**Cons:** Relies on agent compliance

### Option C: Hybrid (Recommended)

1. CI check validates SR Engineer section is filled
2. Engineer agent instructions require SR Engineer handoff
3. SR Engineer fills in section as part of review

---

## Acceptance Criteria

- [ ] PRs cannot be merged without SR Engineer section completed
- [ ] Clear error message when validation fails
- [ ] Documentation updated with new workflow
- [ ] Tested on at least one PR

---

## Related

- BACKLOG-126: Debugging Metrics Enforcement (similar pattern)
- `.github/workflows/ci.yml`: Existing CI workflow

---

## Changelog

- 2026-01-04: Created from SPRINT-022 retrospective
