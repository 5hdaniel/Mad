# Real Estate Archive App - Product Roadmap

**Vision:** Become the go-to solution for real estate agents to backup, search, and manage their business text message conversations across all platforms.

---

## 📍 Current Status (v1.0.2)
- ✅ macOS iMessage export to text files
- ✅ Contact name resolution
- ✅ Multi-conversation selection
- ✅ Attachment handling
- ✅ Full Disk Access permission flow
- ✅ Auto-folder naming

---

## Milestone 1: Polish & Stability (v1.1.0)
**Goal:** Production-ready macOS app with excellent UX
**Timeline:** 2-3 weeks

### Features
- [ ] **Search & Filter**
  - Search conversations by contact name
  - Filter by date range (last 7/30/90 days, custom range)
  - Filter by message count threshold

- [ ] **Export Improvements**
  - Progress bar during export (with % complete)
  - Estimated time remaining
  - Cancel export mid-process
  - Export preview before saving

- [ ] **Settings & Preferences**
  - Choose default export location
  - Timestamp format preferences (12hr/24hr)
  - File naming conventions
  - Dark/light mode toggle

- [ ] **Quality of Life**
  - Remember window size/position
  - Export history (show last 10 exports)
  - Quick re-export functionality
  - Keyboard shortcuts (Cmd+E to export, Cmd+F to search)

### Technical Debt
- [ ] Add error boundary in React
- [ ] Improve error messages (user-friendly)
- [ ] Add logging system (for debugging user issues)
- [ ] Performance optimization for large conversation lists (10k+)

### Success Metrics
- Export 1000+ messages in <5 seconds
- Zero crashes in 50+ test exports
- All macOS versions from Monterey to Sequoia supported

---

## Milestone 2: Enhanced Exports (v1.2.0)
**Goal:** Professional export formats for business use
**Timeline:** 3-4 weeks

### Features
- [ ] **PDF Export**
  - Formatted with conversation metadata (date range, participant names)
  - Include thumbnails of image attachments
  - Page numbers and table of contents for long conversations
  - Header with export date and agent info

- [ ] **CSV Export**
  - Each message as a row (timestamp, sender, message, attachments)
  - Importable into Excel/Google Sheets
  - Useful for data analysis

- [ ] **HTML Export**
  - Chat bubble UI (iMessage-style)
  - Embedded images/attachments
  - Searchable, shareable via web browser

- [ ] **Attachment Management**
  - Export attachments to subfolder
  - Inline images in PDF/HTML exports
  - File size summary before export

### Success Metrics
- All 3 formats exportable without errors
- PDF exports look professional (ready to print)
- Attachments correctly linked/embedded

---

## Milestone 3: Advanced Features (v1.3.0)
**Goal:** Power user features for real estate professionals
**Timeline:** 4-5 weeks

### Features
- [ ] **Conversation Merging**
  - Merge multiple phone numbers for same contact
  - Handle contact number changes over time

- [ ] **Advanced Search**
  - Full-text search across all messages
  - Search within specific date ranges
  - Filter by attachment type (images, documents, etc.)
  - Regex support for power users

- [ ] **Tagging & Organization**
  - Add tags to conversations (buyer, seller, deal closed, etc.)
  - Custom categories
  - Bulk tagging

- [ ] **Export Templates**
  - Create reusable export configs
  - "End of Month Report" template
  - "Deal Archive" template

- [ ] **Scheduled Exports**
  - Auto-export tagged conversations monthly
  - Backup automation

### Success Metrics
- Tags used by 50%+ of users
- Search finds relevant messages in <1 second
- Templates reduce export time by 50%

---

## Milestone 4: Windows Support (v2.0.0)
**Goal:** Expand to Windows users with iPhones
**Timeline:** 6-8 weeks

### Approach: iTunes Backup Parser
- [ ] **Core Functionality**
  - Detect iTunes/Finder backups on Windows
  - Parse iPhone backup files (SQLite + plist)
  - Extract messages from backup database
  - Handle backup encryption (password prompt)

- [ ] **Windows-Specific UI**
  - Native Windows titlebar
  - Windows File Explorer integration
  - System tray icon

- [ ] **iPhone Backup Management**
  - List available backups (with dates)
  - Create new backup before export
  - Show backup age warning (stale data)

### Technical Implementation
- Parse `3d0d7e5fb2ce288813306e4d4636395e047a3d28` (Messages DB in backup)
- Use `iphone-backup-tools` or custom parser
- Handle both encrypted and unencrypted backups

### Success Metrics
- Windows app launches without issues
- Successfully parses backups from iPhone 12+
- Feature parity with macOS version

---

## Milestone 5: Android Support (v2.1.0)
**Goal:** Support Android users (smaller market, but competitive advantage)
**Timeline:** 4-6 weeks

### Approach A: USB Connection (Rooted/Developer Mode)
- [ ] Connect via ADB (Android Debug Bridge)
  - Pull `/data/data/com.android.providers.telephony/databases/mmssms.db`
  - Requires USB debugging enabled

### Approach B: Backup File Import
- [ ] Import Android backup files
  - Support `.ab` files (Android backup format)
  - Parse SMS/MMS database

### Features
- [ ] Android-specific UI (Material Design elements)
- [ ] Handle MMS group messages
- [ ] Support multiple messaging apps (Messages, WhatsApp backup via future milestone)

### Technical Challenges
- Different DB schema than iMessage
- Carrier-specific fields
- MMS vs SMS handling
- Permission complexity

### Success Metrics
- Import messages from 3+ Android versions
- Handle group MMS correctly
- Attachments extracted properly

---

