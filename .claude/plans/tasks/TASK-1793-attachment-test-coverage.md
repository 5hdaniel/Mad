# TASK-1793: Add Test Coverage for Attachment Extraction

**Backlog ID:** BACKLOG-596
**Sprint:** SPRINT-068 (Follow-up / Post-Review)
**Phase:** Post-Implementation Test Coverage
**Branch:** Follow branch pattern from current work
**Estimated Tokens:** ~15K
**Priority:** LOW

---

## Objective

Add unit tests for new attachment extraction code to prevent regressions and ensure reliability of Windows attachment import (TASK-1788).

---

## Context

**Current Implementation (Issue):**
- TASK-1788 implemented new attachment extraction feature for Windows
- No unit tests for new attachment functionality
- Regressions may not be caught until user testing
- Code paths not covered by existing test suite

**New Functions Implemented:**
- `resolveAttachmentPath()` in `iosMessagesParser.ts`
- `computeBackupFileHash()` in `iosMessagesParser.ts`
- Attachment storage logic in `iPhoneSyncStorageService.storeAttachments()`

**Impact:**
- Future changes to attachment logic could break extraction silently
- Maintenance risk: unclear which functions are critical
- No regression detection for platform-specific code

---

## Requirements

### Must Do:
1. Add unit tests for `resolveAttachmentPath()` function
   - Various media types (photos, videos, documents)
   - Attachment reference formats
   - Missing/invalid attachment handling

2. Add unit tests for `computeBackupFileHash()` function
   - Hash correctness for known files
   - Error handling (file not found, permission denied)
   - Consistency across runs

3. Add unit tests for attachment storage flow
   - Files copied to correct destination
   - Hash stored correctly in database
   - Error handling on copy failure

### Must NOT Do:
- Break existing test suite
- Create flaky tests (time-dependent, file system dependent)
- Achieve 100% coverage at expense of test maintainability

---

## Acceptance Criteria

- [ ] `resolveAttachmentPath()` has test cases for major scenarios
- [ ] `computeBackupFileHash()` has test cases with mocked files
- [ ] Attachment storage flow tested end-to-end
- [ ] Error scenarios covered (missing files, permissions, etc.)
- [ ] All existing tests pass
- [ ] Test coverage increased for modified files (target: 40-60%)

---

## Files to Create / Modify

### New Test Files
- `electron/services/__tests__/iosMessagesParser.test.ts` (if not exists)
  - Tests for `resolveAttachmentPath()`
  - Tests for `computeBackupFileHash()`

- `electron/services/__tests__/iPhoneSyncStorageService.test.ts` (if not exists)
  - Tests for attachment storage logic

### Files to Reference
- Existing test patterns in `electron/services/__tests__/`
- `iosMessagesParser.ts` implementation
- `iPhoneSyncStorageService.ts` implementation

---

## Testing Expectations

### Unit Test Coverage

#### `resolveAttachmentPath()` Tests
1. Standard media path resolution (photo with numeric ID)
2. Video attachment resolution
3. Document attachment resolution
4. Missing attachment reference (should return null or handle gracefully)
5. Invalid path format (should sanitize or reject)

Example:
```typescript
describe('resolveAttachmentPath', () => {
  it('should resolve photo attachment paths', () => {
    const result = resolveAttachmentPath({
      filename: '123ABC.jpg',
      uti: 'public.jpeg'
    }, '/backup/path');
    expect(result).toBeDefined();
    expect(result).toContain('123ABC');
  });

  it('should handle missing attachments', () => {
    const result = resolveAttachmentPath(null, '/backup/path');
    expect(result).toBeNull();
  });
});
```

#### `computeBackupFileHash()` Tests
1. Hash computation on real file (mock)
2. Hash consistency (same file = same hash)
3. Different files have different hashes
4. Error handling: file not found
5. Error handling: permission denied

Example:
```typescript
describe('computeBackupFileHash', () => {
  it('should compute consistent hash for same file', async () => {
    const hash1 = await computeBackupFileHash('/path/to/file');
    const hash2 = await computeBackupFileHash('/path/to/file');
    expect(hash1).toBe(hash2);
  });

  it('should return different hash for different files', async () => {
    const hash1 = await computeBackupFileHash('/path/to/file1');
    const hash2 = await computeBackupFileHash('/path/to/file2');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle missing file', async () => {
    await expect(
      computeBackupFileHash('/nonexistent/file')
    ).rejects.toThrow();
  });
});
```

#### Attachment Storage Tests
1. Files copied to correct directory
2. Hash stored in database
3. Metadata updated correctly
4. Error handling: copy fails (disk full, permission denied)
5. Partial success (some files copied, some failed)

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] Coverage report shows improved coverage for touched files

---

## Technical Notes

### Mocking Strategies

**File System Operations:**
- Use `jest.mock('fs')` or `jest.spyOn(fs, 'readFile')`
- Create fixture files in test temporary directory
- Mock crypto hash for predictable output

**Database Operations:**
- Mock `databaseService` to avoid real DB writes
- Verify called with correct parameters

**File Paths:**
- Use `path.join()` for cross-platform compatibility
- Mock backup path structure

### Test Data Strategy
- Create fixture directory with sample media files
- Use before/after hooks to clean up test files
- Keep fixture files small (don't check large media into repo)

---

## PR Preparation

- **Title:** `test(windows): add coverage for attachment extraction`
- **Target:** `develop`
- **Related PR:** #716 (SPRINT-068 original work)

---

## Guardrails

**STOP and ask PM if:**
- Cannot mock file system without excessive complexity
- Tests become flaky due to file timing issues
- Estimate exceeds 20K tokens

**OK to defer if:**
- User testing of SPRINT-068 shows attachment extraction is stable
- Sprint capacity is limited

---

## Implementation Status

**STATUS: PENDING**

Awaiting engineer assignment from PM. This is a direct SR Engineer follow-up recommendation from PR #716 review. **LOW PRIORITY** - can be deferred if sprint capacity limited. Consider pairing with TASK-1790/1791 for efficiency.

