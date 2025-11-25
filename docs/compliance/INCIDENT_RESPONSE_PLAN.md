# Incident Response Plan

**Magic Audit - Security Incident Response Plan**

> **NOTICE**: This document requires legal review before publication.

---

## Document Control

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Effective Date** | 2024-01-15 |
| **Last Review Date** | 2024-01-15 |
| **Next Review Date** | 2025-01-15 |
| **Author** | Security Team |
| **Approval Status** | Draft - Pending Legal Review |
| **Classification** | Internal Use Only |

---

## 1. Purpose and Scope

### 1.1 Purpose

This Incident Response Plan (IRP) establishes procedures for detecting, responding to, and recovering from security incidents affecting Magic Audit, its users, and their data. The plan ensures a consistent, coordinated approach to minimize damage, reduce recovery time, and protect sensitive real estate transaction data.

### 1.2 Scope

This plan applies to:
- All Magic Audit production systems and services
- Cloud infrastructure (Supabase database, authentication services)
- Third-party integrations (Google OAuth, Microsoft OAuth, Gmail API, Microsoft Graph API)
- User data including communications, transactions, and contact information
- Employee access to production systems
- Desktop application distribution and update mechanisms

### 1.3 Objectives

- Detect and identify security incidents promptly
- Contain and eradicate threats to minimize damage
- Recover operations and data integrity
- Document lessons learned and improve defenses
- Comply with legal and regulatory notification requirements
- Maintain user trust through transparent communication

---

## 2. Incident Classification

### 2.1 Severity Levels

| Priority | Severity | Description | Examples | Response Time |
|----------|----------|-------------|----------|---------------|
| **P1** | Critical | Data breach, complete service outage, active exploitation | Unauthorized access to user data, database compromise, malicious code in application update, OAuth token theft | Immediate (< 15 minutes) |
| **P2** | High | Partial outage, security event with potential data exposure | Failed authentication attacks, suspicious API access patterns, Supabase service degradation, code signing compromise | < 1 hour |
| **P3** | Medium | Degraded service, contained security event | Application performance issues, isolated failed login attempts, minor configuration drift | < 4 hours |
| **P4** | Low | Minor issues, potential vulnerabilities | Non-critical bugs, security advisory review, routine security findings | < 24 hours |

### 2.2 Incident Categories

| Category | Description | Magic Audit Specific Examples |
|----------|-------------|------------------------------|
| **Data Breach** | Unauthorized access to or disclosure of user data | Exposure of iMessage archives, email content, transaction details, contact information |
| **Account Compromise** | Unauthorized access to user or admin accounts | OAuth token theft, session hijacking, credential stuffing against Supabase Auth |
| **Malware/Malicious Code** | Presence of malicious software | Compromised application build, malicious dependency, tampered auto-update |
| **Denial of Service** | Service availability impact | API rate limiting abuse, Supabase connection exhaustion |
| **Insider Threat** | Malicious or negligent insider activity | Unauthorized database access, data exfiltration by employee |
| **Third-Party Compromise** | Security incident at vendor | Supabase breach, Google/Microsoft OAuth provider incident |
| **Physical Security** | Physical access or device theft | Developer workstation theft with signing keys |

---

## 3. Roles and Responsibilities

### 3.1 Incident Response Team

| Role | Responsibilities | Contact |
|------|------------------|---------|
| **Incident Commander (IC)** | Overall incident coordination, decision authority, external communications | [Designated on-call] |
| **Security Lead** | Technical investigation, forensics, containment actions | [Security Team Lead] |
| **Engineering Lead** | System access, technical remediation, deployment coordination | [Engineering Manager] |
| **Communications Lead** | User notifications, public statements, regulatory communications | [Communications/Legal] |
| **Legal Counsel** | Regulatory compliance, breach notification requirements, liability assessment | [Legal Contact] |

### 3.2 Escalation Matrix

| Severity | Primary Contact | Escalation (15 min) | Executive Escalation (30 min) |
|----------|-----------------|---------------------|------------------------------|
| P1 | On-call Engineer | Security Lead + IC | CEO + Legal |
| P2 | On-call Engineer | Security Lead | Engineering Manager |
| P3 | On-call Engineer | Engineering Lead | - |
| P4 | Support Team | On-call Engineer | - |

### 3.3 Contact Information

> **Note**: Actual contact information maintained in secure internal system. Update contact list quarterly.

