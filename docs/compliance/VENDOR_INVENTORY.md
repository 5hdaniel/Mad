# Vendor Inventory

> **Document Control**
> | Field | Value |
> |-------|-------|
> | Version | 1.0 |
> | Effective Date | 2025-11-25 |
> | Last Review | 2025-11-25 |
> | Author | Security/Compliance Team |
> | Approval Status | DRAFT - Requires Legal Review |
> | Next Review | 2026-05-25 |

> **NOTICE:** This document requires legal review before publication. Data Processing Agreements (DPAs) should be executed with all vendors processing personal data.

---

## 1. Overview

This document maintains an inventory of all third-party vendors and service providers used by Magic Audit that process, store, or have access to customer data. This inventory supports SOC 2 compliance and vendor risk management requirements.

### 1.1 Purpose

- Track all third-party service providers
- Document data flows to external parties
- Ensure appropriate security and privacy controls
- Support audit and compliance requirements
- Enable vendor risk assessment

### 1.2 Vendor Classification

| Risk Level | Criteria | Review Frequency |
|------------|----------|------------------|
| **Critical** | Processes or stores customer PII, core infrastructure | Quarterly |
| **High** | Access to customer data, security-relevant service | Semi-annually |
| **Medium** | Limited data access, operational service | Annually |
| **Low** | No customer data access, development/tooling | Annually |

---

## 2. Critical Vendors

### 2.1 Supabase

| Field | Details |
|-------|---------|
| **Vendor Name** | Supabase, Inc. |
| **Service Type** | Cloud Database, Authentication, Analytics |
| **Risk Classification** | Critical |
| **Purpose** | User account management, subscription data, device registration, usage analytics |
| **Data Processed** | User profiles (email, name), device information, usage events, subscription status, license data |
| **Data Classification** | Personal, Business |
| **SOC 2 Status** | SOC 2 Type II available - [Request latest report] |
| **DPA Status** | Required - [To be executed] |
| **Data Location** | [To be confirmed - request from Supabase] |
| **Encryption** | At rest: AES-256, In transit: TLS 1.2+ |
| **Access Controls** | Row Level Security (RLS), API key authentication |
| **Retention** | Per Magic Audit retention policy |
| **Subprocessors** | AWS (infrastructure), Cloudflare (CDN) |
| **Contract Start** | [To be added] |
| **Contract Renewal** | [To be added] |
| **Primary Contact** | support@supabase.io |
| **Security Contact** | security@supabase.io |
| **Last Review** | 2025-11-25 |

**Action Items:**
- [ ] Request current SOC 2 Type II report
- [ ] Execute Data Processing Agreement
- [ ] Confirm data residency location
- [ ] Review subprocessor list
- [ ] Document RLS policy configuration

---

### 2.2 Google (Google Cloud / Workspace APIs)

| Field | Details |
|-------|---------|
| **Vendor Name** | Google LLC |
| **Service Type** | OAuth Authentication, Gmail API |
| **Risk Classification** | Critical |
| **Purpose** | User authentication, Gmail content access for email archiving |
| **Data Processed** | User email address, name, profile picture, Gmail message content (with user authorization) |
| **Data Classification** | Personal, Business |
| **SOC 2 Status** | SOC 2 Type II available - [Google Cloud compliance page] |
| **DPA Status** | Standard Google Terms include DPA provisions |
| **Data Location** | Global (Google infrastructure) |
| **Encryption** | In transit: TLS 1.3, At rest: AES-256 |
| **Access Controls** | OAuth 2.0, user consent required, scopes limited to read-only |
| **Retention** | Tokens stored locally; Gmail data imported per user action |
| **API Compliance** | Google API Services User Data Policy, Limited Use requirements |
| **Contract Type** | Google API Terms of Service |
| **Primary Contact** | Google Cloud Console |
| **Security Contact** | security@google.com |
| **Last Review** | 2025-11-25 |

**Data Flow:**
1. User initiates Google OAuth flow
2. User consents to requested scopes (Gmail read)
3. Magic Audit receives OAuth tokens (stored locally, encrypted)
4. Gmail messages fetched via API, stored in local database
5. No Gmail data sent to Magic Audit servers

**API Scopes Used:**
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

**Action Items:**
- [ ] Complete Google API verification (if required for production)
- [ ] Document compliance with Limited Use requirements
- [ ] Implement OAuth token refresh monitoring

---

### 2.3 Microsoft (Azure AD / Microsoft Graph)

