# Phase 1: Test Stabilization - Engineer Assignment Prompts

**Sprint:** TECHDEBT-2024-01
**Phase Goal:** Get all skipped tests passing
**Tasks:** TASK-201, TASK-202, TASK-203, TASK-204

These tasks can run **in parallel** as they modify independent test files.

> **Metrics Protocol:** See `.claude/docs/METRICS-PROTOCOL.md` for full details.
> - **Engineer** tracks their own metrics (implementation + debugging)
> - **Senior Engineer** tracks their own metrics (review), then approves and merges
> - **PM** records both sets of metrics from merged PR to INDEX.md

---

## TASK-201: Fix App.test.tsx Skipped Tests

**Copy this prompt to a new Claude instance:**

```
**START TIME:** Note your start time now: _______________

Read `.claude/plans/tasks/TASK-201-fix-app-tests.md` and complete the task.

Follow the git branching strategy in `CLAUDE.md`:
1. Create branch `fix/task-201-app-tests` from `develop`
2. Implement the fixes according to the task file
3. Run `npm test -- --testPathPattern=App.test.tsx` to verify
4. Run tests 3x to ensure no flakiness
5. Create PR targeting `develop`
6. Wait for CI to pass
7. **Add YOUR Engineer Metrics to PR description** (format below)
8. Request Senior Engineer review (they will add their metrics and merge)

**ENGINEER METRICS REPORTING (REQUIRED) - Add to PR description AFTER CI passes:**

---

## Engineer Metrics: TASK-201

**Engineer Start Time:** [when you started]
**Engineer End Time:** [when CI passed]

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |

**Implementation Notes:** [any context about your implementation]

---

**Maps to INDEX.md columns:**
- Impl Turns | Impl Tokens | Impl Time
- Debug Turns | Debug Tokens | Debug Time

**What you do NOT track:**
- PR metrics (Senior Engineer tracks their own)

See `.claude/docs/METRICS-PROTOCOL.md` for full protocol.
```

**Estimated:** 12-18 turns, 48-72K tokens (engineer portion)
**File:** `src/components/__tests__/App.test.tsx`
**Tests:** 14 skipped tests (async hook timing issues)

---

## TASK-202: Fix AppleDriverSetup.test.tsx Flaky Tests

**Copy this prompt to a new Claude instance:**

```
**START TIME:** Note your start time now: _______________

Read `.claude/plans/tasks/TASK-202-fix-driver-tests.md` and complete the task.

Follow the git branching strategy in `CLAUDE.md`:
1. Create branch `fix/task-202-driver-tests` from `develop`
2. Implement the fixes according to the task file
3. Run `npm test -- --testPathPattern=AppleDriverSetup.test.tsx` to verify
4. Run tests 3x to ensure no flakiness
5. Create PR targeting `develop`
6. Wait for CI to pass
7. **Add YOUR Engineer Metrics to PR description** (format below)
8. Request Senior Engineer review (they will add their metrics and merge)

**ENGINEER METRICS REPORTING (REQUIRED) - Add to PR description AFTER CI passes:**

---

## Engineer Metrics: TASK-202

**Engineer Start Time:** [when you started]
**Engineer End Time:** [when CI passed]

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |

**Implementation Notes:** [any context about your implementation]

---

**Maps to INDEX.md columns:**
- Impl Turns | Impl Tokens | Impl Time
- Debug Turns | Debug Tokens | Debug Time

**What you do NOT track:**
- PR metrics (Senior Engineer tracks their own)

See `.claude/docs/METRICS-PROTOCOL.md` for full protocol.
```

**Estimated:** 10-15 turns, 40-60K tokens (engineer portion)
**File:** `src/components/__tests__/AppleDriverSetup.test.tsx`
**Tests:** 8 skipped tests (fake timer issues, UI text changes)

---

## TASK-203: Fix syncOrchestrator.test.ts Skipped Tests

**Copy this prompt to a new Claude instance:**

```
**START TIME:** Note your start time now: _______________

Read `.claude/plans/tasks/TASK-203-fix-sync-tests.md` and complete the task.

Follow the git branching strategy in `CLAUDE.md`:
1. Create branch `fix/task-203-sync-tests` from `develop`
2. Implement the fixes according to the task file
3. Run `npm test -- --testPathPattern=syncOrchestrator.test.ts` to verify
4. Run tests 3x to ensure no flakiness
5. Create PR targeting `develop`
6. Wait for CI to pass
7. **Add YOUR Engineer Metrics to PR description** (format below)
8. Request Senior Engineer review (they will add their metrics and merge)

**ENGINEER METRICS REPORTING (REQUIRED) - Add to PR description AFTER CI passes:**

---

## Engineer Metrics: TASK-203

**Engineer Start Time:** [when you started]
**Engineer End Time:** [when CI passed]

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |

**Implementation Notes:** [any context about your implementation]

---

**Maps to INDEX.md columns:**
- Impl Turns | Impl Tokens | Impl Time
- Debug Turns | Debug Tokens | Debug Time

**What you do NOT track:**
- PR metrics (Senior Engineer tracks their own)

See `.claude/docs/METRICS-PROTOCOL.md` for full protocol.
```