---

## 4. Detection and Reporting

### 4.1 Detection Sources

| Source | Monitoring Method | Alert Threshold |
|--------|-------------------|-----------------|
| **Application Logs** | Electron-log file monitoring, structured logging | Error rate > 5%, security events |
| **Supabase Monitoring** | Dashboard alerts, API metrics | Failed auth > 10/min, unusual queries |
| **User Reports** | Support channels, feedback system | Any security concern |
| **Dependency Scanning** | npm audit, GitHub Dependabot | High/Critical vulnerabilities |
| **Code Signing Alerts** | Apple notarization service | Signing failures, revocation |
| **OAuth Provider Alerts** | Google/Microsoft security notifications | Token revocation, suspicious activity |

### 4.2 Reporting Procedures

**Internal Discovery:**
1. Document initial observations (time, symptoms, affected systems)
2. Assess potential severity using classification matrix
3. Report immediately through incident channel
4. Do not attempt remediation without coordination

**External Reports:**
1. Direct user reports to security@magicaudit.com
2. Log all details provided by reporter
3. Acknowledge receipt within 2 hours
4. Triage and assign severity

### 4.3 Initial Triage Checklist

- [ ] What systems/data are potentially affected?
- [ ] Is the incident ongoing or historical?
- [ ] What is the potential scope (number of users, data types)?
- [ ] Are there indicators of active exploitation?
- [ ] Is this a known vulnerability or novel threat?
- [ ] Are third-party vendors involved?

---

## 5. Response Procedures

### 5.1 Phase 1: Identification (0-30 minutes)

**Objectives:** Confirm incident, assess scope, activate response team

**Actions:**
1. Verify incident is genuine (not false positive)
2. Assign Incident Commander
3. Create incident tracking record
4. Begin incident timeline documentation
5. Preserve initial evidence (logs, screenshots, system state)
6. Determine affected Magic Audit components:
   - Desktop application
   - Supabase backend
   - OAuth integrations
   - User data categories

### 5.2 Phase 2: Containment (30 minutes - 4 hours)

**Objectives:** Limit damage, prevent spread, preserve evidence

**Short-term Containment:**
| Incident Type | Containment Action |
|---------------|-------------------|
| Compromised OAuth Tokens | Revoke affected tokens, force re-authentication |
| Database Breach | Rotate Supabase credentials, enable additional logging |
| Malicious Update | Halt auto-updater, publish security advisory |
| Account Compromise | Disable affected accounts, reset credentials |
| API Abuse | Implement emergency rate limits, block suspicious IPs |

**Evidence Preservation:**
- Export relevant Supabase logs
- Preserve application logs from affected systems
- Document system configurations
- Capture network traffic if available
- Maintain chain of custody documentation

### 5.3 Phase 3: Eradication (4-24 hours)

**Objectives:** Remove threat, patch vulnerabilities

**Actions:**
1. Identify root cause and attack vector
2. Remove malicious artifacts
3. Patch exploited vulnerabilities
4. Update affected dependencies
5. Rotate compromised credentials:
   - Supabase service keys
   - OAuth client secrets
   - Code signing certificates (if compromised)
6. Verify eradication through testing

### 5.4 Phase 4: Recovery (24-72 hours)

**Objectives:** Restore services, verify integrity

**Recovery Steps:**
1. Restore from known-good backups if necessary
2. Deploy patched application version
3. Re-enable disabled services incrementally
4. Monitor for recurrence with enhanced logging
5. Verify data integrity:
   - User account data
   - Transaction records
   - Communication archives
6. Confirm OAuth integrations functional

**User Communication:**
- Notify affected users before service restoration
- Provide clear instructions for any required user actions
- Establish support channel for incident-related questions

### 5.5 Phase 5: Post-Incident (72+ hours)

**Objectives:** Document lessons learned, improve defenses

**Actions:**
1. Complete incident documentation
2. Conduct post-incident review meeting
3. Update this IRP based on lessons learned
4. Implement preventive controls
5. Share anonymized learnings with team
6. Close incident tracking record

---

## 6. Communication Plan

### 6.1 Internal Communication

| Audience | Channel | Timing | Content |
|----------|---------|--------|---------|
| Incident Response Team | Dedicated incident channel | Immediate | Full technical details |
| Engineering Team | Team channel | After containment | Relevant technical context |
| All Employees | Company-wide | After severity confirmed | High-level summary |
| Board/Investors | Direct communication | P1/P2 incidents | Business impact assessment |

