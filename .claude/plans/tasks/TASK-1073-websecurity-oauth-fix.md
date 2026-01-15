# Task TASK-1073: Fix Disabled webSecurity in OAuth Popup Windows

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1073 |
| **Sprint** | SPRINT-039 |
| **Backlog Item** | BACKLOG-232 |
| **Priority** | CRITICAL |
| **Phase** | 1 |
| **Category** | security |
| **Estimated Tokens** | ~30K |
| **Token Cap** | 120K |

---

## Goal

Re-enable `webSecurity` in OAuth popup BrowserWindows for Google and Microsoft authentication while ensuring OAuth flows continue to work correctly.

## Non-Goals

- Do NOT refactor the entire OAuth flow
- Do NOT change the token storage mechanism
- Do NOT add new OAuth providers
- Do NOT modify the main window security settings

## Deliverables

1. Update: `electron/handlers/googleAuthHandlers.ts` - Remove `webSecurity: false`
2. Update: `electron/handlers/microsoftAuthHandlers.ts` - Remove `webSecurity: false`
3. New tests: OAuth handler configuration tests

## Acceptance Criteria

- [ ] `webSecurity: false` removed from Google OAuth BrowserWindow
- [ ] `webSecurity: false` removed from Microsoft OAuth BrowserWindow
- [ ] Google OAuth sign-in flow works end-to-end
- [ ] Microsoft OAuth sign-in flow works end-to-end
- [ ] Token exchange completes successfully for both providers
- [ ] No CORS errors in OAuth flow
- [ ] Unit tests for BrowserWindow configuration
- [ ] All CI checks pass

## Implementation Notes

### Problem Analysis

The current OAuth popup windows disable web security:
```typescript
// DANGEROUS - This disables same-origin policy
const authWindow = new BrowserWindow({
  webPreferences: {
    webSecurity: false,  // <-- SECURITY HOLE
    // ...
  }
});
```

Disabling `webSecurity` allows:
- Cross-origin requests without CORS
- Potential XSS attacks from OAuth provider pages
- Reduced isolation between contexts

### Key Patterns

The fix should simply remove the `webSecurity: false` option:

```typescript
// Before (insecure)
const authWindow = new BrowserWindow({
  webPreferences: {
    webSecurity: false,
    nodeIntegration: false,
    contextIsolation: true,
  }
});

// After (secure)
const authWindow = new BrowserWindow({
  webPreferences: {
    // webSecurity defaults to true when not specified
    nodeIntegration: false,
    contextIsolation: true,
  }
});
```

### Why This Should Work

OAuth flows typically don't need `webSecurity: false` because:
1. OAuth redirects happen via navigation, not XHR/fetch
2. The redirect URL is registered with the OAuth provider
3. Token exchange happens server-side or via allowed redirect

### Potential Issues to Watch For

If OAuth breaks after this change, investigate:

1. **CORS on token exchange**: If token exchange uses fetch from the popup, may need backend proxy
2. **Redirect URI issues**: Ensure redirect URIs are correctly registered
3. **Cookie handling**: Some OAuth flows rely on cookies that might be blocked

### Investigation Steps

1. Read current OAuth handler implementations
2. Identify where `webSecurity: false` is set
3. Remove the setting
4. Test both OAuth providers
5. If issues arise, document and propose alternative fix

## Integration Notes

- Imports from: Electron's `BrowserWindow`
- Used by: Main window auth triggers
- Depends on: None (standalone security fix)

## Do / Don't

### Do:

- Remove `webSecurity: false` from OAuth windows
- Test both Google and Microsoft flows
- Add unit tests for BrowserWindow configuration
- Document any CORS issues encountered

### Don't:

- Add workarounds that compromise security
- Disable other security features to "fix" CORS
- Modify the main window security settings
- Change the token storage or refresh mechanism

## When to Stop and Ask

- If removing `webSecurity: false` breaks OAuth flow completely
- If CORS errors appear that require architectural changes
- If you discover other security issues in the OAuth flow
- If the fix requires changes to token exchange logic

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that Google OAuth BrowserWindow has `webSecurity: true` (or undefined)
  - Test that Microsoft OAuth BrowserWindow has `webSecurity: true` (or undefined)
  - Test BrowserWindow configuration includes required security settings

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Complete Google OAuth sign-in flow
  - Complete Microsoft OAuth sign-in flow
  - Verify tokens are correctly stored after OAuth

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(security): re-enable webSecurity in OAuth windows`
- **Labels**: `security`, `oauth`, `fix`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~30K

**Token Cap:** 120K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 handler files | +10K |
| Investigation | Read OAuth flow, test | +10K |
| Tests | Unit tests for config | +10K |

**Confidence:** Medium

**Risk factors:**
- OAuth may break if webSecurity was actually required
- May need to investigate CORS issues

**Similar past tasks:** Security category uses 0.4x multiplier

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
Files modified:
- [ ] electron/handlers/googleAuthHandlers.ts
- [ ] electron/handlers/microsoftAuthHandlers.ts

Features implemented:
- [ ] webSecurity re-enabled (removed false setting)
- [ ] OAuth flows verified working

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual OAuth testing completed
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~30K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-232 | Disabled webSecurity in OAuth Windows | Source backlog item |

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-15 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-1073-websecurity-oauth-fix

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** TASK-1075 (Phase 2 starts after Phase 1)

### Shared File Analysis
- Files modified: `googleAuthHandlers.ts`, `microsoftAuthHandlers.ts`
- Conflicts with: None

### Technical Considerations

**Scope Clarification:**
The task correctly identifies the issue. Code review reveals:

1. **googleAuthHandlers.ts** - 4 BrowserWindow instances with:
   - `webSecurity: false` (line 135, 635, 869)
   - `allowRunningInsecureContent: true` (line 136, 636, 870)

2. **microsoftAuthHandlers.ts** - 3 BrowserWindow instances with:
   - `webSecurity: false` (line 123, 558, 772)
   - `allowRunningInsecureContent: true` (line 124, 559, 773)

**CRITICAL FINDING:** The task description mentions only `webSecurity: false` but the code also has `allowRunningInsecureContent: true`. **Both settings should be removed.**

**Risk Assessment:**
- CSP header stripping is present (lines 143-162 in google, 133-152 in microsoft). This is acceptable for OAuth flows as OAuth providers require specific headers.
- OAuth should work without webSecurity disabled because:
  - Token exchange uses navigation interception, not fetch
  - The callback URL is intercepted before rendering
  - CSP stripping handles provider-specific requirements

**Testing Guidance:**
- Test with actual Google/Microsoft accounts
- Verify no CORS errors in DevTools
- Confirm token exchange completes

### Complexity Assessment
**Estimated Tokens:** ~30K is appropriate
**Confidence:** High - straightforward removal of settings
