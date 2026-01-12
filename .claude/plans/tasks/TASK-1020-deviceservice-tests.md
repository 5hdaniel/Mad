# TASK-1020: Add Tests for deviceService.ts

**Backlog ID:** BACKLOG-191
**Sprint:** SPRINT-031
**Phase:** 2 (Parallel)
**Branch:** `test/task-1020-deviceservice-tests`
**Estimated Tokens:** ~30K

---

## Objective

Create comprehensive unit tests for `src/services/deviceService.ts` covering device management, sync status, and backup operations.

---

## Context

The device service handles device-level operations:
- Device registration and identification
- Sync status tracking
- Backup management
- Device linking

Currently at 0% test coverage. This completes the service layer test coverage initiative.

**Prerequisite:** Phase 1 (TASK-1017, 1018, 1019) must be completed first.

---

## Requirements

### Must Do:
1. Create `src/services/__tests__/deviceService.test.ts`
2. Reuse mock pattern from previous tasks
3. Test device registration
4. Test device identification
5. Test sync status queries
6. Test backup operations
7. Achieve >60% code coverage for deviceService.ts

### Must NOT Do:
- Modify deviceService.ts implementation
- Create tests with real device interactions
- Create flaky tests

---

## Acceptance Criteria

- [ ] `deviceService.test.ts` exists and passes
- [ ] Coverage >60% for `src/services/deviceService.ts`
- [ ] Device registration fully tested
- [ ] Sync status operations tested
- [ ] Tests run 3x without flakiness

---

## Files to Modify

- `src/services/__tests__/deviceService.test.ts` - CREATE (new file)

## Files to Read (for context)

- `src/services/deviceService.ts` - Service to test
- `src/services/__tests__/authService.test.ts` - Mock pattern reference
- `electron/preload/deviceBridge.ts` - IPC interface

---

## Implementation Guide

### Step 1: Set Up Device Mocks

```typescript
// src/services/__tests__/deviceService.test.ts

/**
 * DeviceService Tests
 *
 * Final service in BACKLOG-191 test coverage initiative.
 */

const mockRegisterDevice = jest.fn();
const mockGetDeviceId = jest.fn();
const mockGetSyncStatus = jest.fn();
const mockUpdateSyncStatus = jest.fn();
const mockCreateBackup = jest.fn();
const mockRestoreBackup = jest.fn();
const mockGetDeviceInfo = jest.fn();

Object.defineProperty(window, 'api', {
  value: {
    device: {
      register: mockRegisterDevice,
      getId: mockGetDeviceId,
      getSyncStatus: mockGetSyncStatus,
      updateSyncStatus: mockUpdateSyncStatus,
      createBackup: mockCreateBackup,
      restoreBackup: mockRestoreBackup,
      getInfo: mockGetDeviceInfo,
    },
  },
  writable: true,
});
```

### Step 2: Test Cases to Implement

| Category | Test Case | Priority |
|----------|-----------|----------|
| Registration | Register new device | High |
| Registration | Handle already registered | Medium |
| Registration | Registration error | Medium |
| Identity | Get device ID | High |
| Identity | Device ID not set | Medium |
| Sync | Get sync status | High |
| Sync | Update sync status | High |
| Sync | Sync in progress flag | Medium |
| Backup | Create backup success | High |
| Backup | Create backup error | Medium |
| Backup | Restore backup | High |
| Backup | Restore with validation | Medium |
| Info | Get device info | High |

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:** 12-15 test cases
- **Existing tests to update:** None

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness
- [ ] Coverage threshold met

---

## PR Preparation

- **Title:** `test(device): add unit tests for deviceService`
- **Branch:** `test/task-1020-deviceservice-tests`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely
- [ ] Reviewed previous task mock patterns

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: deviceService.ts at 0% coverage
- **After**: deviceService.ts at >60% coverage
- **Actual Tokens**: ~XK (Est: 30K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## SR Engineer Review Notes

**Review Date:** 2026-01-10 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** test/task-1020-deviceservice-tests

### Execution Classification
- **Parallel Safe:** Yes - Phase 2, different file from TASK-1021/1022
- **Depends On:** TASK-1019 (Phase 1 complete)
- **Blocks:** None

### Shared File Analysis
- Files created: `src/services/__tests__/deviceService.test.ts`
- Conflicts with: None (creates new test file)

### Technical Considerations

**CRITICAL - This is the LARGEST service file (782 lines, 40+ methods):**
Token estimate may be low. This service has 4 API domains:
1. `window.api.device` - Device detection (5 methods + 2 event handlers)
2. `window.api.backup` - Backup operations (12 methods + 3 event handlers)
3. `window.api.drivers` - Driver management (4 methods)
4. `window.api.sync` - iPhone sync (10 methods + 9 event handlers)

**API Availability Guards:**
Every method checks if the API exists first:
```typescript
if (!window.api.device) {
  return { success: false, error: "Device API not available" };
}
```
Test BOTH scenarios: API available and API not available.

**Event Handler Testing:**
Service has 14 event subscription methods (e.g., `onDeviceConnected`, `onBackupProgress`).
These return unsubscribe functions. Test:
1. With API available - returns actual cleanup function
2. Without API - returns no-op function `() => {}`

**Mock Structure:**
```typescript
(window as any).api = {
  device: { /* 5 methods */ },
  backup: { /* 12 methods */ },
  drivers: { /* 4 methods */ },
  sync: { /* 10 methods */ },
};
```

**Suggested Test Priority (for 60% coverage):**
| Priority | Methods | Count |
|----------|---------|-------|
| High | listDevices, startBackup, startSync, checkAppleDriver | 4 |
| Medium | API availability guards (test once, pattern repeats) | 1 |
| Medium | Event handlers (test pattern once) | 1 |
| Lower | Remaining CRUD methods | As needed |

**Token Estimate Revision:**
Original: 30K tokens
Revised: 35-40K tokens (due to file size and 4 API domains)

---

## Guardrails

**STOP and ask PM if:**
- Device service has complex state management
- Backup operations have unexpected complexity
- Sync status has many edge cases
- Tests require modifying production code
- You encounter blockers not covered in the task file