### 6.2 External Communication

| Audience | Channel | Timing | Content |
|----------|---------|--------|---------|
| Affected Users | Email + In-app notification | Within 72 hours of confirmation | Nature of incident, impact, remediation steps |
| All Users | Status page, blog | After containment | Transparency update |
| Regulators | Official notification | Per legal requirements | Formal incident report |
| Media | Press statement | Only if required | Approved statement only |

### 6.3 Notification Requirements

**Data Breach Notification:**
- California (CCPA): Notify affected California residents without unreasonable delay
- Other states: Follow applicable state breach notification laws
- Document notification decisions and timing

**Third-Party Notification:**
- Supabase: Report if incident originates from their services
- Google/Microsoft: Report OAuth-related incidents per their policies

### 6.4 Communication Templates

> **Note**: Pre-approved communication templates maintained in secure document repository. Templates cover:
> - Initial user notification
> - Follow-up status updates
> - Resolution confirmation
> - Regulatory notification letters

---

## 7. Post-Incident Review

### 7.1 Review Meeting

**Timing:** Within 5 business days of incident closure

**Attendees:** All IRT members involved, relevant stakeholders

**Agenda:**
1. Incident timeline review
2. What worked well
3. What could be improved
4. Root cause analysis
5. Action items and owners

### 7.2 Documentation Requirements

| Document | Owner | Deadline |
|----------|-------|----------|
| Incident Timeline | Incident Commander | 48 hours post-incident |
| Technical Analysis | Security Lead | 5 business days |
| Root Cause Report | Engineering Lead | 5 business days |
| Lessons Learned Summary | Incident Commander | 10 business days |
| Control Improvements | Security Lead | 30 days |

### 7.3 Metrics Tracking

- Mean Time to Detect (MTTD)
- Mean Time to Respond (MTTR)
- Mean Time to Recover
- Number of users affected
- Data categories exposed
- Root cause category
- Preventability assessment

---

## 8. Document Control

### 8.1 Review and Updates

This plan shall be reviewed:
- Annually at minimum
- After every P1 or P2 incident
- When significant changes occur to Magic Audit architecture
- When new compliance requirements emerge

### 8.2 Testing

| Test Type | Frequency | Description |
|-----------|-----------|-------------|
| Tabletop Exercise | Quarterly | Scenario-based discussion with IRT |
| Technical Drill | Semi-annually | Simulated incident with system actions |
| Full Exercise | Annually | End-to-end response simulation |

### 8.3 Related Documents

- [Data Retention Policy](./DATA_RETENTION_POLICY.md)
- [Privacy Policy](./PRIVACY_POLICY_DRAFT.md)
- [Vendor Inventory](./VENDOR_INVENTORY.md)
- [SOC 2 Controls Matrix](./SOC2_CONTROLS_MATRIX.md)
- Security Review (../SECURITY_REVIEW.md)
- Production Readiness (../PRODUCTION_READINESS.md)

### 8.4 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-15 | Security Team | Initial version |

---

## Appendix A: Incident Response Checklist

### P1 Critical Incident Checklist

- [ ] Confirm incident and assess initial scope
- [ ] Page Incident Commander immediately
- [ ] Establish incident communication channel
- [ ] Begin timeline documentation
- [ ] Implement immediate containment measures
- [ ] Notify executive leadership
- [ ] Engage legal counsel for breach assessment
- [ ] Preserve all relevant evidence
- [ ] Prepare initial internal communication
- [ ] Assess regulatory notification requirements
- [ ] Draft user communication (pending legal review)
- [ ] Continue monitoring for incident expansion

### Evidence Collection Checklist

- [ ] Supabase database logs and audit trail
- [ ] Application error logs (electron-log files)
- [ ] Authentication logs (OAuth events)
- [ ] API access logs
- [ ] System configuration snapshots
- [ ] Network traffic captures (if available)
- [ ] User reports and support tickets
- [ ] Third-party vendor communications

---

## Appendix B: Contact Quick Reference

> **Security Incident Hotline:** [Internal number]
> **Security Email:** security@magicaudit.com
> **On-Call Rotation:** [Link to schedule]
> **Incident Tracking System:** [Link to system]

---

*This document is proprietary to Magic Audit and intended for internal use only.*