**Estimated:** 15-25 turns, 60-100K tokens (engineer portion)
**File:** `electron/services/__tests__/syncOrchestrator.test.ts`
**Tests:** 9+ skipped tests (complex mocking required)

---

## TASK-204: Fix EmailOnboardingScreen.test.tsx Skipped Tests

**Copy this prompt to a new Claude instance:**

```
**START TIME:** Note your start time now: _______________

Read `.claude/plans/tasks/TASK-204-fix-email-tests.md` and complete the task.

Follow the git branching strategy in `CLAUDE.md`:
1. Create branch `fix/task-204-email-tests` from `develop`
2. Implement the fixes according to the task file
3. Run `npm test -- --testPathPattern=EmailOnboardingScreen.test.tsx` to verify
4. Run tests 3x to ensure no flakiness
5. Create PR targeting `develop`
6. Wait for CI to pass
7. **Add YOUR Engineer Metrics to PR description** (format below)
8. Request Senior Engineer review (they will add their metrics and merge)

**ENGINEER METRICS REPORTING (REQUIRED) - Add to PR description AFTER CI passes:**

---

## Engineer Metrics: TASK-204

**Engineer Start Time:** [when you started]
**Engineer End Time:** [when CI passed]

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |

**Implementation Notes:** [any context about your implementation]

---

**Maps to INDEX.md columns:**
- Impl Turns | Impl Tokens | Impl Time
- Debug Turns | Debug Tokens | Debug Time

**What you do NOT track:**
- PR metrics (Senior Engineer tracks their own)

See `.claude/docs/METRICS-PROTOCOL.md` for full protocol.
```

**Estimated:** 5-8 turns, 20-32K tokens (engineer portion)
**File:** `src/components/__tests__/EmailOnboardingScreen.test.tsx`
**Tests:** 3 skipped tests (pre-DB flow issues)

---

## Phase 1 Summary

| Task | Est. Eng Turns | Est. Eng Tokens | Tests | Parallelizable |
|------|----------------|-----------------|-------|----------------|
| TASK-201 | 12-18 | 48-72K | 14 | Yes |
| TASK-202 | 10-15 | 40-60K | 8 | Yes |
| TASK-203 | 15-25 | 60-100K | 9+ | Yes |
| TASK-204 | 5-8 | 20-32K | 3 | Yes |
| **Total (Eng)** | **42-66** | **168-264K** | **34+** | |

*Note: SR Engineer review metrics will be added separately and tracked in INDEX.md*

---

## Role Responsibilities

### Engineer (executes task)
1. Track YOUR metrics from start
2. Complete implementation
3. Wait for CI to pass
4. **Add YOUR Engineer Metrics to PR description**
5. Request Senior Engineer review

### Senior Engineer (reviews + merges)
1. Verify Engineer Metrics are present
2. Track YOUR review metrics
3. Review code quality and architecture
4. **Add YOUR SR Metrics to PR** (commit or description edit)
5. **Approve and merge the PR**

### PM (records after merge)
1. Read merged PR description
2. Extract Engineer Metrics
3. Extract SR Engineer Metrics
4. Calculate totals
5. Update `INDEX.md` with both sets of metrics
6. Update sprint plan to mark task complete

---

## PM Checklist (After Each Task Merges)

- [ ] Read PR description for both metrics sections
- [ ] Extract Engineer Metrics: Impl (turns/tokens/time) + Debug (turns/tokens/time)
- [ ] Extract SR Engineer Metrics: PR (turns/tokens/time)
- [ ] Update `INDEX.md` with full granularity:
  ```
  | ID | Title | Est. Turns | Est. Tokens | Est. Time | Impl Turns | Impl Tokens | Impl Time | PR Turns | PR Tokens | PR Time | Debug Turns | Debug Tokens | Debug Time | Status |
  ```
- [ ] Mark task complete in sprint plan
- [ ] Note any significant variance (>20%) for calibration

Once all Phase 1 tasks complete:
- [ ] Run full `npm test` to verify all tests pass together
- [ ] Verify CI passes on develop branch
- [ ] Phase 1 complete - Phase 2 and Phase 3 can proceed
