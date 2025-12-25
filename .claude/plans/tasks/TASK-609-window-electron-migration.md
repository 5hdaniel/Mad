# TASK-609: window.electron Migration

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 5 - Electron Services & Migration
**Priority:** HIGH
**Status:** Pending
**Depends On:** TASK-608

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
- Est Turns: 5-6 → Actual: _ (variance: _%)
- Est Wall-Clock: 25-30 min → Actual: _ min (variance: _%)
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 16-20 | **5-6** | - |
| **Tokens** | ~80K | ~24K | - |
| **Time** | 2.5-3h | **25-30 min** | **25-30 min** |

**Category:** refactor
**Confidence:** High (based on TASK-602/603 actuals)

---

## Objective

Migrate all `window.electron.*` calls to `window.api.*` and remove the legacy `window.electron` namespace from preload.ts.

---

## Current State

13 files still use `window.electron.*`:
- `src/components/OutlookExport.tsx`
- `src/components/MicrosoftLogin.tsx`
- `src/components/ConversationList/index.tsx`
- And more...

The `window.electron` namespace in `preload.ts` (lines 1661-1902) duplicates `window.api` functionality.

---

## Requirements

### Must Do
1. Identify all `window.electron` usages
2. Replace with equivalent `window.api` calls
3. Use service layer where available
4. Remove `window.electron` from preload.ts
5. Update TypeScript types

### Must NOT Do
- Break existing functionality
- Add new features
- Change API semantics

---

## Files to Migrate

| File | window.electron Calls | Replacement |
|------|----------------------|-------------|
| `OutlookExport.tsx` | outlook methods | `window.api.outlook` or service |
| `MicrosoftLogin.tsx` | auth methods | `window.api.auth` or service |
| `ConversationList/index.tsx` | conversation methods | `window.api.conversations` or service |
| (audit for complete list) | | |

---

## Migration Pattern

### Before (window.electron)
```typescript
const result = await window.electron.outlook.getEmails(folderId);
```

### After (service layer - preferred)
```typescript
import { outlookService } from "@/services/outlookService";
const result = await outlookService.getEmails(folderId);
```

### After (window.api - fallback)
```typescript
const result = await window.api.outlook.getEmails(folderId);
```

---

## Implementation Steps

1. **Audit** - Find all window.electron usages:
   ```bash
   grep -r "window\.electron" src/
   ```

2. **Map equivalents** - Document window.api equivalent for each call

3. **Migrate incrementally** - One file at a time:
   - Replace calls
   - Test functionality
   - Commit

4. **Remove legacy namespace** - After all migrations:
   - Remove from preload.ts
   - Update types

5. **Final verification** - Ensure no references remain

---

## Files to Modify

| File | Change |
|------|--------|
| All 13 files with window.electron | Replace with window.api or service |
| `electron/preload.ts` | Remove window.electron namespace (~240 lines) |
| `src/types/electron.d.ts` | Remove window.electron types |

---

## Testing Requirements

1. **Per-File Testing**
   - Test each migrated component
   - Verify functionality unchanged

2. **Regression Testing**
   - All existing tests pass
   - Full app smoke test

3. **TypeScript**
   - No type errors
   - No missing methods

---

## Acceptance Criteria

- [ ] No `window.electron` calls in src/
- [ ] `window.electron` removed from preload.ts
- [ ] All functionality works via window.api or services
- [ ] All existing tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] SR Engineer architecture review passed

---

## Branch

```
feature/TASK-609-window-electron-migration
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
