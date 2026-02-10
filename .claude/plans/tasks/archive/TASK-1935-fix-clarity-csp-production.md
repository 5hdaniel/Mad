# Task TASK-1935: Fix Clarity CSP for Production

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

Add `'unsafe-eval'` to the production CSP `script-src` directive in `broker-portal/next.config.mjs` so that Microsoft Clarity's JavaScript (which uses `new Function()`) can execute in production without CSP violations.

## Non-Goals

- Do NOT switch to Clarity's cookie-free mode (does not eliminate `new Function()` usage)
- Do NOT implement nonce-based CSP (requires Next.js middleware changes, out of scope)
- Do NOT modify any other CSP directives
- Do NOT change the dev CSP configuration
- Do NOT remove Clarity integration

## Deliverables

1. Update: `broker-portal/next.config.mjs` -- add `'unsafe-eval'` to production `script-src`

## Acceptance Criteria

- [ ] Production CSP `script-src` includes `'unsafe-eval'`
- [ ] Dev CSP `script-src` still includes `'unsafe-eval'` (unchanged)
- [ ] Both dev and production CSP now have identical `script-src` directives
- [ ] `npm run build -w broker-portal` passes
- [ ] `npm run type-check` passes
- [ ] CSP header comment is updated to explain why `unsafe-eval` is needed in production

## Implementation Notes

### Current State

File: `broker-portal/next.config.mjs`

The current CSP configuration has a conditional for `script-src`:
```javascript
isDev
  ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms"
  : "script-src 'self' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms",
```

In development, `unsafe-eval` is included (for HMR/Fast Refresh AND Clarity). In production, it is excluded -- but Clarity still needs it.

### The Fix

Change the production `script-src` to include `'unsafe-eval'`:

**Before:**
```javascript
// Development needs unsafe-eval for HMR/Fast Refresh; production does not
isDev
  ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms"
  : "script-src 'self' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms",
```

**After:**
```javascript
// unsafe-eval required in both dev (HMR) and prod (Clarity uses new Function())
"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms",
```

Since both environments now need `unsafe-eval`, the conditional can be removed entirely for this directive. The `isDev` variable may still be used elsewhere (check first), but the `script-src` line becomes unconditional.

### Important: Check if isDev is used elsewhere

Before removing the conditional entirely, verify if `isDev` is used for any other directive:
```bash
grep -n "isDev" broker-portal/next.config.mjs
```

If `isDev` is only used for this one line, you can simplify by removing the ternary. If it's used elsewhere, keep the variable declaration but simplify the `script-src` line.

### Security Note

Adding `unsafe-eval` to `script-src` allows `eval()` and `new Function()` calls from allowed script origins. This is a known tradeoff for Microsoft Clarity compatibility. The risk is mitigated by:
- Scripts are limited to `'self'`, `clarity.ms`, and `scripts.clarity.ms`
- `connect-src` still restricts network requests
- All other CSP directives remain strict

## Integration Notes

- No other tasks depend on this change
- This file is not modified by any other SPRINT-075 task
- The broker-portal CSP is independent of the Electron app's security

## Do / Don't

### Do:
- Update the comment to accurately explain why `unsafe-eval` is needed
- Verify the broker-portal still builds after the change
- Keep the CSP as strict as possible for all other directives

### Don't:
- Don't add `unsafe-eval` to any other CSP directive (only `script-src`)
- Don't remove the Clarity domain allowlists
- Don't modify any other security headers (X-Content-Type-Options, X-Frame-Options, etc.)

## When to Stop and Ask

- If the `next.config.mjs` file has changed significantly from what's described above
- If there are other CSP-related configurations (middleware, headers elsewhere)
- If removing the `isDev` conditional affects other parts of the config

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No -- configuration change, no testable logic
- Existing tests to update: None

### Coverage

- Coverage impact: None

### Integration / Feature Testing

- Manual verification (post-deploy): Open broker portal in production, check browser console for CSP violation errors related to Clarity
- Verify Clarity dashboard receives data

### CI Requirements

This task's PR MUST pass:
- [ ] Build (`npm run build -w broker-portal`)
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(broker-portal): add unsafe-eval to production CSP for Clarity compatibility`
- **Labels**: `config`, `security`, `broker-portal`
- **Sprint**: SPRINT-075
- **Branch**: `fix/repo-cleanup-hardening`
- **Target**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~3K (config x 0.5 = ~3K from ~5K base)

**Token Cap:** 12K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file | +2K |
| Code volume | ~3 lines changed | +1K |
| Test complexity | None | +0K |

**Confidence:** High

**Risk factors:**
- Essentially zero risk -- simple config line change

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
- [ ] broker-portal/next.config.mjs

Verification:
- [ ] npm run build -w broker-portal passes
- [ ] npm run type-check passes
- [ ] CSP script-src includes unsafe-eval in production
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~3K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If no deviations, write "None">

**Issues encountered:**
<Document any issues>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** N/A
**Security Review:** PASS / FAIL (verify CSP change is minimal and justified)
**Test Coverage:** N/A

**Review Notes:**
<Verify only script-src is changed, comment explains the tradeoff>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
