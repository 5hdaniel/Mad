# Privacy Policy Draft

**Keepr - Privacy Policy**

> **NOTICE**: This document requires legal review before publication. This is a DRAFT and should not be published without approval from legal counsel.

---

## Document Control

| Field | Value |
|-------|-------|
| **Version** | 1.0 DRAFT |
| **Effective Date** | [To be determined after legal review] |
| **Last Review Date** | 2024-01-15 |
| **Next Review Date** | 2025-01-15 |
| **Author** | Security Team |
| **Approval Status** | Draft - Requires Legal Review |
| **Classification** | Public (after approval) |

---

## Privacy Policy

**Last Updated:** [Date - To be inserted upon publication]

Keepr ("we," "us," or "our") respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our desktop application and related services (collectively, the "Service").

Please read this Privacy Policy carefully. By using the Service, you agree to the collection and use of information in accordance with this policy.

---

## 1. Information We Collect

### 1.1 Information You Provide to Us

**Account Information**
When you create an account, we collect:
- Email address
- Name and display name
- Profile picture (if provided via OAuth)

**Transaction Data**
When you use our transaction management features, you may provide:
- Property addresses and details
- Transaction types, dates, and financial information (listing price, sale price)
- Contact information for parties involved in transactions (names, emails, phone numbers, professional roles)

**Communication Data**
When you use our communication archiving features:
- iMessage content extracted from your local Messages database (with your explicit permission and macOS Full Disk Access)
- Email content retrieved from your Gmail or Outlook accounts (with your OAuth authorization)
- Message metadata (dates, participants, attachments)

**Feedback and Support**
- Corrections and feedback you provide on extracted data
- Support requests and communications with our team

### 1.2 Information Collected Automatically

**Device Information**
- Device identifier (for license management)
- Operating system version
- Application version
- Hardware identifiers (for device registration)

**Usage Information**
- Features used and frequency of use
- Error logs and crash reports
- Performance metrics

**Authentication Data**
- Login timestamps
- Session information
- OAuth token metadata (not the tokens themselves)

### 1.3 Information from Third Parties

**OAuth Providers (Google, Microsoft)**
When you connect your Google or Microsoft account, we receive:
- Basic profile information (name, email, profile picture)
- Access tokens for authorized API access
- Email content and metadata (when you authorize Gmail or Outlook access)

We do not receive or store your Google or Microsoft passwords.

---

## 2. How We Use Your Information

We use the information we collect for the following purposes:

### 2.1 Service Delivery
- Provide, operate, and maintain the Keepr application
- Process and organize your communications and transaction data
- Extract and structure transaction information using automated processing
- Enable data export in various formats

### 2.2 Account Management
- Create and manage your user account
- Process subscription payments and manage billing
- Verify your identity and prevent fraud
- Enforce our terms of service

### 2.3 Communication
- Send service-related notifications (updates, security alerts, support)
- Respond to your inquiries and support requests
- Send product updates and feature announcements (with your consent)

### 2.4 Improvement and Development
- Analyze usage patterns to improve our Service
- Develop new features and functionality
- Fix bugs and improve performance
- Train and improve our data extraction algorithms (using anonymized data)

### 2.5 Security and Compliance
- Detect, prevent, and respond to security incidents
- Monitor for unauthorized access or abuse
- Comply with legal obligations
- Enforce our policies and protect our rights

---

## 3. How We Share Your Information

We do not sell your personal information. We may share your information in the following circumstances:

### 3.1 Service Providers

We share information with third-party service providers who perform services on our behalf:

| Provider | Purpose | Data Shared |
|----------|---------|-------------|
| Supabase | Cloud database, authentication | User profiles, device registration, usage analytics |
| Google | Authentication, email access | OAuth tokens, profile information |
| Microsoft | Authentication, email access | OAuth tokens, profile information |
| Apple | Application distribution, notarization | Application binaries only |

All service providers are bound by data processing agreements and are prohibited from using your information for purposes other than providing services to us.

### 3.2 Legal Requirements

We may disclose your information if required to do so by law or in response to:
- Valid legal process (subpoena, court order, government request)
- Protect our rights, privacy, safety, or property
- Enforce our terms of service
- Protect against legal liability

### 3.3 Business Transfers

If Keepr is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any change in ownership or uses of your personal information.

### 3.4 With Your Consent

We may share your information for other purposes with your explicit consent.

---

## 4. Data Storage and Security

### 4.1 Where We Store Your Data

**Local Storage (Your Device)**
The majority of your data is stored locally on your device:
- Communications archive (iMessages, emails)
- Transaction records
- Contact information
- Application settings

**Cloud Storage (Supabase)**
We store the following in our cloud infrastructure:
- User account information
- Subscription and billing status
- Device registration
- Usage analytics
- Audit logs

Our cloud infrastructure is hosted by Supabase with data centers in [Location - to be confirmed].

### 4.2 Security Measures

We implement appropriate technical and organizational measures to protect your information:

**Technical Controls**
- Encryption in transit (TLS 1.2+)
- Encryption at rest (AES-256 for cloud storage)
- OAuth token encryption using OS-level keychain (macOS Keychain)
- Parameterized database queries to prevent injection attacks
- Access controls with user data isolation

