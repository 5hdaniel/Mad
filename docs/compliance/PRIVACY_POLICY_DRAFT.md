# Privacy Policy - DRAFT

> **Document Control**
> | Field | Value |
> |-------|-------|
> | Version | 1.0 DRAFT |
> | Effective Date | [TO BE DETERMINED] |
> | Last Review | 2025-11-25 |
> | Author | Legal/Compliance Team |
> | Approval Status | DRAFT - Requires Legal Review |
> | Next Review | Prior to publication |

> **CRITICAL NOTICE:** This document is a DRAFT and requires thorough legal review before publication. This draft is intended as a starting framework and must be reviewed by qualified legal counsel to ensure compliance with all applicable laws and regulations.

---

# Magic Audit Privacy Policy

**Last Updated:** [TO BE DETERMINED]

## 1. Introduction

Magic Audit ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our desktop application and related services (collectively, the "Service").

Please read this Privacy Policy carefully. By using the Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with the terms of this Privacy Policy, please do not access or use the Service.

---

## 2. Information We Collect

### 2.1 Information You Provide Directly

| Data Type | Description | Purpose |
|-----------|-------------|---------|
| **Account Information** | Email address, name, profile picture (from OAuth provider) | Account creation and management |
| **Contact Information** | Names, email addresses, phone numbers, company names of your contacts | Transaction management and communication archiving |
| **Transaction Data** | Property addresses, closing dates, transaction types, associated parties | Core application functionality |
| **Communications** | Emails and iMessages you choose to import into the application | Compliance archiving as requested by you |
| **Feedback** | Corrections and feedback on extracted data | Service improvement |

### 2.2 Information Collected Automatically

| Data Type | Description | Purpose |
|-----------|-------------|---------|
| **Device Information** | Device identifier, operating system, app version | License management, troubleshooting |
| **Usage Analytics** | Feature usage, error reports, performance data | Service improvement |
| **Authentication Data** | OAuth tokens (encrypted), session information | Secure access to your connected accounts |

### 2.3 Information from Third Parties

| Source | Data Type | Purpose |
|--------|-----------|---------|
| **Google** | Email address, name, profile picture, Gmail content (with your authorization) | Authentication and email import |
| **Microsoft** | Email address, name, profile picture, Outlook content (with your authorization) | Authentication and email import |
| **Apple Messages** | iMessage content from your device (local access only) | Communication archiving |

---

## 3. How We Use Your Information

We use the information we collect for the following purposes:

### 3.1 Core Service Functionality

- Create and manage your user account
- Process and store your transaction records
- Import and archive your communications
- Generate compliance reports and exports
- Manage contact information for your transactions

### 3.2 Service Improvement

- Analyze usage patterns to improve features
- Debug and fix technical issues
- Develop new features based on user needs

### 3.3 Account Management

- Manage your subscription and license
- Send service-related notifications
- Respond to your support requests
- Enforce our Terms of Service

### 3.4 Security and Compliance

- Detect and prevent fraud or abuse
- Maintain security of our systems
- Comply with legal obligations

---

## 4. Data Storage and Security

### 4.1 Local Storage

The majority of your data is stored locally on your device:

| Data | Storage | Security |
|------|---------|----------|
| Transaction records | Local SQLite database | Device-level security |
| Imported communications | Local SQLite database | Device-level security |
| Contact information | Local SQLite database | Device-level security |
| OAuth tokens | Local database, encrypted | Encryption at rest |

**Your data stays on your device.** We do not upload your transactions, communications, or contacts to our servers unless you explicitly choose to do so.

### 4.2 Cloud Storage

Limited data is stored in our cloud infrastructure (Supabase):

| Data | Purpose | Security |
|------|---------|----------|
| Account profile | Authentication, subscription management | Encrypted at rest and in transit |
| Device registrations | License management | Encrypted at rest and in transit |
| Usage analytics | Service improvement | Aggregated, encrypted |
| Subscription status | Access management | Encrypted at rest and in transit |

### 4.3 Security Measures

We implement appropriate technical and organizational measures to protect your data:

- Encryption of sensitive data at rest and in transit
- OAuth 2.0 for third-party authentication
- Row-level security in our cloud database
- Regular security assessments
- Access controls and authentication requirements

---

## 5. Data Sharing and Disclosure

### 5.1 We Do Not Sell Your Data

We do not sell, rent, or trade your personal information to third parties for their marketing purposes.

### 5.2 Service Providers

We share information with service providers who assist us in operating the Service:

| Provider | Purpose | Data Shared |
|----------|---------|-------------|
| **Supabase** | Cloud database and authentication | Account data, device info, analytics |
| **Google** | OAuth authentication, Gmail access | Authentication tokens (encrypted) |
| **Microsoft** | OAuth authentication, Outlook access | Authentication tokens (encrypted) |
| **GitHub** | Application distribution and updates | Update check requests (anonymized) |

### 5.3 Legal Requirements

We may disclose your information when required by law:

- To comply with legal process (subpoena, court order)
- To respond to requests from government authorities
- To protect our rights, privacy, safety, or property
- To enforce our Terms of Service

### 5.4 Business Transfers

In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change.

---

## 6. Your Privacy Rights

### 6.1 Access and Portability

You have the right to:
- Access your personal data stored in the Service
- Export your data in a structured, machine-readable format
- Request a copy of all data we hold about you

