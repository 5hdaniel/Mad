# TASK-617: Commented Code Removal

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 7 - Cleanup
**Priority:** LOW
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** [YYYY-MM-DD HH:MM]
**Task End:** [YYYY-MM-DD HH:MM]
**Wall-Clock Time:** [X min] (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

**Estimated vs Actual:**
- Est Turns: 1-2 → Actual: _ (variance: _%)
- Est Wall-Clock: 5-10 min → Actual: _ min (variance: _%)
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 4-6 | **1-2** | - |
| **Tokens** | ~20K | ~6K | - |
| **Time** | 30-45m | **5-10 min** | **5-10 min** |

**Category:** refactor
**Confidence:** High (based on TASK-602/603 actuals)

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
