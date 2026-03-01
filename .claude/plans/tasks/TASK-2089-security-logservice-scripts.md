# Task TASK-2089: Security Fixes - logService + scripts + other services

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

Fix all 19 security-related CodeQL alerts in `electron/services/logService.ts`, `scripts/download-apple-drivers.js`, `broker-portal/app/setup/consent/callback/route.ts`, and other isolated service files. This covers log injection, filesystem race conditions, shell command injection, insecure randomness, XSS, insecure temp files, and HTTP-to-file-access vulnerabilities.

## Non-Goals

- Do NOT refactor these services beyond what is needed to fix the alerts
- Do NOT touch `pdfExportService.ts` or `outlookService.ts` (owned by TASK-2088)
- Do NOT fix code quality alerts in `electron/` files (owned by TASK-2091) -- EXCEPT in files you own below, fix ALL alerts (security + quality) to avoid conflicts
- Do NOT add new features or change service behavior
- Do NOT change public API signatures

## Deliverables

1. Update: `electron/services/logService.ts` (5 alerts: 4x log-injection + 1x http-to-file-access)
2. Update: `scripts/download-apple-drivers.js` (4 alerts: 3x shell-command-injection + 1x log-injection)
3. Update: `broker-portal/app/setup/consent/callback/route.ts` (2 alerts: log-injection)
4. Update: `electron/services/errorLoggingService.ts` (1 alert: insecure-randomness at line 61)
5. Update: `electron/services/microsoftAuthService.ts` (1 alert: reflected-xss at line 179)
6. Update: `electron/utils/messageTypeDetector.ts` (1 alert: missing-regexp-anchor at line 36)
7. Update: Related test files ONLY if existing tests break

## SR Engineer Review — Corrected Alert Inventory (14 alerts total)

**The original task had incorrect alert types and counts. This corrected inventory is from the SR Engineer's CodeQL API cross-reference.**

### electron/services/logService.ts (5 alerts)

| # | Rule | Severity | Line | Description |
|---|------|----------|------|-------------|
| 1-4 | `js/log-injection` | MEDIUM | 176, 179, 182, 185 | User-controlled data in `writeToConsole()` calls without sanitization. |
| 5 | `js/http-to-file-access` | MEDIUM | 159 | `writeToFile()` writes user-controlled log data to disk via `fs.appendFile`. Will likely resolve as side effect of log-injection fix. |

### scripts/download-apple-drivers.js (4 alerts)

| # | Rule | Severity | Line | Description |
|---|------|----------|------|-------------|
| 1-3 | `js/shell-command-injection-from-environment` | MEDIUM | 89, 93, 96 | `execSync` with string interpolation for `iTunesExe` and `TEMP_DIR`. |
| 4 | `js/log-injection` | MEDIUM | 168 | `console.error('Error:', error.message)` with unsanitized error. |

**NOTE:** The original plan incorrectly attributed file-system-race, indirect-command-line-injection, and insecure-temporary-file alerts to this file. Those alerts are actually in other `electron/services/` files owned by TASK-2091.

### broker-portal/app/setup/consent/callback/route.ts (2 alerts)

| # | Rule | Severity | Line | Description |
|---|------|----------|------|-------------|
| 1-2 | `js/log-injection` | MEDIUM | 24 | `console.error('Admin consent denied:', error, errorDescription)` with unsanitized URL params. |

**NOTE:** The original plan incorrectly said these were `js/http-to-file-access`. They are `js/log-injection`.

### Other files (3 alerts, 1 each — exact locations from SR review)

| # | Rule | Severity | File | Line | Description |
|---|------|----------|------|------|-------------|
| 1 | `js/insecure-randomness` | HIGH | `electron/services/errorLoggingService.ts` | 61 | `Math.random()` for session IDs. Replace with `crypto.randomBytes()` or `crypto.randomUUID()`. |
| 2 | `js/reflected-xss` | HIGH | `electron/services/microsoftAuthService.ts` | 179 | Error description interpolated directly into HTML without escaping. **Genuine XSS vulnerability.** |
| 3 | `js/regex/missing-regexp-anchor` | HIGH | `electron/utils/messageTypeDetector.ts` | 36 | `/maps\.(google\|apple)\.com/i` missing anchors — can match substrings like `evilmaps.google.com`. |

## File Ownership (explicit — to avoid conflicts)

This task OWNS these files:
- `electron/services/logService.ts`
- `scripts/download-apple-drivers.js`
- `broker-portal/app/setup/consent/callback/route.ts`
- `electron/services/errorLoggingService.ts`
- `electron/services/microsoftAuthService.ts`
- `electron/utils/messageTypeDetector.ts`

TASK-2091 must NOT touch these files.

**Unassigned alert:** `electron/services/emailAttachmentService.ts:297` has a `js/http-to-file-access` alert. This is assigned to TASK-2091 since it is in `electron/services/` and not owned by this task.

## Acceptance Criteria

