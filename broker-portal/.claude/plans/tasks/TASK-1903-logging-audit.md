# TASK-1903: Audit debug logging for sensitive data

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1903 |
| **Sprint** | SPRINT-071 |
| **Priority** | P3 - Low |
| **Status** | Pending |
| **Estimated Tokens** | ~6K |
| **Depends On** | TASK-1902 |

## Security Context

**Issue:** LOW-001 - Debug logging audit

Logging statements may inadvertently expose sensitive information to browser consoles or server logs.

## Requirements

### Must Do

1. Search for all logging statements:
   ```bash
   grep -rn "console\." --include="*.ts" --include="*.tsx"
   ```

2. Review each statement for sensitive data:
   - User credentials (passwords, tokens, API keys)
   - PII (email addresses, names, phone numbers)
   - Session data
   - Internal system paths or configurations

3. For each finding:
   - Remove if not needed
   - Redact sensitive portions
   - Wrap in development-only check if needed for debugging

### Sensitive Data Patterns to Look For

| Pattern | Risk | Action |
|---------|------|--------|
| `password`, `token`, `secret` | High | Remove or redact |
| `email`, `user.email` | Medium | Redact in production |
| `session`, `cookie` | High | Remove |
| Stack traces with paths | Low | Acceptable in dev only |
| Error objects with user data | Medium | Sanitize |

### Implementation Pattern

For development-only logging:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', sanitizedData);
}
```

For redaction:
```typescript
const redactEmail = (email: string) => {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
};
```

### Verification Steps

1. **Search for remaining issues:**
   ```bash
   grep -rn "console\." --include="*.ts" --include="*.tsx" | \
     grep -E "(password|token|secret|email|session)"
   ```
   Should return no results (or documented exceptions).

2. **Build Test:**
   ```bash
   npm run build
   ```
   Ensure no console statements in production build contain sensitive data.

## Files to Audit

All `.ts` and `.tsx` files in:
- `app/`
- `components/`
- `lib/`
- `hooks/`
- `middleware.ts`

## Acceptance Criteria

- [ ] All logging statements reviewed
- [ ] No credentials or tokens in logs
- [ ] PII redacted or removed from logs
- [ ] Development-only logs properly guarded
- [ ] Findings documented in this task file

## Branch Information

**Branch From:** `sprint/071-security-fixes` (after TASK-1902 merged)
**Branch Into:** `sprint/071-security-fixes`
**Branch Name:** `fix/TASK-1903-logging-audit`

## Implementation Summary

*(To be filled by Engineer after implementation)*

| Field | Value |
|-------|-------|
| **Agent ID** | |
| **Actual Tokens** | |
| **Duration** | |
| **Files Changed** | |
| **Issues/Blockers** | |

### Audit Findings

*(Document all logging statements reviewed and actions taken)*

| File | Line | Original | Action | Reason |
|------|------|----------|--------|--------|
| | | | | |
