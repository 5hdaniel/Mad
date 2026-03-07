# SPRINT-117: SOC 2 Audit Compliance

**Created:** 2026-03-07
**Status:** Planned
**Goal:** Close critical SOC 2 audit gaps in logging, immutability, and export capabilities

---

## Sprint Narrative

SOC 2 Type II audit readiness requires robust audit logging with specific properties: IP capture, immutability, authentication event tracking, export capabilities, retention policy, and alerting. Current audit infrastructure has gaps identified during SPRINT-113 SR Engineer review. This sprint closes the Critical and High priority items.

---

## In-Scope

### Phase 1: Critical (Must-Have for SOC 2)

| Backlog | Title | Priority | Est. Complexity |
|---------|-------|----------|-----------------|
| BACKLOG-855 | Capture IP address in audit logs | Critical | Medium |
| BACKLOG-856 | Enable authentication event logging | Critical | Medium |
| BACKLOG-857 | Make audit logs immutable (block DELETE/UPDATE) | Critical | Low |
| BACKLOG-858 | Add audit log CSV/JSON export for auditors | Critical | Medium |

### Phase 2: High Priority

| Backlog | Title | Priority | Est. Complexity |
|---------|-------|----------|-----------------|
| BACKLOG-859 | Define audit log retention policy | High | Low |
| BACKLOG-860 | Capture user agent in audit logs | High | Low |
| BACKLOG-861 | Add alerting for high-risk admin actions | High | High |

### Phase 3: Medium Priority (if time permits)

| Backlog | Title | Priority | Est. Complexity |
|---------|-------|----------|-----------------|
| BACKLOG-862 | Standardize before/after payloads in audit logs | Medium | Medium |
| BACKLOG-863 | Add missing audit log action types | Medium | Medium |

## Out of Scope / Deferred

- External SIEM integration (future)
- Hash chain tamper evidence (future)
- Full SOC 2 documentation package (separate effort)

---

## Dependencies

- SPRINT-113 (RBAC + audit log viewer) — Completed
- SPRINT-115 (admin polish) — Completed
- No dependency on SPRINT-116 (impersonation) — can run in parallel or before

---

## Merge Plan

- Phase 1 tasks can be parallelized (independent schema/code changes)
- Phase 2 depends on Phase 1 (IP capture needed before alerting)
- Target: `develop`

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| IP capture in serverless (Vercel) may need Edge Function | Medium | Check Vercel headers (x-forwarded-for, x-real-ip) |
| Supabase auth.audit_log_entries may not be configurable | Medium | Fall back to custom auth event logging via webhooks |
| Immutability trigger could block legitimate migrations | Low | Trigger allows postgres role for schema migrations |

---

## SOC 2 Control Mapping

| Control | Requirement | Backlog |
|---------|-------------|---------|
| CC6.1 | Security event logging with source identification | BACKLOG-855, BACKLOG-860 |
| CC6.2 | Authentication event tracking | BACKLOG-856 |
| A1.2 | Log integrity / tamper protection | BACKLOG-857 |
| CC7.2 | Monitoring and alerting for anomalies | BACKLOG-861 |
| CC7.3 | Log retention and availability | BACKLOG-859, BACKLOG-858 |
