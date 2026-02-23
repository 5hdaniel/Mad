# Task TASK-2038: Scrub Sensitive Data from Log Statements

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

Audit all log statements (`console.log`, `log.info`, `log.error`, `log.warn`, `log.debug`) across the codebase and remove or redact sensitive data including access tokens, refresh tokens, email addresses, phone numbers, and API keys. Follow the existing `redactDeepLinkUrl()` pattern for consistent redaction.

## Non-Goals

- Do NOT refactor the logging infrastructure or replace console.log with a logging library
- Do NOT remove log statements that contain non-sensitive operational data
- Do NOT add structured logging or log levels
- Do NOT modify the `redactDeepLinkUrl()` function itself
- Do NOT create a centralized log redaction middleware (that is a separate, larger effort)

## Deliverables

1. Updated log statements across `electron/` and `src/` directories
2. New redaction utility functions if needed (following `redactDeepLinkUrl()` pattern)

## Acceptance Criteria

- [ ] No access tokens logged in plain text
- [ ] No refresh tokens logged in plain text
- [ ] No full email addresses logged (use redaction: `u***@example.com`)
- [ ] No full phone numbers logged (use redaction: `***-**-1234`)
- [ ] No API keys logged in plain text
- [ ] No Supabase service role keys logged
- [ ] Existing `redactDeepLinkUrl()` pattern followed for new redaction utilities
- [ ] Log statements still provide useful debugging context (redact values, not structure)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Step 1: Scope Scan (REQUIRED)

Before implementing, scan the codebase to understand the scope:

```bash
# Count all log statements
grep -rn "console\.\(log\|warn\|error\|info\|debug\)" --include="*.ts" --include="*.tsx" src/ electron/ | grep -v node_modules | wc -l

# Find log statements with likely sensitive data
grep -rn "console\.\(log\|warn\|error\|info\|debug\)" --include="*.ts" --include="*.tsx" src/ electron/ | grep -iv node_modules | grep -i "token\|key\|secret\|password\|email\|phone\|credential\|auth"

# Find electron-log statements
grep -rn "log\.\(info\|error\|warn\|debug\)" --include="*.ts" electron/ | grep -v node_modules | grep -i "token\|key\|secret\|password\|email\|phone\|credential\|auth"
```

**Document scan results in Implementation Summary.**

### Step 2: Find Existing Redaction Pattern

```bash
# Find redactDeepLinkUrl and similar patterns
grep -rn "redact" --include="*.ts" --include="*.tsx" src/ electron/
```

### Step 3: Create Redaction Utilities (if needed)

Follow the `redactDeepLinkUrl()` pattern:

```typescript
// Example redaction utilities (add to appropriate utility file):

function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local[0]}***@${domain}`;
}

function redactToken(token: string): string {
  if (token.length <= 8) return '***';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

function redactPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.substring(digits.length - 4)}`;
}
```

### Step 4: Apply Redaction

For each flagged log statement:

```typescript
// Before (SENSITIVE):
console.log('Auth token:', accessToken);
log.info('User email:', user.email);
log.error('API key used:', apiKey);

// After (REDACTED):
console.log('Auth token:', redactToken(accessToken));
log.info('User email:', redactEmail(user.email));
log.error('API key used:', '***');
```

### Key Patterns

- **Redact values, not structure**: Keep the log message, redact the sensitive value
- **Token logging**: Show first 4 and last 4 chars: `eyJh...xQ2M`
- **Email logging**: Show first char and domain: `u***@example.com`
- **Phone logging**: Show last 4 digits: `***-1234`
- **API keys**: Replace entirely with `***` or `[REDACTED]`
- **Errors with tokens**: `log.error('Auth failed:', error.message)` is fine; `log.error('Auth failed:', error)` may leak tokens in error objects

## Integration Notes

- This task modifies log statements across many files but does not change logic or exports
- No overlap with other SPRINT-091 tasks (they modify specific files; this modifies log content)
- If creating new redaction utility files, place them in `electron/utils/` or `src/utils/`

## Do / Don't

### Do:
- Scan scope first before starting fixes
- Follow the existing `redactDeepLinkUrl()` pattern
- Keep log messages useful for debugging (redact values, keep context)
- Focus on the highest-risk leaks first (tokens, API keys)
- Test that redacted logs are still readable and useful

### Don't:
- Remove entire log statements (redact instead)
- Create a logging middleware or wrapper (out of scope)
- Modify log levels or add new logging infrastructure
- Spend excessive time on low-risk items (e.g., redacting non-PII metadata)
- Touch `node_modules/` or third-party code

## When to Stop and Ask

- If the scope scan reveals more than 50 log statements with sensitive data -- ask PM about prioritization
- If redacting a value would make debugging impossible for a critical path
- If you find tokens being stored in state/context (beyond just logging) -- that is a separate security issue

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (for new redaction utility functions)
- New tests to write:
  - `redactEmail()` handles edge cases (no @, short local part)
  - `redactToken()` handles short and long tokens
  - `redactPhone()` handles various formats
- Existing tests to update: None expected (log changes don't affect behavior)

### Coverage

- Coverage impact: Slight increase from new utility tests

### Integration / Feature Tests

- Required scenarios: None

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(security): scrub sensitive data from log statements`
- **Labels**: `security`, `cleanup`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `cleanup`

**Estimated Tokens:** ~40K

**Token Cap:** 160K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Scope scan | Initial audit of log statements | +5K |
| Redaction utilities | 2-3 new functions + tests | +15K |
| Log statement fixes | ~20-30 statements estimated | +15K |
| Verification | Spot-check redacted output | +5K |

**Confidence:** Medium

**Risk factors:**
- Scope depends on scan results (could be 10 or 100 log statements)
- Some log statements may be in complex error handling paths
- Need to balance security with debuggability

**Similar past tasks:** TASK-2008 (replace console.log) -- similar audit/cleanup pattern.

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Scope Scan Results

**Scan Date:** <DATE>
**Total log statements:** X
**Statements with sensitive data:** X across Y files

### Checklist

```
Files created:
- [ ] Redaction utilities (if new file created)

Files modified:
- [ ] List of files with redacted log statements

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
