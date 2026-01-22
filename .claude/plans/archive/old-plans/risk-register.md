# Risk Register

**Last Updated:** 2026-01-03
**Maintained By:** PM Agent

---

## Active Risks

### RISK-001: State Coordination Overhaul Breaks Auth Flow

**Status:** Active
**Severity:** High
**Probability:** Medium
**Initiative:** BACKLOG-142 (State Coordination Overhaul)

**Description:**
The state coordination overhaul (BACKLOG-142) touches the auth/onboarding flow which is critical for user access. A regression could prevent users from logging in.

**Impact:**
- Users unable to login
- App unusable without auth
- Support tickets increase

**Mitigation Strategies:**

| Strategy | Owner | Status |
|----------|-------|--------|
| Parallel implementation (Phase 1 adds, doesn't remove) | PM | Planned |
| Feature flag with instant rollback | Engineer (TASK-933) | Planned |
| Integration tests for all auth flows | Engineer (TASK-931) | Planned |
| Platform testing at each phase | SR Engineer | Planned |
| Project branch for all work | PM | Planned |

**Contingency Plan:**
If auth breaks in production:
1. Immediately disable feature flag via localStorage
2. Push hotfix to disable flag by default
3. Investigate root cause
4. Re-enable after fix verified

**Monitoring:**
- "Database not initialized" errors in logs
- Login failure rate increase
- Support ticket volume

---

### RISK-002: Platform-Specific Edge Cases Not Covered

**Status:** Active
**Severity:** Medium
**Probability:** Medium
**Initiative:** BACKLOG-142

**Description:**
macOS and Windows have different secure storage implementations (Keychain vs DPAPI). Platform-specific edge cases may not be discovered until late in development.

**Impact:**
- One platform works, other doesn't
- Windows users or macOS users blocked
- Last-minute fixes needed

**Mitigation Strategies:**

| Strategy | Owner | Status |
|----------|-------|--------|
| Platform-specific task (TASK-932) | Engineer | Planned |
| Test on both platforms at each task | SR Engineer | Planned |
| CI runs on both macOS and Windows | CI | Active |
| Document platform differences | Engineer | Planned |

**Contingency Plan:**
If platform issues found:
1. Disable feature flag on affected platform
2. Create hotfix branch
3. Add platform-specific regression test

---

### RISK-003: State Machine Design Requires Iteration

**Status:** Active
**Severity:** Low
**Probability:** Medium
**Initiative:** BACKLOG-142

**Description:**
The state machine types and transitions (TASK-927, TASK-928) may need iteration as we implement consumers. Early design decisions could be wrong.

**Impact:**
- Rework in later tasks
- Token overrun in Phase 2
- Design changes ripple through

**Mitigation Strategies:**

| Strategy | Owner | Status |
|----------|-------|--------|
| Design review before TASK-928 starts | SR Engineer | Planned |
| Types are in separate file (easy to update) | Engineer | Planned |
| Phase 1 is parallel (changes don't break existing) | PM | Planned |

**Contingency Plan:**
If design needs major changes:
1. Create design revision task
2. Estimate token impact
3. Adjust Phase 2 scope if needed

---

### RISK-004: Token Overrun from Debugging

**Status:** Active
**Severity:** Medium
**Probability:** Medium
**Initiative:** BACKLOG-142

**Description:**
SPRINT-014 and SPRINT-019 showed that debugging can consume 100-2000% of estimated tokens. State machine work may have similar issues.

**Impact:**
- Budget overrun
- Sprint scope reduced
- Timeline slip

**Mitigation Strategies:**

| Strategy | Owner | Status |
|----------|-------|--------|
| Token caps on all tasks | PM | Done |
| PM monitoring during execution | PM | Planned |
| Stop-and-ask at cap | Engineer | In process docs |
| Integration tests early (TASK-931) | Engineer | Planned |

**Contingency Plan:**
If token cap hit:
1. Engineer stops and reports
2. PM evaluates: simplify scope or allocate more
3. Document root cause for future estimates

---

## Closed Risks

### RISK-000: Database Initialization Race Condition (Example)

**Status:** Closed - Resolved
**Closed Date:** 2026-01-03
**Resolution:** SPRINT-019 implemented database init gate

---

## Risk Severity Matrix

| Probability \ Impact | Low | Medium | High | Critical |
|---------------------|-----|--------|------|----------|
| **High** | Monitor | Mitigate | Mitigate | Prevent |
| **Medium** | Accept | Monitor | Mitigate | Mitigate |
| **Low** | Accept | Accept | Monitor | Mitigate |

---

## Risk Categories

| Category | Description |
|----------|-------------|
| Technical | Code, architecture, integration |
| Process | Workflow, communication, handoffs |
| Resource | Token budget, time, capacity |
| Platform | macOS/Windows specific |
| External | Dependencies, APIs, services |

---

## Changelog

- 2026-01-03: Created risk register with BACKLOG-142 risks
