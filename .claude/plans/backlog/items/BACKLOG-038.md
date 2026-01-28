# BACKLOG-038: Schema Mismatch contacts.name

**Priority:** Critical
**Type:** Technical Debt / Data Integrity
**Created:** 2025-12-16
**Sprint:** SPRINT-003 (Phase 2)

---

## Problem Statement

The `contacts` table schema has both `name` (deprecated) and `display_name` (canonical) columns. Code inconsistently uses both, causing:
1. Data written to wrong column
2. Queries returning null when data exists in other column
3. UI showing empty names for valid contacts
4. Backwards compatibility workarounds scattered throughout codebase

---

## Technical Analysis

### Current State

**Database Schema:**
- `contacts.display_name` - Canonical column (should be primary)
- `contacts.name` - Deprecated column (exists for backwards compatibility)

**Type Definition** (`electron/types/models.ts`):
```typescript
export interface Contact {
  display_name?: string; // Optional for backwards compat - use name as fallback
  /** @deprecated Use display_name instead */
  name?: string;
}
```

**Workaround Code** (`contactDbService.ts`):
```typescript
// Line 41: Fallback in createContact
display_name: contactData.display_name || contactData.name || "Unknown",

// Line 109, 135, 170: Aliasing in queries
c.display_name as name,
```

### Problem Scope

Files with `contacts.name` references:
- `electron/services/db/contactDbService.ts` - Multiple workarounds
- `electron/services/contactsService.ts` - May have direct references
- `src/appCore/state/*.ts` - UI state may expect `name`
- Various React components - May render `contact.name`

---

## Acceptance Criteria

- [ ] All database queries use `display_name` as the source of truth
- [ ] `NewContact` type requires `display_name`, deprecates `name`
- [ ] All write operations populate `display_name` only
- [ ] All read operations return `display_name` (no aliasing needed)
- [ ] Backwards compatibility layer clearly documented and isolated
- [ ] Migration script copies any orphaned `name` values to `display_name`
- [ ] UI components updated to use `display_name`
- [ ] All existing tests pass
- [ ] New tests verify correct column usage

---

## Implementation Approach

### Phase 1: Data Migration
1. Create migration that copies `name` -> `display_name` where `display_name` is null
2. Verify no data loss

### Phase 2: Service Layer Update
1. Update `createContact` to only write `display_name`
2. Remove aliasing workarounds from queries
3. Update `NewContact` type to make `display_name` required

### Phase 3: UI Update
1. Search for `contact.name` usage in React components
2. Update to `contact.display_name`
3. Update any type assertions

### Phase 4: Cleanup
1. Remove deprecated `name` field handling
2. Document migration path for external consumers

---

## Estimated Effort

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Data Migration | 3-5 | ~15K | 20m |
| Service Layer | 4-6 | ~20K | 30m |
| UI Update | 2-3 | ~10K | 15m |
| Testing | 2-3 | ~10K | 15m |
| **Total** | **10-15** | **~55K** | **~1.5h** |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Backup before, copy don't delete |
| Breaking external imports | Medium | Keep `name` field readable temporarily |
| UI regressions | Medium | Manual UI testing after changes |

---

## Dependencies

- None (can be done in parallel with BACKLOG-039)

---

## Testing Requirements

### Unit Tests
- `createContact` writes to `display_name`
- `getContacts` returns `display_name` populated
- Legacy `name` fallback works for old data

### Integration Tests
- End-to-end contact creation shows correct name in UI
- Imported contacts display properly

---

## References

- Type definition: `electron/types/models.ts` (Contact interface)
- Service implementation: `electron/services/db/contactDbService.ts`
- Related backlog: BACKLOG-016 (Refactor Contact Import)