**How to exercise:** Use the export feature in the application or contact privacy@magicaudit.com

### 6.2 Correction

You have the right to:
- Correct inaccurate personal information
- Update outdated information

**How to exercise:** Edit your profile in the application or contact support

### 6.3 Deletion

You have the right to:
- Delete your account and associated data
- Request deletion of specific communications
- Have your data removed from our systems

**How to exercise:** Use account deletion in settings or contact privacy@magicaudit.com

**Note:** Some data may be retained for legal compliance (see Section 8).

### 6.4 California Privacy Rights (CCPA/CPRA)

If you are a California resident, you have additional rights:

- **Right to Know:** Request disclosure of data collected about you
- **Right to Delete:** Request deletion of your personal information
- **Right to Opt-Out of Sale:** We do not sell your data, but you may opt-out of any future sale
- **Right to Non-Discrimination:** We will not discriminate against you for exercising your rights
- **Right to Correct:** Request correction of inaccurate information
- **Right to Limit Use of Sensitive Personal Information:** Limit use to necessary purposes

**To exercise your California rights:**
- Email: privacy@magicaudit.com
- Include: "California Privacy Request" in subject line
- Verification: We will verify your identity before processing

**Do Not Sell My Personal Information:**
We do not sell personal information. If this changes, we will provide an opt-out mechanism.

### 6.5 Response Timeframes

| Request Type | Response Time |
|--------------|---------------|
| Access Request | 30 days |
| Deletion Request | 30 days (+ 30-day grace period) |
| Correction Request | 15 days |
| California Requests | 45 days (with possible 45-day extension) |

---

## 7. Third-Party Integrations

### 7.1 Google Integration

When you connect your Google account:
- We access Gmail content only with your explicit authorization
- We use read-only access to import emails
- We do not modify or delete your Gmail messages
- You can revoke access at any time via Google Account settings

**Google API Disclosure:** Magic Audit's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

### 7.2 Microsoft Integration

When you connect your Microsoft account:
- We access Outlook content only with your explicit authorization
- We use read-only access to import emails
- We do not modify or delete your Outlook messages
- You can revoke access at any time via Microsoft Account settings

### 7.3 Apple Messages

When you import iMessages:
- Data is read directly from your local Messages database
- Data never leaves your device (unless you export)
- No connection to Apple servers is made
- Requires Full Disk Access permission on macOS

---

## 8. Data Retention

We retain your data according to our [Data Retention Policy](./DATA_RETENTION_POLICY.md):

| Data Type | Retention Period |
|-----------|------------------|
| Transaction Records | 7 years from transaction date |
| Communication Data | 5 years from creation |
| User Account Data | Until deletion request + 30 days |
| Session Data | 30 days |
| Analytics | 90 days |

**Exceptions:** Data may be retained longer if required for:
- Legal compliance
- Dispute resolution
- Fraud prevention
- Legitimate business purposes

---

## 9. Children's Privacy

The Service is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at privacy@magicaudit.com.

---

## 10. International Data Transfers

Magic Audit is operated from the United States. If you access the Service from outside the United States, your information may be transferred to and processed in the United States, where data protection laws may differ from those in your jurisdiction.

By using the Service, you consent to the transfer of your information to the United States and the processing of your information in the United States.

---

## 11. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of changes by:
- Posting the new Privacy Policy in the application
- Updating the "Last Updated" date
- Sending an email notification for material changes

Your continued use of the Service after changes become effective constitutes acceptance of the revised Privacy Policy.

---

## 12. Contact Us

If you have questions about this Privacy Policy or our privacy practices:

**Email:** privacy@magicaudit.com

**Mail:**
Magic Audit
[Address to be added]

**Data Protection Inquiries:** privacy@magicaudit.com
**California Privacy Requests:** privacy@magicaudit.com (Subject: "California Privacy Request")
**Support:** support@magicaudit.com

---

## 13. Additional Disclosures

### 13.1 Analytics and Tracking

We collect anonymized usage analytics to improve the Service. We do not use third-party advertising trackers or sell data to advertisers.

### 13.2 Cookies and Local Storage

As a desktop application, Magic Audit does not use browser cookies. We use local storage on your device to store application data and preferences.

### 13.3 Automated Decision-Making

We do not use automated decision-making or profiling that produces legal effects concerning you.

---

## Document Review Notes

> **FOR LEGAL REVIEW:**
>
> 1. Verify all claims about data handling are accurate
> 2. Confirm CCPA/CPRA compliance language
> 3. Review third-party provider agreements for required disclosures
> 4. Add specific addresses and contact information
> 5. Verify Google API Services User Data Policy compliance
> 6. Review data transfer mechanisms for international users
> 7. Confirm retention periods align with legal requirements
> 8. Add any state-specific requirements as needed
> 9. Review against current regulations and pending legislation
> 10. Coordinate effective date with Terms of Service

---

## Related Documents

- [Data Retention Policy](./DATA_RETENTION_POLICY.md)
- [Incident Response Plan](./INCIDENT_RESPONSE_PLAN.md)
- [Vendor Inventory](./VENDOR_INVENTORY.md)
- [SOC 2 Controls Matrix](./SOC2_CONTROLS_MATRIX.md)
- Terms of Service (to be developed)

---

*This document is a DRAFT and requires legal review before publication.*
