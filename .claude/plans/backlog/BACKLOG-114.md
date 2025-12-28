# BACKLOG-114: Boost Test Coverage for electron/utils/

## Priority: Medium

## Category: test

## Summary

Increase test coverage for `electron/utils/` from 13.59% to target of 55%.

## Problem

The electron utils directory has very low test coverage at 13.59%. These utilities handle critical Electron-specific functionality that needs testing.

**Current State:**
- Coverage: 13.59%
- Target: 55% (lower than renderer due to Electron complexity)
- Gap: 41.41 percentage points

## Solution

Add targeted tests for electron utility functions.

### Special Considerations for Electron Utils

1. **Mock Electron APIs**
   - Use jest.mock for Electron modules
   - Create test doubles for BrowserWindow, ipcMain, etc.

2. **Platform-Specific Logic**
   - Test cross-platform utilities on current platform
   - Mock platform-specific behavior where needed

3. **File System Operations**
   - Use temp directories or mock fs
   - Clean up after tests

### Example Test Pattern

```typescript
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name) => `/mock/${name}`),
    isPackaged: false,
  },
  BrowserWindow: jest.fn(),
}));

import { getAppDataPath } from './pathUtils';

describe('pathUtils', () => {
  describe('getAppDataPath', () => {
    it('should return correct path in development', () => {
      const path = getAppDataPath();
      expect(path).toContain('/mock/userData');
    });
  });
});
```

## Implementation Steps

1. Run coverage report for electron utils
2. Identify critical utilities to test
3. Set up Electron mocking infrastructure
4. Add tests for each utility
5. Verify coverage improvement

## Acceptance Criteria

- [ ] `electron/utils/` coverage >= 55%
- [ ] Critical utilities fully tested
- [ ] Electron APIs properly mocked
- [ ] Platform-specific logic tested
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 20-30 | Electron mocking adds complexity |
| Tokens | ~80K | |
| Time | 1 day | |

## Dependencies

- None

## Risks

| Risk | Mitigation |
|------|------------|
| Complex Electron mocking | Use established patterns from existing tests |
| Platform-specific failures | Test on CI across platforms |

## Notes

**This item is SR Engineer sourced from coverage audit.**

The target is 55% (lower than 80% for renderer) because Electron utilities often involve:
- Native module interactions
- File system operations
- Platform-specific behavior
- Process/IPC complexity

Focus on utilities with pure logic first, then tackle those requiring complex mocking.

**Files to test:**
- `electron/utils/*.ts`
