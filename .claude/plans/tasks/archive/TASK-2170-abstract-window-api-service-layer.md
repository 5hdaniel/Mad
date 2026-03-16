# Task TASK-2170: Abstract window.api Calls into Service Layer (Top 10)

**Status:** Completed
**Sprint:** SPRINT-129
**Backlog:** BACKLOG-204

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Migrate the top 10 component files away from direct `window.api.*` calls to use existing service layer abstractions in `src/services/`. Only migrate calls that already have corresponding service wrappers -- do NOT create new service methods in this task.

## Target Components (Top 10)

1. `src/components/Settings.tsx`
2. `src/components/Login.tsx`
3. `src/components/OutlookExport.tsx`
4. `src/components/ExportModal.tsx`
5. `src/components/MacOSMessagesImportSettings.tsx`
6. `src/components/LLMSettings.tsx`
7. `src/components/SystemHealthMonitor.tsx`
8. `src/components/MicrosoftLogin.tsx`
9. `src/components/TransactionDetails.tsx`
10. `src/components/UpdateNotification.tsx`

## Non-Goals

- Do NOT create new service methods -- only migrate calls where a service wrapper already exists
- Do NOT migrate components beyond the top 10 listed above
- Do NOT modify `electron/` files
- Do NOT refactor component logic beyond replacing `window.api` calls
- Do NOT change error handling patterns in components (beyond adopting service error types)
- Do NOT migrate `window.api` calls in hooks or sub-components of these files

## Deliverables

1. Update: 10 component files -- replace direct `window.api.*` calls with service imports
2. Update: Component test files -- mock service layer instead of `window.api` where applicable
3. Document: List of `window.api` calls that could NOT be migrated (no existing service wrapper)

## File Boundaries

### Files to modify (owned by this task):

- `src/components/Settings.tsx`
- `src/components/Login.tsx`
- `src/components/OutlookExport.tsx`
- `src/components/ExportModal.tsx`
- `src/components/MacOSMessagesImportSettings.tsx`
- `src/components/LLMSettings.tsx`
- `src/components/SystemHealthMonitor.tsx`
- `src/components/MicrosoftLogin.tsx`
- `src/components/TransactionDetails.tsx`
- `src/components/UpdateNotification.tsx`
- Corresponding test files for the above components

### Files this task must NOT modify:

- Any `electron/` files -- Out of scope
- `src/services/*.ts` -- Do NOT add new service methods
- Other `src/components/` files beyond the top 10
- `src/utils/` -- Out of scope (TASK-2168 handles utilities)

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] All `window.api.*` calls in the 10 target components that have existing service wrappers are replaced with service imports
- [ ] Components import from `src/services/` instead of calling `window.api` directly
- [ ] Unmigrated `window.api` calls (no service wrapper exists) are documented in Implementation Summary
- [ ] Component behavior is unchanged (same functionality, same error handling)
- [ ] Updated component tests mock service layer (not `window.api`)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No `electron/` files modified
- [ ] No new service methods created

## Implementation Notes

### Step 1: Catalog window.api Calls in Target Components

For each of the 10 components, list every `window.api.*` call:

```bash
# For each target component
grep -n "window\.api\." src/components/Settings.tsx
grep -n "window\.api\." src/components/Login.tsx
# ... etc for all 10
```

### Step 2: Map to Existing Services

Check which calls have existing service wrappers:

```bash
# List available service methods
grep -rn "export" src/services/*.ts | grep -v "test" | head -50
```

Create a mapping table:
| Component | window.api Call | Service Method | Can Migrate? |
|-----------|----------------|----------------|-------------|
| Settings.tsx | window.api.auth.getCurrentUser() | authService.getCurrentUser() | Yes |
| Settings.tsx | window.api.system.openExternal() | -- | No (no wrapper) |

### Step 3: Migrate Each Component

For each component, in order:

```typescript
// Before
const user = await window.api.auth.getCurrentUser();

// After
import { authService } from '../services/authService';
const user = await authService.getCurrentUser();
```

### Step 4: Update Tests

