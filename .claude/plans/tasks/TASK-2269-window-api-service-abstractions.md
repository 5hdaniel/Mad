# TASK-2269: Extract window.api Service Abstractions for Remaining Handlers

**Backlog ID:** BACKLOG-1267
**Sprint:** SecReview H: Deferred Improvements
**Branch:** `fix/task-2269-window-api-abstractions`
**Estimated Tokens:** 25K-40K
**Lane:** Parallel (independent -- renderer-side only)
**Integration Branch:** `int/secreview-h`

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. Follow the 15-step agent-handoff workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Extract remaining direct `window.api.*` and `window.electron.*` calls from React components into dedicated service abstractions in `src/services/`. Several service files already exist (e.g., `authService.ts`, `syncService.ts`); this task creates service abstractions for the remaining domains where components still call `window.api` directly.

## Non-Goals

- Do NOT change Electron IPC handlers or the preload bridge
- Do NOT modify `electron/preload.ts`
- Do NOT change `src/window.d.ts` type definitions
- Do NOT refactor business logic in components
- Do NOT change admin-portal or broker-portal code
- Do NOT modify any handler files in `electron/handlers/`

## Deliverables

1. **Audit remaining `window.api.*` calls** in `src/` components:
   - Identify all components calling `window.api.*` directly
   - Group by domain (contacts, transactions, settings, etc.)
   - Check which domains already have service abstractions

2. **Create service abstractions** for remaining domains (estimated 3-5 new services):
   - `src/services/contactService.ts` (if not exists)
   - `src/services/transactionService.ts` (if not exists)
   - `src/services/settingsService.ts` (if not exists)
   - `src/services/deviceService.ts` (if not exists)
   - Others as discovered during audit

3. **Refactor components** to use service abstractions instead of direct `window.api` calls:
   - Replace `window.api.someMethod()` with `someService.someMethod()`
   - Preserve all error handling and loading states
   - Keep the same return types

4. **Update barrel exports** in `src/services/index.ts` (if exists)

## File Boundaries

### Files to modify (owned by this task):
- New: `src/services/*Service.ts` (new service files)
- Components in `src/` that directly call `window.api.*`
- `src/services/index.ts` -- update exports

### Files this task must NOT modify:
- `electron/preload.ts` -- preload bridge
- `src/window.d.ts` -- type declarations
- `electron/handlers/*.ts` -- handler implementations
- `electron/services/databaseService.ts`
- admin-portal or broker-portal files

### If you need to modify a restricted file:
**STOP** and notify PM.

## Acceptance Criteria

- [ ] Audit identifies all remaining direct `window.api.*` calls in components
- [ ] Service abstractions created for all remaining domains
- [ ] At least 80% of direct `window.api.*` calls replaced with service calls
- [ ] No functional regressions -- same behavior, different call path
- [ ] Services handle errors consistently (try/catch with logging)
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// src/services/contactService.ts
import log from 'electron-log/renderer';

export const contactService = {
  async getContacts(filters?: ContactFilters): Promise<Contact[]> {
    try {
      return await window.api.getContacts(filters);
    } catch (error) {
      log.error('[ContactService] getContacts failed:', error);
      throw error;
    }
  },

  async createContact(data: NewContact): Promise<Contact> {
    try {
      return await window.api.createContact(data);
    } catch (error) {
      log.error('[ContactService] createContact failed:', error);
      throw error;
    }
  },
};
```

```typescript
// Component refactor:
// Before:
const contacts = await window.api.getContacts(filters);

// After:
import { contactService } from '../services/contactService';
const contacts = await contactService.getContacts(filters);
```

### Important Details

- **Audit first**: Run `grep -r "window\.api\." src/ --include="*.tsx" --include="*.ts" | grep -v "\.d\.ts" | grep -v "services/"` to find all direct calls.
- **Existing services**: Check `src/services/` for services that already exist. Don't duplicate.
- **Error handling**: Services should add consistent error logging. Don't swallow errors -- re-throw after logging.
- **Type preservation**: Service methods should have the same return types as the underlying `window.api` calls.
- **Lazy pattern**: For large services, consider splitting by sub-domain (e.g., `contactService.ts` vs `contactSearchService.ts`).

## Integration Notes

- Independent of all other Sprint H tasks
- Renderer-side only; no electron main process changes
- Future tasks can leverage these services for testing (mockable boundary)

## Do / Don't

### Do:
- Wrap every `window.api` call in try/catch with logging
- Match existing service patterns (check `authService.ts` for reference)
- Keep service methods thin (just wrap + log, no business logic)
- Group related methods into the same service file

### Don't:
- Don't add business logic to services (just API wrapping)
- Don't change component behavior during refactoring
- Don't create one service per window.api method (group by domain)
- Don't refactor hooks or state management while extracting services

## When to Stop and Ask

- If there are more than 100 direct `window.api` calls (scope too large)
- If some calls are deeply integrated with component state in a way that resists extraction
- If existing service files already cover most domains
- If you discover `window.api` calls that don't have TypeScript types

## Testing Expectations

### Unit Tests
- Required: No (pure refactor, no logic changes)
- Existing tests must continue to pass

### CI Requirements
- [ ] Type checking passes
- [ ] Existing tests pass
- [ ] Build succeeds

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~25K-40K (apply 0.5x refactor multiplier = ~13K-20K expected actual)

**Token Cap:** 160K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | ~3-5 service files | +8K |
| Files to modify | ~10-20 component files | +15K |
| Audit | Identifying all direct calls | +5K |
| Verification | Type-check + test runs | +7K |

**Confidence:** Medium (scope depends on audit results -- number of direct calls)

**Risk factors:**
- Number of direct `window.api` calls may be larger than expected
- Some calls may be in complex component patterns

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~17K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:** <Key decisions>
**Deviations from plan:** <If any>
**Issues encountered:** <If any>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID
```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Merge Information

**PR Number:** #XXX
**Merged To:** int/secreview-h
