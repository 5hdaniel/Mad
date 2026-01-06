# BACKLOG-072: Enforce Engineer Workflow Compliance

**Priority:** Critical
**Type:** Process Improvement
**Created:** 2025-12-16
**Sprint:** Unassigned

---

## Problem Statement

SPRINT-002 audit revealed **0% workflow compliance** across all 5 PRs:
- No Plan agent invocations
- No Engineer Metrics in PR descriptions
- No SR Engineer reviews
- All PRs self-merged
- No PM handoffs between tasks

This undermines the entire estimation calibration system and quality gates.

---

## Root Cause Analysis

| Issue | Cause | Impact |
|-------|-------|--------|
| No Plan agent | Not enforced, easy to skip | No upfront design review |
| No metrics | PR template doesn't require them | Can't calibrate estimates |
| Self-merge | Branch protection allows it | No code review gate |
| No SR review | Not enforced in tooling | Quality gate bypassed |
| No PM handoff | Informal task assignment | No prioritization control |

---

## Acceptance Criteria

### 1. Technical Enforcement

- [ ] **PR Template** with required metrics section
  - Template blocks submission without metrics table
  - Includes Plan, Implementation, Debug breakdown

- [ ] **Branch Protection Rules**
  - Require at least 1 review before merge
  - Prevent self-approval
  - Require status checks to pass

- [ ] **CI Check for Metrics**
  - Add workflow step that validates PR description contains metrics table
  - Fail CI if metrics missing

### 2. Agent Enforcement

- [ ] **Engineer Agent** must invoke Plan agent before implementation
  - Add check in engineer.md that blocks coding without plan
  - Plan agent outputs a plan file that must exist

- [ ] **SR Engineer Agent** must verify:
  - Engineer Metrics present in PR
  - Plan was created (plan file exists)
  - Tests pass before approving

- [ ] **PM Agent** must:
  - Assign tasks formally (create task file)
  - Receive completion reports with metrics
  - Update backlog with actuals

### 3. Documentation

- [ ] Update `engineer-workflow.md` with enforcement details
- [ ] Add examples of compliant vs non-compliant PRs
- [ ] Create "Workflow Violation" escalation process

---

## Implementation Approach

### Phase 1: PR Template & Branch Protection
1. Create `.github/PULL_REQUEST_TEMPLATE.md` with metrics section
2. Update branch protection rules in GitHub settings
3. Add CI step to validate PR description format

### Phase 2: Agent Guardrails
1. Update `engineer.md` with Plan-First blocking logic
2. Update `senior-engineer-pr-lead.md` with verification checklist
3. Update PM skill to require formal task assignment

### Phase 3: Monitoring
1. Add sprint retrospective template that audits compliance
2. Create dashboard/report for workflow metrics
3. Weekly compliance review by PM

---

## Estimated Effort

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Phase 1: Templates & CI | 8-12 | 30-50K | 1h |
| Phase 2: Agent Updates | 10-15 | 40-60K | 1.5h |
| Phase 3: Monitoring | 5-8 | 20-30K | 45m |
| **Total** | **23-35** | **90-140K** | **~3h** |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Plan Agent Usage | 0% | 100% |
| Metrics in PRs | 0% | 100% |
| SR Review Rate | 0% | 100% |
| Self-Merge Rate | 100% | 0% |

---

## Dependencies

- GitHub repo admin access (branch protection)
- Agent file update permissions

---

## Notes

This is a **process debt** item, not technical debt. However, it's critical for:
1. Estimation accuracy improvement
2. Code quality gates
3. Knowledge transfer between agents
4. Sprint velocity tracking

Without enforcement, the workflow documentation is just aspirational.

---

## References

- `engineer-workflow.md` - Current workflow docs
- `senior-engineer-pr-lead.md` - SR review process
- `SPRINT-002-tech-debt-review.md` - Audit findings
