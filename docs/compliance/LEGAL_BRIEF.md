# Legal Brief: Terms of Service & Privacy Policy for Keepr

**Prepared for:** Outside legal counsel
**From:** Blue Spaces LLC
**Product:** Keepr (desktop application for real estate transaction auditing)
**Market:** United States only
**Date:** February 20, 2026

---

## 1. COMPANY & PRODUCT OVERVIEW

**Entity:** Blue Spaces LLC
**Product:** Keepr - an Electron-based desktop application that helps real estate agents organize, audit, and archive transaction communications (email, iMessage, SMS) and documents.

**Architecture:** Local-first. For Individual license users, most sensitive data (emails, messages, transactions, contacts) is stored locally on the user's device in an AES-256 encrypted SQLite database, with only account info stored in the cloud. For Team/Enterprise users, when an agent submits transactions to their broker for review, that transaction data (including messages and attachments) is also stored in Supabase cloud storage.

**User base:** Licensed real estate agents (18+) in the US. All users are professionals.

---

## 2. LICENSE TIERS (affects ToS scope)

| Tier | Description | Data Profile |
|------|-------------|-------------|
| **Individual** | Single agent, standalone | Almost entirely local storage. Cloud = account info, device registration, usage analytics only |
| **Team** | Multi-agent, broker oversight | Same as Individual + agent can submit transactions to broker via cloud portal |
| **Enterprise** | SSO/SCIM provisioned | Same as Team + SSO integration, organization-level compliance settings |

**Device limit:** 2 devices per license (configurable)

**Add-on:** AI Detection - uses LLM APIs (OpenAI/Anthropic) to auto-detect transactions from emails

---

## 3. DATA CATEGORIES - WHAT WE COLLECT

