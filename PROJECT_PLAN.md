# Magic Audit - AI-Enabled Real Estate Transaction Audit Exporter

## Project Plan & MVP Roadmap

**Document Version:** 1.0
**Created:** 2025-12-12
**Product Vision:** An AI-enabled desktop application that automatically creates comprehensive audit packages for closed real estate transactions by analyzing imported communications (email, text, attachments) and using LLM to identify relevant contacts and their transaction roles.

---

## Executive Summary

### Current State (What We Have)

| Feature | Status |
|---------|--------|
| Desktop App (Electron + React + TypeScript) | ✅ Complete |
| User Authentication (Google OAuth, Microsoft OAuth) | ✅ Complete |
| iMessage Extraction (macOS) | ✅ Complete |
| iPhone Message Extraction via USB (Windows) | ✅ Complete |
| Email Integration (Gmail API, Outlook API) | ✅ Complete |
| Transaction Management (manual creation) | ✅ Complete |
| Contact Management (manual role assignment) | ✅ Complete |
| PDF Export | ✅ Complete |
| Local Storage (SQLite) + Cloud Sync (Supabase) | ✅ Complete |
| Cross-platform (macOS + Windows) | ✅ Complete |

### Gap Analysis (What We Need for AI Audit Exporter)

| Feature | Status | Priority |
|---------|--------|----------|
| LLM/AI Integration Layer | ❌ Missing | P0 - MVP |
| AI Contact Role Identification | ❌ Missing | P0 - MVP |
| Automated Communication Relevance Analysis | ❌ Missing | P0 - MVP |
| Comprehensive Audit Package Generation | ❌ Missing | P0 - MVP |
| Attachment Extraction & Organization | ❌ Missing | P1 |
| Transaction Closure Workflow | ❌ Missing | P1 |
| Timeline/Chronology Generation | ❌ Missing | P1 |
| Android Phone Support | ❌ Missing | P2 |

---

## MVP Definition

### MVP Scope (Bare Minimum for Launch)

The MVP enables a real estate agent to:
1. Import their communications (existing email + phone data)
2. Create/select a transaction
3. Use AI to identify which contacts are involved and their roles
4. Generate a basic audit package with relevant communications

### MVP User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER FLOW - MVP                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Agent connects email/phone ──► (Already exists)             │
│                    │                                            │
│                    ▼                                            │
│  2. Agent creates transaction ──► (Already exists)              │
│     with property address                                       │
│                    │                                            │
│                    ▼                                            │
│  3. AI analyzes communications ──► (NEW - MVP)                  │
│     for this property address                                   │
│                    │                                            │
│                    ▼                                            │
│  4. AI suggests contacts + roles ──► (NEW - MVP)                │
│     Agent confirms/adjusts                                      │
│                    │                                            │
│                    ▼                                            │
│  5. Generate Audit Package ──► (NEW - MVP)                      │
│     PDF/ZIP with communications                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Out of Scope for MVP

- Android phone support (use existing iPhone/macOS support)
- Attachment organization/OCR
- Automated transaction closure detection
- Advanced timeline visualization
- Voice/call transcription
- CRM integrations
- Multi-agent collaboration features

---

## Project Phases & Epics

### Phase 0: Foundation - LLM Integration Layer
**Goal:** Establish the AI/LLM infrastructure

### Phase 1: AI-Powered Contact Analysis
**Goal:** Use LLM to identify contacts and suggest roles

### Phase 2: Communication Relevance Engine
**Goal:** Filter and rank communications by transaction relevance

### Phase 3: Audit Package Generator
**Goal:** Create exportable audit packages

### Phase 4: Post-MVP Enhancements
**Goal:** Attachments, Android, advanced features

---

## Detailed Epic & Task Breakdown

---

## EPIC 0: LLM Integration Foundation

**Description:** Build the core infrastructure for LLM communication, including API integration, prompt management, and cost/token tracking.

**Dependencies:** None
**Estimated Complexity:** Medium

### TASK-0.1: LLM Provider Service Architecture
**Type:** Architecture/Backend
**Priority:** P0 - MVP Critical
**Labels:** `ai`, `backend`, `architecture`

**Description:**
Create a service layer for LLM communication that abstracts the provider (OpenAI, Anthropic, local models) to allow flexibility.

