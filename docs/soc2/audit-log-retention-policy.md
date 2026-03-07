# Audit Log Retention Policy

**Effective Date:** 2026-03-07
**Version:** 1.0
**SOC 2 Control:** CC7.3 - Log retention and availability
**Owner:** Security Team
**Review Cycle:** Annual

---

## 1. Policy Statement

All entries in the `admin_audit_logs` table must be retained for a minimum of **7 years** from the date of creation. This exceeds the SOC 2 minimum requirement of 1 year to meet financial services industry best practices and regulatory expectations for real estate transaction auditing.

Audit logs are the authoritative record of administrative actions within the Keepr platform and are critical for:

- SOC 2 Type II audit evidence
- Regulatory compliance investigations
- Security incident forensics
- Internal accountability and governance

## 2. Scope

This policy applies to all records stored in the `public.admin_audit_logs` table in the Supabase PostgreSQL database. This includes but is not limited to:

- Administrative user actions (user management, role changes)
- Authentication events (login, logout, failed attempts)
- Configuration changes (organization settings, feature toggles)
- Data access events (exports, bulk operations)
- Security-related actions (permission changes, API key management)

## 3. Retention Rules

| Category | Retention Period | Storage Tier | Early Archival Allowed |
|----------|-----------------|--------------|----------------------|
| Admin actions | 7 years | Primary database | Yes, after 1 year |
| Authentication events | 7 years | Primary database | Yes, after 1 year |
| High-risk actions (role changes, deletions) | 7 years | Primary database | No |
| Security incidents | 7 years | Primary database | No |

### 3.1 Retention Period Justification

- **SOC 2 CC7.3** requires organizations to retain monitoring logs for a period sufficient to support investigations. Industry guidance recommends a minimum of 1 year.
- **Financial services best practice** recommends 7 years, aligning with IRS record retention requirements and state real estate commission audit windows.
- **Keepr's 7-year policy** provides a single, uniform retention period that satisfies all applicable requirements without the complexity of tiered retention.

## 4. Immutability

Audit log entries must **never be modified or deleted**. Immutability is enforced at the database level through PostgreSQL triggers:

- `prevent_audit_log_update` -- Blocks UPDATE operations on `admin_audit_logs`
- `prevent_audit_log_delete` -- Blocks DELETE operations on `admin_audit_logs`

These triggers were established under TASK-2139 (SOC 2 Control A1.2 - Log integrity / tamper protection). Only the `postgres` superuser role may bypass these triggers, and only for emergency maintenance operations that must be documented and approved by the security team.

### 4.1 Deletion Policy

**Audit log entries must NEVER be routinely deleted.** There is no automated purge process, and none should be implemented without a formal policy amendment reviewed by legal counsel and the security team.

If an entry must be removed for legal reasons (e.g., court order, GDPR right-to-erasure for non-business-critical data), the following process applies:

1. Written approval from the Security Team lead and legal counsel
2. Documentation of the legal basis for removal
3. The removal itself logged as a new audit entry
4. Performed only by the `postgres` role with change management ticket

## 5. Archival Strategy (Future Implementation)

When the `admin_audit_logs` table exceeds a growth threshold to be determined based on operational monitoring (recommended review at 1M rows or 10 GB), the following archival strategy should be implemented:

1. **Partition the table by month** using PostgreSQL native range partitioning on `created_at`
2. **Archive partitions older than 1 year** to cold storage (Amazon S3 with Object Lock in Compliance mode)
3. **Maintain queryable access** via a foreign data wrapper, archive API endpoint, or on-demand restore process
4. **Never delete** -- archived data must remain accessible for the full 7-year retention period
5. **Verify archive integrity** via checksums at write time and periodic validation

### 5.1 Archival Prerequisites (Not Yet Implemented)

- [ ] `pg_cron` extension for scheduled archival jobs
- [ ] S3 bucket with Object Lock and versioning enabled
- [ ] Archive restore API endpoint in admin portal
- [ ] Monitoring alerts for table size thresholds
- [ ] Runbook for manual archive and restore procedures

**Note:** Automated archival is documented here as future work. It is NOT implemented as part of this policy. See the sprint backlog for tracking.

## 6. Access Controls

Access to audit logs is governed by Row Level Security (RLS) policies on the `admin_audit_logs` table and the admin portal's role-based access controls:

- **Read access:** Restricted to authenticated admin users via the admin portal
- **Write access:** Application service role only (logs are generated programmatically)
- **Export access:** Admin users can export logs via the admin portal's export feature
- **Direct database access:** Restricted to the `postgres` role for emergency maintenance

## 7. Compliance Mapping

| Requirement | Control | How This Policy Satisfies It |
|-------------|---------|------------------------------|
| SOC 2 CC7.3 | Log retention and availability | 7-year retention exceeds 1-year minimum |
| SOC 2 A1.2 | Log integrity | Immutability triggers prevent modification |
| SOC 2 CC6.1 | Logical access controls | RLS policies restrict log access |
| SOC 2 CC7.2 | Monitoring of system components | Logs capture all admin actions |

## 8. Review Schedule

This policy must be reviewed **annually** by the Security Team, or sooner if:

- Regulatory requirements change
- A security incident reveals gaps in log coverage
- The archival strategy is implemented
- The organization's risk profile changes significantly

### 8.1 Review Checklist

- [ ] Retention period remains adequate for all applicable regulations
- [ ] Immutability triggers are still active and functioning
- [ ] Table growth is within acceptable limits (or archival plan is in progress)
- [ ] Access controls remain appropriately restrictive
- [ ] This document is current and accurate

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-07 | Engineering (TASK-2141) | Initial policy definition |
