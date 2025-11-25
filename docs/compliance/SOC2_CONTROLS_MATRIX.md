# SOC 2 Controls Matrix

> **Document Control**
> | Field | Value |
> |-------|-------|
> | Version | 1.0 |
> | Effective Date | 2025-11-25 |
> | Last Review | 2025-11-25 |
> | Author | Security/Compliance Team |
> | Approval Status | DRAFT - Requires Legal Review |
> | Next Review | 2026-05-25 |

> **NOTICE:** This document requires legal review before publication. This matrix serves as a framework for SOC 2 compliance and should be validated by qualified auditors.

---

## 1. Overview

This document maps Magic Audit's security controls to the AICPA Trust Service Criteria for SOC 2 Type II compliance. The matrix covers the five Trust Service Categories:

1. **Security** (Common Criteria) - Required
2. **Availability** - Optional (Included)
3. **Processing Integrity** - Optional (Included)
4. **Confidentiality** - Optional (Included)
5. **Privacy** - Optional (Included)

### 1.1 Scope

This controls matrix covers:
- Magic Audit desktop application
- Supabase cloud infrastructure
- Third-party integrations (Google, Microsoft)
- Data processing and storage systems
- Supporting infrastructure and operations

### 1.2 Control Status Legend

| Status | Description |
|--------|-------------|
| Implemented | Control is fully implemented and operational |
| Partial | Control is partially implemented; gaps identified |
| Planned | Control is planned but not yet implemented |
| N/A | Control is not applicable to Magic Audit |

---

## 2. CC1: Control Environment

### CC1.1 - CC1.5: COSO Principles

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| CC1.1-1 | Commitment to integrity and ethical values | Code of conduct documented and communicated | Planned | Code of Conduct document | HR |
| CC1.1-2 | Commitment to integrity and ethical values | Background checks for personnel | Planned | Background check policy | HR |
| CC1.2-1 | Board independence and oversight | Security oversight by leadership | Partial | Meeting minutes | Executive |
| CC1.3-1 | Management structure and authority | Organization chart with security responsibilities | Planned | Org chart | HR |
| CC1.4-1 | Commitment to competence | Security training program | Planned | Training records | HR |
| CC1.4-2 | Commitment to competence | Role-based access requirements | Implemented | Access control policy | Security |
| CC1.5-1 | Accountability for controls | Security responsibilities documented | Partial | Job descriptions | HR |

---

## 3. CC2: Communication and Information

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| CC2.1-1 | Information quality | Data validation in application | Implemented | Code review, tests | Engineering |
| CC2.1-2 | Information quality | Database constraints and integrity | Implemented | Schema review | Engineering |
| CC2.2-1 | Internal communication | Security policies documented | Partial | Policy documents | Security |
| CC2.2-2 | Internal communication | Incident escalation procedures | Implemented | [INCIDENT_RESPONSE_PLAN.md](./INCIDENT_RESPONSE_PLAN.md) | Security |
| CC2.3-1 | External communication | Privacy policy published | Planned | [PRIVACY_POLICY_DRAFT.md](./PRIVACY_POLICY_DRAFT.md) | Legal |
| CC2.3-2 | External communication | Security contact information | Planned | Website, app | Security |

---

## 4. CC3: Risk Assessment

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| CC3.1-1 | Risk identification | Vendor risk assessment | Implemented | [VENDOR_INVENTORY.md](./VENDOR_INVENTORY.md) | Security |
| CC3.1-2 | Risk identification | Threat modeling | Planned | Threat model document | Security |
| CC3.2-1 | Risk analysis | Security review process | Implemented | SECURITY_REVIEW.md | Security |
| CC3.2-2 | Risk analysis | Dependency vulnerability scanning | Implemented | Dependabot alerts | Engineering |
| CC3.3-1 | Fraud risk assessment | Access control review | Partial | Access logs | Security |
| CC3.4-1 | Change management risk | Change control process | Partial | PR review process | Engineering |

---

## 5. CC4: Monitoring Activities

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| CC4.1-1 | Ongoing monitoring | Application logging (logService) | Implemented | Log files | Engineering |
| CC4.1-2 | Ongoing monitoring | Error tracking and alerting | Partial | Error logs | Engineering |
| CC4.1-3 | Ongoing monitoring | Supabase audit logging | Planned | Supabase logs | Security |
| CC4.2-1 | Deficiency evaluation | Security issue tracking | Implemented | GitHub issues | Security |
| CC4.2-2 | Deficiency evaluation | Incident post-mortems | Implemented | [INCIDENT_RESPONSE_PLAN.md](./INCIDENT_RESPONSE_PLAN.md) | Security |

