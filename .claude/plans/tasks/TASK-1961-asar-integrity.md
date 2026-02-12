# Task TASK-1961: Enable ASAR Integrity

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

Explicitly enable ASAR packaging in electron-builder config to ensure the `EnableEmbeddedAsarIntegrityValidation` fuse (set in TASK-1960) works correctly. While ASAR is the default, making it explicit prevents accidental disabling.

## Non-Goals

- Do NOT modify ASAR exclusion patterns
- Do NOT change `extraResources` configuration (already outside ASAR, which is correct)
- Do NOT add ASAR signing (separate from integrity validation)

## Deliverables

1. Update: `package.json` — add explicit `"asar": true` in the build section (around line 136)

## Acceptance Criteria

- [ ] `"asar": true` is explicitly set in `package.json` build config
- [ ] Build on macOS succeeds with no ASAR integrity failure on launch
- [ ] `extraResources` entries still work correctly (they are outside ASAR by design)
- [ ] All CI checks pass

## Implementation Notes

### Change

In `package.json`, in the `"build"` section, add:
```json
"asar": true
```

This should go near the top of the build config section (around line 136).

### Important Details

- electron-builder defaults to `asar: true`, but making it explicit prevents accidental regression
- `extraResources` are correctly configured to be outside ASAR — no changes needed there
- This pairs with `EnableEmbeddedAsarIntegrityValidation` fuse from TASK-1960

## Integration Notes

- Depends on TASK-1960 (fuses must be configured first)
- TASK-1962 follows this task (sequential chain)

## Do / Don't

### Do:
- Place `"asar": true` prominently in the build config
- Add a brief comment in the PR about why explicit is better than implicit default

### Don't:
- Do NOT add `asar` sub-options (like `smartUnpack`) unless needed
- Do NOT modify extraResources configuration

## When to Stop and Ask

- If the build config already has `"asar": false` (indicates intentional disabling — ask PM)
- If ASAR packaging causes any runtime errors

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (build configuration, not runtime code)
- Verify via: `npm run package:dev` + launch packaged app

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## PR Preparation

- **Title:** `feat(security): enable explicit ASAR integrity`
- **Labels:** `security`, `electron`
- **Depends on:** TASK-1960

---

## PM Estimate (PM-Owned)

**Category:** `security`
**Estimated Tokens:** ~10K
**Token Cap:** 40K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Files modified:
- [ ] package.json (asar: true in build config)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] npm run package:dev produces working build with ASAR
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
