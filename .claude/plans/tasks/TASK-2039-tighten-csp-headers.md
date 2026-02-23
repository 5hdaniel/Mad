# Task TASK-2039: Review and Tighten CSP Headers

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

Review and tighten Content Security Policy (CSP) headers in the Electron app to restrict inline scripts, external resource loading, and dynamic code execution. Ensure CSP is properly configured to prevent XSS and code injection attacks.

## Non-Goals

- Do NOT implement CSP for the broker portal (Next.js) -- Electron app only
- Do NOT refactor the session/webRequest handling architecture
- Do NOT add CSP reporting endpoints
- Do NOT modify the preload script security model
- Do NOT change `webPreferences` settings (that is TASK-2033)

## Deliverables

1. Updated CSP configuration in `electron/main.ts`
2. Documentation of CSP directives and their rationale

## Acceptance Criteria

- [ ] CSP headers are set via `session.defaultSession.webRequest.onHeadersReceived` or equivalent
- [ ] `script-src` does NOT include `'unsafe-inline'` (or is restricted to nonces/hashes)
- [ ] `script-src` does NOT include `'unsafe-eval'`
- [ ] `default-src` is set to `'self'` or more restrictive
- [ ] External resource loading is restricted to known domains (Supabase, Microsoft Graph, Google APIs)
- [ ] `style-src` allows inline styles if needed by React but is as restrictive as possible
- [ ] App loads and functions correctly with the tightened CSP
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Step 1: Audit Current CSP

Check for existing CSP configuration:

```bash
# Check for CSP in main.ts
grep -n "Content-Security-Policy\|CSP\|onHeadersReceived\|meta.*http-equiv" electron/main.ts

# Check for CSP meta tags in HTML
grep -rn "Content-Security-Policy" --include="*.html" .

# Check for CSP in any config files
grep -rn "Content-Security-Policy" --include="*.ts" --include="*.json" electron/
```

### Step 2: Identify Required Origins

The app needs to connect to:
- `*.supabase.co` -- Supabase backend
- `graph.microsoft.com` -- Microsoft Graph API
- `login.microsoftonline.com` -- Microsoft OAuth
- `accounts.google.com` -- Google OAuth
- `googleapis.com` -- Google API
- `localhost` / `file:` -- Local dev and packaged app resources

### Step 3: Implement or Tighten CSP

```typescript
// In electron/main.ts, add or update:
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",  // React may need inline styles
          "img-src 'self' data: blob:",
          "font-src 'self'",
          "connect-src 'self' https://*.supabase.co https://graph.microsoft.com https://login.microsoftonline.com https://accounts.google.com https://*.googleapis.com",
          "frame-src 'none'",
          "object-src 'none'",
          "base-uri 'self'",
        ].join('; ')
      ]
    }
  });
});
```

### Key Considerations

- **Vite dev server**: In development, CSP needs to allow `ws:` for HMR (hot module replacement). Use a conditional CSP:
  ```typescript
  const isDev = !app.isPackaged;
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline'"  // Vite HMR needs inline scripts in dev
    : "script-src 'self'";
  ```
- **React inline styles**: React uses inline styles (`style="..."`) which `style-src 'unsafe-inline'` allows. This is a common trade-off.
- **Data URLs**: `img-src data:` may be needed for embedded images (e.g., base64 avatars).
- **Blob URLs**: `img-src blob:` may be needed for image processing.
- **Electron specifics**: Electron loads via `file:` protocol in production; `'self'` covers this.

### Step 4: Test Thoroughly

After applying CSP:
1. Start the app in dev mode -- check for CSP violations in DevTools console
2. Build and run in production mode -- check for CSP violations
3. Test all features that load external resources:
   - OAuth login (Microsoft, Google)
   - Supabase sync
   - Email/message fetching
   - Image/attachment display
   - Export functionality

## Integration Notes

- This modifies `electron/main.ts` which TASK-2036 also modifies (different section: deep link handler)
- TASK-2033 reads `electron/main.ts` for BrowserWindow verification (read-only)
- No TypeScript type changes or export changes
- CSP is a runtime security header, not a compile-time feature

## Do / Don't

### Do:
- Start by auditing what CSP exists today (may be none)
- Allow different CSP for dev vs production (dev needs HMR)
- Document each CSP directive and why it is set
- Test with DevTools Console open to catch CSP violations
- Use the most restrictive policy that still allows the app to function

### Don't:
- Use `'unsafe-eval'` -- this defeats much of CSP's purpose
- Use `*` wildcards in connect-src -- whitelist specific domains
- Block resources needed by the app (test thoroughly)
- Add `'unsafe-inline'` to `script-src` in production
- Forget to handle both dev and production environments

## When to Stop and Ask

- If the app uses dynamic code execution patterns anywhere (would require unsafe-eval in CSP)
- If CSP blocks critical functionality that cannot be worked around
- If there are many external domains the app connects to that are not listed above
- If the app uses script tags with inline content in HTML templates

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (CSP is a runtime configuration, not testable in unit tests)
- Existing tests should still pass

### Coverage

- Coverage impact: None

### Integration / Feature Tests

- Required scenarios:
  - App loads without CSP violations
  - OAuth login works (Microsoft, Google)
  - Supabase sync works
  - Email/message fetching works
  - All UI features render correctly

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(security): add and tighten CSP headers in Electron app`
- **Labels**: `security`, `electron`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~40K

**Token Cap:** 160K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Audit current CSP | Read main.ts, HTML files | +5K |
| Identify required origins | Check all external connections | +10K |
| Implement CSP | Write headers + dev/prod conditional | +15K |
| Testing/iteration | Fix CSP violations | +10K |

**Confidence:** Medium

**Risk factors:**
- Unknown what external resources the app loads (may need to whitelist more domains)
- Dev vs production CSP complexity
- React/Vite may require specific CSP allowances
- Could require multiple iterations to find the right balance

**Similar past tasks:** TASK-1119 (tighten dev CSP) -- directly related predecessor.

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
- [ ] electron/main.ts (CSP configuration)

Features implemented:
- [ ] CSP headers configured
- [ ] Dev vs production CSP
- [ ] External domains whitelisted
- [ ] CSP violations tested

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] App functions correctly with CSP
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

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~40K | ~XK | +/-X% |
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
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
