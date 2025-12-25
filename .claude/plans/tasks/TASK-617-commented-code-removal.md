# TASK-617: Commented Code Removal

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 7 - Cleanup
**Priority:** LOW
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

Remove commented-out code blocks throughout the codebase. Move any architectural decisions to documentation.

---

## Current State

Various commented code blocks exist, e.g.:
```typescript
// electron/main.ts (line 41-42)
// NOTE: tokenEncryptionService removed - using session-only OAuth
// Tokens stored in encrypted database, no additional keychain encryption needed
```

---

## Requirements

### Must Do
1. Find commented-out code blocks
2. Evaluate if they contain important context
3. Move architectural notes to docs if needed
4. Remove pure commented code

### Must NOT Do
- Remove JSDoc comments
- Remove TODO/FIXME with context
- Delete without reviewing

---

## Evaluation Criteria

Keep if:
- JSDoc/documentation comment
- TODO with context and issue reference
- Important architectural explanation

Remove if:
- Old implementation code
- Debug code
- Duplicate functionality
- Self-evident "removed X" comments

---

## Files to Check

All TypeScript files, prioritizing:
- `electron/main.ts`
- `electron/preload.ts`
- Large service files

---

## Acceptance Criteria

- [ ] No commented-out code blocks
- [ ] Architectural notes moved to docs
- [ ] No useful context lost
- [ ] All tests pass

---

## Branch

```
feature/TASK-617-cleanup-comments
```
