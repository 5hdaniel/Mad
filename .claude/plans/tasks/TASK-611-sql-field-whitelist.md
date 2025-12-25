# TASK-611: SQL Field Whitelist

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 6 - Type Safety
**Priority:** MEDIUM
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

Add explicit field whitelist validation for dynamic SQL construction to prevent potential SQL injection if untrusted field names were ever introduced.

---

## Current State

Pattern found in multiple locations:
```typescript
const sql = `UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`;
```

While values are parameterized (safe), field names are constructed dynamically. Currently safe because fields come from internal code, but fragile if modified.

---

## Requirements

### Must Do
1. Create field whitelist per table
2. Validate field names before SQL construction
3. Throw error if invalid field detected
4. Add tests for validation

### Must NOT Do
- Change existing SQL functionality
- Add unnecessary overhead
- Break working queries

---

## Implementation

### Field Whitelist
```typescript
// electron/utils/sqlFieldWhitelist.ts

export const TABLE_FIELDS = {
  contacts: new Set([
    "id", "user_id", "name", "display_name", "email", "phone",
    "company", "role", "notes", "created_at", "updated_at"
  ]),
  transactions: new Set([
    "id", "user_id", "property_address", "status", "detection_status",
    "created_at", "updated_at", "reviewed_at", "rejection_reason"
  ]),
  // ... other tables
} as const;

export function validateFields(table: keyof typeof TABLE_FIELDS, fields: string[]): void {
  const validFields = TABLE_FIELDS[table];
  for (const field of fields) {
    // Extract field name (handle "field = ?" pattern)
    const fieldName = field.split(/\s*=/)[0].trim();
    if (!validFields.has(fieldName)) {
      throw new Error(`Invalid field "${fieldName}" for table "${table}"`);
    }
  }
}
```

### Usage
```typescript
// Before SQL construction
validateFields("contacts", fields);
const sql = `UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`;
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/utils/sqlFieldWhitelist.ts` | Field validation |
| `electron/utils/__tests__/sqlFieldWhitelist.test.ts` | Tests |

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/databaseService.ts` | Add field validation |
| `electron/services/db/*.ts` | Add field validation where needed |

---

## Testing Requirements

1. **Unit Tests**
   - Valid fields pass
   - Invalid fields throw
   - All tables covered

2. **Integration**
   - Existing operations work
   - No regressions

---

## Acceptance Criteria

- [ ] Field whitelist defined for all tables
- [ ] Validation added to dynamic SQL
- [ ] Tests cover validation logic
- [ ] All existing tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Branch

```
feature/TASK-611-sql-whitelist
```
