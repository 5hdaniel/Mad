# BACKLOG-102: Security Hardening - Injection Protection Evaluation

## Priority: Medium

## Category: security

## Summary

Evaluate and implement additional security hardening measures to further protect against SQL injection, XSS, and DoS attacks. Current protections are strong (8.5/10), but there are minor gaps to address.

## Current State

The codebase has solid defense-in-depth protections:
- **SQL Injection**: Parameterized queries (100%), field whitelist (TASK-611), input validation
- **XSS**: React auto-escaping, strict CSP, contextIsolation, ESLint rules
- **Command Injection**: UDID validation, path validation, shell metacharacter blocking

## Identified Gaps

### 1. No SQL Query Timeout
**Risk**: Long-running queries could cause application hangs
**Location**: `electron/services/db/core/dbConnection.ts`
**Solution**: Add SQLite busy timeout pragma

```typescript
database.pragma("busy_timeout = 5000"); // 5-second timeout
```

### 2. No IPC Rate Limiting
**Risk**: Potential DoS via rapid repeated IPC calls
**Location**: IPC handlers in `electron/handlers/`
**Solution**: Implement debouncing/throttling for expensive operations

```typescript
// Example pattern
const throttledHandler = throttle(async (userId) => {
  // expensive operation
}, 1000);
```

### 3. Optional HTML Sanitization Library
**Risk**: If user-generated HTML is ever rendered, XSS could occur
**Current**: Not needed (React handles escaping), but good for defense-in-depth
**Solution**: Add DOMPurify as optional dependency

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

### 4. Security Documentation
**Risk**: Security assumptions not documented for future developers
**Solution**: Add security section to architecture documentation

## Implementation Phases

### Phase 1: Query Timeout (~15 min)
1. Add `busy_timeout` pragma to database initialization
2. Test with concurrent operations
3. Verify timeout behavior

### Phase 2: IPC Rate Limiting (~45 min)
1. Identify expensive IPC handlers (file operations, database scans)
2. Implement throttle/debounce utility
3. Apply to identified handlers
4. Add tests for rate limiting

### Phase 3: DOMPurify Integration (Optional) (~30 min)
1. Install DOMPurify
2. Create sanitization utility
3. Document usage patterns
4. Skip if no HTML rendering is planned

### Phase 4: Security Documentation (~20 min)
1. Document current protections in `.claude/docs/shared/`
2. Add security checklist for new features
3. Document validation patterns

## Acceptance Criteria

- [ ] `busy_timeout` pragma added to database initialization
- [ ] At least 3 expensive IPC handlers have rate limiting
- [ ] Security documentation created at `.claude/docs/shared/security-patterns.md`
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 6-8 | Multiple small changes |
| Tokens | ~30K | |
| Time | 1.5-2 hours | |

## Dependencies

- TASK-611 (SQL field whitelist) should be completed first

## Risks

| Risk | Mitigation |
|------|------------|
| Rate limiting breaks legitimate use | Use generous thresholds, add bypass for batch operations |
| Query timeout interrupts valid long operations | Set timeout high enough (5-10 seconds) |

## Notes

This is a proactive security improvement, not a response to a vulnerability. Current protections are strong; these additions provide defense-in-depth.

**Files to modify:**
- `electron/services/db/core/dbConnection.ts` - Query timeout
- `electron/handlers/*.ts` - Rate limiting
- `electron/utils/sanitization.ts` (new) - Optional DOMPurify wrapper
- `.claude/docs/shared/security-patterns.md` (new) - Documentation
