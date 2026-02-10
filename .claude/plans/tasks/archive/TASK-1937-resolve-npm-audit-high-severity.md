# Task TASK-1937: Resolve npm audit High-Severity Vulnerabilities

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

Resolve remaining npm audit high-severity vulnerabilities (14 reported) that are NOT covered by TASK-1936's direct dependency updates. These are primarily in the `tar` -> `node-gyp` -> `electron-rebuild` -> `sqlite3` transitive dependency chain. Use `overrides` in `package.json` to force patched versions of transitive dependencies.

## Non-Goals

- Do NOT update direct dependencies (handled by TASK-1936)
- Do NOT replace `electron-rebuild` or `node-gyp` with alternatives
- Do NOT remove any dependencies
- Do NOT address low or moderate severity issues
- Do NOT modify application code

## Deliverables

1. Update: `package.json` -- add/update `overrides` section for vulnerable transitive dependencies
2. Update: `package-lock.json` -- regenerated lockfile
3. Document: List of resolved vs. remaining vulnerabilities

## Acceptance Criteria

- [ ] `npm audit` shows fewer than 14 high-severity vulnerabilities (ideally 0)
- [ ] Any remaining vulnerabilities are documented with justification (e.g., "only in dev dependency, no runtime impact")
- [ ] `npm install` succeeds without errors
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] `npm rebuild better-sqlite3-multiple-ciphers` succeeds
- [ ] `npx electron-rebuild` succeeds (verify native module build still works)

## Implementation Notes

### Step 1: Assess Current State After TASK-1936

**IMPORTANT:** This task should run AFTER or alongside TASK-1936. Start by checking what TASK-1936 already resolved.

```bash
# Check current audit state
npm audit 2>&1

# Check tar specifically
npm ls tar

# Check existing overrides in package.json
grep -A 10 '"overrides"' package.json
```

### Step 2: Identify Remaining Vulnerabilities

```bash
# Get detailed audit report
npm audit --json 2>&1 | head -200

# Focus on high severity
npm audit 2>&1 | grep -A 5 "high"
```

### Step 3: Add Overrides for Transitive Dependencies

The `overrides` field in `package.json` forces specific versions of transitive dependencies.

**Current overrides:**
```json
"overrides": {
  "diff": ">=8.0.3",
  "@next/eslint-plugin-next": {
    "glob": ">=10.5.0"
  }
}
```

**Add tar override (if needed):**
```json
"overrides": {
  "diff": ">=8.0.3",
  "@next/eslint-plugin-next": {
    "glob": ">=10.5.0"
  },
  "tar": ">=6.2.1"
}
```

The exact version depends on which CVEs need fixing:
- Arbitrary file creation: fixed in tar >= 6.2.1
- Race condition: fixed in tar >= 6.2.1
- Symlink poisoning: fixed in tar >= 6.2.1

Verify the fix version:
```bash
npm view tar versions --json | tail -10
```

### Step 4: Apply Overrides and Rebuild

```bash
# After updating package.json overrides
rm -rf node_modules package-lock.json
npm install

# Verify overrides took effect
npm ls tar

# Verify native modules still build
npm rebuild better-sqlite3-multiple-ciphers
npx electron-rebuild

# Re-run audit
npm audit
```

### Step 5: Handle axios Override (if needed)

If TASK-1936 updated axios but some sub-dependency still pulls in a vulnerable version:
```json
"overrides": {
  "axios": ">=1.8.2"
}
```

### Step 6: Full Verification

```bash
npm audit
npm run type-check
npm test
npm run build
```

### Handling Unfixable Vulnerabilities

If some vulnerabilities cannot be resolved via overrides (e.g., the vulnerable package has no patched version):

1. Document the vulnerability details
2. Note the dependency chain (how it's pulled in)
3. Assess impact: is it dev-only? runtime? build-time?
4. Add a comment in `package.json` near the overrides section
5. Report to SR Engineer during review

## Integration Notes

- **Depends on TASK-1936**: TASK-1936 handles direct dependency updates; this task handles transitive overrides
- Both tasks modify `package.json` and `package-lock.json` -- if running on same branch, coordinate commits
- The `overrides` section already exists in `package.json` -- extend it, don't replace it

## Do / Don't

### Do:
- Check `npm audit` output carefully to understand the dependency chain
- Verify native module builds still work after lockfile regeneration
- Document any remaining vulnerabilities with justification
- Extend the existing `overrides` section, don't replace it

### Don't:
- Don't delete `node_modules` and `package-lock.json` unless absolutely necessary (prefer `npm audit fix` first)
- Don't use `--force` flags without understanding implications
- Don't remove the existing overrides for `diff` and `glob`
- Don't modify application code

## When to Stop and Ask

- If overrides break `npm install` (dependency resolution conflict)
- If native module rebuilds fail after lockfile changes
- If more than 5 vulnerabilities remain after all overrides are applied
- If the engineer discovers the vulnerability is in a direct dependency not covered by TASK-1936

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests
- Existing tests to update: None

### Coverage

- Coverage impact: None

### Integration / Feature Testing

- Required scenarios:
  - `npm install` succeeds cleanly
  - `npm rebuild better-sqlite3-multiple-ciphers` succeeds
  - `npx electron-rebuild` succeeds
  - `npm test` passes (verify no dependency changes break tests)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step
- [ ] Security audit (npm audit)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(deps): add overrides for npm audit high-severity transitive vulnerabilities`
- **Labels**: `security`, `dependencies`
- **Sprint**: SPRINT-075
- **Branch**: `fix/repo-cleanup-hardening`
- **Target**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~8K (security x 0.4 = ~8K from ~20K base)

**Token Cap:** 32K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 files (package.json, lockfile) | +3K |
| Investigation | Audit output, dependency tree analysis | +8K |
| Override configuration | 2-3 override entries | +3K |
| Native module verification | Rebuild + test | +5K |

**Confidence:** Medium

**Risk factors:**
- Overrides may cause dependency resolution conflicts
- Native module rebuilds are fragile
- Some vulnerabilities may not have patched versions yet

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
Overrides added:
- [ ] tar: <version>
- [ ] <other if needed>

Verification:
- [ ] npm audit shows improvement
- [ ] npm install succeeds
- [ ] npm rebuild better-sqlite3-multiple-ciphers succeeds
- [ ] npx electron-rebuild succeeds
- [ ] npm test passes
- [ ] npm run build passes
```

### Vulnerability Summary

| Vulnerability | Package | Before | After | Status |
|---------------|---------|--------|-------|--------|
| DoS | tar | High | ? | Resolved / Remaining |
| File overwrite | tar | High | ? | Resolved / Remaining |
| Symlink | tar | High | ? | Resolved / Remaining |
| (others) | ... | ... | ... | ... |

**Total high-severity before:** 14
**Total high-severity after:** X
**Remaining justification:** <if any remain>

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~8K vs Actual ~XK (X% over/under)

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
**Security Review:** PASS / FAIL (verify overrides are correct and safe)
**Test Coverage:** N/A

**Review Notes:**
<Verify native module builds work, check remaining audit output>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