## Milestone 6: Cloud & Collaboration (v2.2.0)
**Goal:** Team features for real estate brokerages
**Timeline:** 6-8 weeks

### Features
- [ ] **Cloud Storage Integration**
  - Auto-upload exports to Google Drive
  - OneDrive integration
  - Dropbox integration
  - S3-compatible storage

- [ ] **Team Features**
  - Share exports with team members
  - Centralized backup for brokerage
  - Admin dashboard (view all agent exports)

- [ ] **Web Portal** (Optional)
  - View exports from web browser
  - Search across all archived conversations
  - Download/share exports

### Success Metrics
- 80% of exports auto-uploaded
- Zero data loss in cloud sync
- Web portal loads in <2 seconds

---

## Milestone 7: Monetization & Growth (v3.0.0)
**Goal:** Convert to sustainable SaaS business
**Timeline:** 8-10 weeks

### Business Model
- [ ] **Free Tier**
  - 10 exports per month
  - Text format only
  - Basic features

- [ ] **Pro Tier ($9.99/month or $79/year)**
  - Unlimited exports
  - All formats (PDF, CSV, HTML)
  - Advanced search & tagging
  - Priority support

- [ ] **Team Tier ($49/month for 5 users)**
  - All Pro features
  - Cloud storage (100GB)
  - Team collaboration
  - Admin dashboard
  - Centralized billing

### Technical Implementation
- [ ] Authentication system
  - Email + password
  - OAuth (Google, Apple)
  - License key management

- [ ] Payment Integration
  - Stripe integration
  - Subscription management
  - Upgrade/downgrade flows

- [ ] License Enforcement
  - Check license on app launch
  - Graceful degradation (Pro → Free)
  - Offline grace period (7 days)

- [ ] Analytics (Privacy-focused)
  - Track exports (count, formats)
  - Feature usage
  - Error rates
  - NO message content tracking

### Marketing Site
- [ ] Landing page
- [ ] Documentation
- [ ] Pricing page
- [ ] Testimonials

### Success Metrics
- 100 paying users in first 3 months
- <5% churn rate
- 4.5+ star rating

---

## Milestone 8: WhatsApp & Signal Support (v3.1.0)
**Goal:** Expand beyond SMS/iMessage
**Timeline:** 6-8 weeks

### Features
- [ ] **WhatsApp Backup Import**
  - Parse WhatsApp chat exports
  - Handle media (images, videos, voice notes)
  - Group chat support

- [ ] **Signal Backup Import**
  - Encrypted backup decryption
  - Desktop Signal DB access

- [ ] **Unified Export**
  - Merge conversations across platforms
  - Deduplicate messages
  - Timeline view showing all platforms

### Success Metrics
- WhatsApp imports work for 95%+ of exports
- All media types supported
- Cross-platform search works

---

## Future Exploration (Post v3.1)

### Possible Features
- **AI-Powered Features**
  - Smart summaries of conversations
  - Extract action items / follow-ups
  - Sentiment analysis
  - Conversation insights (response time, message frequency)

- **Legal/Compliance**
  - GDPR export tools
  - Redaction features (hide sensitive info)
  - Audit logs
  - Tamper-proof exports (blockchain/signatures)

- **Mobile Apps**
  - iOS app (direct Messages.app access)
  - Android app (native SMS access)

- **Integrations**
  - CRM integration (HubSpot, Salesforce)
  - Real estate platforms (Zillow, Realtor.com)
  - Automatic contact import

---

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Apple changes Messages DB schema | Version detection + fallback queries |
| Permissions blocked by OS updates | Monitor beta releases, update entitlements |
| Large databases (100k+ messages) | Pagination, indexing, background processing |
| Backup file corruption | Validation checks, partial recovery |

### Business Risks
| Risk | Mitigation |
|------|------------|
| Low user adoption | Pre-launch surveys, beta testing |
| Competitor emerges | Focus on UX, real estate niche |
| Privacy concerns | Transparency, local-first approach |
| Platform lock-in | Open export formats, no cloud lock-in |

---

## Success Metrics by Phase

| Milestone | Downloads | Paying Users | Revenue/mo | NPS Score |
|-----------|-----------|--------------|------------|-----------|
| M1 (v1.1) | 500 | 0 | $0 | N/A |
| M2 (v1.2) | 1,500 | 0 | $0 | 50+ |
| M3 (v1.3) | 3,000 | 0 | $0 | 60+ |
| M4 (v2.0) | 7,500 | 0 | $0 | 55+ |
| M5 (v2.1) | 10,000 | 0 | $0 | 55+ |
| M6 (v2.2) | 15,000 | 50 | $500 | 60+ |
| M7 (v3.0) | 25,000 | 500 | $5,000 | 65+ |
| M8 (v3.1) | 40,000 | 1,500 | $15,000 | 70+ |

---

## Development Principles

1. **Privacy First**: No message content leaves the device without explicit user action
2. **Offline First**: Core features work without internet
3. **Real Estate Focus**: Design for agent workflows, not general consumers
4. **Cross-Platform**: Write once, run everywhere (where possible)
5. **Open Core**: Keep base functionality open-source, charge for premium features

---

## Questions to Answer Before Each Milestone

- [ ] Who is the target user for this milestone?
- [ ] What problem does this solve for them?
- [ ] How will we measure success?
- [ ] What are the biggest technical risks?
- [ ] Can we build an MVP in half the time?
- [ ] How do we get user feedback before full release?

---

**Last Updated:** 2025-11-05
**Current Version:** v1.0.2
**Next Milestone:** M1 - Polish & Stability (v1.1.0)
