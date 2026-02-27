# Task TASK-2088: Security Fixes - pdfExportService + outlookService

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

Fix all 16 security-related CodeQL alerts in `electron/services/pdfExportService.ts` and `electron/outlookService.ts`, addressing incomplete multi-character sanitization, bad tag filters, and double escaping vulnerabilities.

## Non-Goals

- Do NOT refactor these services beyond what is needed to fix the alerts
- Do NOT add new features or change service behavior
- Do NOT fix code quality alerts in these files (those are handled by TASK-2091)
- Do NOT modify any files outside the two target files
- Do NOT change public API signatures of these services

## Deliverables

1. Update: `electron/services/pdfExportService.ts` (7 alerts)
2. Update: `electron/outlookService.ts` (5-6 alerts)
3. Update: Related test files ONLY if existing tests break due to fixes

## Scope: Exact Alerts to Fix

### electron/services/pdfExportService.ts (7 alerts)

| # | Rule | Severity | Description |
|---|------|----------|-------------|
| 1 | `js/incomplete-multi-character-sanitization` | HIGH | Sanitization of multi-character sequences (e.g., `<script>`) using `.replace()` with a single pass. The replacement may be incomplete if the input contains nested/overlapping patterns. |
| 2-7 | `js/incomplete-multi-character-sanitization` | HIGH | Same rule, multiple locations in the file. Each `.replace()` call that sanitizes multi-char sequences needs fixing. |

**Also in pdfExportService.ts:**
| # | Rule | Severity | Description |
|---|------|----------|-------------|
| 8 | `js/double-escaping` | HIGH | A value is escaped twice, producing garbled output. Find where HTML entities or special chars are double-escaped. |

### electron/outlookService.ts (5-6 alerts)

| # | Rule | Severity | Description |
|---|------|----------|-------------|
| 1-2 | `js/incomplete-multi-character-sanitization` | HIGH | Same pattern as pdfExportService -- `.replace()` calls for multi-char sanitization. |
| 3-4 | `js/bad-tag-filter` | HIGH | Regex-based HTML tag filtering that can be bypassed. The regex used to strip HTML tags is insufficient. |
| 5 | `js/incomplete-multi-character-sanitization` | HIGH | Additional sanitization location. |

## Acceptance Criteria

- [ ] All `js/incomplete-multi-character-sanitization` alerts in both files are resolved
- [ ] The `js/double-escaping` alert in pdfExportService.ts is resolved
- [ ] Both `js/bad-tag-filter` alerts in outlookService.ts are resolved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (no regressions)
- [ ] The sanitization functions still correctly sanitize their intended input
- [ ] No new CodeQL alerts introduced

## Implementation Notes

### SR Engineer Review Notes (MUST READ)

**WARNING: DOMPurify cannot be used in Electron main process.** The `dompurify` package requires a DOM environment (`document.createElement`). It works in renderer components but NOT in main process code like `pdfExportService.ts`. Do NOT attempt to import DOMPurify here. If you believe a library-based approach is needed, ask PM about adding `isomorphic-dompurify` as a dependency.

**Recommended approach:** Use the while-loop pattern to silence CodeQL alerts. The HTML is loaded into a sandboxed BrowserWindow with `contextIsolation: true` and `nodeIntegration: false`, which provides defense-in-depth. The regex-based sanitization is an additional layer, not the sole protection.

**This task owns ALL alerts (security + quality) in pdfExportService.ts and outlookService.ts.** TASK-2091 will NOT touch these files. Fix unused vars, trivial conditionals, etc. in these files as well.

### Alert Locations (from SR review)

**pdfExportService.ts — `sanitizeHtml` function (lines 510-562):**
| Line | Pattern | Alert |
|------|---------|-------|
| 516 | `.replace(/<script\b.../)` | `js/incomplete-multi-character-sanitization` |
| 519 | `.replace(/<style\b.../)` | `js/incomplete-multi-character-sanitization` |
| 534 | `.replace(/<iframe\b.../)` | `js/incomplete-multi-character-sanitization` |
| 536 | `.replace(/<embed\b.../)` | `js/incomplete-multi-character-sanitization` |
| 537 | `.replace(/<object\b.../)` | `js/incomplete-multi-character-sanitization` |
| 541 | `.replace(/<form\b.../)` | `js/incomplete-multi-character-sanitization` |
| 553 | `.replace(/<!DOCTYPE.../)` | `js/incomplete-multi-character-sanitization` |

**pdfExportService.ts — double-escaping:**
Check the `truncatePreview()` function (~line 568-569). It returns escaped HTML via `escapeHtml()`. If the output is later used in a context that also escapes, that is the double-escape source. Trace where `truncatePreview()` output is consumed (likely appendix section ~line 801).

**outlookService.ts (lines 564-572):**
| Line | Pattern | Alert |
|------|---------|-------|
| 565-566 | style/script tag removal | `js/incomplete-multi-character-sanitization` |
| 567 | `/<[^>]+>/g` tag stripping | `js/bad-tag-filter` |
| 568-572 | Entity replacement (`&nbsp;`, `&amp;`, etc.) | `js/incomplete-multi-character-sanitization` |

