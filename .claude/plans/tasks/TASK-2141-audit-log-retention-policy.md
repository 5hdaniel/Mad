# Task TASK-2141: Define Audit Log Retention Policy

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
**Backlog:** BACKLOG-859
**SOC 2 Control:** CC7.3 - Log retention and availability

## Goal

Define and document a formal audit log retention policy (minimum 1 year, recommend 7 years for financial services). Create a SQL migration that adds a retention policy comment/metadata to the `admin_audit_logs` table and optionally sets up partitioning or archival infrastructure for future automated archival. The primary deliverable is a documented policy, not automated archival tooling.

## Non-Goals

- Do NOT install `pg_cron` or implement automated archival (document as future work)
- Do NOT delete any existing audit log entries
- Do NOT implement log archival to cold storage (S3, etc.)
- Do NOT modify the audit log viewer or export UI
- Do NOT change the `admin_audit_logs` schema structure

## Deliverables

1. New file: `docs/soc2/audit-log-retention-policy.md` - Formal retention policy document
2. New migration: `supabase/migrations/YYYYMMDD_audit_log_retention_policy.sql` - Table comment documenting retention policy, optional index on `created_at` for archival queries

## File Boundaries

### Files to modify (owned by this task):

- `docs/soc2/audit-log-retention-policy.md` (NEW)
- `supabase/migrations/YYYYMMDD_audit_log_retention_policy.sql` (NEW)

### Files this task must NOT modify:

- `admin-portal/` -- No portal changes
- Existing migration files

## Acceptance Criteria

- [ ] A formal retention policy document exists at `docs/soc2/audit-log-retention-policy.md`
- [ ] The policy specifies: minimum retention period (7 years), archival strategy (future), deletion policy (never delete, archive to cold storage)
- [ ] A SQL comment on the `admin_audit_logs` table documents the retention requirement
- [ ] An index on `created_at` exists for efficient date-range queries (if not already present)
- [ ] The policy document references relevant SOC 2 controls (CC7.3)
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass

## Implementation Notes

### Retention Policy Document

Create `docs/soc2/audit-log-retention-policy.md` with:

```markdown
# Audit Log Retention Policy

**Effective Date:** 2026-03-XX
**Version:** 1.0
**SOC 2 Control:** CC7.3

## Policy Statement

All entries in the `admin_audit_logs` table must be retained for a minimum
of **7 years** from the date of creation. This exceeds the SOC 2 minimum
of 1 year to meet financial services industry best practices.

## Retention Rules

| Category | Retention Period | Storage |
|----------|-----------------|---------|
| Admin actions | 7 years | Primary database |
| Authentication events | 7 years | Primary database |
| High-risk actions | 7 years (no early archival) | Primary database |

## Archival Strategy (Future)

When the `admin_audit_logs` table exceeds [threshold TBD]:
1. Partition table by month using PostgreSQL native partitioning
2. Archive partitions older than 1 year to cold storage (S3 with Object Lock)
3. Maintain queryable access via foreign data wrapper or archive API
4. Never delete -- only archive

## Deletion Policy

**Audit log entries must NEVER be deleted.** The immutability trigger
(TASK-2139) enforces this at the database level. Even the postgres role
should only bypass immutability for emergency maintenance, never for
routine deletion.

## Review Schedule

This policy must be reviewed annually by the security team.
```

### SQL Migration

```sql
-- Document retention policy on the table
COMMENT ON TABLE public.admin_audit_logs IS
  'SOC 2 audit trail. Retention: 7 years minimum. '
  'Immutability enforced by triggers (prevent_audit_log_update, prevent_audit_log_delete). '
  'Do NOT delete entries. Archive to cold storage when table exceeds growth threshold.';

-- Ensure index exists for date-range queries (used by export and archival)
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at);
```

## Integration Notes

- Depends on: TASK-2139 (immutability trigger) should be in place, but this task does not require it
- Used by: SOC 2 auditors reviewing retention practices
- Exports to: Referenced by the SPRINT-117 compliance documentation

## Do / Don't

### Do:

- Use clear, formal language suitable for auditor review
- Reference specific SOC 2 controls
- Include a review schedule
- Make the migration idempotent

### Don't:

- Do NOT implement automated archival (just document the strategy)
- Do NOT install pg_cron or any extensions
- Do NOT modify existing data
- Do NOT set up partitioning (document as future work)

## When to Stop and Ask

- If the `docs/soc2/` directory does not exist (create it)
- If the `admin_audit_logs` table already has a comment that conflicts

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (documentation + SQL comment)

### CI Requirements

- [ ] Migration is valid SQL
- [ ] All CI checks pass

## PR Preparation

- **Title**: `docs(soc2): define audit log retention policy`
- **Labels**: `soc2`, `audit`, `documentation`
- **Depends on**: None (Phase 2 but no technical dependency)

---

## PM Estimate (PM-Owned)

**Category:** `docs`

**Estimated Tokens:** ~8K-12K (apply docs multiplier cautiously -- this is a short, well-scoped doc)

**Token Cap:** 48K (4x upper estimate)

**Confidence:** High

**Risk factors:**
- Minimal -- well-defined scope

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
- [ ] docs/soc2/audit-log-retention-policy.md
- [ ] supabase/migrations/YYYYMMDD_audit_log_retention_policy.sql

Verification:
- [ ] Policy document is clear and auditor-ready
- [ ] Migration applies without errors
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

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