---

## 6. CC5: Control Activities

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| CC5.1-1 | Control selection | Security controls documented | Implemented | This document | Security |
| CC5.2-1 | Technology controls | Automated security testing | Partial | CI/CD pipeline | Engineering |
| CC5.2-2 | Technology controls | Type checking (TypeScript strict) | Implemented | tsconfig.json | Engineering |
| CC5.3-1 | Policy deployment | Security policies distributed | Planned | Policy repository | Security |

---

## 7. CC6: Logical and Physical Access Controls

### 7.1 Logical Access

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| CC6.1-1 | Access provisioning | OAuth-based authentication | Implemented | Auth code | Engineering |
| CC6.1-2 | Access provisioning | Session management | Implemented | sessionService.ts | Engineering |
| CC6.1-3 | Access provisioning | License-based access control | Implemented | License system | Engineering |
| CC6.2-1 | Access removal | Session expiration (7 days) | Implemented | databaseService.ts | Engineering |
| CC6.2-2 | Access removal | OAuth token revocation | Implemented | Auth handlers | Engineering |
| CC6.3-1 | Access authorization | Role-based access (user isolation) | Implemented | RLS policies | Engineering |
| CC6.3-2 | Access authorization | User data segregation (user_id FK) | Implemented | Database schema | Engineering |
| CC6.4-1 | Access restriction | API key protection | Implemented | Environment variables | Engineering |
| CC6.4-2 | Access restriction | Token encryption (safeStorage) | Implemented | tokenEncryptionService.ts | Engineering |
| CC6.5-1 | Authentication | OAuth 2.0 implementation | Implemented | googleAuthService.ts, microsoftAuthService.ts | Engineering |
| CC6.5-2 | Authentication | Session token generation | Implemented | Crypto.randomUUID | Engineering |
| CC6.6-1 | Access review | Access log review | Planned | Audit procedures | Security |
| CC6.7-1 | System access restrictions | Least privilege principle | Implemented | Code review | Engineering |
| CC6.8-1 | Malicious software prevention | Dependency scanning | Implemented | npm audit, Dependabot | Engineering |

### 7.2 Physical Access

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| CC6.4-3 | Physical access | Supabase physical security | Implemented | Supabase SOC 2 | Vendor |
| CC6.4-4 | Physical access | Local data on user devices | N/A | User responsibility | User |

---

## 8. CC7: System Operations

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| CC7.1-1 | Security event detection | Application error logging | Implemented | logService.ts | Engineering |
| CC7.1-2 | Security event detection | Authentication failure tracking | Partial | Log review | Security |
| CC7.2-1 | Incident response | Incident Response Plan | Implemented | [INCIDENT_RESPONSE_PLAN.md](./INCIDENT_RESPONSE_PLAN.md) | Security |
| CC7.2-2 | Incident response | Escalation procedures | Implemented | IRP Section 3 | Security |
| CC7.3-1 | Recovery procedures | Data backup guidance | Partial | User documentation | Engineering |
| CC7.3-2 | Recovery procedures | Database recovery | Partial | Local backup | Engineering |
| CC7.4-1 | Vulnerability management | Dependency updates | Implemented | Dependabot, npm audit | Engineering |
| CC7.4-2 | Vulnerability management | Security advisories monitoring | Implemented | GitHub alerts | Security |
| CC7.5-1 | Business continuity | Service availability monitoring | Planned | Monitoring system | Operations |

---

## 9. CC8: Change Management

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| CC8.1-1 | Change authorization | Pull request review required | Implemented | GitHub branch protection | Engineering |
| CC8.1-2 | Change authorization | Code review requirements | Implemented | PR templates | Engineering |
| CC8.1-3 | Change authorization | Type checking in CI | Implemented | npm run type-check | Engineering |
| CC8.1-4 | Change authorization | Automated testing | Implemented | npm test | Engineering |
| CC8.1-5 | Change authorization | Lint checks | Implemented | npm run lint | Engineering |
| CC8.1-6 | Change authorization | Pre-commit hooks | Implemented | Husky configuration | Engineering |

---

