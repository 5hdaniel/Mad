# SPRINT-117: SOC 2 Audit Log Compliance

**Status:** Ready
**Created:** 2026-03-06
**Integration Branch:** `int/sprint-117-soc2-audit`
**Merge Target:** `develop`

---

## Sprint Goal

Bring audit logging to SOC 2 readiness with IP capture, auth event logging, user agent tracking, immutability enforcement, CSV/JSON export, standardized payloads, complete action type coverage, retention policy, and high-risk action alerting.

## Dependencies

- **SPRINT-113** (Admin RBAC) -- MERGED (PR #1062). Establishes the `admin_audit_logs` table and `log_admin_action()` RPC.
- **SPRINT-116** (Impersonation) -- Must be complete before this sprint. Impersonation actions need to be covered by the audit improvements here, and the immutability trigger (Phase 3) should not be applied until impersonation audit trail is verified working.
- **User action required before Phase 3:** Clean test data from `admin_audit_logs` before applying immutability trigger (cannot DELETE after trigger is active).

## Context

SOC 2 audit identified critical gaps in the audit logging system built in SPRINT-113:
- **CC6.1:** IP addresses not captured (column exists but always NULL)
- **CC6.2:** Zero authentication event visibility (no login/logout/failed auth logging)
- **A1.2:** Audit logs are mutable (service_role can DELETE/UPDATE)
- **CC7.2:** No automated alerting for high-risk admin actions

This sprint addresses all gaps across 4 phases in strict execution order.

---

## In-Scope

### Phase 1: Data Capture (Parallel within phase)

| Backlog | Title | Priority | Type | Est. Tokens |
|---------|-------|----------|------|-------------|
| BACKLOG-855 | Capture IP address in audit logs | Critical | bug | ~8K |
| BACKLOG-856 | Enable authentication event logging | Critical | feature | ~12K |
| BACKLOG-860 | Capture user agent in audit logs | High | feature | ~5K |

**Phase 1 Subtotal:** ~25K tokens

### Phase 2: Export & Standardization (Parallel within phase, sequential after Phase 1)

| Backlog | Title | Priority | Type | Est. Tokens |
|---------|-------|----------|------|-------------|
| BACKLOG-858 | Add audit log CSV/JSON export for auditors | Critical | feature | ~15K |
| BACKLOG-862 | Standardize before/after payloads in audit logs | Medium | chore | ~8K |
| BACKLOG-863 | Add missing audit log action types | Medium | chore | ~8K |

**Phase 2 Subtotal:** ~31K tokens

### Phase 3: Immutability (Sequential, after Phase 2 + user data cleanup)

| Backlog | Title | Priority | Type | Est. Tokens |
|---------|-------|----------|------|-------------|
| BACKLOG-857 | Make audit logs immutable (DELETE/UPDATE trigger) | Critical | feature | ~5K |

**Phase 3 Subtotal:** ~5K tokens

**WARNING:** Phase 3 MUST be last among the data-modifying phases. Once the immutability trigger is active, no corrections can be made to existing audit log entries. User must clean test data before this phase executes.

### Phase 4: Policy & Alerting (Parallel within phase, sequential after Phase 3)

| Backlog | Title | Priority | Type | Est. Tokens |
|---------|-------|----------|------|-------------|
| BACKLOG-859 | Define audit log retention policy | High | chore | ~5K |
| BACKLOG-861 | Add alerting for high-risk admin actions | High | feature | ~12K |

**Phase 4 Subtotal:** ~17K tokens

**Total Estimated:** ~78K tokens

## Out of Scope / Deferred

- External log shipping (S3 with Object Lock, SIEM integration) -- future enhancement
- Hash chain / tamper evidence beyond immutability trigger -- future enhancement
- Log rotation / automated archival implementation (Phase 4 defines policy only)
- Real-time dashboard for audit events

---

## Execution Plan

### Phase 1: Data Capture

All three tasks modify the audit logging pipeline but touch different aspects:

- **BACKLOG-855 (IP capture):** Modify middleware or RPC to extract IP from request headers (`x-forwarded-for`, `x-real-ip`) and pass to `log_admin_action()`. Add `ip_address` parameter to RPC if not already present.
- **BACKLOG-856 (Auth events):** Enable Supabase Auth audit logging. Add auth event webhook or Edge Function to capture login/logout/failed auth events into `admin_audit_logs`. New action types: `auth.login`, `auth.logout`, `auth.failed_login`.
- **BACKLOG-860 (User agent):** Pass `navigator.userAgent` from client to RPC. Either add `user_agent` column to `admin_audit_logs` or include in `metadata` JSONB field.

**Parallelism note:** BACKLOG-855 and BACKLOG-860 both modify the `log_admin_action()` RPC signature. SR Engineer should determine whether these can safely run in parallel or must be sequential.

### Phase 2: Export & Standardization

- **BACKLOG-858 (Export):** Add CSV/JSON export button to audit log UI. Create API endpoint or RPC that returns all logs for a date range. Support filtering by action type, date range, actor.
- **BACKLOG-862 (Payloads):** Audit all `log_admin_action()` call sites. Standardize to include `before` and `after` objects in metadata. Follow the pattern already used by license updates.
- **BACKLOG-863 (Action types):** Add missing action types: `user.delete`, `organization.update`, `settings.update`, `data.export`. Add `log_admin_action()` calls to any uncovered RPCs.

**Parallelism note:** BACKLOG-862 and BACKLOG-863 both modify `log_admin_action()` call sites. SR Engineer should determine whether these can safely run in parallel or must be sequential.

### Phase 3: Immutability

- **BACKLOG-857 (Immutability trigger):** Create `BEFORE UPDATE OR DELETE` trigger on `admin_audit_logs` that raises an exception. This is a one-way door -- once applied, audit log entries cannot be modified or deleted by any role including `service_role` and `postgres`.

**Pre-requisites:**
1. All Phase 1 and Phase 2 work merged and verified
2. User has cleaned test/development data from `admin_audit_logs`
3. PM confirms with user that data cleanup is complete before assigning this task

### Phase 4: Policy & Alerting

- **BACKLOG-859 (Retention policy):** Document formal retention policy (recommend 7 years for financial services). Define archival strategy. Consider `pg_cron` for automated archival to cold storage.
- **BACKLOG-861 (Alerting):** Implement webhook-based alerts for high-risk actions: impersonation, bulk user suspension, role creation/deletion, permission escalation. Use Supabase Database Webhooks or Edge Functions. Configure notification targets (email, Slack).

---

## Dependency Graph

```
Phase 1 (parallel):
  BACKLOG-855 (IP capture)
  BACKLOG-856 (auth events)       -- SR to confirm parallel safety
  BACKLOG-860 (user agent)
        |
        v
Phase 2 (parallel):
  BACKLOG-858 (export)
  BACKLOG-862 (standardize payloads)  -- SR to confirm parallel safety
  BACKLOG-863 (missing action types)
        |
        v
  [USER ACTION: Clean test data from admin_audit_logs]
        |
        v
Phase 3 (sequential):
  BACKLOG-857 (immutability trigger)
        |
        v
Phase 4 (parallel):
  BACKLOG-859 (retention policy)
  BACKLOG-861 (alerting)
```

---

## Merge Plan

- Integration branch: `int/sprint-117-soc2-audit`
- Base from: `develop` (after SPRINT-116 merged)
- Separate branch per task with PRs to integration branch
- Phase execution is strictly sequential (1 -> 2 -> user cleanup -> 3 -> 4)
- Within phases, parallel execution as approved by SR Engineer
- Integration branch merges to `develop` after all phases complete and QA passes

---

## Testing Plan

| Backlog | Test Type | Details |
|---------|-----------|---------|
| BACKLOG-855 | Manual + Query | Perform admin action; verify `ip_address` column populated in `admin_audit_logs` |
| BACKLOG-856 | Manual + Query | Login/logout/failed login; verify events appear in audit logs with correct action types |
| BACKLOG-860 | Manual + Query | Perform admin action; verify user agent captured in audit log entry |
| BACKLOG-858 | Manual | Export CSV and JSON for date range; verify completeness and correct formatting |
| BACKLOG-862 | Manual + Query | Perform role update, user suspension; verify `before`/`after` payloads in metadata |
| BACKLOG-863 | Code review | Audit all RPCs for `log_admin_action()` coverage; verify no uncovered operations |
| BACKLOG-857 | Manual | Attempt `DELETE FROM admin_audit_logs` and `UPDATE admin_audit_logs` via SQL; verify trigger blocks both |
| BACKLOG-859 | Documentation review | Retention policy document exists with clear timelines and archival strategy |
| BACKLOG-861 | Manual | Trigger high-risk action (e.g., role creation); verify alert fires to configured target |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Immutability trigger applied before test data cleanup | High | Phase 3 gated behind explicit user confirmation; PM must verify before assigning |
| IP capture breaks behind load balancer/CDN | Medium | Use standard header chain: `x-forwarded-for` -> `x-real-ip` -> connection IP |
| Auth event webhook misses events | High | Verify Supabase Auth audit logging is enabled at project level; add manual fallback logging |
| Export endpoint exposes sensitive data | Medium | Gate behind `audit.view` permission; rate limit export endpoint |
| Alerting false positives cause alert fatigue | Medium | Start with high-confidence triggers only (impersonation, bulk suspension); tune thresholds after rollout |
| Immutability trigger blocks legitimate schema migrations | Medium | Trigger only blocks row-level DELETE/UPDATE; schema changes (ALTER TABLE) are unaffected |

---

## Acceptance Criteria

### Phase 1
- [ ] All new audit log entries include IP address (not NULL)
- [ ] Login, logout, and failed login events appear in audit logs
- [ ] User agent captured for all audit log entries

### Phase 2
- [ ] Auditors can export logs as CSV or JSON for any date range
- [ ] All `log_admin_action()` calls include structured `before`/`after` payloads
- [ ] All admin operations have corresponding action types in audit logs

### Phase 3
- [ ] `DELETE` and `UPDATE` operations on `admin_audit_logs` are blocked by trigger
- [ ] Trigger works for all roles including `service_role` and `postgres`
- [ ] New `INSERT` operations still work normally

### Phase 4
- [ ] Formal retention policy documented (minimum 1 year, recommended 7 years)
- [ ] High-risk admin actions trigger automated alerts
- [ ] Alert targets configured and verified (email and/or Slack)
