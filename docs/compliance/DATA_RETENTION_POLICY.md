# Data Retention Policy

> **Document Control**
> | Field | Value |
> |-------|-------|
> | Version | 1.0 |
> | Effective Date | 2025-11-25 |
> | Last Review | 2025-11-25 |
> | Author | Compliance Team |
> | Approval Status | DRAFT - Requires Legal Review |
> | Next Review | 2026-05-25 |

> **NOTICE:** This document requires legal review before publication. All policies must be reviewed by legal counsel prior to implementation.

---

## 1. Purpose and Scope

### 1.1 Purpose

This Data Retention Policy establishes guidelines for the retention, archival, and deletion of data processed by Magic Audit. The policy ensures:

- Compliance with legal and regulatory requirements
- Protection of user privacy rights
- Efficient data management and storage optimization
- Support for business operations and audit requirements
- Consistent data handling practices across the organization

### 1.2 Scope

This policy applies to all data collected, processed, and stored by Magic Audit, including:

- Data stored locally on user devices (SQLite database)
- Data stored in cloud infrastructure (Supabase)
- Data processed through third-party integrations (Google, Microsoft)
- Backup and archived data
- Logs and analytics data

### 1.3 Legal Framework

This policy considers requirements from:

- California Consumer Privacy Act (CCPA/CPRA)
- California Civil Code Section 1798 (breach notification)
- Real estate recordkeeping requirements
- Electronic communications retention standards
- SOC 2 Trust Service Criteria

---

## 2. Data Classification

### 2.1 Classification Levels

| Level | Description | Examples |
|-------|-------------|----------|
| **Confidential** | Highly sensitive data requiring maximum protection | OAuth tokens, session tokens, encryption keys |
| **Personal** | Personally identifiable information (PII) | Email addresses, names, contact information |
| **Business** | Business transaction and operational data | Property addresses, transaction records, communications |
| **Internal** | Internal operational data | Application logs, analytics, configuration |
| **Public** | Non-sensitive, publicly available information | Public application information |

### 2.2 Data Categories in Magic Audit

| Data Category | Classification | Storage Location | Owner |
|---------------|----------------|------------------|-------|
| User Account Data | Personal | Local DB + Supabase | User |
| OAuth Tokens | Confidential | Local DB (encrypted) | System |
| Session Tokens | Confidential | Local DB | System |
| Transaction Records | Business | Local DB | User |
| Communication Archives | Personal/Business | Local DB | User |
| Contact Information | Personal | Local DB + Supabase | User |
| Analytics Events | Internal | Supabase | System |
| Application Logs | Internal | Local + Log files | System |
| Device Information | Internal | Supabase | System |

---

## 3. Retention Schedule

### 3.1 Detailed Retention Matrix

| Data Type | Retention Period | Archive Period | Deletion Method | Legal Basis | Notes |
|-----------|------------------|----------------|-----------------|-------------|-------|
| **User Account Data** | Until account deletion request + 30 days | None | Secure wipe from all systems | Contractual necessity | Grace period for account recovery |
| **Transaction Records** | 7 years from transaction date | 5 years active, 2 years archived | Secure wipe after retention | Legal/regulatory requirement | Real estate recordkeeping laws |
| **Communication Data (Emails)** | 5 years from creation | 3 years active, 2 years archived | Soft delete, then secure wipe | Legitimate business interest | User may request earlier deletion |
| **Communication Data (iMessages)** | 5 years from import | 3 years active, 2 years archived | Soft delete, then secure wipe | Legitimate business interest | User may request earlier deletion |
| **Audit Logs** | 2 years | Append-only storage | Auto-purge after retention | Compliance requirement | SOC 2 audit trail |
| **Session Data** | 30 days from creation | None | Auto-purge | Technical necessity | Security best practice |
| **OAuth Tokens** | Until revocation or expiry | None | Secure wipe on revocation | Technical necessity | Refreshed as needed |
| **Analytics Events** | 90 days | None | Auto-purge | Legitimate business interest | Aggregated data may be kept longer |
| **Contact Information** | Until user deletion or account deletion | None | Secure wipe | Contractual necessity | User-controlled |
| **Device Information** | Until device deregistration + 30 days | None | Secure wipe | Technical necessity | License management |
| **Application Logs** | 90 days | None | Auto-purge | Technical necessity | Debug and monitoring |
| **Error Reports** | 180 days | None | Auto-purge | Legitimate business interest | Product improvement |
| **Export Files** | User-controlled (local) | N/A | User-initiated | User control | Files on user's device |
| **Backup Data** | 30 days | None | Secure overwrite | Technical necessity | Disaster recovery |

### 3.2 Retention Period Rationale

**7 Years (Transaction Records):**
- IRS recordkeeping requirements for financial transactions
- State real estate commission requirements
- Statute of limitations for contract disputes
- Professional liability considerations

**5 Years (Communication Data):**
- Balance between user utility and privacy
- Litigation hold requirements
- Professional conduct record requirements
- Shorter than transaction records as supporting evidence

**2 Years (Audit Logs):**
- SOC 2 audit requirements
- Security investigation needs
- Regulatory examination preparation

