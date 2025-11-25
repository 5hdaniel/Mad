# Incident Response Plan

> **Document Control**
> | Field | Value |
> |-------|-------|
> | Version | 1.0 |
> | Effective Date | 2025-11-25 |
> | Last Review | 2025-11-25 |
> | Author | Security Team |
> | Approval Status | DRAFT - Requires Legal Review |
> | Next Review | 2026-05-25 |

> **NOTICE:** This document requires legal review before publication. All policies must be reviewed by legal counsel prior to implementation.

---

## 1. Purpose and Scope

### 1.1 Purpose

This Incident Response Plan (IRP) establishes a structured approach for identifying, responding to, containing, and recovering from security incidents affecting Magic Audit, its systems, and its users. The plan ensures:

- Rapid detection and response to security events
- Minimization of damage and data loss
- Proper evidence preservation for forensic analysis
- Compliance with legal and regulatory notification requirements
- Continuous improvement through post-incident review

### 1.2 Scope

This plan applies to:

- **Systems**: Magic Audit desktop application, Supabase cloud infrastructure, OAuth integrations (Google, Microsoft), and supporting services
- **Data**: User account information, transaction records, communication archives (emails, iMessages), OAuth tokens, and analytics data
- **Personnel**: All employees, contractors, and third-party service providers with access to Magic Audit systems
- **Locations**: All environments where Magic Audit systems are accessed or data is processed

### 1.3 Definitions

| Term | Definition |
|------|------------|
| **Security Incident** | Any event that compromises the confidentiality, integrity, or availability of Magic Audit systems or data |
| **Data Breach** | Unauthorized access to, acquisition of, or disclosure of personal data |
| **Indicator of Compromise (IOC)** | Evidence that a security incident has occurred |
| **Mean Time to Detect (MTTD)** | Average time to identify a security incident |
| **Mean Time to Respond (MTTR)** | Average time to contain and remediate a security incident |

---

## 2. Incident Classification

### 2.1 Severity Levels

| Priority | Severity | Description | Examples | Response Time |
|----------|----------|-------------|----------|---------------|
| **P1** | Critical | Complete system compromise, active data breach, widespread service outage | Database breach exposing user data, ransomware attack, complete authentication system failure | Immediate (< 15 min) |
| **P2** | High | Partial system compromise, security event with potential data exposure, major service degradation | Unauthorized access attempt detected, OAuth token compromise, single-service outage | < 1 hour |
| **P3** | Medium | Contained security event, degraded service affecting subset of users | Failed login spike, minor service degradation, suspicious but contained activity | < 4 hours |
| **P4** | Low | Minor security issues, no immediate threat | Single failed authentication, minor misconfiguration, security advisory for dependencies | < 24 hours |

### 2.2 Incident Categories

| Category | Description | Classification Criteria |
|----------|-------------|------------------------|
| **Data Breach** | Unauthorized access to user data | Any confirmed access to PII, transaction records, or communications |
| **System Compromise** | Unauthorized access to systems | Evidence of unauthorized code execution, backdoors, or privilege escalation |
| **Denial of Service** | Service availability impact | Intentional attacks affecting service availability |
| **Insider Threat** | Malicious internal activity | Employee or contractor misconduct |
| **Third-Party Breach** | Vendor security incident | Supabase, Google, Microsoft, or other vendor compromise affecting Magic Audit |
| **Credential Compromise** | Authentication breach | Leaked or stolen credentials, OAuth token theft |
| **Malware** | Malicious software detection | Virus, ransomware, or trojan affecting systems |

---

## 3. Roles and Responsibilities

### 3.1 Incident Response Team (IRT)

| Role | Responsibilities | Contact Method |
|------|-----------------|----------------|
| **Incident Commander (IC)** | Overall incident coordination, decision authority, executive communication | Primary escalation contact |
| **Security Lead** | Technical investigation, forensic analysis, containment implementation | Security team Slack channel |
| **Engineering Lead** | System recovery, patch deployment, technical remediation | Engineering on-call rotation |
| **Communications Lead** | Internal/external communications, customer notification, PR coordination | Communications team |
| **Legal Counsel** | Regulatory compliance, breach notification requirements, evidence preservation | Legal team |
| **Executive Sponsor** | Strategic decisions, resource allocation, board communication | Executive team |

### 3.2 Escalation Matrix

```
P1 (Critical): IC + Security Lead + Engineering Lead + Legal + Executive (immediately)
P2 (High):     IC + Security Lead + Engineering Lead (within 1 hour)
P3 (Medium):   Security Lead + Engineering Lead (within 4 hours)
P4 (Low):      Security team during business hours
```

### 3.3 On-Call Rotation

- Primary on-call engineer available 24/7
- Secondary backup during off-hours
- Rotation schedule maintained in team calendar
- Maximum response time: 15 minutes for P1/P2 pages

---

## 4. Detection and Reporting

### 4.1 Detection Sources

