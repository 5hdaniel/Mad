# BACKLOG-508: Consolidate Shared Message/Contact Utilities

## Type
refactor

## Priority
low

## Status
backlog

## Description

There's significant code duplication between export services and UI fetching that could be consolidated into shared utilities.

### Duplicated Code Identified

| Utility | Implementations | Locations |
|---------|-----------------|-----------|
| Phone normalization | 2 | Export services, UI components |
| Contact name lookup | 2 | Export services, UI components |
| Thread grouping | 2 | Export services, UI components |
| Group chat detection | 2 | Export services, UI components |

### Proposed Solution

Create shared utility modules:
- `electron/utils/phoneUtils.ts` - Phone normalization
- `electron/utils/contactUtils.ts` - Contact name lookup
- `electron/utils/threadUtils.ts` - Thread grouping and group chat detection

### Benefits
- Single source of truth for each utility
- Easier maintenance
- Consistent behavior across export and UI
- Reduced code size

### Related
- BACKLOG-506 (Database Architecture Cleanup) - noted this opportunity but not blocking

## Acceptance Criteria
- [ ] All phone normalization uses single shared implementation
- [ ] All contact name lookup uses single shared implementation
- [ ] All thread grouping uses single shared implementation
- [ ] All group chat detection uses single shared implementation
- [ ] No behavioral changes (pure refactor)
- [ ] All tests pass