**90 Days (Analytics/Logs):**
- Sufficient for debugging and performance analysis
- Minimizes data exposure risk
- Storage optimization

**30 Days (Session Data):**
- Security best practice
- Automatic session management
- User convenience balance

---

## 4. Data Storage Locations

### 4.1 Local Storage (User Device)

**Database:** SQLite database (`mad.db`)
**Location:** User's application data directory
**Encryption:** Implementation planned (see SOC2_CONTROLS_MATRIX.md)

| Data Type | Table | Retention Enforcement |
|-----------|-------|----------------------|
| User Account | `users_local` | Manual process |
| Sessions | `sessions` | Application auto-cleanup |
| OAuth Tokens | `oauth_tokens` | Application auto-cleanup |
| Transactions | `transactions` | Scheduled retention job |
| Communications | `communications` | Scheduled retention job |
| Contacts | `contacts` | User-initiated |
| User Feedback | `user_feedback` | Linked to transaction retention |

### 4.2 Cloud Storage (Supabase)

**Location:** Supabase managed infrastructure
**Encryption:** Supabase encryption at rest and in transit
**Region:** To be confirmed with Supabase

| Data Type | Table | Retention Enforcement |
|-----------|-------|----------------------|
| User Profiles | `users` | Automated retention job |
| Licenses | `licenses` | Linked to user lifecycle |
| Devices | `devices` | Automated cleanup |
| Analytics Events | `analytics_events` | Automated purge (90 days) |
| API Usage | `api_usage` | Automated purge (90 days) |
| User Preferences | `user_preferences` | Linked to user lifecycle |

### 4.3 Third-Party Storage

**Google APIs:** Data processed in transit only; no persistent storage by Magic Audit
**Microsoft Graph:** Data processed in transit only; no persistent storage by Magic Audit
**GitHub:** Release binaries and update metadata; public information

---

## 5. Deletion Procedures

### 5.1 Deletion Methods

| Method | Description | Use Cases | Verification |
|--------|-------------|-----------|--------------|
| **Secure Wipe** | Cryptographic erasure or multiple-pass overwrite | Confidential data, PII, tokens | Verification log entry |
| **Soft Delete** | Mark as deleted, exclude from queries | User-facing data with recovery option | Soft delete flag |
| **Auto-Purge** | Automated removal based on retention period | Logs, analytics, session data | Automated verification |
| **Archive** | Move to cold storage with restricted access | Long-term legal holds | Archive manifest |

### 5.2 User-Initiated Deletion

**Account Deletion Request:**

1. User submits deletion request via application or email
2. Identity verification completed
3. 30-day grace period begins (user notified)
4. Data marked for deletion across all systems
5. After grace period:
   - Local database: User prompted to delete or data wiped
   - Supabase: Automated cascade delete
   - OAuth tokens: Revoked with providers
   - Logs: PII anonymized or deleted
6. Deletion confirmation sent to user
7. Deletion logged for audit purposes

**Communication Deletion Request:**

1. User selects communications for deletion
2. Soft delete applied immediately
3. Data excluded from all queries and exports
4. Hard delete after 30 days
5. Associated extracted data anonymized

### 5.3 Automated Deletion Jobs

```
Daily Jobs:
- Expire and delete sessions older than 30 days
- Delete analytics events older than 90 days
- Delete application logs older than 90 days

Weekly Jobs:
- Review and delete soft-deleted communications (> 30 days)
- Clean up orphaned records
- Verify backup retention compliance

Monthly Jobs:
- Review transaction records for archival eligibility
- Generate retention compliance report
- Audit user deletion requests completion

Annual Jobs:
- Archive eligible transaction records
- Delete transactions past retention period
- Full retention policy compliance audit
```

### 5.4 Deletion Verification

Each deletion operation must:

1. Log the deletion action with timestamp
2. Record the data type and quantity deleted
3. Verify deletion through query confirmation
4. Generate audit trail entry
5. Exclude from backup restoration scope

---

## 6. Legal Holds and Exceptions

### 6.1 Legal Hold Procedure

When litigation or regulatory investigation is anticipated:

1. **Identification:** Legal counsel identifies data subject to hold
2. **Scope Definition:** Specific data types, users, and date ranges defined
3. **Hold Implementation:**
   - Automated retention suspended for in-scope data
   - Hold tag applied to relevant records
   - Deletion jobs exclude held data
4. **Documentation:** Hold notice documented with:
   - Matter reference
   - Data scope
   - Hold start date
   - Responsible attorney
5. **Monitoring:** Regular review of hold status
6. **Release:** Written release from legal counsel required
7. **Resumption:** Normal retention schedule resumes after release

### 6.2 Regulatory Exceptions

| Exception Type | Description | Duration |
|----------------|-------------|----------|
| **Audit Preparation** | Extended retention for upcoming audits | Until audit completion |
| **Regulatory Investigation** | Hold pending investigation | Until resolution |
| **Law Enforcement Request** | Preservation per valid legal process | As specified in order |
| **Insurance Claim** | Retain relevant transaction data | Until claim resolution |

