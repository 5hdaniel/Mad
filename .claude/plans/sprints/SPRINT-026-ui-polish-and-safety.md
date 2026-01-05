# SPRINT-026: UI Polish & Agent Safety

**Created**: 2026-01-05
**Status**: PLANNED
**Type**: Feature + Infrastructure Sprint

---

## Sprint Goal

Complete the communications UI (deferred TASK-978), add transaction editing for active transactions, and implement critical agent safety measures to prevent token burn incidents.

**Core Principle**: Safety first, features second.

---

## 1. Sprint Scope

### In-Scope

| ID | Title | Priority | Est. Tokens | Category |
|----|-------|----------|-------------|----------|
| BACKLOG-161 | Agent Anti-Loop Enforcement | Critical | 5,000 | infra |
| BACKLOG-162 | Fix CI Bash Escaping | Medium | 1,000 | infra |
| TASK-978 | Manual Link Messages UI | P1 | 5,000 | ui |
| NEW | Edit Active Transactions | P2 | 4,000 | ui |

**Total Estimated**: ~15,000 tokens (with 2.5x buffer from SPRINT-025 learnings: ~37,500)

### Out-of-Scope / Deferred

- BACKLOG-160: Column naming consolidation (low priority)
- Additional UI refactoring (BACKLOG-158, 159)
- Test coverage improvements (SPRINT-024 scope)

---

## 2. Phase Plan

### Phase 1: Safety Infrastructure (Sequential - BLOCKING)

**Rationale**: BACKLOG-161 MUST complete before any parallel agent work. SPRINT-025 burned 14.2M tokens due to missing safeguards.

| Task | Description | Blocks |
|------|-------------|--------|
| TASK-979 | Implement BACKLOG-161: Anti-loop hook + engineer prompt | All parallel work |
| TASK-980 | Implement BACKLOG-162: CI bash escaping fix | Clean CI |

**Execution**: Sequential, NOT in background. PM monitors directly.

### Phase 2: UI Features (Can Parallelize After Phase 1)

| Task | Description | Dependencies |
|------|-------------|--------------|
| TASK-978 | Manual Link Messages UI | TASK-979, TASK-980 |
| TASK-981 | Edit Active Transactions | TASK-979, TASK-980 |

**Execution**: Can run in parallel using worktrees (after BACKLOG-161 implemented).

---

## 3. Dependency Graph

```
TASK-979 (Anti-Loop Hook) ─────┬──> TASK-978 (Manual Link Messages)
                               │
TASK-980 (CI Fix) ─────────────┴──> TASK-981 (Edit Active Transactions)
```

**YAML (machine-readable):**
```yaml
dependencies:
  TASK-978:
    - TASK-979
    - TASK-980
  TASK-981:
    - TASK-979
    - TASK-980
  TASK-979: []
  TASK-980: []
```

---

## 4. File Overlap Analysis (Pre-Parallel Check)

| Task | Files Modified | Conflict Risk |
|------|----------------|---------------|
| TASK-979 | `.claude/hooks/`, `.claude/agents/engineer.md`, `.claude/skills/agentic-pm/` | None |
| TASK-980 | `.github/workflows/ci.yml` | None |
| TASK-978 | `src/components/transaction*`, `electron/transaction-handlers.ts` | **TASK-981** |
| TASK-981 | `src/components/transaction*`, `TransactionHeader.tsx` | **TASK-978** |

**⚠️ WARNING**: TASK-978 and TASK-981 may both touch transaction components. Run sequentially OR use explicit file boundaries.

**Decision**: Run TASK-978 first, then TASK-981. This avoids the merge conflict issue from SPRINT-025.

---

## 5. Merge Plan

```
develop
  │
  ├── PR: TASK-979 (Anti-Loop Hook)
  │
  ├── PR: TASK-980 (CI Fix)
  │
  ├── PR: TASK-978 (Manual Link Messages)
  │
  └── PR: TASK-981 (Edit Active Transactions)
```

**Merge Order**: TASK-979 → TASK-980 → TASK-978 → TASK-981

---

## 6. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Agent loop despite new safeguards | High | Low | PM monitors ALL agents, no background execution in Phase 1 |
| TASK-978/981 file conflict | Medium | Medium | Sequential execution, explicit file boundaries |
| UI regression in transaction view | Medium | Low | Manual testing before merge |

---

## 7. Testing & Quality Plan

### TASK-979 (Anti-Loop Hook)
- **Unit test**: Hook script detects loop conditions
- **Manual test**: Verify warning messages appear in agent context
- **No CI impact**: Hook is local only

### TASK-980 (CI Fix)
- **Integration test**: Create PR with "built-in" in body, verify CI passes
- **Regression test**: Existing PRs still pass metrics validation

### TASK-978 (Manual Link Messages)
- **Manual test**: Search contacts, link/unlink texts in transaction view
- **Unit tests**: New UI components have basic render tests

### TASK-981 (Edit Active Transactions)
- **Manual test**: Edit button appears for Active transactions, modal works
- **Unit tests**: EditTransactionModal accepts active transactions

---

## 8. PM Monitoring Protocol (MANDATORY)

Per BACKLOG-161 Solution 4, PM MUST:

1. **Phase 1**: Run agents in foreground, monitor directly
2. **Phase 2**: If running background agents:
   - Record agent_id immediately
   - Set 30-minute check-in timer
   - Check progress: `TaskOutput --task_id=<id> --block=false`
   - Kill if stuck (>5x estimate with no output)

---

## 9. Success Criteria

- [ ] Anti-loop hook implemented and tested
- [ ] CI passes with special characters in PR body
- [ ] Users can manually link/unlink texts to transactions
- [ ] Users can edit Active transactions (not just Pending Review)
- [ ] No token burn incidents (all tasks within 10x estimate)
- [ ] All PRs reviewed by SR Engineer before merge

---

## 10. Task Files

- `TASK-979-anti-loop-hook.md` - BACKLOG-161 implementation
- `TASK-980-ci-bash-escaping.md` - BACKLOG-162 implementation
- `TASK-978-manual-link-messages.md` - Deferred from SPRINT-025
- `TASK-981-edit-active-transactions.md` - New backlog item
