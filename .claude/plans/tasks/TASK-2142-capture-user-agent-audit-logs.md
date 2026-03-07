# Task TASK-2142: Capture User Agent in Audit Logs

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Sprint

**SPRINT-117** - SOC 2 Audit Compliance
**Phase:** 2 (High Priority)
**Backlog:** BACKLOG-860
**SOC 2 Control:** CC6.1 - Security event logging with source identification

## Goal

Capture the HTTP User-Agent string in audit log entries for forensic investigation. Either add a `user_agent` column to `admin_audit_logs` or include the user agent in the `metadata` JSONB field. The user agent is passed from the admin portal client to the server-side audit logging route.

## Non-Goals

- Do NOT parse or enrich the user agent string (no device/browser detection)
- Do NOT capture user agent for desktop app actions (admin portal only)
- Do NOT modify the audit log viewer to display user agent (can be added later)
- Do NOT capture user agent for SQL-level RPC audit entries (impersonation, etc.)

## Deliverables

1. New migration: `supabase/migrations/YYYYMMDD_audit_log_user_agent.sql` - Add `user_agent` column to `admin_audit_logs` (or update the `log_admin_action` RPC to include it in metadata)
2. Update: `admin-portal/app/api/audit-log/route.ts` (if created by TASK-2137) or `admin-portal/lib/audit.ts` - Pass user agent from request headers
3. Update: Client-side audit log calls to include user agent header

## File Boundaries

### Files to modify (owned by this task):

- `supabase/migrations/YYYYMMDD_audit_log_user_agent.sql` (NEW)
- `admin-portal/app/api/audit-log/route.ts` (UPDATE - if created by TASK-2137)
- `admin-portal/lib/audit.ts` (UPDATE - if created by TASK-2137)

### Files this task must NOT modify:

- `admin-portal/app/dashboard/audit-log/AuditLogContent.tsx` -- Viewer, no display changes
- `admin-portal/middleware.ts` -- Shared middleware
- Existing migration files

## Acceptance Criteria

- [ ] New audit log entries include a `user_agent` value (either as column or in metadata)
- [ ] The user agent is extracted from the HTTP `User-Agent` header on the server side
- [ ] The `log_admin_action` RPC (or equivalent) accepts a user agent parameter
- [ ] Existing audit log entries are not affected (user_agent is NULL for historical entries)
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass

## Implementation Notes

### Decision: Column vs Metadata

**Option A (Recommended): Dedicated column**

A dedicated `user_agent TEXT` column provides easier querying and filtering:

```sql
ALTER TABLE public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Update log_admin_action to accept user_agent
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (
    actor_id, action, target_type, target_id, metadata, ip_address, user_agent
  )
  VALUES (
    auth.uid(), p_action, p_target_type, p_target_id, p_metadata, p_ip_address, p_user_agent
  );
END;
$$;
```

**Option B: Include in metadata JSONB**

Simpler, no schema change, but harder to query:

```sql
-- In the audit log API route, just add to metadata:
p_metadata: { ...body.metadata, user_agent: request.headers.get('user-agent') }
```

### Server-Side User Agent Extraction

If TASK-2137 created the `/api/audit-log/route.ts` route:

```typescript
// Add user agent extraction alongside IP extraction
const userAgent = request.headers.get('user-agent') || 'unknown';

const { error } = await supabase.rpc('log_admin_action', {
  p_action: body.action,
  p_target_type: body.target_type,
  p_target_id: body.target_id,
  p_metadata: body.metadata || null,
  p_ip_address: ip,
  p_user_agent: userAgent,
});
```

### Important Details

- The `User-Agent` header is automatically sent by browsers -- no client-side changes needed
- On Vercel, the `User-Agent` header is available on `NextRequest.headers`
- User agent strings can be long (200+ chars) -- use TEXT type, not VARCHAR
- If TASK-2137 has not been completed yet, this task should create both the API route and the column

## Integration Notes

- Depends on: TASK-2137 (IP capture) creates the audit log API route and `log_admin_action` RPC. If TASK-2137 runs first, this task extends those. If not, this task must create them.
- Imports from: `admin-portal/lib/audit.ts` (if created by TASK-2137)
- Used by: Forensic investigation, SOC 2 auditors

## Do / Don't

### Do:

- Prefer the dedicated column approach for queryability
- Make the migration idempotent (ADD COLUMN IF NOT EXISTS)
- Use TEXT type for the user_agent column
- Handle missing User-Agent header gracefully

### Don't:

- Do NOT truncate the user agent string
- Do NOT parse the user agent into structured fields
- Do NOT require user agent for existing SQL-level audit entries (NULL is fine)

## When to Stop and Ask

- If TASK-2137 has not been completed and the `log_admin_action` RPC does not exist
- If the `admin_audit_logs` table schema cannot be altered (permissions issue)
- If the immutability trigger (TASK-2139) blocks the ALTER TABLE

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No

### Integration / Feature Tests

- Required scenarios:
  - Create an audit log entry via the API route and verify `user_agent` is populated
  - Verify historical entries have NULL user_agent (no data corruption)

### CI Requirements

- [ ] Migration is valid SQL
- [ ] Type checking passes
- [ ] All CI checks pass

## PR Preparation

- **Title**: `feat(audit): capture user agent in audit log entries`
- **Labels**: `soc2`, `audit`, `admin-portal`
- **Depends on**: TASK-2137 (soft dependency -- can create RPC independently if needed)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~10K-15K

**Token Cap:** 60K (4x upper estimate)

**Confidence:** High (straightforward schema + API change)

**Risk factors:**
- Dependency on TASK-2137 completion state

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
- [ ] supabase/migrations/YYYYMMDD_audit_log_user_agent.sql

Files modified:
- [ ] admin-portal/app/api/audit-log/route.ts (or created if not existing)

Verification:
- [ ] npm run type-check passes (in admin-portal)
- [ ] Migration applies without errors
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~12K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:** <Key decisions>
**Deviations from plan:** <If any, explain. If none, "None">
**Design decisions:** <Document decisions>
**Issues encountered:** <Document issues>
**Reviewer notes:** <Anything for reviewer>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop / int/sprint-117-soc2-compliance

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