- [ ] All 4 `js/log-injection` alerts in logService.ts are resolved
- [ ] The `js/http-to-file-access` alert in logService.ts:159 is resolved
- [ ] All 3 `js/shell-command-injection-from-environment` alerts in download-apple-drivers.js are resolved
- [ ] The `js/log-injection` alert in download-apple-drivers.js:168 is resolved
- [ ] Both `js/log-injection` alerts in broker-portal route.ts are resolved
- [ ] The `js/insecure-randomness` alert in errorLoggingService.ts:61 is resolved
- [ ] The `js/reflected-xss` alert in microsoftAuthService.ts:179 is resolved
- [ ] The `js/regex/missing-regexp-anchor` alert in messageTypeDetector.ts:36 is resolved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (no regressions)
- [ ] No new CodeQL alerts introduced

## Implementation Notes

### SR Engineer Review Notes (MUST READ)

1. **Sanitize in `formatLogEntry()` as the centralized point** — do NOT add sanitization at each call site
2. **Do NOT use `[^\x20-\x7E]` regex** — it strips ALL Unicode (contact names with accents, addresses, etc.). Use `[\x00-\x1f\x7f]` to remove only control characters while preserving Unicode
3. **The XSS in microsoftAuthService.ts:179 is genuine** — line 195 interpolates `parsedUrl.query.error_description` directly into HTML. Use a simple `escapeHtml()` helper (not a new dependency)
4. **7z `-o` flag quirk** — the path is concatenated to `-o`, not a separate argument: `execFileSync('7z', ['x', iTunesExe, \`-o\${path.join(TEMP_DIR, 'extracted')}\`, '-y'])`
5. **The `http-to-file-access` alert in logService.ts:159** will likely resolve as a side effect of the log-injection sanitization in `formatLogEntry()`

### Fixing `js/log-injection` (logService.ts)

The problem: User-controlled data in log messages can inject newlines or control characters, creating fake log entries.

**Fix pattern — sanitize in `formatLogEntry()` (centralized):**

```typescript
// BAD: Direct interpolation of user input in logs
logger.info(`User logged in: ${username}`);

// GOOD: Sanitize log data — remove control chars but preserve Unicode
function sanitizeForLog(input: string): string {
  return input.replace(/[\r\n]/g, ' ').replace(/[\x00-\x1f\x7f]/g, '');
}

logger.info(`User logged in: ${sanitizeLogData(username)}`);

// ALSO GOOD: Use structured logging with separate data field
logger.info('User logged in', { username });
```

### Fixing `js/file-system-race` (download-apple-drivers.js)

The problem: TOCTOU race condition where you check if a file exists, then use it -- another process could modify/delete it in between.

**Fix pattern:**

```javascript
// BAD: Check then use
if (fs.existsSync(filePath)) {
  fs.readFileSync(filePath);  // File may have changed!
}

// GOOD: Use try-catch instead of check-then-use
try {
  const data = fs.readFileSync(filePath);
} catch (err) {
  if (err.code === 'ENOENT') {
    // File doesn't exist, handle appropriately
  }
  throw err;
}

// GOOD: Use exclusive flag for creating files
fs.writeFileSync(filePath, data, { flag: 'wx' }); // Fails if exists
```

### Fixing `js/shell-command-injection-from-environment`

**IMPORTANT: This codebase has `src/utils/execFileNoThrow.ts` -- a safer alternative to child_process functions. Use it where applicable.**

**Fix pattern:**

```javascript
// BAD: Environment variable directly in shell command via child_process
const { execSync } = require('child_process');
const cmd = `${process.env.TOOL_PATH} --arg value`;
execSync(cmd);  // Shell interpretation = injection risk

// GOOD: Use execFileSync with argument array (no shell)
const { execFileSync } = require('child_process');
execFileSync(process.env.TOOL_PATH, ['--arg', 'value']);

// GOOD: Validate environment variable before use
const toolPath = process.env.TOOL_PATH;
if (!toolPath || !/^[a-zA-Z0-9/_.-]+$/.test(toolPath)) {
  throw new Error('Invalid TOOL_PATH');
}

// ALSO GOOD: For TypeScript files, use the project's safe wrapper
// import { execFileNoThrow } from '../utils/execFileNoThrow.js'
// await execFileNoThrow('command', [arg1, arg2]);
```

### Fixing `js/insecure-randomness`

```typescript
// BAD: Math.random() for security-sensitive values
const token = Math.random().toString(36);

// GOOD: Use crypto module
import { randomBytes, randomUUID } from 'crypto';
const token = randomBytes(32).toString('hex');
// or
const id = randomUUID();
```

### Fixing `js/reflected-xss`

```typescript
// BAD: User input in response without escaping
res.send(`<div>${userInput}</div>`);

// GOOD: Escape or encode user input
import { encode } from 'html-entities';
res.send(`<div>${encode(userInput)}</div>`);

// ALSO GOOD: Use Content-Type to prevent interpretation
res.type('text/plain').send(userInput);
```

### Fixing `js/regex/missing-regexp-anchor`

```typescript
// BAD: Regex without anchors used for validation
if (/example\.com/.test(hostname)) { allow(); }
// Can be bypassed with "evil-example.com"

// GOOD: Add anchors
if (/^example\.com$/.test(hostname)) { allow(); }
// or for subdomain matching
if (/^(.*\.)?example\.com$/.test(hostname)) { allow(); }
```

