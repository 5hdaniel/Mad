# Task TASK-202: Fix contacts.name Schema Mismatch

## Goal

Normalize the contacts table to use `display_name` as the single source of truth for contact names, eliminating the dual-column ambiguity between `name` (deprecated) and `display_name` (canonical).

## Non-Goals

- Do NOT drop the `name` column yet (keep for read-only backwards compatibility)
- Do NOT change contact import from external sources (iPhone sync)
- Do NOT modify the ContactEmail/ContactPhone child tables
- Do NOT refactor the entire contact system

## Deliverables

1. New file: `electron/database/migrations/normalize_contacts_display_name.sql`
2. Update: `electron/services/db/contactDbService.ts`
3. Update: `electron/types/models.ts` (clarify deprecation)
4. Update: Any React components using `contact.name`

## Acceptance Criteria

- [ ] Migration copies `name` -> `display_name` where `display_name` is null
- [ ] `createContact` writes only to `display_name`
- [ ] All queries return `display_name` directly (no aliasing)
- [ ] `NewContact` type makes `display_name` the expected field
- [ ] UI components use `contact.display_name`
- [ ] Backwards compatibility: `contact.name` still readable
- [ ] All existing tests pass
- [ ] New test verifies display_name is primary

## Implementation Notes

### Migration Script

```sql
-- Migration: normalize_contacts_display_name.sql
-- Copy name to display_name where display_name is null/empty

UPDATE contacts
SET display_name = name
WHERE (display_name IS NULL OR display_name = '')
  AND name IS NOT NULL
  AND name != '';

-- Verify: SELECT COUNT(*) FROM contacts WHERE display_name IS NULL AND name IS NOT NULL;
-- Should return 0 after migration
```

### Service Layer Changes

**contactDbService.ts - createContact:**
```typescript
// Before (line ~41):
display_name: contactData.display_name || contactData.name || "Unknown",

// After:
display_name: contactData.display_name || "Unknown",
// Remove name fallback - callers should provide display_name
```

**contactDbService.ts - queries:**
Remove aliasing like `c.display_name as name` and return `display_name` directly.

**Type clarification (models.ts):**
```typescript
export interface Contact {
  display_name: string; // Primary field - REQUIRED
  /** @deprecated Read-only for backwards compatibility. Use display_name for writes. */
  name?: string;
}
```

### UI Component Search

Search for `contact.name` usage:
- `src/components/` - Contact display components
- `src/appCore/` - State management

Replace with `contact.display_name` or use fallback:
```typescript
const displayName = contact.display_name || contact.name || "Unknown";
```

## Integration Notes

- Imports from: `electron/types/models.ts`
- Exports to: UI components, contact handlers
- Used by: Contact list, transaction contacts, communication display
- Depends on: None
- Parallel with: TASK-203 (can run simultaneously)

## Do / Don't

### Do:
- Run migration on test database first
- Keep backwards compatibility for reads
- Update one service method at a time
- Test UI after each component update

### Don't:
- Drop the `name` column (future cleanup task)
- Change iPhone sync contact creation (separate backlog item)
- Modify contact search logic (display_name is already searched)
- Break existing API contracts

## When to Stop and Ask

- If migration finds contacts with both `name` and `display_name` with different values
- If UI component uses `contact.name` in a way that's not simple substitution
- If type changes cause cascading TypeScript errors > 10 files
- If tests fail in unexpected ways

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `createContact` stores value in `display_name` column
  - `getContacts` returns `display_name` populated
  - Legacy data with only `name` is readable via `display_name` after migration
- Existing tests to update:
  - Any test that explicitly checks `name` field

### Coverage

- Coverage impact: Should not decrease

### Integration Tests

- Required scenarios:
  - Create contact, verify display in UI
  - Edit contact name, verify persistence
  - Import contact, verify name display

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(schema): normalize contacts.name to display_name`
- **Labels**: `database`, `schema`, `tech-debt`
- **Depends on**: TASK-201 (workflow enforcement should be in place)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] Migration script

Files updated:
- [ ] contactDbService.ts
- [ ] models.ts (type clarification)
- [ ] UI components (list files)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Migration tested on dev database
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>