**IMPORTANT:** Lines 568-572 are HTML entity DECODING (not sanitization). The output goes to a `.txt` file, not rendered HTML. The while-loop fix is appropriate here, but do NOT remove the entity decoding — it is needed for readable text output.

### Fixing `js/incomplete-multi-character-sanitization`

The problem: Using `.replace('ab', '')` only does one pass. If input is `aabb`, after one replace you get `ab` -- the sanitization is incomplete.

**Fix pattern -- use a while-loop:**

```typescript
// BAD: Single-pass replace
function sanitize(input: string): string {
  return input.replace('<script>', '');
}

// GOOD: Loop until no more matches
function sanitize(input: string): string {
  let result = input;
  while (result.includes('<script>')) {
    result = result.replace('<script>', '');
  }
  return result;
}

// ALSO GOOD: Use regex with global flag (for simple patterns)
function sanitize(input: string): string {
  return input.replace(/<script>/gi, '');
}
```

### Fixing `js/bad-tag-filter`

The problem: Regex like `/<[^>]*>/g` to strip HTML tags can be bypassed with malformed HTML like `<script src=">"`.

**Fix pattern — use iterative regex:**

```typescript
// BAD: Simple regex tag stripping
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// GOOD: Iterative approach
function stripTags(html: string): string {
  let result = html;
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = result.replace(/<[^>]*>/g, '');
  }
  return result;
}
```

Note: Since outlookService.ts output goes to `.txt` files (not rendered as HTML), the security risk of the bad tag filter is LOW. But it should still be fixed for correctness.

### Fixing `js/double-escaping`

The problem: A value gets escaped twice. For example, `&amp;` becomes `&amp;amp;`.

**Investigation guide:**
1. Check `truncatePreview()` — it calls `escapeHtml()` and returns escaped HTML
2. Trace where `truncatePreview()` output is used in the PDF HTML template
3. If the template context also escapes (e.g., another `escapeHtml()` call), remove one of the two escaping steps
4. Keep escaping at the OUTPUT boundary (when inserting into HTML), not at the data preparation stage

### Testing Recommendations (from SR review)

Although new tests are not strictly required, consider adding basic tests for:
- Nested tag patterns: `<scr<script>ipt>` after removal should not become `<script>`
- The double-escaping fix: verify `&amp;` stays as `&amp;`, not `&amp;amp;`
- Bad tag filter bypass: `<img src=">" onerror="alert(1)">`

## Integration Notes

- These files are standalone services -- no other tasks depend on changes here
- `pdfExportService.ts` is used by the PDF export feature
- `outlookService.ts` is used by the Outlook email integration
- No shared types or interfaces are being changed

**Conflict avoidance:** This task owns ALL alerts (security + quality) in `pdfExportService.ts` and `outlookService.ts`. TASK-2091 will NOT touch these files.

## Do / Don't

### Do:

- Verify each fix by tracing the data flow through the function
- Test sanitization functions with edge cases (nested tags, overlapping patterns)
- Use `while` loops for multi-character replacement to handle recursive patterns
- Keep the fix minimal -- change only what is needed to resolve the alert
- Check if there is already a sanitization utility in the codebase to reuse

### Don't:

- Do NOT introduce new npm dependencies without asking PM first
- Do NOT rewrite entire functions when a targeted fix suffices
- Do NOT remove sanitization -- fix it to be more thorough
- Do NOT change the function signatures (parameters, return types)
- Do NOT touch code quality alerts (unused vars etc.) in these files -- that belongs to TASK-2091. Actually, if there are quality alerts in these two files, fix them here since you own these files.

## When to Stop and Ask

- If a sanitization function's intent is unclear (what is it trying to protect against?)
- If fixing the alert would require changing the public API of the service
- If you discover the sanitization is fundamentally flawed and needs a library (e.g., DOMPurify)
- If fixing one alert creates a new alert
- If you reach the token cap

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Only if existing tests break
- New tests to write: None required, but if sanitization logic is complex, consider adding a test for the edge case (e.g., nested `<script>` tags)
- Existing tests to update: Fix any tests that reference changed sanitization behavior

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - PDF export still generates valid output
  - Outlook service still processes emails correctly

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(security): resolve CodeQL sanitization alerts in pdfExportService and outlookService`
- **Labels**: `security`, `codeql`
- **Branch**: `fix/task-2088-codeql-security-sanitization`
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~8K

> Base estimate: ~20K (multi-file security fix, need to trace data flows)
> Apply security multiplier: x 0.4 = ~8K
> Note: These are pattern-based fixes across known locations. Relatively mechanical.

**Token Cap:** 80K (4x upper estimate of 20K, pre-multiplier)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 files | +5K |
| Alert count | ~16 alerts | +10K |
| Code complexity | Medium (sanitization logic) | +5K |
| Test updates | Minimal | +0K |

**Confidence:** High

**Risk factors:**
- Some sanitization fixes may require understanding the full data flow
- Double-escaping fix requires tracing where values are escaped

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
- [ ] electron/services/pdfExportService.ts
- [ ] electron/outlookService.ts

Alerts resolved:
- [ ] All js/incomplete-multi-character-sanitization alerts
- [ ] js/double-escaping alert
- [ ] All js/bad-tag-filter alerts

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

**Variance:** PM Est ~8K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~8K | ~XK | +/-X% |
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
