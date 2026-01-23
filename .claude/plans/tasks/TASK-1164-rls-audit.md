# Task TASK-1164: Audit and Restore RLS Policies

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Audit Supabase Row Level Security (RLS) policies to ensure they are properly configured for the B2B broker portal workflow and the new license fields. Document current state and restore any missing policies.

## Non-Goals

- Do NOT modify database schema (that's TASK-1161)
- Do NOT create new tables
- Do NOT modify application code
- Do NOT change authentication flow

## Deliverables

1. New file: `.claude/docs/security/rls-audit-2026-01.md` (audit documentation)
2. Update: `supabase/migrations/20260122_rls_restoration.sql` (if policies need restoration)
3. Update: Existing migration files if policies are incorrect

## Acceptance Criteria

- [ ] All RLS policies on `profiles` table audited and documented
- [ ] All RLS policies on `organizations` table audited and documented
- [ ] All RLS policies on `organization_members` table audited and documented
- [ ] All RLS policies on `transaction_submissions` table audited and documented
- [ ] All RLS policies on `submission_messages` table audited and documented
- [ ] All RLS policies on `submission_attachments` table audited and documented
- [ ] All RLS policies on `submission_comments` table audited and documented
- [ ] Missing or incorrect policies restored via migration
- [ ] Documentation includes policy matrix by user role
- [ ] Test verification for agent and broker user types

## Implementation Notes

### Audit Process

1. **List Current Policies**:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

2. **Verify Each Table Has**:
- SELECT policies for appropriate roles
- INSERT policies with proper WITH CHECK
- UPDATE policies with proper USING and WITH CHECK
- DELETE policies (if applicable)
- Service role bypass policy

3. **Expected Policy Matrix**:

| Table | Agent Can | Broker Can | Admin Can |
|-------|-----------|------------|-----------|
| profiles | Read own | Read own | Read own + org members |
| organizations | Read own org | Read own org | Modify own org |
| organization_members | Read org members | Read org members | Manage members |
| transaction_submissions | CRUD own | Read + Review all in org | Full access |
| submission_messages | CRUD with own submissions | Read in org | Full access |
| submission_attachments | CRUD with own submissions | Read in org | Full access |
| submission_comments | Create + Read | Create + Read | Full access |

### Policies to Verify

From `supabase/migrations/20260122_b2b_broker_portal.sql`, verify these exist:

```sql
-- Profiles
- users_can_read_own_profile
- users_can_update_own_profile
- service_role_full_access_profiles

-- Organizations
- members_can_read_org
- admins_can_modify_org
- service_role_full_access_organizations

-- Organization Members
- members_can_read_org_members
- admins_can_manage_members
- users_can_accept_invite
- service_role_full_access_members

-- Transaction Submissions
- agents_can_read_own_submissions
- brokers_can_read_org_submissions
- agents_can_create_submissions
- agents_can_update_own_submissions
- brokers_can_review_submissions
- service_role_full_access_submissions

-- Submission Messages
- message_access_via_submission
- agents_can_insert_messages
- service_role_full_access_messages

-- Submission Attachments
- attachment_access_via_submission
- agents_can_insert_attachments
- service_role_full_access_attachments

-- Submission Comments
- comment_access_via_submission
- users_can_create_comments
- service_role_full_access_comments
```

### Documentation Format

Create `.claude/docs/security/rls-audit-2026-01.md`:

```markdown
# RLS Policy Audit - January 2026

## Audit Date
2026-01-22

## Tables Audited
- profiles
- organizations
- ...

## Policy Matrix

| Table | Policy Name | Command | Roles | Status |
|-------|-------------|---------|-------|--------|
| profiles | users_can_read_own_profile | SELECT | public | OK |
| ... | ... | ... | ... | ... |

## Issues Found
(List any missing or incorrect policies)

## Restorations Applied
(List any migrations created to fix issues)

## Verification Tests
(Document test results with agent/broker users)
```

## Integration Notes

- Imports from: `supabase/migrations/20260122_b2b_broker_portal.sql`
- Exports to: Documentation in `.claude/docs/security/`
- Used by: TASK-1166, TASK-1167 (testing depends on correct RLS)
- Depends on: TASK-1161 (schema should be in place)

## Do / Don't

### Do:

- Document ALL policies found, not just expected ones
- Test with actual agent and broker user credentials
- Create migration file for any needed fixes
- Include service_role policies in audit

### Don't:

- Don't change authentication logic
- Don't modify application code
- Don't delete policies without understanding their purpose
- Don't skip testing verification

## When to Stop and Ask

- If service_role policies are missing (critical for desktop app)
- If you find policies that seem intentionally different from expected
- If testing reveals authentication issues beyond RLS
- If you're unsure about policy semantics

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (Supabase RLS, not application code)

### Coverage

- Coverage impact: Not applicable

### Integration / Feature Tests

- Required scenarios:
  - Agent user can only see their own submissions
  - Broker user can see all org submissions
  - Service role can access all data
  - Unauthorized users cannot access any data

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (if any TypeScript changes)
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `security(supabase): audit and restore RLS policies`
- **Labels**: `security`, `supabase`, `sprint-051`
- **Depends on**: TASK-1161

---

## PM Estimate (PM-Owned)

**Category:** `service` (Supabase/security)

**Estimated Tokens:** ~8K-12K

**Token Cap:** 40K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1-2 (docs, maybe migration) | +4K |
| Files to modify | 0-1 (only if fixes needed) | +2K |
| Code volume | ~50-100 lines SQL | +3K |
| Test complexity | Low (manual verification) | +1K |

**Confidence:** High

**Risk factors:**
- May find unexpected policy issues requiring investigation
- Testing requires Supabase access

**Similar past tasks:** BACKLOG-419 originally estimated ~10K

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] .claude/docs/security/rls-audit-2026-01.md

Files modified (if needed):
- [ ] supabase/migrations/20260122_rls_restoration.sql

Audit completed:
- [ ] profiles table policies
- [ ] organizations table policies
- [ ] organization_members table policies
- [ ] transaction_submissions table policies
- [ ] submission_messages table policies
- [ ] submission_attachments table policies
- [ ] submission_comments table policies

Verification:
- [ ] Agent user access tested
- [ ] Broker user access tested
- [ ] Service role access tested
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

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
**Merged To:** develop