| Field | Details |
|-------|---------|
| **Vendor Name** | Microsoft Corporation |
| **Service Type** | OAuth Authentication, Microsoft Graph API (Outlook) |
| **Risk Classification** | Critical |
| **Purpose** | User authentication, Outlook email access for email archiving |
| **Data Processed** | User email address, name, profile picture, Outlook message content (with user authorization) |
| **Data Classification** | Personal, Business |
| **SOC 2 Status** | SOC 2 Type II available - [Microsoft Trust Center] |
| **DPA Status** | Microsoft Online Services DPA (standard) |
| **Data Location** | Global (Microsoft Azure infrastructure) |
| **Encryption** | In transit: TLS 1.2+, At rest: AES-256 |
| **Access Controls** | OAuth 2.0, Azure AD, user consent required |
| **Retention** | Tokens stored locally; Outlook data imported per user action |
| **Contract Type** | Microsoft Graph API Terms |
| **Primary Contact** | Azure Portal |
| **Security Contact** | secure@microsoft.com |
| **Last Review** | 2025-11-25 |

**Data Flow:**
1. User initiates Microsoft OAuth flow
2. User consents to requested permissions (Mail.Read)
3. Magic Audit receives OAuth tokens (stored locally, encrypted)
4. Outlook messages fetched via Microsoft Graph, stored in local database
5. No Outlook data sent to Magic Audit servers

**Graph Permissions Used:**
- `Mail.Read`
- `User.Read`
- `offline_access`

**Action Items:**
- [ ] Review Azure AD app registration settings
- [ ] Verify publisher verification status
- [ ] Document permission justification

---

## 3. High Risk Vendors

### 3.1 GitHub

| Field | Details |
|-------|---------|
| **Vendor Name** | GitHub, Inc. (Microsoft subsidiary) |
| **Service Type** | Source Code Repository, Application Distribution, Auto-Updates |
| **Risk Classification** | High |
| **Purpose** | Application releases, auto-update distribution, source code management |
| **Data Processed** | Update check requests (app version, OS), release binaries |
| **Data Classification** | Internal |
| **SOC 2 Status** | SOC 2 Type II available |
| **DPA Status** | GitHub Terms of Service |
| **Data Location** | United States |
| **Encryption** | In transit: TLS 1.2+ |
| **Access Controls** | Repository access controls, signed releases |
| **Contract Type** | GitHub Terms of Service |
| **Primary Contact** | GitHub Support |
| **Security Contact** | security@github.com |
| **Last Review** | 2025-11-25 |

**Update Mechanism:**
- electron-updater checks GitHub Releases for new versions
- User opts in to auto-updates
- Binaries signed with developer certificate

**Action Items:**
- [ ] Implement release signing verification
- [ ] Document update check data minimization

---

### 3.2 Google Places API

| Field | Details |
|-------|---------|
| **Vendor Name** | Google LLC |
| **Service Type** | Address Verification API |
| **Risk Classification** | High |
| **Purpose** | Property address validation and geocoding |
| **Data Processed** | Property addresses entered by users |
| **Data Classification** | Business |
| **SOC 2 Status** | SOC 2 Type II available (Google Cloud) |
| **DPA Status** | Google API Terms |
| **Data Location** | Global |
| **Encryption** | In transit: TLS 1.3 |
| **API Compliance** | Google Maps Platform Terms |
| **Primary Contact** | Google Cloud Console |
| **Last Review** | 2025-11-25 |

**Action Items:**
- [ ] Review Google Maps Platform Terms compliance
- [ ] Implement API usage monitoring
- [ ] Document data minimization practices

---

## 4. Medium Risk Vendors

### 4.1 Electron

| Field | Details |
|-------|---------|
| **Vendor Name** | OpenJS Foundation |
| **Service Type** | Application Framework |
| **Risk Classification** | Medium |
| **Purpose** | Desktop application framework |
| **Data Processed** | None directly; provides runtime environment |
| **Data Classification** | N/A |
| **Security Updates** | Regular releases, CVE monitoring |
| **Contract Type** | MIT License |
| **Last Review** | 2025-11-25 |

**Action Items:**
- [ ] Subscribe to Electron security advisories
- [ ] Maintain regular update schedule

---

### 4.2 npm (Node Package Manager)

| Field | Details |
|-------|---------|
| **Vendor Name** | GitHub, Inc. (npm) |
| **Service Type** | Package Registry |
| **Risk Classification** | Medium |
| **Purpose** | Dependency management |
| **Data Processed** | Package download requests |
| **Data Classification** | Internal |
| **Security Features** | npm audit, package signing |
| **Contract Type** | npm Terms of Service |
| **Last Review** | 2025-11-25 |

**Action Items:**
- [ ] Enable npm audit in CI/CD pipeline
- [ ] Review dependency tree regularly
- [ ] Monitor Dependabot alerts

---

## 5. Low Risk Vendors

### 5.1 Development Tools

| Vendor | Service | Purpose | Data Access |
|--------|---------|---------|-------------|
| **Vite** | Build tool | Application bundling | Source code only |
| **TypeScript** | Language | Type checking | Source code only |
| **ESLint** | Linter | Code quality | Source code only |
| **Jest** | Testing | Test execution | Test data only |
| **Tailwind CSS** | Styling | CSS framework | No data access |

---

## 6. Vendor Risk Assessment

