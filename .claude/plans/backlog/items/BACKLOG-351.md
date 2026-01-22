# BACKLOG-351: Add Logging to Empty Catch Blocks in Export Services

**Created**: 2026-01-21
**Priority**: Low
**Category**: Observability
**Status**: Pending

---

## Description

Multiple catch blocks in `folderExportService.ts` silently swallow errors, making debugging difficult.

## Source

SR Engineer review (2026-01-21): "Multiple catch blocks that silently continue... Errors are silently swallowed, making debugging difficult."

## Locations

- `folderExportService.ts` lines: 148, 795, 836, 908, 940, 1015
- Pattern: `} catch { // Continue }`

## Expected

Replace silent catches with at least debug-level logging:

```typescript
// Before
} catch {
  // Continue
}

// After
} catch (error) {
  logService.debug('Parse error in thread extraction', { error, context: '...' });
}
```

## Acceptance Criteria

- [ ] Audit all catch blocks in export services
- [ ] Add debug-level logging with context
- [ ] Errors are traceable in logs
- [ ] No silent failures

## Priority

Low - Improves debuggability when issues occur