**Organizational Controls**
- Employee access limited to need-to-know basis
- Security awareness training
- Incident response procedures
- Regular security assessments

### 4.3 Data Breach Response

In the event of a data breach that affects your personal information, we will:
- Notify affected users within 72 hours of confirmation
- Provide information about the nature of the breach
- Explain steps we are taking to address the situation
- Offer guidance on protective measures you can take

---

## 5. Data Retention

We retain your information for as long as necessary to provide our services and fulfill the purposes described in this policy. Specific retention periods include:

| Data Category | Retention Period |
|---------------|------------------|
| User Account Data | Until account deletion + 30 days |
| Communication Archives | User controlled (stored locally) |
| Transaction Records | 7 years (legal requirement) |
| Contact Data | Until user deletion request |
| Usage Analytics | 90 days |
| Audit Logs | 2 years |

For complete details, see our [Data Retention Policy](./DATA_RETENTION_POLICY.md).

---

## 6. Your Rights and Choices

### 6.1 Access and Portability

You have the right to:
- Request a copy of your personal information
- Export your data in machine-readable formats (JSON, CSV, PDF, Excel)
- Access data export features directly within the application

### 6.2 Correction

You have the right to:
- Update your account information at any time
- Correct inaccurate transaction or contact data
- Modify extracted information

### 6.3 Deletion

You have the right to:
- Delete individual transactions, contacts, or communications
- Request deletion of your entire account
- Remove connected OAuth accounts

To delete your account, use the account deletion feature in the application or contact privacy@keeprcompliance.com.

**Note:** Some data may be retained for legal compliance (e.g., transaction records for 7 years).

### 6.4 Withdraw Consent

You have the right to:
- Disconnect Google or Microsoft OAuth integrations at any time
- Revoke Full Disk Access permissions for iMessage extraction
- Opt out of non-essential analytics

### 6.5 Data Processing Objection

You may object to processing of your data based on legitimate interests. Contact us to exercise this right.

---

## 7. Third-Party Services and Links

### 7.1 OAuth Providers

When you connect Google or Microsoft accounts, those providers' privacy policies also apply to information they collect:
- [Google Privacy Policy](https://policies.google.com/privacy)
- [Microsoft Privacy Policy](https://privacy.microsoft.com/privacystatement)

### 7.2 External Links

Our Service may contain links to external websites. We are not responsible for the privacy practices of third-party sites.

---

## 8. Children's Privacy

Keepr is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child under 18, we will take steps to delete that information.

---

## 9. California Privacy Rights (CCPA)

If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):

### 9.1 Right to Know
You may request disclosure of:
- Categories of personal information collected
- Sources of personal information
- Business purposes for collection
- Categories of third parties with whom we share information
- Specific pieces of personal information collected

### 9.2 Right to Delete
You may request deletion of your personal information, subject to legal exceptions.

### 9.3 Right to Non-Discrimination
We will not discriminate against you for exercising your CCPA rights.

### 9.4 Categories of Information Collected

In the past 12 months, we have collected the following categories of personal information:

| Category | Examples | Collected |
|----------|----------|-----------|
| Identifiers | Name, email, account ID | Yes |
| Commercial Information | Transaction records, subscription history | Yes |
| Internet Activity | Usage data, feature interactions | Yes |
| Geolocation | Property addresses | Yes |
| Professional Information | Contact roles, company names | Yes |
| Sensitive Personal Information | Communications content | Yes (with consent) |

### 9.5 Sale of Personal Information

We do not sell personal information as defined by the CCPA.

---

## 10. International Data Transfers

If you are located outside the United States, please be aware that your information may be transferred to, stored, and processed in the United States where our servers are located. By using our Service, you consent to this transfer.

We implement appropriate safeguards for international data transfers, including standard contractual clauses where required.

---

## 11. Updates to This Policy

We may update this Privacy Policy from time to time. When we make material changes:
- We will update the "Last Updated" date
- We will notify you via email or in-app notification
- We will request re-acceptance for significant changes

Your continued use of the Service after changes constitutes acceptance of the updated policy.

---

## 12. Contact Us

If you have questions about this Privacy Policy or our privacy practices, please contact us:

**Email:** privacy@keeprcompliance.com

**Data Protection Inquiries:**
Keepr
[Address - To be inserted]
Attn: Privacy Team

**Response Time:** We will respond to privacy inquiries within 30 days.

---

## 13. Related Documents

- [Data Retention Policy](./DATA_RETENTION_POLICY.md)
- [Terms of Service] - [Link to be added]
- [Incident Response Plan](./INCIDENT_RESPONSE_PLAN.md) (Internal)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 DRAFT | 2024-01-15 | Initial draft for legal review |

---

## Legal Review Checklist

Before publication, this document requires review for:

- [ ] Compliance with CCPA requirements
- [ ] Compliance with GDPR requirements (if applicable)
- [ ] Accuracy of data collection descriptions
- [ ] Accuracy of third-party provider descriptions
- [ ] Completeness of user rights sections
- [ ] Appropriate consent mechanisms
- [ ] Children's privacy compliance (COPPA)
- [ ] International transfer mechanisms
- [ ] Contact information and response procedures
- [ ] Version control and update notification procedures

---

*This is a DRAFT document. Do not publish without legal approval.*
