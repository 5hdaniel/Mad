# SPRINT-003: Process & Data Integrity

**Status:** 🔄 Active
**Created:** 2025-12-16
**PM Decision:** Agentic PM

---

## Sprint Narrative

SPRINT-003 addresses two critical gaps exposed by SPRINT-002:

1. **Process Gap:** 0% workflow compliance - no Plan agent, no metrics, no SR reviews
2. **Data Gap:** Schema mismatches causing data integrity issues

This sprint establishes the foundation for reliable future development by fixing both the "how we work" and "what's broken" simultaneously.

---

## Included Items

| ID | Title | Priority | Est. Turns | Phase |
|----|-------|----------|------------|-------|
| BACKLOG-072 | Enforce Engineer Workflow Compliance | Critical | 23-35 | 1 |
| BACKLOG-038 | Schema Mismatch contacts.name | Critical | 10-15 | 2 |
| BACKLOG-039 | Schema Mismatch transactions.status | Critical | 10-15 | 2 |
| BACKLOG-035 | Remove Orphaned Table | Critical | 5-8 | 2 |

**Total Estimated:** 48-73 turns (~55 avg) | **Complexity:** Moderate

---

## Excluded Items (Deferred to SPRINT-004)

| ID | Title | Reason |
|----|-------|--------|
| BACKLOG-032 | Handle Backup Already in Progress | Lower urgency than schema fixes |
| BACKLOG-044 | Multiple Contacts Per Role | Depends on BACKLOG-038 completion |
| BACKLOG-045 | Block Contact Deletion | Depends on BACKLOG-044 |

---

## Phase Plan

### Phase 1: Workflow Enforcement
**Goal:** Achieve 100% workflow compliance capability

```
Phase 1: Workflow Enforcement
├── Sequential tasks: BACKLOG-072 (all 3 sub-phases)
│   ├── 1.1 PR Template & Branch Protection (~12 turns)
│   ├── 1.2 Agent Guardrails (~10 turns)
│   └── 1.3 Monitoring (~8 turns)
├── Integration checkpoint: All enforcement mechanisms active
└── CI gate: PR template validates, branch protection blocks self-merge
```

**Deliverables:**
- `.github/PULL_REQUEST_TEMPLATE.md`
- Branch protection rules updated
- Agent files updated with guardrails
- Compliance audit in retro template

**Est. Effort:** 23-35 turns | ~3h

### Phase 2: Data Integrity
**Goal:** Fix schema mismatches and clean up orphaned data

```
Phase 2: Data Integrity
├── Parallel tasks: [BACKLOG-038, BACKLOG-039] (no shared contracts)
├── Sequential task: BACKLOG-035 (after schema fixes verified)
├── Integration checkpoint: All migrations applied, data validated
└── CI gate: All tests pass, no schema warnings
```

**Task Breakdown:**

| Task | Description | Est. Turns |
|------|-------------|------------|
| BACKLOG-038 | Fix contacts.name → display_name migration | 10-15 |
| BACKLOG-039 | Fix transactions.status enum values | 10-15 |
| BACKLOG-035 | Remove orphaned table after verification | 5-8 |

**Deliverables:**
- Migration scripts for contacts.name
- Migration scripts for transactions.status
- Orphaned table removal
- Data validation tests

**Est. Effort:** 25-38 turns | ~2.5h

---

## Merge Plan

```
develop
  │
  ├── PR: BACKLOG-072 (Workflow Enforcement)
  │   └── Merge first - enables enforcement for remaining PRs
  │
  ├── PR: BACKLOG-038 (contacts.name) ─┐
  │                                     ├── Can merge in parallel
  ├── PR: BACKLOG-039 (transactions.status) ─┘
  │
  └── PR: BACKLOG-035 (Remove Orphaned Table)
      └── Merge last - depends on schema fixes
```

**Integration Order:**
1. BACKLOG-072 → develop (enables enforcement)
2. BACKLOG-038 → develop (parallel with 039)
3. BACKLOG-039 → develop (parallel with 038)
4. BACKLOG-035 → develop (after 038, 039 verified)

---

## Workflow Enforcement (SPRINT-003 Requirement)

**Starting this sprint, all tasks MUST follow the workflow:**

| Step | Requirement | Enforcement |
|------|-------------|-------------|
| 1 | Create branch from develop | Manual |
| 2 | Invoke Plan agent | Agent guardrail (after Phase 1) |
| 3 | Track metrics | PR template (after Phase 1) |
| 4 | Create PR with metrics | CI validation (after Phase 1) |
| 5 | SR Engineer review | Branch protection (after Phase 1) |
| 6 | PM handoff | Agent guardrail (after Phase 1) |

**Note:** BACKLOG-072 (Phase 1) will be the last task without full enforcement. All Phase 2 tasks must comply.

---

## Risks + Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Branch protection breaks existing workflow | Medium | Test with sample PR before enabling |
| Schema migrations cause data loss | High | Backup before migration, reversible scripts |
| Agent guardrails too strict | Low | Start with warnings, escalate to blocks |
| Orphaned table has hidden dependencies | Medium | Search codebase before removal |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] PR template requires metrics section
- [ ] CI fails PRs without metrics
- [ ] Branch protection requires 1+ review
- [ ] Engineer agent refuses to code without plan
- [ ] SR agent verifies metrics before approving

### Phase 2 Complete When:
- [ ] contacts.name → display_name migration applied
- [ ] transactions.status enum normalized
- [ ] Orphaned table removed
- [ ] All tests pass
- [ ] No schema mismatch warnings in logs

### Sprint Complete When:
- [ ] All 4 items merged to develop
- [ ] Compliance rate for Phase 2 tasks = 100%
- [ ] No data integrity issues in production

---

## Capacity Summary

| Phase | Tasks | Est. Turns | Complexity |
|-------|-------|------------|------------|
| Phase 1 | 1 (3 sub-phases) | 23-35 | Moderate |
| Phase 2 | 3 | 25-38 | Moderate |
| **Total** | **4** | **48-73** | **Moderate** |

Within the recommended 50-80 turn budget for moderate complexity sprints.

---

## PM Notes

1. **Phase 1 is foundational** - Without workflow enforcement, we can't trust metrics from future sprints
2. **Schema fixes are blocking** - BACKLOG-044 and 045 depend on these
3. **Orphaned table last** - Low risk quick win after schema verified
4. **First sprint with enforcement** - Expect some friction, document learnings

---

*Sprint planned: 2025-12-16*
*PM: Agentic PM Agent*
