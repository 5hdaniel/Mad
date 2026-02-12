# Task TASK-1962: Add Permission Request Handler

---

## WORKFLOW REQUIREMENT
**This task MUST be implemented via the `engineer` agent.**

1. PM creates branch and updates backlog status
2. PM invokes `engineer` agent with this task file
3. Engineer implements the task
4. Engineer opens PR targeting `develop`
5. SR Engineer reviews and merges
6. PM records metrics and updates backlog

---

## Goal

Add `session.defaultSession.setPermissionRequestHandler()` and `setPermissionCheckHandler()` to deny all web permissions by default, whitelisting only the permissions the app actually needs (clipboard, notifications).

## Non-Goals

- Do NOT modify the existing Content Security Policy (CSP) setup
- Do NOT add permission prompts/dialogs to the user (deny silently)
- Do NOT modify renderer-side code

## Deliverables

1. Update: `electron/main.ts` — add permission handlers after `setupContentSecurityPolicy()` call (around line 729)

## Acceptance Criteria

- [ ] `setPermissionRequestHandler()` is configured with deny-by-default
- [ ] `setPermissionCheckHandler()` is configured with deny-by-default
- [ ] Whitelisted permissions: `clipboard-read`, `clipboard-sanitized-write`, `notifications`
- [ ] Copy-paste works in transaction views (no permission errors)
- [ ] No permission errors in DevTools console during normal app usage
- [ ] All CI checks pass

## Implementation Notes

### Pattern Reference

Follow the existing `setupContentSecurityPolicy()` function style (lines 574-632 in `electron/main.ts`):

```typescript
function setupPermissionHandlers(): void {
  const allowedPermissions = new Set([
    'clipboard-read',
    'clipboard-sanitized-write',
    'notifications',
  ]);

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(allowedPermissions.has(permission));
    }
  );

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => {
      return allowedPermissions.has(permission);
    }
  );
}
```

### Placement

Call `setupPermissionHandlers()` after `setupContentSecurityPolicy()` in the app ready flow (around line 729).

### Important Details

- The `session` import is already available in main.ts (used by CSP setup)
- Permission names are Chromium permission strings (not Electron-specific)
- `clipboard-sanitized-write` is the safe clipboard write permission (vs `clipboard-write` which allows arbitrary formats)

## Integration Notes

- Follows TASK-1961 in the sequential chain
- Uses `session` module already imported in main.ts
- Does not conflict with CSP (CSP handles content policy, permissions handle API access)

## Do / Don't

### Do:
- Follow the `setupContentSecurityPolicy()` function pattern exactly
- Log denied permission requests at debug level for troubleshooting
- Keep the allowed permissions set minimal

### Don't:
- Do NOT add media permissions (camera, microphone) — app doesn't need them
- Do NOT add geolocation permission — app doesn't need it
- Do NOT show permission request dialogs to the user

## When to Stop and Ask

- If any existing app functionality requires a permission not in the whitelist
- If `clipboard-sanitized-write` is not recognized (may need `clipboard-write` instead)
- If `session.defaultSession` is not available at the call site

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (Electron main process, tested manually)
- Verify via: Launch app, test copy-paste, check console for permission errors

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## PR Preparation

- **Title:** `feat(security): add deny-by-default permission handlers`
- **Labels:** `security`, `electron`
- **Depends on:** TASK-1961

---

## PM Estimate (PM-Owned)

**Category:** `security`
**Estimated Tokens:** ~15K
**Token Cap:** 60K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Files modified:
- [ ] electron/main.ts (setupPermissionHandlers function + call)

Features implemented:
- [ ] setPermissionRequestHandler with deny-by-default
- [ ] setPermissionCheckHandler with deny-by-default
- [ ] Whitelist: clipboard-read, clipboard-sanitized-write, notifications

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Copy-paste works in transaction views
- [ ] No permission errors in DevTools console
```

### Notes
**Deviations from plan:** <explanation or "None">
**Issues encountered:** <document and resolution>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary
- Architecture compliance: <PASS/FAIL>
- Security review: <PASS/FAIL>

### Merge Information
**PR Number:** #
**Merge Commit:** <hash>
**Merged To:** develop
