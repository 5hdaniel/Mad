# Task TASK-1801: Internal Error Monitoring Dashboard

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See TASK-1800 for full workflow description.

---

## Goal

Create a simple internal dashboard page in the broker-portal to view and monitor production error logs submitted by users, enabling the team to identify and respond to issues.

## Non-Goals

- Do NOT implement error resolution/tracking workflow
- Do NOT add automated alerting or notifications
- Do NOT implement error aggregation or grouping
- Do NOT build complex filtering/search (basic filters only)
- Do NOT create user-facing support ticket system

## Deliverables

1. New file: `broker-portal/src/app/admin/errors/page.tsx` - Error logs dashboard page
2. New file: `broker-portal/src/app/admin/errors/ErrorLogTable.tsx` - Table component
3. Update: `broker-portal/src/app/admin/layout.tsx` - Add errors link to nav (if exists)

## Acceptance Criteria

- [ ] Dashboard page accessible at `/admin/errors`
- [ ] Lists error logs from Supabase in reverse chronological order
- [ ] Shows: timestamp, user email (if available), error type, error message, app version
- [ ] Expandable row to show full details (stack trace, breadcrumbs, user feedback)
- [ ] Basic filter by error type
- [ ] Pagination (20 items per page)
- [ ] Only accessible to admin users (broker/admin role)
- [ ] All CI checks pass

## Implementation Notes

### Query Pattern

```typescript
// Fetch error logs with user info
const { data, error } = await supabase
  .from('error_logs')
  .select(`
    id,
    error_type,
    error_code,
    error_message,
    stack_trace,
    user_feedback,
    breadcrumbs,
    app_state,
    app_version,
    os_name,
    platform,
    error_timestamp,
    created_at,
    users!error_logs_user_id_fkey (
      email,
      display_name
    )
  `)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

### Table Component Structure

```tsx
// broker-portal/src/app/admin/errors/ErrorLogTable.tsx
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface ErrorLog {
  id: string;
  error_type: string;
  error_code: string | null;
  error_message: string;
  stack_trace: string | null;
  user_feedback: string | null;
  breadcrumbs: Record<string, unknown>[] | null;
  app_version: string;
  os_name: string | null;
  platform: string | null;
  error_timestamp: string;
  users: { email: string; display_name: string | null } | null;
}

interface Props {
  logs: ErrorLog[];
}

export function ErrorLogTable({ logs }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {logs.map((log) => (
            <>
              <tr
                key={log.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDistanceToNow(new Date(log.error_timestamp), { addSuffix: true })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.users?.email ?? 'Anonymous'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                    {log.error_type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                  {log.error_message}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.app_version}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.platform ?? '-'}
                </td>
              </tr>
              {expandedId === log.id && (
                <tr key={`${log.id}-expanded`}>
                  <td colSpan={6} className="px-6 py-4 bg-gray-50">
                    <ExpandedErrorDetails log={log} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpandedErrorDetails({ log }: { log: ErrorLog }) {
  return (
    <div className="space-y-4">
      {log.user_feedback && (
        <div>
          <h4 className="font-medium text-gray-900">User Feedback</h4>
          <p className="mt-1 text-sm text-gray-600 bg-white p-3 rounded border">
            {log.user_feedback}
          </p>
        </div>
      )}
      {log.stack_trace && (
        <div>
          <h4 className="font-medium text-gray-900">Stack Trace</h4>
          <pre className="mt-1 text-xs text-gray-600 bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
            {log.stack_trace}
          </pre>
        </div>
      )}
      {log.breadcrumbs && log.breadcrumbs.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900">Breadcrumbs</h4>
          <pre className="mt-1 text-xs text-gray-600 bg-white p-3 rounded border overflow-x-auto">
            {JSON.stringify(log.breadcrumbs, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

### Page Component

```tsx
// broker-portal/src/app/admin/errors/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ErrorLogTable } from './ErrorLogTable';

export default async function ErrorLogsPage({
  searchParams,
}: {
  searchParams: { page?: string; type?: string };
}) {
  const supabase = createServerComponentClient({ cookies });
  const page = parseInt(searchParams.page ?? '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('error_logs')
    .select(`
      id, error_type, error_code, error_message, stack_trace,
      user_feedback, breadcrumbs, app_version, os_name, platform,
      error_timestamp, created_at,
      users!error_logs_user_id_fkey (email, display_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (searchParams.type) {
    query = query.eq('error_type', searchParams.type);
  }

  const { data: logs, count, error } = await query;

  if (error) {
    return <div>Error loading logs: {error.message}</div>;
  }

  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Error Logs</h1>

      {/* Filter */}
      <div className="mb-4">
        <select
          className="border rounded px-3 py-2"
          defaultValue={searchParams.type ?? ''}
        >
          <option value="">All Types</option>
          <option value="app_error">App Error</option>
          <option value="init_error">Init Error</option>
          <option value="sync_error">Sync Error</option>
        </select>
      </div>

      <ErrorLogTable logs={logs ?? []} />

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center">
        <span className="text-sm text-gray-500">
          Showing {offset + 1} - {Math.min(offset + limit, count ?? 0)} of {count ?? 0}
        </span>
        <div className="space-x-2">
          {page > 1 && (
            <a href={`?page=${page - 1}`} className="px-3 py-1 border rounded">
              Previous
            </a>
          )}
          {page < totalPages && (
            <a href={`?page=${page + 1}`} className="px-3 py-1 border rounded">
              Next
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
```

## Integration Notes

- Imports from: Supabase client from broker-portal
- Exports to: Admin navigation
- Used by: Internal team only
- Depends on: TASK-1800 (error_logs table must have data)

## Do / Don't

### Do:
- Use server components for initial data fetch
- Make rows expandable for detailed view
- Show user feedback prominently when available
- Format timestamps as relative time
- Paginate results (don't load all at once)

### Don't:
- Expose this to non-admin users
- Implement complex search/filtering (keep simple)
- Add edit/delete capabilities
- Show raw SQL or implementation details
- Over-engineer - this is MVP internal tooling

## When to Stop and Ask

- If broker-portal admin routes don't exist
- If RLS policies block admin access to error_logs
- If Supabase join syntax differs from expected
- If Next.js 13+ patterns differ from documented

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (minimal)
- New tests to write:
  - Test ErrorLogTable renders without data
  - Test ErrorLogTable with mock data
  - Test row expansion toggle

### Coverage

- Coverage impact: Must not decrease portal coverage

### Integration / Feature Tests

- Required scenarios:
  - Page loads with data
  - Pagination works
  - Filter by type works

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks
- [x] Build step

## PR Preparation

- **Title**: `feat(portal): add error monitoring dashboard (BACKLOG-613)`
- **Labels**: `feature`, `broker-portal`
- **Base Branch**: `main`
- **Depends on**: TASK-1800

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~12K-15K

**Token Cap:** 60K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files | +8K |
| Files to modify | 1 file (nav) | +2K |
| Code volume | ~200 lines | +3K |
| Test complexity | Low | +2K |

**Confidence:** High

**Risk factors:**
- Broker-portal patterns may differ
- RLS policy for admin access

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] broker-portal/src/app/admin/errors/page.tsx
- [ ] broker-portal/src/app/admin/errors/ErrorLogTable.tsx

Features implemented:
- [ ] Error logs table view
- [ ] Expandable row details
- [ ] Pagination
- [ ] Type filter

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] Portal builds successfully
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** main
