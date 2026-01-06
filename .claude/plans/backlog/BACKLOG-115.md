# BACKLOG-115: Address Remaining `any` Types in Electron Handlers

## Priority: Medium

## Category: refactor

## Summary

Replace 60+ `any` types in electron handlers with proper TypeScript types. Currently generating 100+ ESLint warnings for `@typescript-eslint/no-explicit-any`.

## Problem

The electron handlers directory contains numerous explicit `any` types that:
- Weaken type safety
- Generate ESLint warnings
- Make refactoring riskier
- Reduce IDE support (autocomplete, error detection)

**Current State:**
- 60+ `any` types found
- 100+ ESLint warnings for `@typescript-eslint/no-explicit-any`
- Concentrated in IPC handler files

## Solution

Systematically replace `any` types with proper TypeScript types.

### Type Replacement Strategy

1. **IPC Request/Response Types**
```typescript
// Before
ipcMain.handle('get-user', async (event, userId: any) => {
  return await getUser(userId) as any;
});

// After
interface GetUserRequest {
  userId: string;
}

interface GetUserResponse {
  id: string;
  name: string;
  email: string;
}

ipcMain.handle('get-user', async (event, request: GetUserRequest): Promise<GetUserResponse> => {
  return await getUser(request.userId);
});
```

2. **Error Types**
```typescript
// Before
catch (error: any) {
  console.error(error.message);
}

// After
catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

3. **Dynamic Data**
```typescript
// Before
function processData(data: any): any {
  // ...
}

// After
interface ProcessedData {
  result: string;
  metadata: Record<string, unknown>;
}

function processData(data: Record<string, unknown>): ProcessedData {
  // ...
}
```

### Priority Order

1. **IPC handlers** - Most impactful for type safety
2. **Service method parameters** - API boundaries
3. **Error handling** - Use `unknown` instead of `any`
4. **Internal utilities** - Lower priority

## Implementation Steps

1. Run ESLint to get full list of `any` warnings
2. Group by handler file
3. Create shared type definitions where applicable
4. Replace `any` types file by file
5. Verify no regressions

## Acceptance Criteria

- [ ] `any` types in electron handlers reduced to <10
- [ ] ESLint warnings for `@typescript-eslint/no-explicit-any` reduced by 90%
- [ ] Shared type definitions created for common patterns
- [ ] No functionality changes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes (or warnings significantly reduced)
- [ ] `npm test` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 40-60 | Many files, but mechanical changes |
| Tokens | ~150K | |
| Time | 1-2 days | |

## Dependencies

- None, but consider doing after BACKLOG-111 (service abstractions migration) to avoid conflicts

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking type inference | Test thoroughly after each file |
| Over-strict types causing issues | Use `unknown` or generics where truly dynamic |
| Merge conflicts | Schedule as dedicated work |

## Notes

**This item is SR Engineer sourced from type safety audit.**

This is a code quality improvement that will:
- Catch bugs at compile time
- Improve IDE support
- Make refactoring safer
- Reduce ESLint noise

Consider creating a shared `electron/types/` directory for common IPC types.

**Files to modify:**
- `electron/handlers/*.ts`
- `electron/types/*.ts` (new or existing)
