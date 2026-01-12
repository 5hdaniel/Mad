# BACKLOG-199: TypeScript Global Window Type Updates Not Recognized

## Summary

When updating `window.d.ts` to add new parameters to existing methods in the global Window interface augmentation, TypeScript does not pick up the changes. This requires using type assertions as a workaround.

## Problem

Updated `importMacOSMessages` in `src/window.d.ts` from:
```typescript
importMacOSMessages: (userId: string) => Promise<MacOSImportResult>;
```

to:
```typescript
importMacOSMessages: (userId: string, forceReimport?: boolean) => Promise<MacOSImportResult>;
```

However, TypeScript still reports:
```
error TS2554: Expected 1 arguments, but got 2.
```

## Investigation Done

- Verified file content is correct (md5 hash, od -c check)
- Cleared all caches (node_modules/.cache, .tscache, tsbuildinfo)
- Ran `tsc --noEmit --incremental false`
- Tried triple-slash reference directive
- Verified window.d.ts is in tsconfig include pattern
- Checked for duplicate definitions - none found
- Other 2-arg functions in same file work fine (e.g., `healthCheck`)

## Current Workaround

Type assertion in consuming code:
```typescript
const importFn = window.api.messages.importMacOSMessages as (
  userId: string,
  forceReimport?: boolean
) => Promise<...>;
```

## Possible Causes

1. TypeScript global declaration merging issue
2. Declaration file module resolution order
3. Incremental compilation cache at OS/daemon level
4. Issue with how `declare global` interacts with lib DOM types

## Affected Files

- `src/components/settings/MacOSMessagesImportSettings.tsx` - has workaround

## Priority

Low - workaround exists and doesn't affect runtime

## Tags

typescript, types, window.d.ts, global-augmentation