### 6.1 Assessment Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| **Data Sensitivity** | 30% | Type and volume of data processed |
| **Security Posture** | 25% | SOC 2, security certifications |
| **Business Criticality** | 20% | Impact of vendor failure |
| **Contract Terms** | 15% | DPA, liability, termination |
| **Financial Stability** | 10% | Vendor viability |

### 6.2 Risk Matrix Summary

| Vendor | Data Sensitivity | Security | Criticality | Overall Risk |
|--------|-----------------|----------|-------------|--------------|
| Supabase | High | High | Critical | Critical |
| Google | High | High | High | Critical |
| Microsoft | High | High | High | Critical |
| GitHub | Low | High | Medium | High |
| Google Places | Medium | High | Low | Medium |

---

## 7. Vendor Management Procedures

### 7.1 Onboarding New Vendors

1. **Initial Assessment**
   - Complete vendor questionnaire
   - Review security certifications (SOC 2, ISO 27001)
   - Assess data processing requirements

2. **Due Diligence**
   - Review privacy policy and terms of service
   - Evaluate security practices
   - Check for regulatory compliance

3. **Contract Review**
   - Execute Data Processing Agreement (if applicable)
   - Review liability and indemnification terms
   - Document data handling requirements

4. **Technical Integration**
   - Implement least-privilege access
   - Configure security controls
   - Document data flows

5. **Approval and Documentation**
   - Obtain security team approval
   - Add to vendor inventory
   - Schedule review date

### 7.2 Ongoing Monitoring

| Activity | Frequency | Responsible |
|----------|-----------|-------------|
| Security certification review | Annually | Security Team |
| Contract review | At renewal | Legal |
| Access audit | Quarterly | Security Team |
| Subprocessor changes review | As notified | Compliance |
| Incident monitoring | Continuous | Security Team |

### 7.3 Vendor Offboarding

1. Terminate access and API keys
2. Request data deletion confirmation
3. Update vendor inventory
4. Document offboarding completion

---

## 8. Data Flow Diagram

```
+------------------+
|   Magic Audit    |
|  (User Device)   |
+--------+---------+
         |
         |  User Account Data
         |  Analytics Events
         v
+------------------+
|    Supabase      |
|  (Cloud DB)      |
+------------------+

+------------------+
|   Magic Audit    |
|  (User Device)   |
+--------+---------+
         |
         |  OAuth (User Consent)
         |  Email Import
         v
+--------+---------+--------+
|                           |
v                           v
+------------------+  +------------------+
|   Google APIs    |  | Microsoft Graph  |
|   (Gmail)        |  |   (Outlook)      |
+------------------+  +------------------+

+------------------+
|   Magic Audit    |
|  (User Device)   |
+--------+---------+
         |
         |  Address Lookup
         v
+------------------+
| Google Places API|
+------------------+

+------------------+
|   Magic Audit    |
|  (User Device)   |
+--------+---------+
         |
         |  Update Check
         v
+------------------+
| GitHub Releases  |
+------------------+
```

---

## 9. Document Control

### 9.1 Review Schedule

| Review Type | Frequency | Responsible |
|-------------|-----------|-------------|
| Full Inventory Review | Semi-annual | Security Team |
| Critical Vendor Review | Quarterly | Security Team |
| Contract Renewal Review | As needed | Legal |
| Security Incident Review | As needed | Security Team |

### 9.2 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-25 | Security/Compliance Team | Initial document creation |

### 9.3 Related Documents

- [Data Retention Policy](./DATA_RETENTION_POLICY.md)
- [Privacy Policy](./PRIVACY_POLICY_DRAFT.md)
- [Incident Response Plan](./INCIDENT_RESPONSE_PLAN.md)
- [SOC 2 Controls Matrix](./SOC2_CONTROLS_MATRIX.md)

---

## Appendix A: Vendor Contact Quick Reference

| Vendor | Support | Security | Emergency |
|--------|---------|----------|-----------|
| Supabase | support@supabase.io | security@supabase.io | - |
| Google | Cloud Console | security@google.com | - |
| Microsoft | Azure Portal | secure@microsoft.com | - |
| GitHub | support.github.com | security@github.com | - |

---

## Appendix B: DPA Status Tracker

| Vendor | DPA Required | DPA Status | Execution Date | Renewal Date |
|--------|--------------|------------|----------------|--------------|
| Supabase | Yes | To be executed | - | - |
| Google | Yes | Standard Terms | - | - |
| Microsoft | Yes | Standard Terms | - | - |
| GitHub | No | - | - | - |
| Google Places | No | - | - | - |

---

## Appendix C: SOC 2 Report Tracker

| Vendor | Report Type | Report Period | Received | Review Date |
|--------|-------------|---------------|----------|-------------|
| Supabase | Type II | [Request] | Pending | - |
| Google Cloud | Type II | [Request] | Pending | - |
| Microsoft Azure | Type II | [Request] | Pending | - |
| GitHub | Type II | Available | Pending | - |

---

*This document is confidential and intended for internal use only. Unauthorized distribution is prohibited.*
