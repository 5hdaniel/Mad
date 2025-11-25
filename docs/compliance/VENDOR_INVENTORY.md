# Vendor Inventory

**Magic Audit - Third-Party Vendor Inventory**

> **NOTICE**: This document requires legal review before publication. All vendor assessments should be verified with current documentation from each provider.

---

## Document Control

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Effective Date** | 2024-01-15 |
| **Last Review Date** | 2024-01-15 |
| **Next Review Date** | 2024-07-15 |
| **Author** | Security Team |
| **Approval Status** | Draft - Pending Review |
| **Classification** | Internal Use Only |

---

## 1. Overview

This document inventories all third-party vendors and service providers that process, store, or have access to Magic Audit data. Each vendor has been assessed for SOC 2 compliance, data processing agreements (DPA), and security posture.

### 1.1 Vendor Risk Categories

| Category | Description | Review Frequency |
|----------|-------------|------------------|
| **Critical** | Core infrastructure, processes sensitive data | Quarterly |
| **High** | Authentication, processes PII | Semi-annually |
| **Medium** | Supporting services, limited data access | Annually |
| **Low** | Minimal data access, non-essential | Annually |

---

## 2. Critical Vendors

### 2.1 Supabase

| Field | Details |
|-------|---------|
| **Vendor Name** | Supabase Inc. |
| **Purpose** | Cloud database (PostgreSQL), authentication sync, real-time subscriptions, analytics storage, API usage tracking |
| **Data Processed** | User profiles, subscription data, device registration, usage analytics, audit logs |
| **Data Sensitivity** | High - Contains PII (email, name), account data, behavioral data |
| **Integration Type** | SDK (@supabase/supabase-js), REST API |
| **SOC 2 Status** | SOC 2 Type II certified |
| **SOC 2 Report** | Request via https://supabase.com/security |
| **DPA Status** | Required - Standard DPA available |
| **DPA Location** | https://supabase.com/legal/dpa |
| **Data Location** | AWS US regions (configurable per project) |
| **Encryption** | TLS 1.2+ in transit, AES-256 at rest |
| **Backup** | Automated daily backups with point-in-time recovery |
| **Subprocessors** | AWS, Cloudflare (see Supabase subprocessor list) |
| **Contract Type** | SaaS subscription |
| **Contract Renewal** | Annual |
| **Primary Contact** | support@supabase.io |
| **Security Contact** | security@supabase.io |
| **Last Assessment** | [Date of last review] |
| **Risk Level** | Critical |

**Action Items:**
- [ ] Obtain latest SOC 2 Type II report
- [ ] Execute DPA
- [ ] Confirm data residency settings
- [ ] Review subprocessor list

---

## 3. High-Risk Vendors

### 3.1 Google Cloud / Google APIs

| Field | Details |
|-------|---------|
| **Vendor Name** | Google LLC |
| **Purpose** | OAuth 2.0 authentication, Gmail API access, Google Places API, Google Maps Geocoding API |
| **Data Processed** | User authentication tokens, email content and metadata (Gmail), address validation data |
| **Data Sensitivity** | High - OAuth tokens, email content (sensitive communications) |
| **Integration Type** | OAuth 2.0, REST APIs (googleapis npm package) |
| **SOC 2 Status** | SOC 2 Type II certified |
| **SOC 2 Report** | Available via Google Cloud compliance portal |
| **ISO 27001** | Certified |
| **DPA Status** | Required - Google Cloud DPA |
| **DPA Location** | https://cloud.google.com/terms/data-processing-addendum |
| **Data Location** | Global (Google data centers) |
| **Encryption** | TLS 1.3 in transit, AES-256 at rest |
| **Data Retention** | Per Google's data retention policies |
| **Contract Type** | API Terms of Service, Cloud Services Agreement (if applicable) |
| **Primary Contact** | Google Cloud Support |
| **Security Contact** | https://www.google.com/about/appsecurity/ |
| **Last Assessment** | [Date of last review] |
| **Risk Level** | High |

**API Scopes Used:**
- `https://www.googleapis.com/auth/gmail.readonly` - Read email content
- `https://www.googleapis.com/auth/userinfo.email` - User email address
- `https://www.googleapis.com/auth/userinfo.profile` - User profile information
- `https://maps.googleapis.com/maps/api/geocode` - Address geocoding
- `https://maps.googleapis.com/maps/api/place` - Place details

**Action Items:**
- [ ] Verify OAuth consent screen compliance
- [ ] Review API scope minimization
- [ ] Obtain SOC 2 report from Google Cloud compliance
- [ ] Verify DPA execution

---