## 10. CC9: Risk Mitigation

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| CC9.1-1 | Risk mitigation | Vendor risk assessment | Implemented | [VENDOR_INVENTORY.md](./VENDOR_INVENTORY.md) | Security |
| CC9.1-2 | Risk mitigation | Third-party security requirements | Partial | Vendor contracts | Legal |
| CC9.2-1 | Vendor management | Vendor inventory maintained | Implemented | [VENDOR_INVENTORY.md](./VENDOR_INVENTORY.md) | Security |
| CC9.2-2 | Vendor management | SOC 2 report collection | Planned | Vendor files | Security |

---

## 11. A1: Availability

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| A1.1-1 | Capacity management | Local storage (user device) | Implemented | App design | Engineering |
| A1.1-2 | Capacity management | Supabase scalability | Implemented | Supabase SLA | Vendor |
| A1.2-1 | Recovery procedures | Local data persistence | Implemented | SQLite database | Engineering |
| A1.2-2 | Recovery procedures | Cloud data redundancy | Implemented | Supabase replication | Vendor |
| A1.3-1 | Backup and restoration | User data export | Implemented | Export features | Engineering |

---

## 12. PI1: Processing Integrity

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| PI1.1-1 | Processing accuracy | Input validation | Implemented | validationService.ts | Engineering |
| PI1.1-2 | Processing accuracy | Database constraints | Implemented | Schema CHECK constraints | Engineering |
| PI1.2-1 | Complete processing | Transaction integrity | Implemented | Foreign key constraints | Engineering |
| PI1.3-1 | Timely processing | Real-time data operations | Implemented | App design | Engineering |
| PI1.4-1 | Output accuracy | Data verification | Implemented | Application logic | Engineering |
| PI1.5-1 | Error handling | Error logging and tracking | Implemented | logService.ts | Engineering |

---

## 13. C1: Confidentiality

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| C1.1-1 | Confidential information identification | Data classification | Implemented | [DATA_RETENTION_POLICY.md](./DATA_RETENTION_POLICY.md) | Security |
| C1.2-1 | Confidentiality controls | Encryption in transit (HTTPS/TLS) | Implemented | API calls | Engineering |
| C1.2-2 | Confidentiality controls | Token encryption (safeStorage) | Implemented | tokenEncryptionService.ts | Engineering |
| C1.2-3 | Confidentiality controls | Database encryption at rest | Planned | Future implementation | Engineering |
| C1.2-4 | Confidentiality controls | User data isolation | Implemented | RLS, user_id FK | Engineering |
| C1.3-1 | Confidential information disposal | Data retention policy | Implemented | [DATA_RETENTION_POLICY.md](./DATA_RETENTION_POLICY.md) | Compliance |
| C1.3-2 | Confidential information disposal | Secure deletion procedures | Partial | Deletion procedures | Engineering |

---

## 14. P1-P8: Privacy

| Control ID | Criteria | Control Description | Status | Evidence | Owner |
|------------|----------|---------------------|--------|----------|-------|
| P1.1-1 | Privacy notice | Privacy policy draft | Partial | [PRIVACY_POLICY_DRAFT.md](./PRIVACY_POLICY_DRAFT.md) | Legal |
| P2.1-1 | Choice and consent | OAuth consent flows | Implemented | Auth implementation | Engineering |
| P2.1-2 | Choice and consent | Terms acceptance tracking | Implemented | Database schema | Engineering |
| P3.1-1 | Collection limitation | Data minimization | Implemented | Schema design | Engineering |
| P3.2-1 | Collection from data subjects | Direct collection only | Implemented | App design | Engineering |
| P4.1-1 | Use and retention | Data retention policy | Implemented | [DATA_RETENTION_POLICY.md](./DATA_RETENTION_POLICY.md) | Compliance |
| P5.1-1 | Access rights | User data access | Implemented | Export features | Engineering |
| P5.2-1 | Correction requests | User data editing | Implemented | App features | Engineering |
| P6.1-1 | Disclosure and notification | Third-party disclosures | Implemented | [VENDOR_INVENTORY.md](./VENDOR_INVENTORY.md), Privacy Policy | Legal |
| P6.2-1 | Disclosure authorization | No unauthorized sharing | Implemented | App design | Engineering |
| P7.1-1 | Data quality | Validation controls | Implemented | validationService.ts | Engineering |
| P8.1-1 | Complaint management | Contact information | Planned | Privacy policy | Legal |

---

## 15. Gap Analysis Summary

