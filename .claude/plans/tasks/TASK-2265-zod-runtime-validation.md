# TASK-2265: Adopt Zod for Runtime Schema Validation at Supabase + IPC Boundaries

**Backlog ID:** BACKLOG-1098
**Sprint:** SecReview H: Deferred Improvements
**Branch:** `fix/task-2265-zod-validation`
**Estimated Tokens:** 40K-60K
**Lane:** Parallel (independent -- no dependencies in Sprint H)
**Integration Branch:** `int/secreview-h`

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. Follow the 15-step agent-handoff workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Introduce Zod for runtime schema validation at the two key trust boundaries: (1) Supabase RPC/query responses and (2) Electron IPC messages between main and renderer processes. This task installs Zod, creates schemas for a representative subset of types, and integrates validation at boundary points. Full coverage of all types is out of scope.

## Non-Goals

- Do NOT create Zod schemas for ALL types (only representative subset at key boundaries)
- Do NOT change existing type definitions -- Zod schemas should mirror existing types
- Do NOT modify database queries or handler logic beyond adding validation
- Do NOT add Zod to admin-portal or broker-portal (electron app only for now)
- Do NOT replace TypeScript type assertions globally

## Deliverables

1. **Install Zod** in root package.json:
   ```bash
   npm install zod
   ```

2. **Create Zod schema directory**: `electron/schemas/`
   - `electron/schemas/index.ts` -- barrel export
   - `electron/schemas/user.ts` -- User schema
   - `electron/schemas/transaction.ts` -- Transaction schema
   - `electron/schemas/contact.ts` -- Contact schema
   - `electron/schemas/common.ts` -- shared schemas (pagination, error responses, etc.)

3. **Create validation utilities**: `electron/schemas/validate.ts`
   - `validateResponse<T>(schema, data)` -- validates and returns typed data
   - `safeValidate<T>(schema, data)` -- returns `{ success, data, error }` without throwing
   - Logging integration for validation failures

4. **Integrate at Supabase boundary** (2-3 representative query functions):
   - Pick 2-3 functions in `electron/services/db/` that fetch from Supabase
   - Add schema validation to their response handling
   - Log validation errors but don't break functionality (graceful degradation)

5. **Integrate at IPC boundary** (2-3 representative handlers):
   - Pick 2-3 IPC handlers that receive complex data from renderer
   - Add input validation with Zod
   - Return typed error responses for invalid input

## File Boundaries

### Files to modify (owned by this task):
- `package.json` -- add zod dependency
- New: `electron/schemas/*.ts` (schema files)
- 2-3 files in `electron/services/db/` -- add validation to representative functions
- 2-3 files in `electron/handlers/` -- add IPC input validation

### Files this task must NOT modify:
- `electron/types/ipc/` -- type definitions (owned by TASK-2264; read-only reference)
- `electron/services/databaseService.ts` -- owned by TASK-2260
- `src/window.d.ts` -- type declarations
- admin-portal or broker-portal files

### If you need to modify a restricted file:
**STOP** and notify PM.

## Acceptance Criteria

- [ ] Zod installed and in package.json dependencies
- [ ] `electron/schemas/` directory created with at least 4 schema files
- [ ] `validateResponse` and `safeValidate` utilities work correctly
- [ ] At least 2 Supabase response validations integrated (graceful degradation)
- [ ] At least 2 IPC input validations integrated (return error for invalid input)
- [ ] Zod schemas match existing TypeScript types (no type mismatches)
- [ ] Validation failures are logged (not silent)
- [ ] Application still works with invalid data (graceful degradation, not crashes)
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// electron/schemas/user.ts
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  organization_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  // ... match existing User type
});

export type ValidatedUser = z.infer<typeof UserSchema>;
```

```typescript
// electron/schemas/validate.ts
import { z } from 'zod';
import log from 'electron-log';

export function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    log.warn(`[Validation] ${context}: ${result.error.message}`);
    // Graceful degradation: return data as-is with type assertion
    return data as T;
  }
  return result.data;
}

export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  error?: z.ZodError;
} {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
```

```typescript
// IPC handler validation example:
import { z } from 'zod';

const CreateContactInput = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

ipcMain.handle('contacts:create', async (event, rawInput) => {
  const validation = CreateContactInput.safeParse(rawInput);
  if (!validation.success) {
    return { error: 'Invalid input', details: validation.error.flatten() };
  }
  const input = validation.data;
  // ... proceed with validated input
});
```

### Important Details

- **Graceful degradation is mandatory**: Zod validation should WARN on invalid data, not crash the app. The app has been running without validation -- sudden strict enforcement would break things.
- **Start small**: 4-6 schemas total for the representative subset. Document patterns for future expansion.
- **Infer types from schemas**: Where possible, use `z.infer<typeof Schema>` to keep schema and type in sync. But don't replace existing type exports yet (breaking change for consumers).
- **Schema should match reality, not ideals**: If the database returns `null` for a field, the schema should allow `null`. Don't enforce stricter constraints than what the data actually has.

## Integration Notes

- **Depends on:** TASK-2264 (ipc.ts split) -- split type files make it clearer which schemas to create per domain
- This task establishes patterns; future tasks can add more schemas
- The `electron/schemas/` directory becomes the canonical location for all Zod schemas

## Do / Don't

### Do:
- Make schemas match existing TypeScript types exactly
- Use graceful degradation (log + continue) for validation failures
- Document the validation pattern for future developers
- Test with real data from the running app to verify schemas are correct

### Don't:
- Don't create schemas for ALL types (scope creep)
- Don't make validation throw exceptions (breaks the app)
- Don't replace existing TypeScript types with Zod inferred types (yet)
- Don't add validation to admin-portal or broker-portal (electron only)

## When to Stop and Ask

- If Zod package causes build/bundling issues with Electron
- If existing TypeScript types have inconsistencies that make schema creation ambiguous
- If more than 5 handler files need modification for the representative subset
- If validation failures are too frequent (suggests types are wrong, not data)

## Testing Expectations

### Unit Tests
- Required: Yes
- Test `validateResponse` utility (valid data, invalid data, graceful degradation)
- Test `safeValidate` utility (success/failure paths)
- Test at least 1 schema against sample data

### Coverage
- New schema utilities should have > 80% coverage

### CI Requirements
- [ ] Type checking passes
- [ ] New tests pass
- [ ] Existing tests pass
- [ ] Build succeeds

---

## PM Estimate (PM-Owned)

**Category:** `types`

**Estimated Tokens:** ~40K-60K (apply 1.0x types multiplier = ~40K-60K expected actual)

**Token Cap:** 240K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | ~6-8 schema files + utilities | +15K |
| Files to modify | 4-6 existing files (handlers + db services) | +15K |
| Zod learning/patterns | First introduction of Zod | +10K |
| Test complexity | Utility tests + schema tests | +10K |
| Debugging | Schema/type alignment | +10K |

**Confidence:** Medium (first Zod introduction adds uncertainty)

**Risk factors:**
- Zod + Electron bundling compatibility
- Schema/type alignment with actual runtime data

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

**Variance:** PM Est ~50K vs Actual ~XK (X% over/under)

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
**Merged To:** develop