```typescript
// Before (mocking window.api)
jest.spyOn(window.api.auth, 'getCurrentUser').mockResolvedValue(mockUser);

// After (mocking service)
jest.mock('../services/authService');
(authService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
```

### Available Services (Reference)

Check these files for existing wrappers:
- `src/services/authService.ts`
- `src/services/transactionService.ts`
- `src/services/systemService.ts`
- `src/services/deviceService.ts`
- `src/services/contactService.ts`
- `src/services/exportService.ts`
- `src/services/syncService.ts`

### IPC Error Types (from TASK-2169)

After TASK-2169 merges, the `IpcError` and `IpcResult` types will be available. Service methods may already handle these. If not, document which service methods need error type updates for a follow-up task.

## Integration Notes

- **Depends on:** TASK-2169 (IPC error handling) must be merged first
- This is the final task in SPRINT-129
- PR targets: `int/sprint-129-refactor`
- Reference: BACKLOG-204 for full scope (this task is a subset)
- Reference: `.claude/docs/shared/architecture-guardrails.md` for service layer patterns

## Do / Don't

### Do:

- Catalog ALL `window.api` calls in target components before migrating
- Verify each service wrapper exists before attempting migration
- Document unmigrated calls clearly
- Run type-check after each component migration
- Update tests to mock services instead of window.api

### Don't:

- Create new service methods (out of scope)
- Migrate components beyond the top 10
- Change component behavior or UI
- Modify electron/ files
- Refactor component logic beyond the api call swap

## When to Stop and Ask

- If a target component has more than 20 `window.api` calls (may need to split further)
- If a service wrapper exists but has a different signature than the `window.api` call
- If component tests are extensive and require major rework to switch mock targets
- If TASK-2169 error types are not yet available in the integration branch

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (test updates)
- New tests to write:
  - None (existing component tests should be updated, not new tests)
- Existing tests to update:
  - Component tests that mock `window.api` should be updated to mock services
  - Verify all existing test assertions still pass

### Coverage

- Coverage impact: Should not decrease
- Migration should be transparent to test assertions

### Integration / Feature Tests

- Each migrated component should function identically:
  - Settings page loads and saves correctly
  - Login flow works end-to-end
  - Export features function as before
  - All migrated functionality verified manually via `npm run dev`

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without passing CI WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(components): abstract window.api calls to service layer (top 10)`
- **Branch**: `refactor/task-e-window-api-abstraction`
- **Base**: `int/sprint-129-refactor`
- **Labels**: `refactor`, `architecture`
- **Depends on**: TASK-2169 merged to `int/sprint-129-refactor`

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~50K

**Token Cap:** 200K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 10 components + ~5 test files | +25K |
| Exploration | Cataloging window.api calls, mapping to services | +10K |
| Test updates | Switching mock targets | +10K |
| Verification | Running checks after each migration | +5K |

**Confidence:** Medium

**Risk factors:**
- Some components may have many window.api calls
- Test mock patterns may vary across components
- Service wrappers may not cover all calls (documentation needed for remainder)

**Similar past tasks:** Refactor tasks typically at 0.5x (applied). Base estimate ~100K reduced to ~50K.

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Components migrated:
- [ ] Settings.tsx
- [ ] Login.tsx
- [ ] OutlookExport.tsx
- [ ] ExportModal.tsx
- [ ] MacOSMessagesImportSettings.tsx
- [ ] LLMSettings.tsx
- [ ] SystemHealthMonitor.tsx
- [ ] MicrosoftLogin.tsx
- [ ] TransactionDetails.tsx
- [ ] UpdateNotification.tsx

Tests updated:
- [ ] (list test files updated)

Unmigrated window.api calls (no service wrapper):
- (list calls that could not be migrated)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~50K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Window.api call catalog, service mapping table>

**Deviations from plan:**
<If any, explain what and why. Otherwise "None">

**Design decisions:**
<Decisions on which calls to migrate vs skip>

**Issues encountered:**
<Document any issues>

**Reviewer notes:**
<Anything the reviewer should pay attention to, especially unmigrated calls>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~50K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, service layer usage patterns, unmigrated call review>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/sprint-129-refactor

### Merge Verification (MANDATORY)

```bash
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