| Source | Monitoring Method | Alert Threshold |
|--------|-------------------|-----------------|
| **Application Logs** | Electron logService, structured logging | Error rate > 5%, security events |
| **Supabase Monitoring** | Database logs, RLS violations | Unauthorized access attempts |
| **OAuth Provider Alerts** | Google/Microsoft security notifications | Account compromise alerts |
| **User Reports** | In-app feedback, support tickets | Any security concern |
| **Dependency Scanning** | GitHub Dependabot, npm audit | High/Critical vulnerabilities |
| **External Intelligence** | Security bulletins, vendor notifications | Relevant threat indicators |

### 4.2 Reporting Channels

**Internal Reporting:**
- Security team Slack channel: `#security-incidents`
- Email: security@magicaudit.com
- On-call pager for P1/P2 incidents

**External Reporting:**
- User security concerns: security@magicaudit.com
- Responsible disclosure: security@magicaudit.com
- Bug bounty program (if applicable)

### 4.3 Initial Report Template

```markdown
## Incident Report

**Reporter:** [Name]
**Date/Time Detected:** [ISO 8601 format]
**Detection Method:** [How was the incident discovered?]

### Incident Summary
[Brief description of the incident]

### Affected Systems
- [ ] Magic Audit Desktop App
- [ ] Supabase Cloud Database
- [ ] Google OAuth/Gmail Integration
- [ ] Microsoft OAuth/Outlook Integration
- [ ] User Data
- [ ] Other: ___________

### Initial Assessment
- **Estimated Severity:** P1 / P2 / P3 / P4
- **Data Potentially Affected:** [Yes/No/Unknown]
- **Users Potentially Affected:** [Number/Unknown]
- **Ongoing Threat:** [Yes/No/Unknown]

### Immediate Actions Taken
[List any immediate response actions]
```

---

## 5. Response Procedures

### 5.1 Phase 1: Identification (0-30 minutes for P1/P2)

**Objectives:**
- Confirm the incident is genuine
- Determine initial scope and severity
- Activate appropriate response team

**Actions:**
1. [ ] Acknowledge alert and begin investigation
2. [ ] Review relevant logs (application, database, authentication)
3. [ ] Confirm or rule out false positive
4. [ ] Assign severity level using classification matrix
5. [ ] Notify appropriate team members per escalation matrix
6. [ ] Create incident ticket with unique identifier
7. [ ] Begin incident timeline documentation

### 5.2 Phase 2: Containment (30 min - 2 hours for P1/P2)

**Short-Term Containment:**
1. [ ] Isolate affected systems (if possible without additional damage)
2. [ ] Revoke compromised credentials/tokens
3. [ ] Block malicious IP addresses or accounts
4. [ ] Disable affected services (if necessary)
5. [ ] Preserve evidence before changes (snapshots, logs)

**Long-Term Containment:**
1. [ ] Implement temporary security controls
2. [ ] Apply emergency patches if available
3. [ ] Enable enhanced monitoring
4. [ ] Prepare clean systems for recovery

**Magic Audit Specific Actions:**

| Scenario | Containment Actions |
|----------|---------------------|
| **OAuth Token Compromise** | Revoke tokens via provider console, force user re-authentication, rotate API credentials |
| **Database Breach** | Enable Supabase audit logging, review RLS policies, rotate service keys |
| **Local Database Exposure** | Release emergency app update with enhanced encryption, notify affected users |
| **Session Hijacking** | Invalidate all active sessions, reduce session timeout, enable additional verification |

### 5.3 Phase 3: Eradication (2-24 hours for P1/P2)

**Actions:**
1. [ ] Identify root cause of the incident
2. [ ] Remove malware, backdoors, or unauthorized access
3. [ ] Patch vulnerabilities that enabled the incident
4. [ ] Update detection rules to prevent recurrence
5. [ ] Verify eradication through security scanning
6. [ ] Document all eradication actions

### 5.4 Phase 4: Recovery (24-72 hours for P1/P2)

**Actions:**
1. [ ] Restore systems from clean backups (if needed)
2. [ ] Verify system integrity before restoration
3. [ ] Implement enhanced monitoring for recurrence
4. [ ] Gradually restore services with validation
5. [ ] Confirm business operations are normal
6. [ ] Continue monitoring for signs of persistence

**Recovery Validation Checklist:**
- [ ] All affected systems patched and updated
- [ ] Authentication systems verified
- [ ] Database integrity confirmed
- [ ] User data accessible and unmodified
- [ ] Application functionality tested
- [ ] Enhanced logging enabled

### 5.5 Phase 5: Lessons Learned (Within 1 week of resolution)

**Post-Incident Review Meeting:**
- Schedule within 5 business days of incident closure
- All IRT members required
- Document findings in post-mortem report

**Review Topics:**
1. Incident timeline reconstruction
2. Detection effectiveness (MTTD analysis)
3. Response effectiveness (MTTR analysis)
4. What worked well
5. What could be improved
6. Recommended preventive measures
7. Documentation updates needed

---

## 6. Communication Plan