### 6.3 User Exceptions

Users may request:
- **Early Deletion:** Subject to legal hold review
- **Extended Retention:** For specific transactions beyond standard period
- **Export Before Deletion:** Full data export prior to account deletion

---

## 7. Cross-Border Data Considerations

### 7.1 Data Residency

| Data Type | Primary Location | Backup Location |
|-----------|------------------|-----------------|
| User Account Data | Supabase (region TBD) | User's local device |
| Transaction Records | User's local device | None (user responsibility) |
| Communication Archives | User's local device | None (user responsibility) |
| Analytics | Supabase (region TBD) | None |

### 7.2 International Users

For users outside the United States:
- Primary data storage remains on local device
- Cloud synchronization limited to account management
- Users informed of Supabase data location
- Transfer mechanisms documented in Privacy Policy

---

## 8. Implementation and Enforcement

### 8.1 Technical Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| Automated session cleanup | Application code | Implemented |
| Retention job scheduling | Database triggers/cron | Planned |
| Soft delete functionality | Database schema | Implemented |
| Hard delete procedures | Service layer | Planned |
| Deletion verification | Audit logging | Planned |
| Legal hold flags | Database schema | Planned |

### 8.2 Administrative Controls

- Quarterly retention compliance review
- Annual policy review and update
- Employee training on data handling
- Documentation of all deletion actions
- Regular audit of retention practices

### 8.3 Responsibilities

| Role | Responsibility |
|------|----------------|
| **Data Protection Officer** | Policy oversight, compliance monitoring |
| **Engineering Team** | Technical implementation, automation |
| **Legal Counsel** | Legal hold management, regulatory compliance |
| **Operations** | Daily deletion job monitoring |
| **Users** | Local data management, deletion requests |

---

## 9. User Rights and Requests

### 9.1 Data Subject Rights

Users have the right to:

- **Access:** Request copy of their data
- **Correction:** Request correction of inaccurate data
- **Deletion:** Request deletion of their data (subject to exceptions)
- **Portability:** Receive data in structured format
- **Objection:** Object to certain processing activities
- **Restriction:** Request restriction of processing

### 9.2 Request Handling

| Request Type | Response Time | Method |
|--------------|---------------|--------|
| Access Request | 30 days | Automated export + manual review |
| Deletion Request | 30 days (+ grace period) | Automated with verification |
| Correction Request | 15 days | Manual review + update |
| Portability Request | 30 days | Automated export |

### 9.3 Contact Information

Data retention inquiries: privacy@magicaudit.com
Deletion requests: Account settings or support@magicaudit.com
Legal inquiries: legal@magicaudit.com

---

## 10. Document Control

### 10.1 Review Schedule

| Review Type | Frequency | Responsible Party |
|-------------|-----------|-------------------|
| Full Policy Review | Annual | Compliance Team + Legal |
| Technical Implementation Review | Quarterly | Engineering Team |
| Retention Schedule Validation | Semi-annual | Legal + Compliance |
| Regulatory Update Review | As needed | Legal Counsel |

### 10.2 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-25 | Compliance Team | Initial document creation |

### 10.3 Related Documents

- [Incident Response Plan](./INCIDENT_RESPONSE_PLAN.md)
- [Privacy Policy](./PRIVACY_POLICY_DRAFT.md)
- [Vendor Inventory](./VENDOR_INVENTORY.md)
- [SOC 2 Controls Matrix](./SOC2_CONTROLS_MATRIX.md)

---

## Appendix A: Data Retention Quick Reference

```
+------------------------------------------+
|     DATA RETENTION QUICK REFERENCE       |
+------------------------------------------+
| Transaction Records:     7 years         |
| Communication Data:      5 years         |
| User Account Data:       Until deletion  |
| Audit Logs:              2 years         |
| Analytics:               90 days         |
| Session Data:            30 days         |
| Application Logs:        90 days         |
+------------------------------------------+
| DELETION REQUESTS                        |
| - Submit via app or email                |
| - 30-day grace period                    |
| - Confirmation provided                  |
+------------------------------------------+
| Contact: privacy@magicaudit.com          |
+------------------------------------------+
```

---

## Appendix B: Deletion Verification Checklist

```markdown
## Deletion Verification Checklist

**Request ID:** _______________
**Request Date:** _______________
**Request Type:** [ ] Account Deletion [ ] Data Deletion [ ] Communication Deletion

### Pre-Deletion Checks
- [ ] Legal hold review completed
- [ ] No active regulatory hold
- [ ] Grace period completed (if applicable)
- [ ] User identity verified

### Deletion Execution
- [ ] Local database records deleted
- [ ] Supabase records deleted
- [ ] OAuth tokens revoked
- [ ] Backup exclusion confirmed
- [ ] Logs anonymized (if applicable)

### Verification
- [ ] Query verification completed
- [ ] Audit log entry created
- [ ] User notification sent

**Completed By:** _______________
**Completion Date:** _______________
**Verification Signature:** _______________
```

---

*This document is confidential and intended for internal use only. Unauthorized distribution is prohibited.*
