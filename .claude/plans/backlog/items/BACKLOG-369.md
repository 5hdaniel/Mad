# BACKLOG-369: Align Audit Log Schema Between Migration and Main Schema

**Created**: 2026-01-21
**Priority**: Moderate
**Category**: Technical Debt / Data Integrity
**Status**: Pending
**Source**: SR Engineer Database Audit (ISSUE-006)

---

## Problem Statement

The `audit_logs` table definition differs between the migration file and the main schema file. This can cause:
- Different behavior depending on which schema was applied
- Runtime errors if code expects one schema but runs against another
- Inconsistent data validation

## Differences Found

### Table Definition

| Field/Aspect | add_audit_logs.sql (Migration) | schema.sql (Main) |
|--------------|--------------------------------|-------------------|
| resource_type | `NOT NULL` | No NOT NULL |
| details | Not present | `details TEXT` |
| metadata | `metadata TEXT` | `metadata TEXT` |
| user_id FK | No FK (independent) | `FOREIGN KEY (user_id) REFERENCES users_local(id)` |

### Action CHECK Constraint

**Migration (lines 25-31):**
```sql
CHECK (action IN (
  'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
  'DATA_ACCESS', 'DATA_EXPORT', 'DATA_DELETE',
  'TRANSACTION_CREATE', 'TRANSACTION_UPDATE', 'TRANSACTION_DELETE',
  'CONTACT_CREATE', 'CONTACT_UPDATE', 'CONTACT_DELETE',
  'SETTINGS_CHANGE', 'MAILBOX_CONNECT', 'MAILBOX_DISCONNECT'
))
```

**Main Schema (lines 419-426):**
```sql
CHECK (action IN (
  'LOGIN', 'LOGOUT', 'SESSION_REFRESH',
  'TRANSACTION_CREATE', 'TRANSACTION_UPDATE', 'TRANSACTION_DELETE',
  'CONTACT_CREATE', 'CONTACT_UPDATE', 'CONTACT_DELETE',
  'EXPORT_START', 'EXPORT_COMPLETE', 'EXPORT_FAIL',
  'MAILBOX_CONNECT', 'MAILBOX_DISCONNECT',
  'SETTINGS_UPDATE', 'TERMS_ACCEPT'
))
```

**Missing in Main Schema:**
- LOGIN_FAILED
- DATA_ACCESS
- DATA_EXPORT
- DATA_DELETE
- SETTINGS_CHANGE

**Missing in Migration:**
- SESSION_REFRESH
- EXPORT_START
- EXPORT_COMPLETE
- EXPORT_FAIL
- SETTINGS_UPDATE
- TERMS_ACCEPT

### Resource Type CHECK Constraint

**Migration (lines 33-36):**
```sql
CHECK (resource_type IN (
  'USER', 'SESSION', 'TRANSACTION', 'CONTACT',
  'COMMUNICATION', 'EXPORT', 'MAILBOX', 'SETTINGS'
))
```

**Main Schema:**
No CHECK constraint on resource_type.

### Foreign Key Difference

**Migration:** No FK - intentionally independent for persistence
**Main Schema:** Has FK to users_local with ON DELETE CASCADE

This is a significant architectural difference. Migration approach is correct for audit log integrity.

## Recommendation

Use the migration file as the source of truth because:
1. No FK ensures audit logs persist even if user deleted (compliance requirement)
2. More comprehensive action types for security tracking
3. Resource type constraint prevents invalid values

## Required Changes

### 1. Update schema.sql to Match Migration
- Remove user_id foreign key
- Add resource_type NOT NULL and CHECK constraint
- Merge action CHECK constraints (superset of both)
- Remove `details` column if not used, or add to migration

### 2. Create Reconciliation Migration
- For existing databases, alter table to add missing constraints
- Handle any invalid data that doesn't meet new constraints

### 3. Update AuditService
- Verify it uses correct action values
- Ensure all audit log writes use valid action/resource_type values

## Acceptance Criteria

- [ ] schema.sql and migration have identical audit_logs definition
- [ ] No foreign key on user_id (preserves audit integrity)
- [ ] Comprehensive CHECK constraints for action and resource_type
- [ ] AuditService uses valid action values
- [ ] Existing data validated/migrated if needed

## Estimation

- **Category:** database/schema alignment
- **Estimated Tokens:** ~5K
- **Risk:** Medium (need to verify existing data compatibility)

## Related

- AuditService.ts: Main audit logging service
- Compliance requirements: Audit logs must be immutable
- BACKLOG-296: Database schema audit findings
