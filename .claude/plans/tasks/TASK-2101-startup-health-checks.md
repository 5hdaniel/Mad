# Task TASK-2101: Add Startup Health Checks (Phase 1 -- Pre-Auth)

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

Implement Phase 1 pre-auth startup health checks in `electron/main.ts` that run before `createWindow()`, catching system-level failures early with actionable user-facing error messages instead of cryptic crashes.

## Non-Goals

- Do NOT implement Phase 2 post-auth checks (deferred)
- Do NOT modify existing safeStorage point-of-use checks (Phase 2 centralization)
- Do NOT add network connectivity probes (Phase 2)
- Do NOT add `PRAGMA quick_check` (Phase 2, P3)
- Do NOT modify the renderer or any React components
- Do NOT change the existing boot sequence order beyond adding the health check gate

## Deliverables

1. New file: `electron/services/startupHealthCheck.ts` -- health check module with all P0-P2 checks
2. Update: `electron/main.ts` -- integrate health check call in `app.whenReady()` before `createWindow()`
3. New file: `electron/services/__tests__/startupHealthCheck.test.ts` -- unit tests

## Acceptance Criteria

- [ ] P0: Native module load failure shows `dialog.showErrorBox()` with clear message and reports to Sentry
- [ ] P1: `safeStorage.isEncryptionAvailable()` check runs before DB init; shows clear error if unavailable
- [ ] P1: App data directory writable check runs before DB init; shows path in error message
- [ ] P1: Disk space check warns at <100MB, blocks at <10MB with clear message
- [ ] P2: OS version logged as warning for unsupported versions (macOS < 12, Windows < 10)
- [ ] All checks run in < 100ms total (no perceptible boot delay)
- [ ] Health check failures are reported to Sentry with version/platform context
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Unit tests cover each check in isolation

## Implementation Notes

### Full spec reference

See `.claude/plans/backlog/data/items/BACKLOG-241.md` for detailed requirements per check.

### Module Structure

```typescript
// electron/services/startupHealthCheck.ts
import * as Sentry from "@sentry/electron/main";
import { app, dialog, safeStorage } from "electron";
import * as fs from "fs";
import * as os from "os";
import checkDiskSpace from "check-disk-space";

export interface HealthCheckResult {
  passed: boolean;
  checks: {
    nativeModules: { passed: boolean; error?: string };
    safeStorage: { passed: boolean; error?: string };
    appDirWritable: { passed: boolean; error?: string; path?: string };
    diskSpace: { passed: boolean; warning?: boolean; availableMB?: number };
    osVersion: { passed: boolean; warning?: boolean; version?: string };
  };
}

/**
 * Run all pre-auth health checks. Call before createWindow().
 * Returns result. If critical check fails, shows dialog and returns passed=false.
 */
export async function runStartupHealthChecks(): Promise<HealthCheckResult> {
  // Run checks in order: P0 first, then P1, then P2
}
```

### P0: Native Module Load Validation

```typescript
function checkNativeModules(): { passed: boolean; error?: string } {
  try {
    // Attempt to require the native module
    require("better-sqlite3-multiple-ciphers");
    return { passed: true };
  } catch (error) {
    const message = `Database engine failed to load. Please reinstall the application.\n\nError: ${error instanceof Error ? error.message : String(error)}`;
    dialog.showErrorBox("Startup Error", message);
    Sentry.captureException(error, {
      tags: { check: "native_module", nodeVersion: process.version },
      extra: { electronVersion: process.versions.electron },
    });
    return { passed: false, error: message };
  }
}
```

### P1: safeStorage Preflight

```typescript
function checkSafeStorage(): { passed: boolean; error?: string } {
  if (!safeStorage.isEncryptionAvailable()) {
    const message = "Encryption not available. Please check your system keychain.\n\nThe app requires system encryption to protect your data.";
    dialog.showErrorBox("Encryption Unavailable", message);
    Sentry.captureMessage("safeStorage unavailable at startup", {
      level: "error",
      tags: { check: "safe_storage", platform: process.platform },
    });
    return { passed: false, error: message };
  }
  return { passed: true };
}
```

### P1: App Dir Writable

```typescript
async function checkAppDirWritable(): Promise<{ passed: boolean; error?: string; path?: string }> {
  const userDataPath = app.getPath("userData");
  try {
    await fs.promises.access(userDataPath, fs.constants.W_OK);
    return { passed: true, path: userDataPath };
  } catch {
    const message = `Application data directory is not writable.\n\nExpected path: ${userDataPath}\n\nPlease check directory permissions.`;
    dialog.showErrorBox("Directory Error", message);
    Sentry.captureMessage("userData directory not writable", {
      level: "error",
      tags: { check: "app_dir_writable" },
      extra: { path: userDataPath },
    });
    return { passed: false, error: message, path: userDataPath };
  }
}
```

### P1: Disk Space

