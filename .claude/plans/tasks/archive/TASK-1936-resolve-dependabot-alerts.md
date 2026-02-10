# Task TASK-1936: Resolve Dependabot Security Alerts (axios, next, tar)

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

Resolve 8 Dependabot security alerts by updating vulnerable dependencies (axios, next, tar) to their patched versions. Only update to patch/minor versions to avoid breaking changes.

## Non-Goals

- Do NOT upgrade to Next.js 15 (major version bump, out of scope)
- Do NOT replace axios with another HTTP library
- Do NOT resolve low/moderate severity alerts
- Do NOT modify application code to work around vulnerabilities
- Do NOT update dependencies unrelated to the security alerts

## Deliverables

1. Update: `package.json` -- bump `axios` to patched version
2. Update: `broker-portal/package.json` -- bump `next` to patched version within 14.2.x
3. Update: `package-lock.json` / lockfile -- regenerated after updates
4. Verify: `tar` vulnerabilities in transitive dependency chain

## Acceptance Criteria

- [ ] `axios` updated to version that resolves DoS via `__proto__` key (CVE)
- [ ] `next` updated to latest 14.2.x patch that resolves HTTP deserialization and Image Optimizer vulnerabilities
- [ ] `tar` transitive vulnerability assessed (may require overrides if not fixable via direct update)
- [ ] `npm audit` shows fewer high-severity vulnerabilities after updates
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] `npm run build -w broker-portal` passes
- [ ] No breaking changes introduced

## Implementation Notes

### Step 1: Check Current Versions and Available Patches

```bash
# Check current axios version
npm ls axios

# Check current next version
npm ls next

# Check current tar dependency chain
npm ls tar

# Check available patch versions
npm view axios versions --json | tail -5
npm view next@14 versions --json | tail -5

# Run npm audit to see current state
npm audit 2>&1 | head -40
```

### Step 2: Update axios

```bash
# Update axios to latest patch within current major
npm update axios

# Or if specific version needed:
npm install axios@^1.8.0  # Check what version fixes the __proto__ DoS
```

**Vulnerability:** DoS via `__proto__` key in `mergeConfig`. Fixed in axios >= 1.8.2 (verify exact version).

### Step 3: Update next (broker-portal)

```bash
# Update next within 14.2.x range
cd broker-portal
npm install next@14.2.35  # Check if latest 14.2.x patch
# Also update eslint-config-next to match
npm install eslint-config-next@14.2.35
```

**Vulnerabilities:**
- HTTP request deserialization DoS with insecure React Server Components (high x2)
- DoS via Image Optimizer remotePatterns (medium x2)

Check which 14.2.x version resolves these. The current version is `14.2.35`.

**IMPORTANT:** Verify the latest available 14.2.x version:
```bash
npm view next@">=14.2.35 <15" versions --json
```

If `14.2.35` is already the latest and the CVE is only fixed in 15.x, document this as "cannot fix without major upgrade" and note it for the SR Engineer.

### Step 4: Address tar Vulnerabilities

The `tar` vulnerabilities are in the transitive dependency chain: `tar` -> `node-gyp` -> `electron-rebuild` -> `sqlite3`.

```bash
# Check if updating the direct dependencies resolves tar
npm ls tar

# Try npm audit fix
npm audit fix

# If still vulnerable, check if overrides help
# Add to package.json if needed:
# "overrides": { "tar": ">=6.2.1" }
```

**Vulnerabilities (all high):**
- Arbitrary file creation/overwrite
- Race condition
- Symlink poisoning

These are in dev dependencies (electron-rebuild, node-gyp) used only during build. Document the risk level accordingly.

### Step 5: Verify Everything

```bash
# Full verification
npm audit 2>&1 | head -40
npm run type-check
npm test
npm run build
cd broker-portal && npm run build
```

## Integration Notes

- TASK-1937 (npm audit) is related -- this task handles the direct dependency updates, TASK-1937 handles remaining audit issues via overrides/resolutions
- If this task resolves all npm audit issues, TASK-1937 may become unnecessary
- The `package-lock.json` will change -- coordinate with other tasks if committing to same branch

## Do / Don't

### Do:
- Check the exact CVE fix versions before updating
- Test that the application still works after updates
- Document which alerts were resolved and which remain
- Use `npm ls <package>` to understand the dependency tree before making changes

### Don't:
- Don't do major version bumps (no Next.js 15)
- Don't modify application code to accommodate dependency changes
- Don't remove dependencies to fix alerts
- Don't ignore `npm audit` warnings about remaining vulnerabilities -- document them

## When to Stop and Ask

- If a security fix requires a major version bump (e.g., Next.js 15)
- If updating axios breaks API calls (unlikely but check)
- If tar vulnerabilities cannot be resolved via overrides and the engineer needs guidance on acceptable risk
- If `npm test` or `npm run build` fails after dependency updates

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests needed
- Existing tests to update: None (unless dependency API changed)

### Coverage

- Coverage impact: None expected

### Integration / Feature Testing

- Required scenarios:
  - Verify `npm test` passes (no breaking changes from dependency updates)
  - Verify `npm run build` succeeds
  - Verify `npm run build -w broker-portal` succeeds

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(deps): resolve Dependabot security alerts for axios, next, and tar`
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
| Files to modify | 2-3 package files + lockfile | +5K |
| Investigation | Check versions, audit output | +8K |
| Verification | Run tests, build, audit | +5K |
| Overrides | May need package.json overrides for tar | +2K |

**Confidence:** Medium

**Risk factors:**
- Some vulnerabilities may only be fixed in major versions
- tar is a transitive dependency -- may not be directly updatable
- Next.js 14.2.x may have already reached end-of-patch for some CVEs

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
Dependencies updated:
- [ ] axios: <old version> -> <new version>
- [ ] next: <old version> -> <new version>
- [ ] tar (transitive): resolved / documented

Verification:
- [ ] npm audit shows improvement
- [ ] npm test passes
- [ ] npm run build passes
- [ ] npm run build -w broker-portal passes
- [ ] npm run type-check passes
```

### Alerts Resolved

| Alert | Package | Severity | Status |
|-------|---------|----------|--------|
| __proto__ DoS | axios | High | Resolved / Remaining |
| HTTP deserialization DoS | next | High | Resolved / Remaining |
| HTTP deserialization DoS | next | High | Resolved / Remaining |
| Image Optimizer DoS | next | Medium | Resolved / Remaining |
| Image Optimizer DoS | next | Medium | Resolved / Remaining |
| Arbitrary file creation | tar | High | Resolved / Remaining |
| Race condition | tar | High | Resolved / Remaining |
| Symlink poisoning | tar | High | Resolved / Remaining |

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
**Security Review:** PASS / FAIL (verify CVEs are actually resolved)
**Test Coverage:** N/A

**Review Notes:**
<Verify dependency updates resolve the specific CVEs, check for remaining alerts>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
