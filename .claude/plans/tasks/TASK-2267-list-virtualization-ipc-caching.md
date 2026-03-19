# TASK-2267: Add List Virtualization + IPC-Level Caching for Large Datasets

**Backlog ID:** BACKLOG-1265
**Sprint:** SecReview H: Deferred Improvements
**Branch:** `fix/task-2267-list-virtualization`
**Estimated Tokens:** 30K-50K
**Lane:** Parallel (independent -- no dependencies in Sprint H)
**Integration Branch:** `int/secreview-h`

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. Follow the 15-step agent-handoff workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Add list virtualization to the desktop app's largest list views (contacts list, transactions list, messages list) using `react-window` or `react-virtualized`, and add IPC-level caching/deduplication to prevent redundant main-process queries when the renderer re-requests the same data within a short window.

## Non-Goals

- Do NOT add virtualization to admin-portal or broker-portal (electron app only)
- Do NOT change database queries or Supabase interactions
- Do NOT modify IPC channel definitions or handler signatures
- Do NOT refactor list component architecture beyond adding virtualization
- Do NOT add server-side pagination (separate concern)

## Deliverables

1. **Install virtualization library**:
   ```bash
   npm install react-window react-window-infinite-loader
   npm install -D @types/react-window
   ```

2. **Add virtualization to contact list** (`src/components/contacts/ContactList.tsx` or equivalent):
   - Wrap existing list with `FixedSizeList` or `VariableSizeList`
   - Preserve existing row rendering, selection, and keyboard nav
   - Handle dynamic row heights if needed

3. **Add virtualization to transaction list** (equivalent transaction list component):
   - Same pattern as contacts

4. **Add IPC request caching layer** (`electron/services/ipcCache.ts`):
   - Simple TTL-based cache for IPC responses
   - Cache key = channel name + serialized args
   - Configurable TTL per channel (default: 5 seconds)
   - Deduplication: if identical request is in-flight, return same promise
   - Cache invalidation on write operations (create/update/delete)

5. **Integrate IPC cache** into 2-3 high-frequency read handlers:
   - `contacts:list` or equivalent
   - `transactions:list` or equivalent
   - Show measurable improvement pattern

## File Boundaries

### Files to modify (owned by this task):
- `package.json` -- add react-window dependency
- Contact list component(s) -- add virtualization
- Transaction list component(s) -- add virtualization
- New: `electron/services/ipcCache.ts`
- 2-3 handler files -- integrate cache

### Files this task must NOT modify:
- `electron/services/databaseService.ts` -- owned by TASK-2260
- `electron/types/ipc.ts` -- type definitions
- `src/window.d.ts` -- type declarations
- admin-portal or broker-portal files

### If you need to modify a restricted file:
**STOP** and notify PM.

## Acceptance Criteria

- [ ] `react-window` installed and in package.json
- [ ] Contact list renders with virtualization (only visible rows in DOM)
- [ ] Transaction list renders with virtualization
- [ ] IPC cache layer created with TTL and dedup support
- [ ] At least 2 read handlers use the IPC cache
- [ ] Cache invalidates correctly on write operations
- [ ] No visual regressions in list rendering
- [ ] Scroll performance improved (fewer DOM nodes)
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// IPC Cache layer
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class IpcCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  async get<T>(key: string, fetcher: () => Promise<T>, ttl = 5000): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    // Dedup in-flight requests
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fetcher().then(data => {
      this.cache.set(key, { data, timestamp: Date.now(), ttl });
      this.inflight.delete(key);
      return data;
    });
    this.inflight.set(key, promise);
    return promise;
  }

  invalidate(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(pattern)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }
}
```

```tsx
// Virtualized list pattern
import { FixedSizeList } from 'react-window';

function VirtualContactList({ contacts }: { contacts: Contact[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ContactRow contact={contacts[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={contacts.length}
      itemSize={72}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

### Important Details

- **Measure first**: Check if lists already use any virtualization. Some components may use `overflow: auto` with full DOM rendering.
- **Keyboard navigation**: Ensure virtualized lists still support arrow key navigation and selection.
- **Search/filter**: Virtualized lists need to handle filtered data correctly (itemCount changes).
- **IPC cache TTL**: Keep it short (5s default) to avoid stale data. Write ops must invalidate.

## Integration Notes

- Independent of all other Sprint H tasks
- No shared files with other tasks
- IPC cache is a new module; no conflicts expected

## Do / Don't

### Do:
- Preserve all existing list functionality (selection, context menus, keyboard nav)
- Use `react-window` (lighter than `react-virtualized`)
- Make IPC cache opt-in per handler (not global middleware)
- Add cache hit/miss logging for debugging

### Don't:
- Don't change list item appearance or behavior
- Don't add infinite scroll (separate feature)
- Don't cache write operations
- Don't make cache mandatory for all handlers

## When to Stop and Ask

- If list components are too tightly coupled with non-virtualized rendering
- If virtualization breaks drag-and-drop or selection patterns
- If IPC cache causes stale data issues in testing
- If more than 8 component files need modification

## Testing Expectations

### Unit Tests
- Required: Yes for IPC cache module
- Test cache TTL expiration
- Test in-flight dedup
- Test cache invalidation on write ops

### CI Requirements
- [ ] Type checking passes
- [ ] New cache tests pass
- [ ] Existing tests pass
- [ ] Build succeeds

---

## PM Estimate (PM-Owned)

**Category:** `feature`

**Estimated Tokens:** ~30K-50K (apply 1.0x feature multiplier = ~30K-50K expected actual)

**Token Cap:** 200K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | ~2-3 new files (cache module + tests) | +10K |
| Files to modify | ~4-6 components + 2-3 handlers | +20K |
| Library integration | react-window is straightforward | +5K |
| Testing | Cache unit tests | +10K |

**Confidence:** Medium (virtualization integration depends on existing component structure)

**Risk factors:**
- List components may have complex rendering that resists virtualization
- Keyboard navigation with virtualization can be tricky

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

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

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
