# TASK-1019: Add Tests for systemService.ts

**Backlog ID:** BACKLOG-191
**Sprint:** SPRINT-031
**Phase:** 1 (Sequential - after TASK-1018)
**Branch:** `test/task-1019-systemservice-tests`
**Estimated Tokens:** ~25K

---

## Objective

Create comprehensive unit tests for `src/services/systemService.ts` covering system-level operations like platform detection, file handling, and export functionality.

---

## Context

The system service handles platform and system operations:
- Platform detection (Windows, macOS, Linux)
- File system operations
- Export functionality
- App version and info

Currently at 0% test coverage.

**Prerequisite:** TASK-1018 must be completed first.

---

## Requirements

### Must Do:
1. Create `src/services/__tests__/systemService.test.ts`
2. Reuse mock pattern from previous tasks
3. Test platform detection
4. Test file operations (showInFolder, openPath)
5. Test export functionality
6. Test app info retrieval
7. Achieve >60% code coverage for systemService.ts

### Must NOT Do:
- Modify systemService.ts implementation
- Create tests that depend on actual file system
- Create platform-specific tests that only pass on one OS

---

## Acceptance Criteria

- [ ] `systemService.test.ts` exists and passes
- [ ] Coverage >60% for `src/services/systemService.ts`
- [ ] Platform detection tested with mocked values
- [ ] File operations tested with mocked IPC
- [ ] Tests run 3x without flakiness
- [ ] Tests pass on all platforms (CI validation)

---

## Files to Modify

- `src/services/__tests__/systemService.test.ts` - CREATE (new file)

## Files to Read (for context)

- `src/services/systemService.ts` - Service to test
- `src/services/__tests__/authService.test.ts` - Mock pattern reference
- `electron/preload/systemBridge.ts` - IPC interface

---

## Implementation Guide

### Step 1: Set Up System Mocks

```typescript
// src/services/__tests__/systemService.test.ts

/**
 * SystemService Tests
 *
 * Note: Platform detection tests should mock different platform values
 * to ensure cross-platform compatibility.
 */

const mockGetPlatform = jest.fn();
const mockShowInFolder = jest.fn();
const mockOpenPath = jest.fn();
const mockExportData = jest.fn();
const mockGetAppInfo = jest.fn();

Object.defineProperty(window, 'api', {
  value: {
    system: {
      platform: 'darwin', // Default mock, override per test
      getPlatform: mockGetPlatform,
      showInFolder: mockShowInFolder,
      openPath: mockOpenPath,
      exportData: mockExportData,
      getAppInfo: mockGetAppInfo,
    },
  },
  writable: true,
});
```

### Step 2: Test Cases to Implement

| Category | Test Case | Priority |
|----------|-----------|----------|
| Platform | Detect macOS | High |
| Platform | Detect Windows | High |
| Platform | Detect Linux | Medium |
| Platform | Handle unknown platform | Medium |
| File | Show in folder (success) | High |
| File | Show in folder (error) | Medium |
| File | Open path | High |
| Export | Export data success | High |
| Export | Export with options | Medium |
| Export | Export error handling | Medium |
| Info | Get app version | High |
| Info | Get app info object | Medium |

### Step 3: Platform-Agnostic Testing

```typescript
describe('platform detection', () => {
  it('should detect macOS', () => {
    // Override platform mock for this test
    Object.defineProperty(window.api.system, 'platform', {
      value: 'darwin',
      writable: true,
    });

    const result = systemService.getPlatform();
    expect(result).toBe('macOS');
  });

  it('should detect Windows', () => {
    Object.defineProperty(window.api.system, 'platform', {
      value: 'win32',
      writable: true,
    });

    const result = systemService.getPlatform();
    expect(result).toBe('Windows');
  });
});
```

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:** 12-15 test cases
- **Existing tests to update:** None

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness
- [ ] Tests pass on macOS AND Windows CI runners

---

## PR Preparation

- **Title:** `test(system): add unit tests for systemService`
- **Branch:** `test/task-1019-systemservice-tests`
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

- **Before**: systemService.ts at 0% coverage
- **After**: systemService.ts at >60% coverage
- **Actual Tokens**: ~XK (Est: 25K)
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
- **Suggested Branch Name:** test/task-1019-systemservice-tests

### Execution Classification
- **Parallel Safe:** No - follows TASK-1017/1018 pattern
- **Depends On:** TASK-1018
- **Blocks:** TASK-1020, TASK-1021, TASK-1022 (Phase 2 gate)

### Shared File Analysis
- Files created: `src/services/__tests__/systemService.test.ts`
- Conflicts with: None (creates new test file)

### Technical Considerations

**API Surface to Test (406 lines, 18 methods):**
- Permissions: `runPermissionSetup`, `requestContactsPermission`, `setupFullDiskAccess`, `openPrivacyPane`, `checkFullDiskAccessStatus`, `checkFullDiskAccess`, `checkContactsPermission`, `checkAllPermissions`
- Connections: `checkGoogleConnection`, `checkMicrosoftConnection`, `checkAllConnections`, `healthCheck`
- Secure Storage: `getSecureStorageStatus`, `initializeSecureStorage`, `hasEncryptionKeyStore`
- Database: `initializeDatabase`, `isDatabaseInitialized`
- Support: `contactSupport`, `getDiagnostics`

**Complex Response Mapping (checkAllPermissions):**
Lines 178-192 have complex response mapping with type assertion:
```typescript
const result = await window.api.system.checkAllPermissions() as AllPermissionsResponse;
return {
  success: true,
  data: {
    fullDiskAccess: result.permissions?.fullDiskAccess?.hasPermission ?? false,
    contactsAccess: result.permissions?.contacts?.hasPermission ?? false,
    allGranted: result.allGranted,
  },
};
```
Test edge cases: undefined permissions, partial permissions, null values.

**Mock Requirements:**
This service uses `window.api.system` for all methods. Mock structure:
```typescript
(window as any).api = {
  system: {
    runPermissionSetup: mockRunPermissionSetup,
    // ... 17 more methods
  },
};
```

**Cross-Platform Consideration:**
Tests should NOT depend on actual platform. The service abstracts platform via IPC, so tests just verify the IPC call forwarding and response mapping.

---

## Guardrails

**STOP and ask PM if:**
- Platform-specific behaviors are complex
- File operations have side effects in tests
- Mock setup for system APIs doesn't work
- Tests fail on one platform but pass on another
- You encounter blockers not covered in the task file