### 15.1 Critical Gaps (P0)

| Gap ID | Area | Description | Remediation | Target Date |
|--------|------|-------------|-------------|-------------|
| GAP-001 | C1.2-3 | Database encryption at rest not implemented | Implement SQLCipher or equivalent | Q1 2026 |
| GAP-002 | CC6.2 | Session timeout too long (7 days) | Reduce to 24 hours with idle timeout | Q1 2026 |
| GAP-003 | P1.1-1 | Privacy policy not published | Legal review and publication | Q1 2026 |

### 15.2 High Priority Gaps (P1)

| Gap ID | Area | Description | Remediation | Target Date |
|--------|------|-------------|-------------|-------------|
| GAP-004 | CC1.1-1 | Code of conduct not documented | Create and distribute | Q1 2026 |
| GAP-005 | CC1.4-1 | Security training program | Develop training materials | Q1 2026 |
| GAP-006 | CC4.1-3 | Supabase audit logging | Enable and configure | Q1 2026 |
| GAP-007 | CC9.2-2 | SOC 2 reports not collected | Request from vendors | Q1 2026 |
| GAP-008 | CC6.6-1 | Access log review process | Establish review procedures | Q1 2026 |

### 15.3 Medium Priority Gaps (P2)

| Gap ID | Area | Description | Remediation | Target Date |
|--------|------|-------------|-------------|-------------|
| GAP-009 | CC3.1-2 | Formal threat modeling | Conduct threat analysis | Q2 2026 |
| GAP-010 | CC7.1-2 | Authentication failure alerting | Implement alerting | Q2 2026 |
| GAP-011 | CC7.5-1 | Service availability monitoring | Implement monitoring | Q2 2026 |
| GAP-012 | C1.3-2 | Secure deletion verification | Enhance deletion procedures | Q2 2026 |

---

## 16. Control Testing Schedule

### 16.1 Testing Frequency

| Control Category | Testing Frequency | Method |
|-----------------|-------------------|--------|
| Access Controls | Quarterly | Access review, penetration testing |
| Change Management | Continuous | CI/CD verification |
| Incident Response | Semi-annually | Tabletop exercises |
| Data Protection | Quarterly | Data inventory review |
| Vendor Management | Annually | Vendor assessment |

### 16.2 Annual Testing Calendar

| Q1 | Q2 | Q3 | Q4 |
|----|----|----|----|
| Access review | Penetration test | Access review | Penetration test |
| IRP tabletop | Vendor assessment | IRP tabletop | Annual audit prep |
| Data inventory | Control effectiveness | Data inventory | SOC 2 audit |

---

## 17. Document Control

### 17.1 Review Schedule

- **Quarterly:** Control status updates
- **Semi-annually:** Gap analysis review
- **Annually:** Full matrix review and update

### 17.2 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-25 | Security/Compliance Team | Initial document creation |

### 17.3 Related Documents

- [Data Retention Policy](./DATA_RETENTION_POLICY.md)
- [Privacy Policy](./PRIVACY_POLICY_DRAFT.md)
- [Incident Response Plan](./INCIDENT_RESPONSE_PLAN.md)
- [Vendor Inventory](./VENDOR_INVENTORY.md)

---

## Appendix A: Control Implementation Priority

```
+------------------------------------------+
|     CONTROL IMPLEMENTATION PRIORITY      |
+------------------------------------------+
| IMMEDIATE (P0):                          |
| - Database encryption at rest            |
| - Session timeout reduction              |
| - Privacy policy publication             |
+------------------------------------------+
| Q1 2026 (P1):                            |
| - Code of conduct                        |
| - Security training                      |
| - Vendor SOC 2 collection                |
| - Audit logging                          |
+------------------------------------------+
| Q2 2026 (P2):                            |
| - Threat modeling                        |
| - Authentication alerting                |
| - Availability monitoring                |
+------------------------------------------+
```

---

## Appendix B: Evidence Collection Checklist

For SOC 2 Type II audit, collect evidence for:

- [ ] Access control configurations
- [ ] Authentication logs
- [ ] Change management records (PRs, deployments)
- [ ] Incident response records
- [ ] Security training records
- [ ] Vendor assessment documentation
- [ ] Policy acknowledgments
- [ ] Penetration test reports
- [ ] Vulnerability scan results
- [ ] Data retention compliance records

---

*This document is confidential and intended for internal use only. Unauthorized distribution is prohibited.*