### Fixing `js/http-to-file-access`

```typescript
// BAD: Network data written directly to file
const response = await fetch(url);
const data = await response.text();
fs.writeFileSync(filePath, data);

// GOOD: Validate/sanitize the data first
const response = await fetch(url);
const data = await response.text();
// Validate content type, size, format before writing
if (data.length > MAX_SIZE) throw new Error('Response too large');
fs.writeFileSync(filePath, data);
```

### Fixing `js/insecure-temporary-file`

```javascript
// BAD: Predictable temp file
const tmpFile = '/tmp/myapp-data.tmp';

// GOOD: Use random name in OS temp dir
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const tmpFile = path.join(
  os.tmpdir(),
  `myapp-${crypto.randomBytes(8).toString('hex')}.tmp`
);

// ALSO GOOD: Use mkdtemp for directories
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'myapp-'));
```

## Integration Notes

- `logService.ts` is used throughout the app -- sanitization must not break log readability
- `download-apple-drivers.js` is a build/setup script, not runtime code
- `broker-portal/` route.ts is part of the Next.js broker portal
- No shared types or interfaces are being changed
- TASK-2091 handles code quality alerts in `electron/` -- but this task owns ALL alerts (security + quality) in `logService.ts` and `scripts/download-apple-drivers.js` to avoid file conflicts

**File ownership (to avoid conflicts with other tasks):**
- This task OWNS: `electron/services/logService.ts`, `scripts/download-apple-drivers.js`, `broker-portal/app/setup/consent/callback/route.ts`, and the individual files for insecure-randomness, reflected-xss, missing-regexp-anchor
- TASK-2088 OWNS: `pdfExportService.ts`, `outlookService.ts`
- TASK-2090 OWNS: Everything in `src/`
- TASK-2091 OWNS: Everything else in `electron/` not owned by TASK-2088 or TASK-2089

## Do / Don't

### Do:

- Use `gh api` to find exact file locations for the "TBD" alerts
- Fix ALL alerts (security + quality) in files you own to prevent conflicts
- Validate environment variables and user input before use
- Use `execFileSync` with argument arrays instead of shell string interpolation
- Use `crypto` module instead of `Math.random()` for security purposes
- Test that log output is still readable after sanitization
- Reference `src/utils/execFileNoThrow.ts` for the project's safe execution pattern

### Don't:

- Do NOT introduce new npm dependencies without asking PM first
- Do NOT rewrite entire services when a targeted fix suffices
- Do NOT remove logging -- fix the injection vulnerability
- Do NOT touch files owned by TASK-2088, TASK-2090, or TASK-2091
- Do NOT change public API signatures
- Do NOT use string-interpolated shell commands

## When to Stop and Ask

- If you cannot find the exact file location for a "TBD" alert
- If fixing an alert would require adding a new npm dependency
- If the shell command injection fix would break the build script's functionality
- If the log injection fix would make logs unreadable
- If you discover more security alerts not listed here
- If you reach the token cap

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Only if existing tests break
- New tests to write: None required, but consider testing log sanitization edge cases
- Existing tests to update: Fix any tests that reference changed behavior

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Log service still produces valid log output
  - download-apple-drivers.js script still functions correctly
  - Broker portal consent callback still works

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(security): resolve CodeQL alerts in logService, scripts, and broker-portal`
- **Labels**: `security`, `codeql`
- **Branch**: `fix/task-2089-codeql-security-services`
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~10K

> Base estimate: ~25K (multiple files, diverse alert types, need to find TBD file locations)
> Apply security multiplier: x 0.4 = ~10K
> Slight upward adjustment for file discovery needed (+2K)

**Token Cap:** 100K (4x upper estimate of 25K, pre-multiplier)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 5-8 files | +10K |
| Alert count | ~19 alerts | +10K |
| Code complexity | Medium-High (diverse vulnerability types) | +5K |
| File discovery | Need to locate TBD files via gh api | +2K |

**Confidence:** Medium

**Risk factors:**
- 3 alerts have unknown file locations (need CodeQL API query)
- Shell injection fixes may require understanding build script flow
- TOCTOU fixes may require restructuring file operations

**Similar past tasks:** Security category tasks historically come in at 0.4x estimate (SPRINT-009)

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
- [ ] electron/services/logService.ts
- [ ] scripts/download-apple-drivers.js
- [ ] broker-portal/app/setup/consent/callback/route.ts
- [ ] <TBD: insecure-randomness file>
- [ ] <TBD: reflected-xss file>
- [ ] <TBD: missing-regexp-anchor file>

Alerts resolved:
- [ ] All js/log-injection alerts
- [ ] All js/file-system-race alerts
- [ ] All js/shell-command-injection-from-environment alerts
- [ ] All js/indirect-command-line-injection alerts
- [ ] js/insecure-temporary-file alert
- [ ] Both js/http-to-file-access alerts
- [ ] js/insecure-randomness alert
- [ ] js/reflected-xss alert
- [ ] js/regex/missing-regexp-anchor alert

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

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~10K | ~XK | +/-X% |
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
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