### 3a. Stored LOCALLY on user's device (encrypted)
- Email content (Gmail, Outlook) retrieved via OAuth
- iMessage/SMS content (read from macOS Messages database)
- Transaction records (addresses, prices, dates, parties)
- Contact information (names, emails, phones, roles)
- Attachments and extracted text (OCR)
- OAuth tokens (in OS keychain)
- LLM API keys (user's own, encrypted)
- User feedback/corrections to AI classifications
- Application and error logs (30-90 day rotation)

### 3b. Stored in CLOUD (Supabase)
- Account profile (email, name, avatar from OAuth)
- Subscription/license status and tier
- Device registrations (device ID, OS, app version, last seen)
- Usage analytics events (90-day retention)
- API usage tracking (90-day retention)
- Audit logs (2-year retention)
- Legal acceptance timestamps (ToS version, privacy policy version)
- Organization membership and roles (Team/Enterprise tiers)
- LLM monthly token allowance tracking

### 3c. Stored in cloud ONLY for Team/Enterprise (broker portal)
- Submitted transaction data (denormalized copy)
- Submission-related messages and attachments (Supabase Storage)
- Broker review status and feedback

### 3d. Collected automatically
- Device info (OS, app version, device ID)
- Feature usage analytics
- Error/crash data
- Login timestamps and session info
- Microsoft Clarity analytics (broker portal web app only)

---

## 4. THIRD-PARTY DATA PROCESSORS

| Processor | Purpose | Data Shared | SOC 2 Certified |
|-----------|---------|------------|-----------------|
| **Supabase** | Cloud database, auth | Profiles, analytics, device registry | Yes (Type II) |
| **Google** | OAuth + Gmail API | OAuth tokens, email content flows through their API | Yes (Type II) |
| **Microsoft** | OAuth + Outlook/Graph API | OAuth tokens, email content flows through their API | Yes (Type II) |
| **OpenAI** | LLM transaction detection | Email content sent for AI processing (when enabled) | Yes |
| **Anthropic** | LLM transaction detection | Email content sent for AI processing (when enabled) | Check |
| **Vercel** | Broker portal hosting | Broker portal web traffic | Yes |
| **Apple** | Code signing, notarization | App binaries only | ISO 27001 |
| **GitHub** | App distribution, auto-update | Release binaries, update check IPs | Yes (Type II) |

**Note for legal team:** Data Processing Agreements (DPAs) need to be executed with each processor that handles user data. Prioritize Supabase, OpenAI, and Anthropic.

---

## 5. BUSINESS DECISIONS REQUIRING LEGAL DRAFTING

### 5a. Consent model: SINGLE ToS acceptance
- **Decision:** One "I Agree" checkbox covering all data uses
- **What it covers:** Service delivery, analytics, ML model training on anonymized data, product improvement, LLM processing of content
- **Legal team should:** Draft clear disclosures within the ToS for each use case, ensure CCPA compliance with bundled consent, include opt-out mechanism for "sale" (even though we don't sell - CCPA requires the mechanism)

### 5b. LLM data processing: NO separate opt-in
- **Decision:** Using the platform = consenting to LLM processing of email content for transaction detection
- **Both platform-provided tokens AND user's own API keys** are available
- When platform tokens are used, data flows through Blue Spaces LLC's API accounts with OpenAI/Anthropic
- When user brings their own key, data flows under their own agreement
- **Legal team should:** Clearly disclose that email content is sent to third-party AI providers, name the providers, reference their privacy policies

### 5c. ML training on anonymized data
- **Decision:** Blue Spaces LLC wants to use anonymized/aggregated user data to train its own transaction detection models AND for general product improvement
- **Legal team should:** Define what "anonymized" means in the policy, specify the anonymization process, clarify this covers both model training and analytics

### 5d. Broker portal data control: SHARED
- **Context:** Real estate agents are independent contractors who work under a broker. When an agent submits a transaction to their broker for review, both parties need access.
- **Proposed model:** Agent can withdraw unreviewed submissions. Once broker reviews/approves, both parties retain access. For compliance record-keeping, broker org retains a copy even if agent leaves.
- **Legal team should:** Draft data ownership language that reflects the agent-broker relationship, address what happens when an agent leaves a brokerage, define retention obligations for compliance records

---

## 6. SPECIFIC ToS PROVISIONS NEEDED

1. **Acceptable use** - real estate professionals only, no misuse of email/message access
2. **License restrictions** - 2 devices per license, no sharing credentials
3. **Subscription terms** - billing, cancellation, refund policy
4. **Data ownership** - user owns their data, we get a license to process it
5. **AI/LLM processing disclosure** - content sent to OpenAI/Anthropic for transaction detection
6. **ML training rights** - right to use anonymized data for model improvement
7. **Limitation of liability** - especially around AI-generated transaction data accuracy
8. **Indemnification** - user responsible for data they import (emails from clients, etc.)
9. **Termination** - what happens to data on account deletion
10. **Modification of terms** - notification process, re-acceptance for material changes
11. **Dispute resolution** - arbitration vs. litigation, governing law (what state?)
12. **Export/portability** - user right to export all data in standard formats
13. **Third-party integrations** - user responsible for their Google/Microsoft account terms
14. **Intellectual property** - our software, their data
15. **Warranty disclaimer** - AI detection is not legal/financial advice

---

## 7. SPECIFIC PRIVACY POLICY PROVISIONS NEEDED

1. **Local-first architecture disclosure** - most data never leaves the device (Individual tier); submitted data stored in cloud (Team/Enterprise)
2. **Cloud data vs. local data distinction** - clearly separate what goes where per license tier
3. **Third-party AI processor disclosure** - OpenAI, Anthropic named
4. **Communication data handling** - emails and messages accessed via OAuth/system permissions
5. **CCPA compliance** - right to know, delete, opt-out of sale, non-discrimination
6. **Data breach notification** - 72-hour notification commitment
7. **Children's privacy** - 18+ only, COPPA not applicable
8. **Data retention schedule** - define retention periods (suggest 7 years for transactions per RE industry norms, 90 days for analytics, user-controlled for local communications)
9. **International transfers** - US-only product, but Supabase may use AWS regions
10. **Anonymization for ML** - disclose that anonymized data may be used for model training
11. **Broker portal data flows** - when data moves from local to cloud (explicit user action)
12. **Device access permissions** - Full Disk Access (macOS), OAuth scopes requested

---

## 8. SOC 2 ALIGNMENT CONSIDERATIONS

**Current status:** Not certified. Want policies written to be SOC 2-aligned so we're ready when the time comes.

| SOC 2 Category | Relevance | Policy Impact |
|----------------|-----------|---------------|
| **Security (CC)** | High | Describe encryption (AES-256, TLS 1.2+, OS keychain), access controls (RLS, OAuth) |
| **Availability (A)** | Medium | SLA language for cloud services, local-first means high availability by design |
| **Processing Integrity (PI)** | High | AI accuracy disclaimers, user correction rights, data validation |
| **Confidentiality (C)** | High | Data classification, encryption at rest/in transit, vendor DPAs |
| **Privacy (P)** | High | Entire privacy policy; consent tracking, retention, user rights |

**SOC 1 & SOC 3:** SOC 1 (financial controls) is not directly relevant - Keepr is not a financial services processor. SOC 3 is a public-facing summary of SOC 2 - useful for marketing once certified but doesn't affect policy drafting.

**Legal team should:** Write policies that would survive a SOC 2 Type II audit. Specifically: documented consent mechanisms, defined retention periods, breach notification procedures, vendor management (DPAs), and user rights processes.

---

## 9. ENCRYPTION & SECURITY SUMMARY

| Layer | Method |
|-------|--------|
| Local database (SQLite) | AES-256 via better-sqlite3-multiple-ciphers, key in OS keychain |
| OAuth tokens | Electron safeStorage (macOS Keychain / Windows DPAPI) |
| Session tokens | Encrypted via tokenEncryptionService |
| Network transport | TLS 1.2+ for all API calls |
| Cloud storage | AES-256 at rest (Supabase) |
| Passwords | Never stored (OAuth-only authentication) |

---

## 10. OPEN QUESTIONS FOR LEGAL TEAM

1. **Governing law / jurisdiction** - Which state? (Blue Spaces LLC incorporation state?)
2. **Arbitration vs. litigation** - Preference for dispute resolution?
3. **Class action waiver** - Include?
4. **Real estate industry regulations** - Any state RE commission rules that govern how agents store client communications? NAR/MLS data handling requirements?
5. **Anti-spam / communication access** - Any CAN-SPAM or TCPA implications from accessing/archiving user's client communications?
6. **AI liability** - How aggressive on disclaiming liability for AI-detected transactions? (Users rely on this for compliance auditing)
7. **Broker data retention obligations** - Are there state-level RE record retention requirements that should override the user's deletion rights?
8. **CCPA "sale" definition** - Does sending email content to OpenAI/Anthropic for processing constitute a "sale" under CCPA? (We believe no, since it's for service delivery, but need legal opinion)
9. **Apple Full Disk Access** - Any special disclosure requirements for accessing macOS Messages database?
10. **iPhone backup access** - Legal implications of accessing encrypted iPhone backup data?