### 6.1 Internal Communication

| Audience | Timing | Channel | Content |
|----------|--------|---------|---------|
| IRT Members | Immediately | Slack/Page | Full incident details |
| Engineering Team | Within 1 hour (P1/P2) | Slack | Technical summary, action items |
| All Employees | Within 4 hours (P1/P2) | Email | General awareness, talking points |
| Executive Team | Within 2 hours (P1/P2) | Direct call | Business impact, response status |

### 6.2 External Communication

| Audience | Timing | Channel | Authority |
|----------|--------|---------|-----------|
| Affected Users | Per legal requirements | Email, in-app notification | Communications Lead + Legal |
| Regulatory Bodies | Per legal requirements | Formal notification | Legal Counsel |
| Media | As needed | Press release | Communications Lead + Executive |
| Law Enforcement | If warranted | Direct contact | Legal Counsel |

### 6.3 Breach Notification Requirements

**United States:**
- State breach notification laws vary (typically 30-60 days)
- California (CCPA/CPRA): 72 hours for certain breaches
- Financial data: May trigger additional requirements

**Communication Template for Users:**
```
Subject: Important Security Notice from Magic Audit

Dear [User],

We are writing to inform you of a security incident that may have affected your account...

[Incident description - factual, clear, non-technical]

What Information Was Involved:
[List specific data types affected]

What We Are Doing:
[Response actions taken]

What You Can Do:
[Recommended user actions]

[Contact information for questions]

Sincerely,
Magic Audit Security Team
```

---

## 7. Post-Incident Review

### 7.1 Post-Mortem Report Template

```markdown
# Post-Incident Report: [Incident ID]

## Executive Summary
[2-3 sentence overview]

## Incident Timeline
| Time (UTC) | Event |
|------------|-------|
| [Time] | [Event description] |

## Root Cause Analysis
[Detailed technical analysis]

## Impact Assessment
- Users affected: [Number]
- Data compromised: [Yes/No, type]
- Business impact: [Description]
- Financial impact: [Estimate if applicable]

## Response Evaluation
- MTTD: [Time to detect]
- MTTR: [Time to resolve]
- Response effectiveness: [Assessment]

## Lessons Learned
1. [Lesson 1]
2. [Lesson 2]

## Corrective Actions
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action item] | [Name] | [Date] | [Status] |

## Appendices
- Relevant logs
- Communication records
- Technical artifacts
```

### 7.2 Metrics and KPIs

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| MTTD (Mean Time to Detect) | < 1 hour (P1/P2) | Incident timeline |
| MTTR (Mean Time to Respond) | < 4 hours (P1/P2) | Incident timeline |
| Incidents per quarter | Decreasing trend | Incident tracking |
| Post-mortems completed | 100% for P1/P2 | Documentation audit |
| Action items completed | 100% within deadline | Task tracking |

---

## 8. Document Control

### 8.1 Review Schedule

- **Annual Review**: Full document review and update
- **Post-Incident Review**: Update procedures based on lessons learned
- **Regulatory Changes**: Update as laws and regulations change
- **System Changes**: Update when significant system changes occur

### 8.2 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-25 | Security Team | Initial document creation |

### 8.3 Distribution

This document is distributed to:
- All members of the Incident Response Team
- Engineering leadership
- Executive team
- Legal counsel
- Stored in secure document repository with access controls

### 8.4 Testing

- **Tabletop Exercises**: Quarterly simulation of incident scenarios
- **Technical Drills**: Semi-annual testing of technical response procedures
- **Communication Tests**: Annual test of notification systems and escalation paths

---

## Appendix A: Quick Reference Card

```
+------------------------------------------+
|        INCIDENT RESPONSE QUICK REF       |
+------------------------------------------+
| P1 CRITICAL: Respond in 15 min           |
| P2 HIGH:     Respond in 1 hour           |
| P3 MEDIUM:   Respond in 4 hours          |
| P4 LOW:      Respond in 24 hours         |
+------------------------------------------+
| STEPS:                                   |
| 1. IDENTIFY - Confirm & classify         |
| 2. CONTAIN  - Stop the bleeding          |
| 3. ERADICATE - Remove the threat         |
| 4. RECOVER  - Restore operations         |
| 5. REVIEW   - Learn & improve            |
+------------------------------------------+
| CONTACTS:                                |
| Security Team: #security-incidents       |
| On-Call Page: [pager system]             |
| Email: security@magicaudit.com           |
+------------------------------------------+
```

---

## Appendix B: Related Documents

- [Data Retention Policy](./DATA_RETENTION_POLICY.md)
- [Privacy Policy](./PRIVACY_POLICY_DRAFT.md)
- [Vendor Inventory](./VENDOR_INVENTORY.md)
- [SOC 2 Controls Matrix](./SOC2_CONTROLS_MATRIX.md)
- Business Continuity Plan (to be developed)
- Disaster Recovery Plan (to be developed)

---

*This document is confidential and intended for internal use only. Unauthorized distribution is prohibited.*