```typescript
async function checkDiskSpaceAvailable(): Promise<{ passed: boolean; warning?: boolean; availableMB?: number }> {
  try {
    const userDataPath = app.getPath("userData");
    const { free } = await checkDiskSpace(userDataPath);
    const availableMB = Math.round(free / (1024 * 1024));

    if (availableMB < 10) {
      dialog.showErrorBox(
        "Insufficient Disk Space",
        `Only ${availableMB}MB available. The app requires at least 10MB to operate.\n\nPlease free up disk space and try again.`
      );
      Sentry.captureMessage("Critically low disk space at startup", {
        level: "error",
        tags: { check: "disk_space" },
        extra: { availableMB },
      });
      return { passed: false, availableMB };
    }

    if (availableMB < 100) {
      Sentry.addBreadcrumb({
        category: "startup",
        message: `Low disk space warning: ${availableMB}MB available`,
        level: "warning",
      });
      return { passed: true, warning: true, availableMB };
    }

    return { passed: true, availableMB };
  } catch {
    // Non-critical: if we can't check, proceed
    return { passed: true };
  }
}
```

### P2: OS Version

```typescript
function checkOsVersion(): { passed: boolean; warning?: boolean; version?: string } {
  const release = os.release();
  const platform = process.platform;

  if (platform === "darwin") {
    const major = parseInt(release.split(".")[0], 10);
    // macOS 12 Monterey = Darwin 21.x
    if (major < 21) {
      Sentry.addBreadcrumb({
        category: "startup",
        message: `Unsupported macOS version: Darwin ${release}`,
        level: "warning",
      });
      return { passed: true, warning: true, version: release };
    }
  } else if (platform === "win32") {
    const major = parseInt(release.split(".")[0], 10);
    // Windows 10 = 10.x
    if (major < 10) {
      Sentry.addBreadcrumb({
        category: "startup",
        message: `Unsupported Windows version: ${release}`,
        level: "warning",
      });
      return { passed: true, warning: true, version: release };
    }
  }

  return { passed: true, version: release };
}
```

### Integration in main.ts

```typescript
// In app.whenReady() handler, BEFORE createWindow()
import { runStartupHealthChecks } from "./services/startupHealthCheck";

app.whenReady().then(async () => {
  // Existing code above...

  // NEW: Pre-auth health checks
  const healthResult = await runStartupHealthChecks();
  if (!healthResult.passed) {
    app.quit();
    return;
  }

  // Existing createWindow() call below...
});
```

### Important Details

- `check-disk-space` is already installed as a dependency (used in `deviceSyncOrchestrator.ts`)
- `Sentry` is already initialized before `app.whenReady()` in main.ts
- P0 and P1 failures should block startup (show dialog, then `app.quit()`)
- P2 (OS version) is warning-only -- does not block startup
- All checks should be fast -- no network calls, no heavy IO

## Integration Notes

- **Imports from:** `electron` (app, dialog, safeStorage), `@sentry/electron/main`, `check-disk-space`, `fs`, `os`
- **Exports to:** `electron/main.ts`
- **Used by:** Boot sequence only
- **Depends on:** No other sprint tasks

## Do / Don't

### Do:
- Use `dialog.showErrorBox()` for fatal errors (synchronous, works before window exists)
- Report all failures to Sentry with relevant context tags
- Make the module independently testable (pure functions where possible)
- Keep all checks under 100ms total

### Don't:
- Use `BrowserWindow` dialogs (window doesn't exist yet)
- Block on P2 checks (warnings only)
- Add network-dependent checks (this is pre-auth)
- Modify existing safeStorage point-of-use checks in other files

## When to Stop and Ask

- If `require("better-sqlite3-multiple-ciphers")` side-effects are problematic (e.g., it initializes something)
- If `check-disk-space` API has changed from what's shown here
- If Sentry is not initialized before `app.whenReady()` (need to verify timing)
- If the `app.whenReady()` handler structure has changed significantly from line 837

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `checkNativeModules()` -- mock require failure, verify error object
  - `checkSafeStorage()` -- mock safeStorage.isEncryptionAvailable() false/true
  - `checkAppDirWritable()` -- mock fs.access failure/success
  - `checkDiskSpaceAvailable()` -- mock check-disk-space with various MB values
  - `checkOsVersion()` -- mock os.release() for various versions
  - `runStartupHealthChecks()` -- integration test with all checks passing / one failing

### Coverage

- Coverage impact: Should increase (new module fully tested)

### Integration / Feature Tests

- Required scenarios:
  - App starts normally with all checks passing (manual)
  - (Optional) Corrupt native module binary, verify error dialog appears

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(electron): add pre-auth startup health checks`
- **Labels**: `feature`, `electron`, `reliability`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~18K

**Token Cap:** 72K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files (service + tests) | +10K |
| Files to modify | 1 file (main.ts, small integration) | +3K |
| Code volume | ~150 lines service + ~100 lines tests | +5K |
| Test complexity | Medium (mocking Electron APIs) | +5K |

**Adjustment:** service x 0.5 applied. Base estimate ~35K, adjusted to ~18K.

**Confidence:** High

**Risk factors:**
- Mocking Electron APIs in tests may be tricky
- `require()` interception for native module test may need jest config

**Similar past tasks:** BACKLOG-498 (disk space check in deviceSyncOrchestrator) -- similar pattern

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
Files created:
- [ ] electron/services/startupHealthCheck.ts
- [ ] electron/services/__tests__/startupHealthCheck.test.ts

Features implemented:
- [ ] P0: Native module load validation
- [ ] P1: safeStorage preflight check
- [ ] P1: App data directory writable check
- [ ] P1: Disk space check (warn <100MB, block <10MB)
- [ ] P2: OS version compatibility warning
- [ ] Integration in main.ts app.whenReady()

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

**Variance:** PM Est ~18K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~18K | ~XK | +/-X% |
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
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