### 3.2 Microsoft Azure / Microsoft Graph

| Field | Details |
|-------|---------|
| **Vendor Name** | Microsoft Corporation |
| **Purpose** | OAuth 2.0 authentication (Azure AD), Microsoft Graph API access for Outlook email |
| **Data Processed** | User authentication tokens, email content and metadata (Outlook), calendar data |
| **Data Sensitivity** | High - OAuth tokens, email content (sensitive communications) |
| **Integration Type** | OAuth 2.0/MSAL, REST APIs (@azure/msal-node, @microsoft/microsoft-graph-client) |
| **SOC 2 Status** | SOC 2 Type II certified |
| **SOC 2 Report** | Available via Microsoft Service Trust Portal |
| **ISO 27001** | Certified |
| **DPA Status** | Required - Microsoft DPA (Online Services DPA) |
| **DPA Location** | https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA |
| **Data Location** | Regional (configurable via Azure tenant) |
| **Encryption** | TLS 1.2+ in transit, AES-256 at rest |
| **Data Retention** | Per Microsoft data retention policies |
| **Contract Type** | Microsoft Services Agreement, API Terms |
| **Primary Contact** | Microsoft Support |
| **Security Contact** | https://www.microsoft.com/en-us/msrc |
| **Last Assessment** | [Date of last review] |
| **Risk Level** | High |

**API Permissions Used:**
- `Mail.Read` - Read user email
- `User.Read` - Read user profile
- `offline_access` - Refresh tokens

**Action Items:**
- [ ] Verify Azure AD app registration compliance
- [ ] Review API permission minimization
- [ ] Obtain SOC 2 report from Service Trust Portal
- [ ] Verify DPA execution

---

## 4. Medium-Risk Vendors

### 4.1 GitHub

| Field | Details |
|-------|---------|
| **Vendor Name** | GitHub, Inc. (Microsoft subsidiary) |
| **Purpose** | Application distribution (releases), auto-update hosting |
| **Data Processed** | Application binaries, release metadata, update check requests (IP addresses) |
| **Data Sensitivity** | Medium - Public releases, limited user data (IP in logs) |
| **Integration Type** | GitHub Releases API, electron-updater |
| **SOC 2 Status** | SOC 2 Type II certified |
| **SOC 2 Report** | Available upon request via GitHub Enterprise |
| **DPA Status** | GitHub DPA (via Microsoft) |
| **DPA Location** | https://docs.github.com/en/site-policy/privacy-policies/github-data-protection-agreement |
| **Data Location** | US (GitHub data centers) |
| **Encryption** | TLS 1.2+ in transit |
| **Contract Type** | GitHub Terms of Service |
| **Primary Contact** | GitHub Support |
| **Last Assessment** | [Date of last review] |
| **Risk Level** | Medium |

**Action Items:**
- [ ] Review release signing process
- [ ] Verify auto-update security (HTTPS, signature verification)
- [ ] Document release deployment process

---

### 4.2 Apple Developer Program

| Field | Details |
|-------|---------|
| **Vendor Name** | Apple Inc. |
| **Purpose** | macOS code signing, application notarization, distribution |
| **Data Processed** | Application binaries (for notarization), developer identity |
| **Data Sensitivity** | Medium - Application code (submitted for notarization) |
| **Integration Type** | Xcode, notarytool, electron-notarize |
| **SOC 2 Status** | Apple maintains ISO 27001 certification |
| **DPA Status** | Apple Developer Program License Agreement |
| **DPA Location** | https://developer.apple.com/support/terms/ |
| **Data Location** | US (Apple data centers) |
| **Encryption** | TLS in transit |
| **Contract Type** | Apple Developer Program License Agreement |
| **Contract Renewal** | Annual ($99/year) |
| **Primary Contact** | Apple Developer Support |
| **Last Assessment** | [Date of last review] |
| **Risk Level** | Medium |

**Action Items:**
- [ ] Document code signing key management
- [ ] Verify notarization process security
- [ ] Review hardened runtime requirements

---

## 5. Low-Risk Vendors

### 5.1 npm Registry

| Field | Details |
|-------|---------|
| **Vendor Name** | npm, Inc. (GitHub/Microsoft subsidiary) |
| **Purpose** | Package management, dependency distribution |
| **Data Processed** | Package downloads, package metadata |
| **Data Sensitivity** | Low - Public packages only |
| **Integration Type** | npm CLI |
| **SOC 2 Status** | Covered under GitHub SOC 2 |
| **Contract Type** | npm Terms of Service |
| **Risk Level** | Low |

**Action Items:**
- [ ] Implement dependency scanning (npm audit)
- [ ] Review lockfile integrity
- [ ] Monitor for supply chain threats

