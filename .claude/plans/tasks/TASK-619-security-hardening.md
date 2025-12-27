# TASK-619: Security Hardening - Injection Protection

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 6 - Type Safety (Security)
**Priority:** MEDIUM
**Status:** Implementation Complete - Awaiting SR Review
**Depends On:** TASK-611 (SQL Field Whitelist)
**Source:** BACKLOG-102

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** 2024-12-27 10:00
**Task End:** 2024-12-27 10:25
**Wall-Clock Time:** 25 min (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | 0 | 0 | 0 min |
| Implementation | 2 | ~50K | 25 min |
| Debugging | 0 | 0 | 0 min |
| **Total** | 2 | ~50K | 25 min |

**Estimated vs Actual:**
- Est Turns: 6-8 → Actual: 2 (variance: -71%)
- Est Wall-Clock: 60-90 min → Actual: 25 min (variance: -67%)

**Notes:**
- Phase 2 (IPC Rate Limiting) deferred as per task instructions
- Implemented Phase 1 (Query Timeout) and Phase 3 (Security Docs)
- Background agents attempted parallel execution but blocked on permissions
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (1.0x security) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 6-8 | **6-8** | - |
| **Tokens** | ~30K | ~30K | - |
| **Time** | 1.5-2h | **60-90 min** | **60-90 min** |

**Category:** security
**Confidence:** Medium (security tasks require careful review)

---

## Objective

Implement additional security hardening measures for defense-in-depth protection against SQL injection, XSS, and DoS attacks.

---

## Current State

The codebase has solid protections (8.5/10):
- **SQL Injection**: Parameterized queries (100%), field whitelist (TASK-611), input validation
- **XSS**: React auto-escaping, strict CSP, contextIsolation
- **Command Injection**: UDID validation, path validation, shell metacharacter blocking

---

## Requirements

### Must Do

1. **SQL Query Timeout** - Add `busy_timeout` pragma to prevent hangs
2. **IPC Rate Limiting** - Throttle expensive IPC handlers
3. **Security Documentation** - Document patterns for future developers

### Optional (Skip if not needed)

4. **DOMPurify** - HTML sanitization library (only if rendering user HTML)

### Must NOT Do

- Break existing functionality
- Add unnecessary performance overhead
- Over-engineer rate limiting

---

## Implementation

### Phase 1: Query Timeout (~15 min)

```typescript
// electron/services/db/core/dbConnection.ts
database.pragma("busy_timeout = 5000"); // 5-second timeout
```

### Phase 2: IPC Rate Limiting (~45 min)

Create throttle utility and apply to expensive handlers:

```typescript
// electron/utils/rateLimit.ts
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  let lastCall = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn(...args);
    }
  }) as T;
}
```

Target handlers:
- File scan operations
- Database-heavy queries
- External API calls

### Phase 3: Security Documentation (~20 min)

Create `.claude/docs/shared/security-patterns.md` documenting:
- Current protections
- Validation patterns
- Security checklist for new features

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/utils/rateLimit.ts` | Throttle/debounce utilities |
| `electron/utils/__tests__/rateLimit.test.ts` | Tests |
| `.claude/docs/shared/security-patterns.md` | Security documentation |

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/db/core/dbConnection.ts` | Add busy_timeout pragma |
| `electron/handlers/*.ts` | Add rate limiting to expensive handlers |

---

## Testing Requirements

1. **Unit Tests**
   - Throttle utility works correctly
   - Rate limiting doesn't break normal usage

2. **Integration**
   - Database timeout works
   - Existing operations unaffected

---

## Acceptance Criteria

- [x] `busy_timeout` pragma added to database initialization
- [ ] ~~At least 3 expensive IPC handlers have rate limiting~~ (deferred to Phase 2)
- [x] Security documentation created
- [x] All existing tests pass
- [x] `npm run type-check` passes
- [x] `npm run lint` passes
- [ ] SR Engineer architecture review passed

---

## Parallel Execution Notes

**Can run in parallel with:** TASK-614, TASK-618, TASK-613
**Must wait for:** TASK-616/617 if modifying same handler files

**Recommended approach:**
- Phase 1 (Query Timeout) + Phase 3 (Docs) can run immediately
- Phase 2 (Rate Limiting) should wait until after TASK-616/617

---

## Branch

```
feature/TASK-619-security-hardening
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
