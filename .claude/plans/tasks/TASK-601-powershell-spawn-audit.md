# TASK-601: PowerShell Spawn Audit

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

Audit all `spawn()` and `exec()` calls in the electron services to ensure no user-controlled input flows into command arguments, and add safeguards where needed.

---

## Current State

### Files with spawn/exec calls

1. **`electron/services/appleDriverService.ts:314`**
   ```typescript
   const psCommand = `
     try {
       $process = Start-Process -FilePath "msiexec.exe" -ArgumentList '${msiArgs}' -Verb RunAs -Wait -PassThru -ErrorAction Stop
   `;
   const installer = spawn("powershell", ["-Command", psCommand], { shell: false });
   ```
   **Risk:** `msiArgs` is interpolated into PowerShell command. Need to verify source.

2. **`electron/services/backupService.ts:100, 251`**
   ```typescript
   const proc = spawn(ideviceinfo, ["-u", udid, "-k", "WillEncrypt"]);
   this.currentProcess = spawn(idevicebackup2, args, { ... });
   ```
   **Risk:** `udid` and `args` come from device detection. Need to validate.

3. **`electron/services/deviceDetectionService.ts:216, 269, 345`**
   ```typescript
   const proc = spawn(ideviceIdCmd, ["-l"]);
   const proc = spawn(ideviceinfoCmd, ["-u", udid]);
   ```
   **Risk:** `udid` from device. Need to validate format.

---

## Requirements

### Must Do
1. Audit each spawn/exec call and trace input sources
2. Add input validation for any external data used in commands
3. Document each call site with security analysis
4. Add validation utilities if needed

### Must NOT Do
- Rewrite working functionality
- Add unnecessary complexity
- Break existing device detection/backup features

---

## Audit Checklist

For each spawn/exec call, verify:

| Call Site | Input Source | User Controlled? | Validated? | Action |
|-----------|--------------|------------------|------------|--------|
| `appleDriverService.ts:314` | `msiArgs` | Audit needed | ? | |
| `backupService.ts:100` | `udid` | Device data | ? | |
| `backupService.ts:251` | `args` | Internal | ? | |
| `deviceDetectionService.ts:216` | None | No | N/A | Safe |
| `deviceDetectionService.ts:269` | `udid` | Device data | ? | |
| `deviceDetectionService.ts:345` | `udid` | Device data | ? | |

---

## Implementation Approach

1. **Trace msiArgs source** in appleDriverService
   - Find where `msiArgs` is constructed
   - Verify all components are trusted (paths from app bundle, version strings)

2. **Add UDID validation**
   ```typescript
   function isValidUDID(udid: string): boolean {
     // iOS UDIDs are 40 hex characters (SHA-1) or 25 chars (newer format)
     return /^[a-fA-F0-9]{40}$/.test(udid) || /^[a-fA-F0-9-]{25}$/.test(udid);
   }
   ```

3. **Add path validation** for executable paths
   ```typescript
   function isSafePath(execPath: string): boolean {
     // Must be absolute path, no shell metacharacters
     return path.isAbsolute(execPath) && !/[;&|`$]/.test(execPath);
   }
   ```

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/appleDriverService.ts` | Audit msiArgs, add validation if needed |
| `electron/services/backupService.ts` | Add UDID validation |
| `electron/services/deviceDetectionService.ts` | Add UDID validation |
| `electron/utils/validation.ts` | Add spawn input validators |
| `electron/utils/__tests__/validation.test.ts` | Add tests for validators |

---

## Testing Requirements

1. **Unit Tests**
   - Test UDID validation (valid/invalid formats)
   - Test path validation
   - Test command construction safety

2. **Integration Tests**
   - Ensure device detection still works
   - Ensure backup still works
   - Ensure driver installation still works

---

## Acceptance Criteria

- [ ] All spawn/exec calls audited and documented
- [ ] Input validation added where external data used
- [ ] No user-controlled input flows unvalidated into commands
- [ ] All existing tests pass
- [ ] New validation tests added
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] SR Engineer security review passed

---

## Branch

```
feature/TASK-601-powershell-spawn-audit
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
