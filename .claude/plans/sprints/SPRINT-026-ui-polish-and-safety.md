# SPRINT-026: UI Polish & Agent Safety

**Created**: 2026-01-05
**Updated**: 2026-01-05
**Status**: IN_PROGRESS
**Type**: Feature + Infrastructure + Bug Fix Sprint

---

## Sprint Goal

Complete the communications UI (deferred TASK-978), add transaction editing for active transactions, implement critical agent safety measures, and fix UI bugs discovered during hotfix session.

**Core Principle**: Safety first, features second.

---

## 1. Sprint Scope

### In-Scope

| ID | Title | Priority | Est. Tokens | Category |
|----|-------|----------|-------------|----------|
| BACKLOG-161 | Agent Anti-Loop Enforcement | Critical | 5,000 | infra |
| BACKLOG-162 | Fix CI Bash Escaping | Medium | 1,000 | infra |
| TASK-978 | Manual Link Messages UI | P1 | 5,000 | ui |
| TASK-981 | Edit Active Transactions | P2 | 2,000 | ui |
| BACKLOG-165 | Duplicate Contacts in Import Page | Medium | 20,000 | fix |
| BACKLOG-166 | Platform Detection Returns "unknown" | Medium | 15,000 | fix |
| BACKLOG-167 | Restrict Manual Transaction Status | Low | 15,000 | enhancement |

**Total Estimated**: ~63,000 tokens (with 2.5x buffer: ~157,500)

### Completed (Pre-Sprint Hotfixes)
- Transaction bulk status update (allow all 4 statuses)
- Pending tab filtering for `status=pending`
- Amber styling for pending transactions
- Edit button in review mode for `status=pending`

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

### Phase 3: Bug Fixes (Can Parallelize)

| Task | Description | Dependencies |
|------|-------------|--------------|
| TASK-982 | Fix duplicate contacts in Import page (BACKLOG-165) | Phase 1 |
| TASK-983 | Fix platform detection (BACKLOG-166) | Phase 1 |
| TASK-984 | Restrict manual transaction status options (BACKLOG-167) | Phase 1 |

**Execution**: Can run in parallel using worktrees.

---

## 3. Dependency Graph

```
TASK-979 (Anti-Loop Hook) ─────┬──> TASK-978 (Manual Link Messages)
                               │
TASK-980 (CI Fix) ─────────────┼──> TASK-981 (Edit Active Transactions)
                               │
                               ├──> TASK-982 (Duplicate Contacts)
                               │
                               ├──> TASK-983 (Platform Detection)
                               │
                               └──> TASK-984 (Manual Transaction Status)
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
  TASK-982:
    - TASK-979
    - TASK-980
  TASK-983:
    - TASK-979
    - TASK-980
  TASK-984:
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
| TASK-981 | `src/components/transactionDetailsModule/*`, `TransactionHeader.tsx` | **TASK-978** |
| TASK-982 | `electron/contact-handlers.ts`, `src/components/Contacts.tsx` | None |
| TASK-983 | `src/utils/platform.ts`, `src/contexts/PlatformContext.tsx` | None |
| TASK-984 | `src/components/BulkActionBar.tsx`, `electron/transaction-handlers.ts` | **TASK-978** |

**⚠️ WARNING**: TASK-978, TASK-981, TASK-984 may touch transaction components. Run sequentially OR use explicit file boundaries.

**Decision**: Run TASK-978 first, then TASK-981, then TASK-984. TASK-982 and TASK-983 can run in parallel.

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
  ├── PR: TASK-981 (Edit Active Transactions)
  │
  ├── PR: TASK-982 (Duplicate Contacts) ─┐
  │                                       ├─ Can merge in parallel
  ├── PR: TASK-983 (Platform Detection) ─┘
  │
  └── PR: TASK-984 (Manual Transaction Status)
```

**Merge Order**: TASK-979 → TASK-980 → TASK-978 → TASK-981 → (TASK-982 || TASK-983) → TASK-984

---

## 6. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Agent loop despite new safeguards | High | Low | PM monitors ALL agents, no background execution in Phase 1 |
| TASK-978/981/984 file conflict | Medium | Medium | Sequential execution, explicit file boundaries |
| UI regression in transaction view | Medium | Low | Manual testing before merge |
| Platform detection still fails | Low | Low | Multiple fallback mechanisms in solution |

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

### TASK-982 (Duplicate Contacts)
- **Manual test**: Import page shows each contact once
- **Unit test**: Deduplication logic works correctly

### TASK-983 (Platform Detection)
- **Manual test**: No "unknown platform" warning in console
- **Unit test**: Platform detection returns correct value

### TASK-984 (Manual Transaction Status)
- **Manual test**: Manual transactions only show active/closed options
- **Unit test**: Validation rejects invalid status changes

---

## 8. PM Monitoring Protocol (MANDATORY)

Per BACKLOG-161 Solution 4, PM MUST:

1. **Phase 1**: Run agents in foreground, monitor directly
2. **Phase 2+**: If running background agents:
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
- [ ] Import page shows no duplicate contacts
- [ ] Platform detection returns correct platform (not "unknown")
- [ ] Manual transactions only allow active/closed status
- [ ] No token burn incidents (all tasks within 10x estimate)
- [ ] All PRs reviewed by SR Engineer before merge

---

## 10. Task Files

### Phase 1 (Safety)
- `TASK-979-anti-loop-hook.md` - BACKLOG-161 implementation
- `TASK-980-ci-bash-escaping.md` - BACKLOG-162 implementation

### Phase 2 (UI Features)
- `TASK-978-manual-link-messages.md` - Deferred from SPRINT-025
- `TASK-981-edit-active-transactions.md` - Edit button for active transactions

### Phase 3 (Bug Fixes)
- `TASK-982-duplicate-contacts-fix.md` - BACKLOG-165 implementation
- `TASK-983-platform-detection-fix.md` - BACKLOG-166 implementation
- `TASK-984-manual-transaction-status.md` - BACKLOG-167 implementation

---

## 11. Progress Tracking

| Task | Status | Agent ID | Tokens | PR |
|------|--------|----------|--------|-----|
| TASK-979 | Not Started | - | - | - |
| TASK-980 | Not Started | - | - | - |
| TASK-978 | Not Started | - | - | - |
| TASK-981 | Not Started | - | - | - |
| TASK-982 | Not Started | - | - | - |
| TASK-983 | Not Started | - | - | - |
| TASK-984 | Not Started | - | - | - |