**Acceptance Criteria:**
- [ ] Create `electron/services/llmService.ts` with provider abstraction
- [ ] Support OpenAI API (GPT-4) as primary provider
- [ ] Support Anthropic API (Claude) as secondary provider
- [ ] Configuration for API keys stored securely (electron safeStorage)
- [ ] Token counting and cost estimation utilities
- [ ] Rate limiting to prevent runaway API costs
- [ ] Retry logic with exponential backoff
- [ ] Streaming response support for long operations
- [ ] Unit tests for service layer

**Technical Notes:**
- Use existing `tokenEncryptionService.ts` pattern for secure storage
- Follow existing service patterns in `electron/services/`
- Add new IPC handlers in `electron/llm-handlers.ts`

---

### TASK-0.2: LLM API Key Management UI
**Type:** Frontend
**Priority:** P0 - MVP Critical
**Labels:** `ai`, `frontend`, `settings`

**Description:**
Add UI in Settings for users to add/manage their LLM API keys.

**Acceptance Criteria:**
- [ ] New section in Settings.tsx for "AI Configuration"
- [ ] Input fields for OpenAI API key
- [ ] Input fields for Anthropic API key (optional)
- [ ] Secure storage of keys via IPC to main process
- [ ] Key validation (test API connection)
- [ ] Show connection status (connected/error)
- [ ] Clear instructions for obtaining API keys
- [ ] Help links to provider documentation

**Technical Notes:**
- Use existing Settings.tsx pattern
- Keys MUST be stored via electron safeStorage, never in localStorage

---

### TASK-0.3: Prompt Template System
**Type:** Backend
**Priority:** P0 - MVP Critical
**Labels:** `ai`, `backend`

**Description:**
Create a structured prompt template system for consistent LLM interactions.

**Acceptance Criteria:**
- [ ] Create `electron/services/promptTemplateService.ts`
- [ ] Template types: contact_role_analysis, communication_relevance, summary_generation
- [ ] Support for variable interpolation (property address, contact names, etc.)
- [ ] Version tracking for prompts (for A/B testing later)
- [ ] Load prompts from JSON/YAML files for easy iteration
- [ ] Unit tests for template rendering

**Technical Notes:**
- Store prompts in `electron/prompts/` directory
- Consider future: prompt performance tracking

---

### TASK-0.4: LLM Usage Analytics & Cost Tracking
**Type:** Backend
**Priority:** P1
**Labels:** `ai`, `analytics`

**Description:**
Track LLM usage to help users understand costs and usage patterns.

**Acceptance Criteria:**
- [ ] Log all LLM API calls with token counts
- [ ] Store usage data in local SQLite
- [ ] Calculate estimated costs per model
- [ ] Create usage summary endpoint for UI
- [ ] Daily/monthly usage aggregation
- [ ] Warning when approaching cost thresholds

---

## EPIC 1: AI-Powered Contact Role Identification

**Description:** Use LLM to analyze communications and identify which contacts are involved in a transaction and what their roles are.

**Dependencies:** EPIC 0
**Estimated Complexity:** High

### TASK-1.1: Contact-Communication Association Service
**Type:** Backend
**Priority:** P0 - MVP Critical
**Labels:** `ai`, `backend`, `contacts`

**Description:**
Build a service that links contacts to their communications (emails, texts) for analysis.

**Acceptance Criteria:**
- [ ] Create `electron/services/contactCommunicationService.ts`
- [ ] Query all emails/texts for a given contact (by email/phone)
- [ ] Build communication corpus for a contact (all their messages)
- [ ] Filter by date range (transaction period)
- [ ] Return structured data for LLM analysis
- [ ] Handle multiple identities per contact (work email, personal email, phone)

**Technical Notes:**
- Build on existing `contactsService.ts`
- Use existing email/message data structures

---

### TASK-1.2: Contact Role Analysis LLM Integration
**Type:** Backend/AI
**Priority:** P0 - MVP Critical
**Labels:** `ai`, `backend`, `llm`

**Description:**
Create the LLM prompt and processing logic to identify contact roles from communication content.