---

## 6. Vendor Assessment Criteria

### 6.1 Security Assessment Checklist

For all new vendors processing sensitive data:

| Criterion | Requirement | Weight |
|-----------|-------------|--------|
| SOC 2 Type II Certification | Required for Critical/High vendors | Critical |
| Data Processing Agreement | Required for all PII processors | Critical |
| Encryption (in transit) | TLS 1.2+ required | High |
| Encryption (at rest) | AES-256 or equivalent | High |
| Access Controls | Role-based access, MFA | High |
| Incident Response | Documented IR plan | Medium |
| Business Continuity | DR/BC plans | Medium |
| Subprocessor Transparency | Published subprocessor list | Medium |
| Data Residency | Configurable or documented | Medium |
| Penetration Testing | Annual third-party testing | Medium |

### 6.2 Ongoing Monitoring

| Activity | Frequency | Owner |
|----------|-----------|-------|
| SOC 2 report review | Annual (upon report release) | Security Team |
| Vendor security news monitoring | Continuous | Security Team |
| DPA renewal/update check | Annual | Legal |
| Access review | Quarterly | Engineering |
| Subprocessor list review | Semi-annual | Security Team |

---

## 7. Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MAGIC AUDIT DATA FLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐                                                        │
│  │   User's    │                                                        │
│  │   Device    │                                                        │
│  │  (macOS)    │                                                        │
│  └──────┬──────┘                                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────┐     OAuth      ┌─────────────┐                        │
│  │   Magic     │◄──────────────►│   Google    │                        │
│  │   Audit     │                │   OAuth     │                        │
│  │   App       │                └─────────────┘                        │
│  │             │     OAuth      ┌─────────────┐                        │
│  │  (Electron) │◄──────────────►│  Microsoft  │                        │
│  │             │                │   OAuth     │                        │
│  └──────┬──────┘                └─────────────┘                        │
│         │                                                               │
│         │  User Data,          ┌─────────────┐                         │
│         │  Analytics           │             │                         │
│         └─────────────────────►│  Supabase   │                         │
│                                │  (Cloud DB) │                         │
│                                └─────────────┘                         │
│                                                                         │
│  ┌─────────────┐  Updates      ┌─────────────┐                         │
│  │   GitHub    │◄─────────────►│   Magic     │                         │
│  │  Releases   │               │   Audit     │                         │
│  └─────────────┘               └─────────────┘                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Vendor Risk Register

| Vendor | Risk Level | Top Risk | Mitigation | Status |
|--------|------------|----------|------------|--------|
| Supabase | Critical | Data breach | SOC 2, encryption, access controls | Active monitoring |
| Google | High | OAuth token compromise | Token encryption, scope minimization | Mitigated |
| Microsoft | High | OAuth token compromise | Token encryption, scope minimization | Mitigated |
| GitHub | Medium | Supply chain attack | Release signing, update verification | Mitigated |
| Apple | Medium | Signing key compromise | Key protection, access controls | Mitigated |
| npm | Low | Dependency vulnerability | npm audit, lockfiles | Active monitoring |

---

## 9. Action Items Summary

### Immediate (within 30 days)
- [ ] Obtain current SOC 2 Type II reports from Supabase, Google, Microsoft
- [ ] Execute DPAs with all Critical and High vendors
- [ ] Verify data residency configuration in Supabase

### Short-term (within 90 days)
- [ ] Complete security assessment for all vendors
- [ ] Document all API integrations and data flows
- [ ] Implement vendor monitoring process

### Ongoing
- [ ] Annual SOC 2 report review
- [ ] Quarterly access reviews
- [ ] Continuous security monitoring

---

## 10. Related Documents

- [Data Retention Policy](./DATA_RETENTION_POLICY.md)
- [Privacy Policy](./PRIVACY_POLICY_DRAFT.md)
- [Incident Response Plan](./INCIDENT_RESPONSE_PLAN.md)
- [SOC 2 Controls Matrix](./SOC2_CONTROLS_MATRIX.md)

---

## 11. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-15 | Security Team | Initial vendor inventory |

---

## Appendix A: Vendor Contact Quick Reference

| Vendor | Security Contact | Support Contact |
|--------|------------------|-----------------|
| Supabase | security@supabase.io | support@supabase.io |
| Google | security@google.com | cloud.google.com/support |
| Microsoft | secure@microsoft.com | support.microsoft.com |
| GitHub | security@github.com | support.github.com |
| Apple | product-security@apple.com | developer.apple.com/support |

---

*This document is proprietary to Magic Audit and intended for internal use only.*
