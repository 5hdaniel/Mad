# Task TASK-1964: Broker Portal Submission List Pagination

---

## WORKFLOW REQUIREMENT
**This task MUST be implemented via the `engineer` agent.**

1. PM creates branch and updates backlog status
2. PM invokes `engineer` agent with this task file
3. Engineer implements the task
4. Engineer opens PR targeting `develop`
5. SR Engineer reviews and merges
6. PM records metrics and updates backlog

---

## Goal

Add server-side pagination to the broker portal submission list to handle 50+ submissions efficiently. Page size 25, URL-based state, Previous/Next navigation.

## Non-Goals

- Do NOT implement infinite scroll or virtual scrolling
- Do NOT add client-side caching of pages
- Do NOT modify the submission detail view
- Do NOT change the existing filter behavior (just reset to page 1 on filter change)

## Deliverables

1. Update: `broker-portal/app/dashboard/submissions/page.tsx` (lines 35-189) — add `page` search param, Supabase `.range(from, to)`, total count query
2. Update: `broker-portal/components/submission/SubmissionListClient.tsx` — accept pagination props, render pagination UI
3. Verify: `broker-portal/hooks/useRealtimeSubmissions.ts` — ensure realtime compatibility (should trigger `router.refresh()` which re-fetches current page)

## Acceptance Criteria

- [ ] Submissions paginated with 25 items per page
- [ ] URL state: `?status=submitted&page=2`
- [ ] Page resets to 1 when filter changes
- [ ] Pagination UI: Previous/Next buttons + page indicator (e.g., "Page 2 of 5")
- [ ] Realtime updates still work (new submissions appear on page refresh)
- [ ] Empty state handled when no submissions on current page
- [ ] All CI checks pass

## Implementation Notes

### Server Component (page.tsx)

```typescript
// Extract page from search params
const page = Number(searchParams?.page) || 1;
const pageSize = 25;
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;

// Data query with range
const { data: submissions } = await supabase
  .from('submissions')
  .select('*')
  .eq('organization_id', orgId)
  .order('created_at', { ascending: false })
  .range(from, to);

// Count query (separate for total)
const { count } = await supabase
  .from('submissions')
  .select('*', { count: 'exact', head: true })
  .eq('organization_id', orgId);

const totalPages = Math.ceil((count || 0) / pageSize);
```

### Client Component (SubmissionListClient.tsx)

Add pagination props:
```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string; // includes current filters
}
```

Pagination UI below the table:
```tsx
<div className="flex items-center justify-between px-4 py-3">
  <span className="text-sm text-muted-foreground">
    Page {currentPage} of {totalPages}
  </span>
  <div className="flex gap-2">
    <Button disabled={currentPage <= 1} asChild>
      <Link href={`${baseUrl}&page=${currentPage - 1}`}>Previous</Link>
    </Button>
    <Button disabled={currentPage >= totalPages} asChild>
      <Link href={`${baseUrl}&page=${currentPage + 1}`}>Next</Link>
    </Button>
  </div>
</div>
```

### Filter Reset

When status filter changes, ensure the `page` param is removed/reset:
```typescript
// In filter handler
const params = new URLSearchParams(searchParams);
params.set('status', newStatus);
params.delete('page'); // Reset to page 1
router.push(`?${params.toString()}`);
```

### Existing Indexes

These indexes already exist and support the pagination query:
- `idx_submissions_org_id`
- `idx_submissions_created_at`
- `idx_submissions_status`

### Realtime Compatibility

`useRealtimeSubmissions.ts` triggers `router.refresh()` on changes, which re-fetches the server component with current URL params (including page). This should work without modification — verify during testing.

## Integration Notes

- Standalone task — no dependencies on other 080B tasks
- Touches broker-portal/ only (no Electron code)
- Existing filter behavior (status filter) must be preserved

## Do / Don't

### Do:
- Use URL search params for pagination state (server-side rendering friendly)
- Include total count in the UI ("Page X of Y")
- Handle edge case: page > totalPages (redirect to last page)

### Don't:
- Do NOT use client-side state for pagination (URL is source of truth)
- Do NOT add sorting controls (out of scope)
- Do NOT cache pages client-side

## When to Stop and Ask

- If `SubmissionListClient.tsx` structure differs significantly from expected
- If the Supabase query pattern doesn't support `.range()` with the current setup
- If realtime hook requires significant refactoring for pagination compatibility

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (server component, manual testing)
- Verify via: Manual testing with broker portal dev server, 50+ submissions

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## PR Preparation

- **Title:** `feat(broker-portal): add server-side submission list pagination`
- **Labels:** `feature`, `broker-portal`
- **Depends on:** None

---

## PM Estimate (PM-Owned)

**Category:** `feature`
**Estimated Tokens:** ~60K
**Token Cap:** 240K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Files modified:
- [ ] broker-portal/app/dashboard/submissions/page.tsx
- [ ] broker-portal/components/submission/SubmissionListClient.tsx
- [ ] broker-portal/hooks/useRealtimeSubmissions.ts (if needed)

Features implemented:
- [ ] Server-side pagination (page size 25)
- [ ] URL-based page state
- [ ] Page reset on filter change
- [ ] Previous/Next pagination UI
- [ ] Total page count display

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test with 50+ submissions
```

### Notes
**Deviations from plan:** <explanation or "None">
**Issues encountered:** <document and resolution>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary
- Architecture compliance: <PASS/FAIL>
- Security review: <PASS/FAIL>
- Test coverage: <PASS/FAIL>

### Merge Information
**PR Number:** #
**Merge Commit:** <hash>
**Merged To:** develop