**Acceptance Criteria:**
- [ ] Create role analysis prompt template
- [ ] Send contact communication corpus to LLM
- [ ] Parse LLM response for role suggestions
- [ ] Confidence scoring for role suggestions (high/medium/low)
- [ ] Support all existing transaction roles:
  - Client (Buyer/Seller)
  - Agent (Listing/Buyer's Agent)
  - Title Officer
  - Escrow Officer
  - Home Inspector
  - Appraiser
  - Lender/Loan Officer
  - Attorney
  - Other (with description)
- [ ] Handle edge cases (no clear role, multiple roles)
- [ ] Unit tests with mock LLM responses

**Sample Prompt Structure:**
```
Analyze the following communications involving {contact_name} for the
real estate transaction at {property_address}.

Based on the content, identify this person's role in the transaction.

Communications:
{communication_corpus}

Return a JSON response with:
- suggested_role: string
- confidence: high|medium|low
- evidence: string[] (quotes from communications supporting the role)
```

---

### TASK-1.3: AI Contact Role Suggestion UI
**Type:** Frontend
**Priority:** P0 - MVP Critical
**Labels:** `ai`, `frontend`, `transactions`

**Description:**
Add UI to display AI-suggested contact roles with ability to confirm/override.

**Acceptance Criteria:**
- [ ] New component: `AIRoleSuggestionModal.tsx`
- [ ] Display list of contacts with AI-suggested roles
- [ ] Show confidence indicator (high/medium/low)
- [ ] Show evidence snippets (why AI chose this role)
- [ ] Allow user to confirm suggestion
- [ ] Allow user to override with different role
- [ ] "Analyze Contacts" button in transaction view
- [ ] Loading state during analysis
- [ ] Error handling for API failures
- [ ] Integration with existing transaction workflow

**UI Mockup:**
```
┌─────────────────────────────────────────────────────┐
│  AI Contact Analysis - 123 Main St                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ John Smith                                      │
│     Suggested: Buyer's Agent (High confidence)      │
│     Evidence: "I'll represent the buyer..."         │
│     [Confirm] [Change Role ▼]                       │
│                                                     │
│  ⚠️ Sarah Johnson                                   │
│     Suggested: Title Officer (Medium confidence)    │
│     Evidence: "Title search complete..."            │
│     [Confirm] [Change Role ▼]                       │
│                                                     │
│  ❓ Mike Brown                                      │
│     Suggested: Unknown (Low confidence)             │
│     Evidence: Limited communication                 │
│     [Assign Role ▼] [Exclude from Transaction]      │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Apply All Suggestions]        [Save & Continue]   │
└─────────────────────────────────────────────────────┘
```

---

### TASK-1.4: Batch Contact Analysis
**Type:** Backend
**Priority:** P0 - MVP Critical
**Labels:** `ai`, `backend`, `performance`

**Description:**
Optimize contact analysis to handle multiple contacts efficiently.

**Acceptance Criteria:**
- [ ] Batch multiple contacts into single LLM call when possible
- [ ] Parallel processing with configurable concurrency
- [ ] Progress tracking for large contact lists
- [ ] Resume capability if interrupted
- [ ] Caching of analysis results
- [ ] Invalidation when new communications arrive

---

## EPIC 2: Communication Relevance Analysis

**Description:** Use AI to determine which communications are relevant to a specific transaction based on property address and context.

**Dependencies:** EPIC 0
**Estimated Complexity:** High

### TASK-2.1: Property Address Extraction Service
**Type:** Backend
**Priority:** P0 - MVP Critical
**Labels:** `ai`, `backend`, `nlp`

**Description:**
Extract and normalize property addresses mentioned in communications.

**Acceptance Criteria:**
- [ ] Create `electron/services/addressExtractionService.ts`
- [ ] Use LLM to identify addresses in text
- [ ] Normalize addresses to standard format
- [ ] Match against Google Places API (existing integration)
- [ ] Handle address variations (123 Main vs 123 Main Street)
- [ ] Handle partial addresses ("the Smith property", "Main St house")
- [ ] Unit tests with various address formats

---

### TASK-2.2: Communication Relevance Scoring
**Type:** Backend/AI
**Priority:** P0 - MVP Critical
**Labels:** `ai`, `backend`, `llm`

**Description:**
Score communications by relevance to a specific transaction.

**Acceptance Criteria:**
- [ ] Create relevance scoring prompt template
- [ ] Score 0-100 for each communication
- [ ] Factors: property address mention, transaction keywords, party involvement
- [ ] Categorize: Contract, Inspection, Financing, Title, Closing, General
- [ ] Handle long email threads (summarize first)
- [ ] Batch processing for efficiency
- [ ] Store relevance scores in database
- [ ] Re-scoring when transaction details change

---

### TASK-2.3: Transaction Communication Filter
**Type:** Backend
**Priority:** P0 - MVP Critical
**Labels:** `backend`, `transactions`

**Description:**
Filter and retrieve communications relevant to a specific transaction.

**Acceptance Criteria:**
- [ ] Create `electron/services/transactionCommunicationService.ts`
- [ ] Query by property address
- [ ] Query by assigned contacts
- [ ] Query by date range (contract to close)
- [ ] Combine AI relevance scores with explicit filters
- [ ] Sort by relevance, date, or sender
- [ ] Pagination for large result sets
- [ ] Include both emails and text messages

---

### TASK-2.4: Relevant Communications UI
**Type:** Frontend
**Priority:** P0 - MVP Critical
**Labels:** `frontend`, `transactions`

**Description:**
Display filtered, relevant communications within transaction view.

**Acceptance Criteria:**
- [ ] New component: `TransactionCommunications.tsx`
- [ ] List view of relevant communications
- [ ] Show relevance score/indicator
- [ ] Show communication category (Contract, Inspection, etc.)
- [ ] Expandable message preview
- [ ] Filter by type (email/text), sender, category
- [ ] "Include in Audit" toggle per communication
- [ ] Bulk select/deselect
- [ ] Integration with transaction detail view

---

## EPIC 3: Audit Package Generation

**Description:** Generate comprehensive, exportable audit packages for closed transactions.

**Dependencies:** EPIC 1, EPIC 2
**Estimated Complexity:** Medium

### TASK-3.1: Audit Package Data Model
**Type:** Backend/Database
**Priority:** P0 - MVP Critical
**Labels:** `backend`, `database`, `audit`

**Description:**
Design and implement the data model for audit packages.

**Acceptance Criteria:**
- [ ] Create `audit_packages` table in SQLite
- [ ] Fields: id, transaction_id, created_at, status, config, file_path
- [ ] Create `audit_package_items` table (communications included)
- [ ] Version tracking for regeneration
- [ ] Supabase sync for cloud backup
- [ ] Migration scripts

**Schema:**
```sql
CREATE TABLE audit_packages (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL, -- draft, generating, complete, error
  config TEXT, -- JSON: format preferences, included items
  file_path TEXT,
  file_size INTEGER,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE TABLE audit_package_items (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  item_type TEXT NOT NULL, -- email, text, attachment, summary
  item_id TEXT NOT NULL, -- reference to original item
  included INTEGER DEFAULT 1,
  FOREIGN KEY (package_id) REFERENCES audit_packages(id)
);
```

---

### TASK-3.2: PDF Audit Report Generator
**Type:** Backend
**Priority:** P0 - MVP Critical
**Labels:** `backend`, `export`, `pdf`

**Description:**
Enhance existing PDF export to generate comprehensive audit reports.

**Acceptance Criteria:**
- [ ] Extend `pdfExportService.ts` for audit packages
- [ ] Cover page: Property address, transaction dates, parties
- [ ] Table of contents with page numbers
- [ ] Contact summary section with roles
- [ ] Chronological communication log
- [ ] Each communication: date, from, to, subject/preview, category
- [ ] Page numbers and footer
- [ ] Professional styling/branding
- [ ] Configurable sections (include/exclude)
- [ ] Handle long packages (100+ pages)

---

### TASK-3.3: ZIP Archive Generator
**Type:** Backend
**Priority:** P0 - MVP Critical
**Labels:** `backend`, `export`

**Description:**
Generate ZIP archives containing all audit materials.

**Acceptance Criteria:**
- [ ] Create `electron/services/auditArchiveService.ts`
- [ ] Include PDF summary report
- [ ] Include individual email exports (.eml or .txt)
- [ ] Include text message exports (.txt)
- [ ] Organized folder structure:
  ```
  Audit_123MainSt_2025-12-12/
  ├── Summary_Report.pdf
  ├── Contacts/
  │   └── contact_list.csv
  ├── Emails/
  │   ├── 2024-01-15_Contract_Discussion.txt
  │   └── ...
  ├── Text_Messages/
  │   ├── John_Smith_conversation.txt
  │   └── ...
  └── Attachments/ (Post-MVP)
  ```
- [ ] Progress tracking for large archives
- [ ] Compression level options

---

### TASK-3.4: AI-Generated Transaction Summary
**Type:** Backend/AI
**Priority:** P0 - MVP Critical
**Labels:** `ai`, `backend`, `llm`

**Description:**
Use LLM to generate an executive summary of the transaction.

**Acceptance Criteria:**
- [ ] Create summary generation prompt template
- [ ] Input: All relevant communications + transaction details
- [ ] Output: 1-2 page narrative summary
- [ ] Key sections:
  - Transaction Overview (parties, property, dates)
  - Timeline of Key Events
  - Important Decisions/Agreements
  - Issues Encountered & Resolutions
  - Final Outcome
- [ ] Handle token limits for large transactions
- [ ] User can regenerate with different focus
- [ ] Edit capability for generated summary

---

### TASK-3.5: Audit Package Generation UI
**Type:** Frontend
**Priority:** P0 - MVP Critical
**Labels:** `frontend`, `export`, `audit`

**Description:**
Create UI for configuring and generating audit packages.

**Acceptance Criteria:**
- [ ] New component: `AuditPackageWizard.tsx`
- [ ] Step 1: Review transaction details
- [ ] Step 2: Review/confirm contacts and roles
- [ ] Step 3: Review/select communications to include
- [ ] Step 4: Configure export options (PDF, ZIP, sections)
- [ ] Step 5: Generate & Download
- [ ] Progress indicator during generation
- [ ] Preview before final generation
- [ ] Error handling with retry option
- [ ] Success confirmation with file location

---

### TASK-3.6: "Close Transaction" Workflow
**Type:** Frontend/Backend
**Priority:** P1
**Labels:** `frontend`, `backend`, `transactions`

**Description:**
Create explicit workflow for marking transaction as closed and generating audit.

**Acceptance Criteria:**
- [ ] Add transaction status field (active, pending_close, closed)
- [ ] "Close Transaction" action button
- [ ] Closing checklist (all contacts assigned, communications reviewed)
- [ ] Prompt to generate audit package on close
- [ ] Closed transaction visual indicator
- [ ] Archive closed transactions (separate view)
- [ ] Prevent edits to closed transactions (or warn)

---

## EPIC 4: Post-MVP Enhancements

**Description:** Features for future releases after MVP launch.

### TASK-4.1: Attachment Extraction & Organization
**Priority:** P1 - Post-MVP
**Labels:** `backend`, `attachments`

- Extract attachments from emails
- Categorize attachments (contracts, disclosures, inspections)
- OCR for image-based documents
- Include attachments in audit package

### TASK-4.2: Android Phone Support
**Priority:** P2 - Post-MVP
**Labels:** `platform`, `android`

- Research Android backup formats
- Google Messages export support
- ADB integration for advanced access
- UI adaptations for Android flow

### TASK-4.3: Timeline Visualization
**Priority:** P2 - Post-MVP
**Labels:** `frontend`, `visualization`

- Interactive timeline of transaction
- Key milestones marked
- Communication density visualization
- Export timeline as graphic

### TASK-4.4: Smart Transaction Detection
**Priority:** P2 - Post-MVP
**Labels:** `ai`, `automation`

- Detect new transactions from communication patterns
- Suggest creating transaction when address mentioned frequently
- Alert when transaction appears to be closing

### TASK-4.5: Multi-Agent Collaboration
**Priority:** P3 - Future
**Labels:** `collaboration`

- Share transactions between agents
- Role-based access (read-only for compliance)
- Team audit package reviews

### TASK-4.6: CRM Integrations
**Priority:** P3 - Future
**Labels:** `integrations`

- Salesforce integration
- Follow Up Boss integration
- kvCORE integration
- Auto-sync transaction details

---

## Implementation Phases & Timeline

### Phase 0: Foundation (MVP-Critical)
**Tasks:** 0.1, 0.2, 0.3
**Parallel Execution:** All tasks can start immediately

```
TASK-0.1 (LLM Service) ─────────────┐
TASK-0.2 (API Key UI)  ─────────────┼──► Phase 0 Complete
TASK-0.3 (Prompt Templates) ────────┘
```

### Phase 1: Contact Analysis (MVP-Critical)
**Dependencies:** Phase 0
**Tasks:** 1.1, 1.2, 1.3, 1.4

```
TASK-1.1 (Contact-Communication Service) ───┐
                                            ├──► TASK-1.2 (Role Analysis) ──► TASK-1.4 (Batch)
                                            │           │
TASK-1.3 (Role Suggestion UI) ──────────────┘           │
                                                        ▼
                                               Phase 1 Complete
```

### Phase 2: Communication Relevance (MVP-Critical)
**Dependencies:** Phase 0
**Can run in parallel with Phase 1**

```
TASK-2.1 (Address Extraction) ───┐
                                 ├──► TASK-2.2 (Relevance Scoring)
                                 │           │
                                 │           ▼
                                 └───► TASK-2.3 (Filter Service)
                                              │
TASK-2.4 (Communications UI) ────────────────┘
                                              ▼
                                     Phase 2 Complete
```

### Phase 3: Audit Generation (MVP-Critical)
**Dependencies:** Phase 1, Phase 2

```
TASK-3.1 (Data Model) ──────────────────┐
                                        │
TASK-3.2 (PDF Generator) ───────────────┤
                                        ├──► TASK-3.5 (Wizard UI) ──► TASK-3.6 (Close Workflow)
TASK-3.3 (ZIP Archive) ─────────────────┤                                     │
                                        │                                     ▼
TASK-3.4 (AI Summary) ──────────────────┘                              MVP Complete
```

---

## Dependency Graph (Full MVP)

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                       PHASE 0                           │
                    │              LLM Integration Foundation                  │
                    ├─────────────────────────────────────────────────────────┤
                    │  TASK-0.1   TASK-0.2   TASK-0.3   TASK-0.4(P1)         │
                    │  LLM Svc    API Keys   Prompts    Analytics             │
                    └──────────────────────────┬──────────────────────────────┘
                                               │
                    ┌──────────────────────────┴──────────────────────────┐
                    │                                                      │
                    ▼                                                      ▼
     ┌──────────────────────────────┐              ┌──────────────────────────────┐
     │          PHASE 1             │              │          PHASE 2             │
     │   Contact Role Analysis      │              │   Communication Relevance    │
     ├──────────────────────────────┤              ├──────────────────────────────┤
     │ TASK-1.1 Contact-Comm Svc    │              │ TASK-2.1 Address Extraction  │
     │ TASK-1.2 Role Analysis LLM   │              │ TASK-2.2 Relevance Scoring   │
     │ TASK-1.3 Role Suggestion UI  │              │ TASK-2.3 Filter Service      │
     │ TASK-1.4 Batch Processing    │              │ TASK-2.4 Communications UI   │
     └──────────────────────────────┘              └──────────────────────────────┘
                    │                                          │
                    └──────────────────┬───────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                       PHASE 3                           │
                    │              Audit Package Generation                   │
                    ├─────────────────────────────────────────────────────────┤
                    │ TASK-3.1 Data Model       TASK-3.4 AI Summary           │
                    │ TASK-3.2 PDF Generator    TASK-3.5 Wizard UI            │
                    │ TASK-3.3 ZIP Archive      TASK-3.6 Close Workflow (P1)  │
                    └─────────────────────────────────────────────────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  MVP LAUNCH │
                                        └─────────────┘
                                               │
                                               ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                       PHASE 4                           │
                    │              Post-MVP Enhancements                      │
                    ├─────────────────────────────────────────────────────────┤
                    │ TASK-4.1 Attachments     TASK-4.4 Smart Detection       │
                    │ TASK-4.2 Android         TASK-4.5 Collaboration         │
                    │ TASK-4.3 Timeline Viz    TASK-4.6 CRM Integrations      │
                    └─────────────────────────────────────────────────────────┘
```

---

## MVP Launch Checklist

### Technical Requirements
- [ ] All P0 tasks completed
- [ ] End-to-end flow tested manually
- [ ] LLM costs documented and communicated
- [ ] Error handling for API failures
- [ ] Offline mode graceful degradation
- [ ] Performance acceptable (<30s for analysis)

### Documentation Requirements
- [ ] User guide for AI features
- [ ] API key setup instructions
- [ ] Troubleshooting guide
- [ ] Privacy policy updated (LLM data handling)

### Quality Requirements
- [ ] Unit tests for all new services
- [ ] Integration tests for LLM flows
- [ ] Manual QA on macOS and Windows
- [ ] Security review of API key handling

---

## Linear Import Guide

### Project Structure
```
Project: Magic Audit
└── Cycles:
    ├── MVP Phase 0: LLM Foundation
    ├── MVP Phase 1: Contact Analysis
    ├── MVP Phase 2: Communication Relevance
    ├── MVP Phase 3: Audit Generation
    └── Post-MVP: Enhancements
```

### Labels to Create
- `ai` - AI/LLM related tasks
- `backend` - Electron main process work
- `frontend` - React UI work
- `database` - Schema/migration work
- `architecture` - System design work
- `export` - Export/audit generation
- `transactions` - Transaction feature work
- `contacts` - Contact feature work
- `settings` - Settings/config work
- `platform` - Platform-specific work
- `performance` - Optimization work

### Priority Mapping
- `P0` → Urgent (MVP Critical)
- `P1` → High (Should have for MVP)
- `P2` → Medium (Post-MVP)
- `P3` → Low (Future)

### Task Template for Linear
```
Title: [TASK-X.Y] Brief Description

## Description
[Full description from this document]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
...

## Technical Notes
[Technical notes if any]

## Dependencies
Blocked by: [TASK-X.Y]
Blocks: [TASK-X.Y]

## Labels
[Labels from this document]
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM API costs higher than expected | Medium | High | Token budgeting, usage caps, user-provided keys |
| LLM accuracy insufficient | Medium | High | Prompt iteration, human confirmation step |
| API rate limits | Low | Medium | Queue system, exponential backoff |
| User confusion with AI features | Medium | Medium | Clear UI, confidence indicators |
| Privacy concerns with LLM | Medium | High | Clear disclosure, local processing options |

---

## Success Metrics

### MVP Launch Metrics
- Users can generate audit package in <5 minutes
- AI contact role accuracy >80%
- AI communication relevance accuracy >85%
- System handles transactions with 100+ communications

### Post-Launch Metrics
- User adoption of AI features
- Time saved vs manual process
- Error rate in audit packages
- User satisfaction scores

---

## Appendix A: Existing Code to Leverage

| Existing Service | Reuse For |
|------------------|-----------|
| `databaseService.ts` | New audit tables |
| `tokenEncryptionService.ts` | LLM API key storage |
| `pdfExportService.ts` | Enhanced audit PDF |
| `transactionService.ts` | Transaction closure workflow |
| `contactsService.ts` | Contact-communication linking |
| `gmailFetchService.ts` | Email retrieval for analysis |
| `outlookFetchService.ts` | Email retrieval for analysis |
| `messagesService.ts` | Text message retrieval |
| `addressVerificationService.ts` | Property address normalization |
| `validationService.ts` | Input validation patterns |
| `rateLimitService.ts` | LLM API rate limiting |

---

## Appendix B: Prompt Engineering Notes

### Contact Role Analysis Prompt (Draft)
```
You are an expert at analyzing real estate transaction communications.

Given the following email/text communications involving a contact named "{contact_name}",
determine their role in the real estate transaction for the property at "{property_address}".

## Communications
{communications}

## Available Roles
- Buyer (purchasing the property)
- Seller (selling the property)
- Listing Agent (representing seller)
- Buyer's Agent (representing buyer)
- Title Officer (handling title search/insurance)
- Escrow Officer (handling escrow/closing)
- Home Inspector (conducting property inspection)
- Appraiser (conducting property appraisal)
- Lender/Loan Officer (handling financing)
- Attorney (legal representation)
- Other (specify)

## Instructions
1. Analyze the communication content carefully
2. Look for explicit role mentions ("I'm the listing agent", "as your lender")
3. Look for implicit role indicators (discussing inspection findings = inspector)
4. Consider email signatures and titles
5. If unclear, assign "Unknown" with explanation

## Response Format (JSON)
{
  "contact_name": "{contact_name}",
  "suggested_role": "string",
  "confidence": "high|medium|low",
  "evidence": ["quote1", "quote2"],
  "reasoning": "explanation"
}
```

---

**End of Project Plan**
