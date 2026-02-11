# Task TASK-1947: Fix System Health Check "Provider must be one of" Error

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Fix the system health check error `"Provider must be one of: google, microsoft"` that occurs when `provider` is an empty string `""`. The `system:health-check` IPC handler at `electron/system-handlers.ts:1012` uses a ternary `provider ? validateProvider(provider) : null` which correctly handles `null` but fails when provider is `""` (empty string is falsy in JS, so it already goes to `null` branch). Investigate the actual root cause -- the error is being thrown, so the provider value reaching the handler must be something other than `null` or `""` (possibly `"azure"` which is a valid `OAuthProvider` type but not accepted by `validateProvider`).

## Non-Goals

- Do NOT refactor the entire health check system
- Do NOT modify the health check response format
- Do NOT add new health check categories
- Do NOT modify other IPC handlers in `system-handlers.ts`

## Deliverables

1. Update: `electron/system-handlers.ts` -- fix the provider validation in `system:health-check` handler
2. Possibly update: `electron/utils/validation.ts` -- if `validateProvider` needs to accept `"azure"` or handle edge cases
3. Update or add test coverage for the fix

## Acceptance Criteria

- [ ] `system:health-check` no longer throws when provider is `""`, `undefined`, `null`, or `"azure"`
- [ ] Valid providers (`"google"`, `"microsoft"`) still work correctly
- [ ] The health check gracefully skips provider-specific checks when no valid provider is available
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Error no longer appears in logs during normal app usage

## Implementation Notes

### Root Cause Analysis

The error message is: `Provider must be one of: google, microsoft`

This comes from `electron/utils/validation.ts:306`:
```typescript
export function validateProvider(provider: unknown): string {
  if (!provider || typeof provider !== "string") {
    throw new ValidationError("Provider is required and must be a string", "provider");
  }
  const validProviders = ["google", "microsoft"];
  const lowercase = provider.toLowerCase();
  if (!validProviders.includes(lowercase)) {
    throw new ValidationError(`Provider must be one of: ${validProviders.join(", ")}`, "provider");
  }
  ...
}
```

The `system:health-check` handler at line 1012:
```typescript
const validatedProvider = provider ? validateProvider(provider) : null;
```

The ternary handles `null` and `""` (both falsy). But the `OAuthProvider` type is `"google" | "microsoft" | "azure"`. If the user authenticates via Azure AD, `authProvider` in `AppShell.tsx` would be `"azure"`, which is truthy, so `validateProvider("azure")` gets called and throws because `"azure"` is not in the valid providers list.

### Fix Strategy

**Option A (Recommended):** Update `validateProvider` in `validation.ts` to accept `"azure"` and map it to `"microsoft"` (since Azure AD uses Microsoft Graph API):

```typescript
export function validateProvider(provider: unknown): string {
  if (!provider || typeof provider !== "string") {
    throw new ValidationError("Provider is required and must be a string", "provider");
  }
  // Azure uses Microsoft Graph, normalize
  const normalized = provider.toLowerCase() === "azure" ? "microsoft" : provider.toLowerCase();
  const validProviders = ["google", "microsoft"];
  if (!validProviders.includes(normalized)) {
    throw new ValidationError(`Provider must be one of: ${validProviders.join(", ")}`, "provider");
  }
  return normalized;
}
```

**Option B:** Handle it at the call site in `system-handlers.ts`:

```typescript
// Normalize azure to microsoft for connection checking
const normalizedProvider = provider === "azure" ? "microsoft" : provider;
const validatedProvider = normalizedProvider ? validateProvider(normalizedProvider) : null;
```

**Option C:** Add additional guard to skip validation for unrecognized providers:

```typescript
const validatedProvider = provider && ["google", "microsoft", "azure"].includes(provider)
  ? validateProvider(provider === "azure" ? "microsoft" : provider)
  : null;
```

