# TASK-600: AppleScript Injection Fix

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 1 - Security Hardening
**Priority:** CRITICAL
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start Time:** [timestamp]
**Task End Time:** [timestamp]

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |
```

---

## Objective

Fix shell command injection risk in AppleScript execution by using safer patterns.

---

## Current State

### Files Affected

1. **`electron/main.ts:430`**
   ```typescript
   exec(`osascript -e '${script}'`, (error) => {
   ```
   The `script` variable is a hardcoded AppleScript string. Risk is theoretical but the pattern is dangerous.

2. **`electron/services/macOSPermissionHelper.ts:62`**
   ```typescript
   await execAsync(`osascript -e '${appleScript}'`);
   ```
   Same pattern - hardcoded AppleScript, but fragile if modified.

---

## Requirements

### Must Do
1. Replace string interpolation with safer AppleScript execution pattern
2. Use `osascript` with `-` (stdin) to pass script content safely
3. OR write script to temp file and execute file path
4. Maintain exact same functionality
5. Add tests for the permission helper

### Must NOT Do
- Change any user-facing behavior
- Add new dependencies without justification
- Modify other unrelated code

---

## Implementation Approach

### Option A: Use stdin (Recommended)
```typescript
import { spawn } from 'child_process';

function runAppleScript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('osascript', ['-']);
    proc.stdin.write(script);
    proc.stdin.end();
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`osascript exited with code ${code}`));
    });
  });
}
```

### Option B: Use temp file
```typescript
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runAppleScript(script: string): Promise<void> {
  const tempPath = join(tmpdir(), `applescript-${Date.now()}.scpt`);
  writeFileSync(tempPath, script);
  // exec osascript tempPath
  // cleanup: unlinkSync(tempPath)
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/main.ts` | Replace exec pattern at line 430 |
| `electron/services/macOSPermissionHelper.ts` | Replace execAsync pattern at line 62 |
| `electron/services/macOSPermissionHelper.ts` | Add utility function for safe AppleScript execution |
| `electron/services/__tests__/macOSPermissionHelper.test.ts` | Add/update tests |

---

## Testing Requirements

1. **Unit Tests**
   - Test safe AppleScript execution utility
   - Test error handling for failed scripts
   - Mock spawn/exec calls

2. **Manual Testing (macOS only)**
   - Verify System Settings opens correctly
   - Verify Contacts permission request works
   - Verify Full Disk Access guidance works

---

## Acceptance Criteria

- [ ] No string interpolation with `exec()` for AppleScript
- [ ] Scripts passed via stdin or temp file
- [ ] All existing tests pass
- [ ] New tests for safe execution utility
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] SR Engineer security review passed

---

## Branch

```
feature/TASK-600-applescript-injection-fix
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
