# TASK-1790: Optimize Attachment File Hashing with Streaming

**Backlog ID:** BACKLOG-593
**Sprint:** SPRINT-068 (Follow-up / Post-Review)
**Phase:** Post-Implementation Optimization
**Branch:** Follow branch pattern from current work
**Estimated Tokens:** ~5K
**Priority:** MEDIUM

---

## Objective

Replace memory-intensive file hashing in `iPhoneSyncStorageService.storeAttachments()` with streaming hash computation to prevent memory pressure when handling many large attachments (up to 50MB each).

---

## Context

**Current Implementation (Issue):**
- `iPhoneSyncStorageService.storeAttachments()` loads entire file into memory for hashing (around line 584)
- Uses `readFile()` + `hash.update()` approach
- Can cause memory pressure with multiple large attachments
- iPhone backups can contain numerous photos/media up to 50MB each

**Impact:**
- User may experience app slowdown/freeze during attachment extraction
- Potential memory leaks with high-volume attachment syncs
- Unoptimized for large media libraries (100+ messages with photos)

---

## Requirements

### Must Do:
1. Replace `readFile()` + buffer hash with streaming hash implementation
2. Use readable stream + crypto hash for memory efficiency
3. Maintain identical hash output (compatibility with existing hashes)
4. Handle errors gracefully (file not found, permission denied, etc.)

### Must NOT Do:
- Change the final hash format or algorithm (must be backward compatible)
- Skip error handling for missing/unreadable files
- Introduce async/await without proper error handling

---

## Acceptance Criteria

- [ ] File hash computed using streaming (no full buffer load)
- [ ] Hash output matches original implementation (test with known files)
- [ ] Memory usage is constant regardless of file size
- [ ] Error handling works for permission/missing file scenarios
- [ ] Existing tests pass
- [ ] Performance improved (measure before/after on 50MB file)

---

## Files to Modify

- `electron/services/iPhoneSyncStorageService.ts` (lines 584 area - `storeAttachments()` method)

## Files to Reference

- Node.js `fs.createReadStream()` documentation
- Node.js `crypto` module streaming hash patterns
- `computeBackupFileHash()` in `iosMessagesParser.ts` (may need same treatment)

---

## Testing Expectations

### Manual Testing (Primary)
1. Import iPhone backup with large attachments (test with 50MB file)
2. Monitor system memory during import (task manager / Activity Monitor)
3. Verify attachments extract correctly
4. Verify hash integrity (compare with hash of same file)

### Unit Tests
- **Recommended:** Add test for streaming hash with various file sizes (1KB, 10MB, 50MB)
- **Existing tests:** Must pass

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

---

## Technical Notes

### Streaming Hash Implementation Pattern

```typescript
// Instead of:
const buffer = await fs.promises.readFile(filePath);
const hash = crypto.createHash('sha256');
hash.update(buffer);
const hexHash = hash.digest('hex');

// Use:
const readable = fs.createReadStream(filePath);
const hash = crypto.createHash('sha256');
return new Promise((resolve, reject) => {
  readable
    .on('data', (chunk) => hash.update(chunk))
    .on('end', () => resolve(hash.digest('hex')))
    .on('error', reject);
});
```

### Benefits
- Constant memory footprint (~64KB chunks, not entire file)
- Faster for large files (can start hashing while reading)
- No temporary buffer allocations

---

## PR Preparation

- **Title:** `perf(windows): use streaming hash for attachment hashing`
- **Target:** `develop`
- **Related PR:** #716 (SPRINT-068 original work)

---

## Guardrails

**STOP and ask PM if:**
- Hash output format changes (must remain compatible)
- Cannot reproduce performance issue
- Estimate exceeds 8K tokens

**OK to skip if:**
- User testing shows no performance issues with current implementation
- Memory usage is acceptable on target hardware (4GB+ machines)

---

## Implementation Status

**STATUS: PENDING**

Awaiting engineer assignment from PM. This is a direct SR Engineer follow-up recommendation from PR #716 review.

