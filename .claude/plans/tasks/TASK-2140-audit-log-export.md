# Task TASK-2140: Add Audit Log CSV/JSON Export for Auditors

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Sprint

**SPRINT-117** - SOC 2 Audit Compliance
**Phase:** 1 (Critical)
**Backlog:** BACKLOG-858
**SOC 2 Control:** CC7.3 - Log retention and availability

## Goal

Add CSV and JSON export capabilities for audit logs, allowing SOC 2 auditors to independently extract and review logs for a specified date range. Currently, the only way to view audit logs is through the paginated UI.

## Non-Goals

- Do NOT implement scheduled/automated exports (manual only)
- Do NOT add email delivery of exported logs
- Do NOT implement audit log filtering beyond date range for exports (the export includes all actions in the range)
- Do NOT modify the existing audit log viewer pagination or filtering
- Do NOT implement a separate auditor role (existing `audit.view` permission gates access)

## Deliverables

1. New file: `admin-portal/app/api/audit-log/export/route.ts` - Server-side download route
2. Update: `admin-portal/app/dashboard/audit-log/AuditLogContent.tsx` - Add export buttons (CSV + JSON) to the UI
3. New file: `admin-portal/lib/audit-export.ts` - Export formatting utilities (CSV serialization, etc.)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/api/audit-log/export/route.ts` (NEW)
- `admin-portal/app/dashboard/audit-log/AuditLogContent.tsx` (UPDATE - add export buttons)
- `admin-portal/lib/audit-export.ts` (NEW)

### Files this task must NOT modify:

- `admin-portal/middleware.ts` -- Shared middleware
- `admin-portal/app/dashboard/audit-log/page.tsx` -- Server component, no changes needed
- `supabase/migrations/` -- No schema changes needed

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] An "Export CSV" button appears in the audit log UI header area
- [ ] An "Export JSON" button appears in the audit log UI header area
- [ ] Export buttons are only visible to users with `audit.view` permission (already enforced by page access)
- [ ] Clicking "Export CSV" downloads a `.csv` file with all audit log entries matching the current date range filter
- [ ] Clicking "Export JSON" downloads a `.json` file with all audit log entries matching the current date range filter
- [ ] Exported files include ALL columns: id, action, target_type, target_id, actor_email, actor_name, ip_address, metadata (flattened for CSV), created_at
- [ ] The export API route enforces authentication and `audit.view` permission
- [ ] Large exports (10K+ rows) do not time out (use streaming or pagination in the API)
- [ ] Exported filenames include the date range: `audit-log-YYYY-MM-DD-to-YYYY-MM-DD.csv`
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass

## Implementation Notes

### API Route Pattern

Follow the existing API route pattern from `admin-portal/app/api/internal-users/invite/route.ts`.

```typescript
// admin-portal/app/api/audit-log/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permission check
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    check_user_id: user.id,
    required_permission: 'audit.view',
  });
  if (!hasPerm) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv'; // 'csv' or 'json'
  const dateFrom = searchParams.get('from');
  const dateTo = searchParams.get('to');

  // Fetch ALL audit logs for the date range (no pagination)
  const params: Record<string, unknown> = {
    p_limit: 100000, // Large limit for export
    p_offset: 0,
  };
  if (dateFrom) params.p_date_from = new Date(dateFrom).toISOString();
  if (dateTo) params.p_date_to = new Date(dateTo + 'T23:59:59').toISOString();

  const { data, error } = await supabase.rpc('admin_get_audit_logs', params);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { logs: Array<Record<string, unknown>>; total: number };
  const logs = result.logs || [];

  // Format filename
  const fromStr = dateFrom || 'all';
  const toStr = dateTo || 'now';
  const filename = `audit-log-${fromStr}-to-${toStr}`;

  if (format === 'json') {
    return new NextResponse(JSON.stringify(logs, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      },
    });
  }

  // CSV format
  const csv = convertToCSV(logs);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  });
}
```

### CSV Conversion Utility

```typescript
// admin-portal/lib/audit-export.ts
export function convertToCSV(logs: Array<Record<string, unknown>>): string {
  if (logs.length === 0) return '';

  const headers = [
    'id', 'created_at', 'action', 'target_type', 'target_id',
    'actor_id', 'actor_email', 'actor_name', 'ip_address', 'metadata'
  ];

  const rows = logs.map(log =>
    headers.map(h => {
      const val = log[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      const str = String(val);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
```

### UI Export Buttons

Add to the header area of `AuditLogContent.tsx`, near the page size selector:

```tsx
import { Download } from 'lucide-react';

// Inside the component, near the pagination controls:
<div className="flex items-center gap-2">
  <button
    onClick={() => handleExport('csv')}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
  >
    <Download className="h-3.5 w-3.5" />
    Export CSV
  </button>
  <button
    onClick={() => handleExport('json')}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
  >
    <Download className="h-3.5 w-3.5" />
    Export JSON
  </button>
</div>
```

```typescript
function handleExport(format: 'csv' | 'json') {
  const params = new URLSearchParams();
  params.set('format', format);
  if (dateFrom) params.set('from', dateFrom);
  if (dateTo) params.set('to', dateTo);

  // Trigger download via browser navigation
  window.open(`/api/audit-log/export?${params.toString()}`, '_blank');
}
```

### Important Details

- The `admin_get_audit_logs` RPC already exists and handles pagination -- for exports, use a very large limit
- The Download icon from `lucide-react` is already available in the project
- The API route runs server-side on Vercel, so it has access to the Supabase server client with cookies
- For very large datasets, consider streaming but start with the simple approach (Vercel serverless has a 10-second timeout for hobby, 60 seconds for pro)
- CSV must properly escape fields containing commas, quotes, and newlines
- The `metadata` column is JSONB -- serialize it as a JSON string in CSV, keep as object in JSON export

## Integration Notes

- Imports from: `admin-portal/lib/supabase/server.ts` (createClient)
- Imports from: `admin_get_audit_logs` RPC (existing)
- Exports to: None (standalone export feature)
- Used by: SOC 2 auditors via the UI
- Depends on: None (Phase 1, no dependencies)

## Do / Don't

### Do:

- Follow the existing API route pattern from `/api/internal-users/invite/route.ts`
- Include proper Content-Disposition headers for file downloads
- Escape CSV fields properly (commas, quotes, newlines)
- Include both the export buttons and the API route (server-side download)
- Use `window.open()` for the download to avoid blocking the UI

### Don't:

- Do NOT generate the CSV client-side (security: use server-side with permission checks)
- Do NOT remove or modify existing filter controls in AuditLogContent
- Do NOT add new filter types (use the existing dateFrom/dateTo)
- Do NOT stream results unless the simple approach times out (premature optimization)

## When to Stop and Ask

- If the `admin_get_audit_logs` RPC does not support a large enough limit for exports
- If Vercel serverless timeout is too short for large exports
- If the AuditLogContent component structure makes it difficult to add buttons without major refactoring
- If the `has_permission` RPC does not exist or has a different signature

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (admin portal does not have unit test framework)
- The `convertToCSV` utility could have a unit test if a test framework is available

### Coverage

- Coverage impact: N/A

### Integration / Feature Tests

- Required scenarios:
  - Click "Export CSV" and verify a valid CSV file is downloaded
  - Click "Export JSON" and verify a valid JSON file is downloaded
  - Verify the exported file contains the expected columns
  - Verify CSV properly escapes metadata containing commas/quotes
  - Verify unauthenticated requests to `/api/audit-log/export` return 401
  - Verify users without `audit.view` permission get 403

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (`npm run type-check` in admin-portal)
- [ ] Lint / format checks
- [ ] Build succeeds

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(audit): add CSV/JSON export for audit logs`
- **Labels**: `soc2`, `audit`, `admin-portal`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files (API route, utility) | +10K |
| Files to modify | 1 existing file (AuditLogContent) | +10K |
| Code volume | ~200 lines | +5K |
| Test complexity | Low (manual verification) | +5K |

**Confidence:** High

**Risk factors:**
- Vercel serverless timeout for large exports
- CSV escaping edge cases

**Similar past tasks:** TASK-2114 (admin audit log schema, ~20K tokens)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] admin-portal/app/api/audit-log/export/route.ts
- [ ] admin-portal/lib/audit-export.ts

Files modified:
- [ ] admin-portal/app/dashboard/audit-log/AuditLogContent.tsx

Features implemented:
- [ ] Server-side export API route with auth + permission checks
- [ ] CSV export with proper escaping
- [ ] JSON export
- [ ] Export buttons in audit log UI
- [ ] Date range filtering in exports

Verification:
- [ ] npm run type-check passes (in admin-portal)
- [ ] npm run lint passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If deviations, explain. If none, write "None">

**Design decisions:**
<Document design decisions and reasoning>

**Issues encountered:**
<Document issues and resolutions>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop / int/sprint-117-soc2-compliance

### Merge Verification (MANDATORY)

```bash
gh pr view <PR-NUMBER> --json state --jq '.state'
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