Choose whichever approach best fits the codebase patterns. Option A is cleanest since it fixes the validation utility globally. Check if `validateProvider` is called from other places (`transaction-handlers.ts:991`) and ensure the azure normalization works there too.

### Caller Context

In `src/appCore/AppShell.tsx:116`:
```tsx
provider={authProvider as OAuthProvider}
```

The `OAuthProvider` type (`electron/types/models.ts:14`) includes `"azure"`:
```typescript
export type OAuthProvider = "google" | "microsoft" | "azure";
```

The `authProvider` guard (`authProvider &&`) at line 109 ensures it's truthy, but when it's `"azure"`, the downstream validation fails.

## Integration Notes

- `validateProvider` is also used in `transaction-handlers.ts:991` -- ensure the fix works there too
- `SystemHealthMonitor.tsx` calls `window.api.system.healthCheck(userId, provider)` at line 51
- The `provider` prop comes from `AppShell.tsx` which casts `authProvider as OAuthProvider`

## Do / Don't

### Do:
- Fix the root cause, not just the symptom
- Check all call sites of `validateProvider` to ensure consistency
- Add a test case for `"azure"` provider value
- Keep the fix minimal and focused

### Don't:
- Do NOT change the `OAuthProvider` type definition
- Do NOT modify `SystemHealthMonitor.tsx` component logic
- Do NOT add new IPC channels
- Do NOT modify health check response types

## When to Stop and Ask

- If the root cause is different from what's described (not the `"azure"` provider issue)
- If fixing `validateProvider` breaks other call sites
- If the fix requires changes to more than 3 files

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test `validateProvider("azure")` returns `"microsoft"` (if Option A)
  - Test `system:health-check` handler with `provider = "azure"`
  - Test `system:health-check` handler with `provider = ""` (should not throw)
  - Test `system:health-check` handler with `provider = null` (should not throw)
- Existing tests to update:
  - Check if `validation.test.ts` exists and update provider tests

### Coverage

- Coverage impact: Should increase (adding edge case tests)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `fix(system): handle azure provider in health check validation`
- **Base**: `develop`
- **Labels**: `bug`, `electron`

---

## PM Estimate (PM-Owned)

**Category:** `bug`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 files (validation.ts, possibly system-handlers.ts) | +5K |
| Code volume | ~10 lines changed | +2K |
| Test complexity | Medium (need edge case tests) | +3K |

**Confidence:** High

**Risk factors:**
- Need to verify the actual root cause matches the analysis
- `validateProvider` is shared -- must ensure no regressions

---

## Implementation Summary (Engineer-Owned)

*Completed: 2026-02-10*

### Agent ID

```
Engineer Agent ID: (auto-captured by SubagentStop hook)
```

### Checklist

```
Files modified:
- [x] electron/utils/validation.ts
- [x] electron/utils/__tests__/validation.test.ts
- [x] electron/__tests__/system-handlers.test.ts

Features implemented:
- [x] Azure provider handled gracefully (normalized to "microsoft")
- [x] Empty/null/undefined provider handled (falsy check in system-handlers.ts already correct)
- [x] All validation call sites verified (system-handlers.ts:1012, transaction-handlers.ts:991)

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (161 tests, 3 suites)
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured) |
| Duration | (auto-captured) |
| API Calls | (auto-captured) |

**Variance:** PM Est ~10K vs Actual (auto-captured)

### Notes

**Issues encountered:** None

**Approach taken:** Option A from task file -- updated `validateProvider` in `validation.ts` to normalize "azure" to "microsoft" before validating. This fixes the issue globally for all call sites (system-handlers.ts and transaction-handlers.ts).

**Changes summary:**
1. `validation.ts`: Added azure-to-microsoft normalization before the valid providers check
2. `validation.test.ts`: Added 10 new tests covering azure normalization, case insensitivity, and edge cases
3. `system-handlers.test.ts`: Added 2 new tests for azure provider and empty string provider in health check

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
