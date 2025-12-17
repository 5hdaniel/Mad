# Linear Task Import - Magic Audit AI MVP

Quick-reference task list for Linear. Copy each task section into Linear.

---

## Cycle: MVP Phase 0 - LLM Foundation

### [TASK-0.1] Create LLM Provider Service Architecture
**Priority:** Urgent | **Labels:** `ai`, `backend`, `architecture`

Create abstraction layer for LLM communication (OpenAI/Anthropic).

**Acceptance Criteria:**
- [ ] Create `electron/services/llmService.ts` with provider abstraction
- [ ] Support OpenAI API (GPT-4) as primary
- [ ] Support Anthropic API (Claude) as secondary
- [ ] Secure API key storage via electron safeStorage
- [ ] Token counting and cost estimation
- [ ] Rate limiting and retry logic
- [ ] Unit tests

---

### [TASK-0.2] Add LLM API Key Management UI
**Priority:** Urgent | **Labels:** `ai`, `frontend`, `settings`

**Blocked by:** None | **Blocks:** TASK-1.2, TASK-2.2, TASK-3.4

Add Settings UI for users to configure LLM API keys.

**Acceptance Criteria:**
- [ ] New "AI Configuration" section in Settings
- [ ] OpenAI API key input with validation
- [ ] Anthropic API key input (optional)
- [ ] Secure storage via IPC
- [ ] Connection status indicator
- [ ] Help links for obtaining keys

---

### [TASK-0.3] Build Prompt Template System
**Priority:** Urgent | **Labels:** `ai`, `backend`

**Blocked by:** None | **Blocks:** TASK-1.2, TASK-2.2, TASK-3.4

Create structured prompt management for consistent LLM interactions.

**Acceptance Criteria:**
- [ ] Create `electron/services/promptTemplateService.ts`
- [ ] Template types: contact_role, communication_relevance, summary
- [ ] Variable interpolation support
- [ ] Load prompts from JSON files in `electron/prompts/`
- [ ] Unit tests

---

### [TASK-0.4] Implement LLM Usage Analytics
**Priority:** High | **Labels:** `ai`, `analytics`, `backend`

**Blocked by:** TASK-0.1

Track LLM API usage and costs.

**Acceptance Criteria:**
- [ ] Log all API calls with token counts
- [ ] Store usage in SQLite
- [ ] Calculate costs per model
- [ ] Usage summary endpoint
- [ ] Cost threshold warnings

---

## Cycle: MVP Phase 1 - Contact Role Analysis

### [TASK-1.1] Build Contact-Communication Association Service
**Priority:** Urgent | **Labels:** `backend`, `contacts`

**Blocked by:** None | **Blocks:** TASK-1.2

Link contacts to their emails/texts for analysis.

**Acceptance Criteria:**
- [ ] Create `electron/services/contactCommunicationService.ts`
- [ ] Query all emails/texts for a contact
- [ ] Build communication corpus per contact
- [ ] Filter by date range
- [ ] Handle multiple contact identities (work email, personal, phone)

---

### [TASK-1.2] Implement Contact Role Analysis LLM
**Priority:** Urgent | **Labels:** `ai`, `backend`, `llm`

**Blocked by:** TASK-0.1, TASK-0.3, TASK-1.1 | **Blocks:** TASK-1.3

Use LLM to identify contact roles from communication content.

**Acceptance Criteria:**
- [ ] Create role analysis prompt template
- [ ] Send contact corpus to LLM
- [ ] Parse response for role suggestions
- [ ] Confidence scoring (high/medium/low)
- [ ] Support all transaction roles (Buyer, Seller, Agent, Title, Escrow, Inspector, etc.)
- [ ] Evidence extraction (quotes supporting role)
- [ ] Unit tests with mock responses

---

### [TASK-1.3] Create AI Role Suggestion Modal UI
**Priority:** Urgent | **Labels:** `ai`, `frontend`, `transactions`

**Blocked by:** TASK-1.2 | **Blocks:** TASK-3.5

Display AI-suggested roles with confirm/override capability.

**Acceptance Criteria:**
- [ ] New `AIRoleSuggestionModal.tsx` component
- [ ] List contacts with suggested roles
- [ ] Confidence indicators
- [ ] Evidence snippets display
- [ ] Confirm/override actions
- [ ] "Analyze Contacts" button in transaction view
- [ ] Loading and error states

---

### [TASK-1.4] Optimize Batch Contact Analysis
**Priority:** Urgent | **Labels:** `ai`, `backend`, `performance`

**Blocked by:** TASK-1.2

Efficient processing of multiple contacts.

**Acceptance Criteria:**
- [ ] Batch contacts into single LLM calls when possible
- [ ] Parallel processing with configurable concurrency
- [ ] Progress tracking
- [ ] Resume capability
- [ ] Result caching

---

## Cycle: MVP Phase 2 - Communication Relevance

### [TASK-2.1] Create Property Address Extraction Service
**Priority:** Urgent | **Labels:** `ai`, `backend`, `nlp`

**Blocked by:** TASK-0.1, TASK-0.3 | **Blocks:** TASK-2.2

Extract/normalize property addresses from communications.

**Acceptance Criteria:**
- [ ] Create `electron/services/addressExtractionService.ts`
- [ ] Use LLM to identify addresses in text
- [ ] Normalize to standard format
- [ ] Match against Google Places API
- [ ] Handle variations and partial addresses
- [ ] Unit tests

---

### [TASK-2.2] Implement Communication Relevance Scoring
**Priority:** Urgent | **Labels:** `ai`, `backend`, `llm`

**Blocked by:** TASK-0.1, TASK-0.3, TASK-2.1 | **Blocks:** TASK-2.3

Score communications by transaction relevance (0-100).

**Acceptance Criteria:**
- [ ] Create relevance scoring prompt
- [ ] Score based on: address mention, keywords, party involvement
- [ ] Categorize: Contract, Inspection, Financing, Title, Closing, General
- [ ] Handle long email threads
- [ ] Batch processing
- [ ] Store scores in database

---

### [TASK-2.3] Build Transaction Communication Filter
**Priority:** Urgent | **Labels:** `backend`, `transactions`

**Blocked by:** TASK-2.2 | **Blocks:** TASK-2.4

Filter and retrieve relevant communications for transactions.

**Acceptance Criteria:**
- [ ] Create `electron/services/transactionCommunicationService.ts`
- [ ] Query by property address
- [ ] Query by assigned contacts
- [ ] Query by date range
- [ ] Combine AI scores with explicit filters
- [ ] Sort by relevance/date/sender
- [ ] Pagination support

---

### [TASK-2.4] Create Relevant Communications UI
**Priority:** Urgent | **Labels:** `frontend`, `transactions`

**Blocked by:** TASK-2.3 | **Blocks:** TASK-3.5

Display filtered communications in transaction view.

**Acceptance Criteria:**
- [ ] New `TransactionCommunications.tsx` component
- [ ] List view with relevance indicators
- [ ] Category tags
- [ ] Expandable message preview
- [ ] Filter by type/sender/category
- [ ] "Include in Audit" toggle
- [ ] Bulk select/deselect

---

## Cycle: MVP Phase 3 - Audit Package Generation

### [TASK-3.1] Design Audit Package Data Model
**Priority:** Urgent | **Labels:** `backend`, `database`

**Blocked by:** None | **Blocks:** TASK-3.2, TASK-3.3

Database schema for audit packages.

**Acceptance Criteria:**
- [ ] Create `audit_packages` table
- [ ] Create `audit_package_items` table
- [ ] Fields: id, transaction_id, status, config, file_path
- [ ] Version tracking
- [ ] Supabase sync
- [ ] Migration scripts

---

### [TASK-3.2] Enhance PDF Audit Report Generator
**Priority:** Urgent | **Labels:** `backend`, `export`, `pdf`

**Blocked by:** TASK-3.1 | **Blocks:** TASK-3.5

Generate comprehensive PDF audit reports.

**Acceptance Criteria:**
- [ ] Extend `pdfExportService.ts`
- [ ] Cover page with transaction details
- [ ] Table of contents
- [ ] Contact summary with roles
- [ ] Chronological communication log
- [ ] Professional styling
- [ ] Configurable sections
- [ ] Handle 100+ page packages

---

### [TASK-3.3] Create ZIP Archive Generator
**Priority:** Urgent | **Labels:** `backend`, `export`

**Blocked by:** TASK-3.1 | **Blocks:** TASK-3.5

Generate ZIP archives with all audit materials.

**Acceptance Criteria:**
- [ ] Create `electron/services/auditArchiveService.ts`
- [ ] Include PDF summary
- [ ] Include email exports
- [ ] Include text message exports
- [ ] Organized folder structure
- [ ] Progress tracking
- [ ] Compression options

---

### [TASK-3.4] Implement AI Transaction Summary
**Priority:** Urgent | **Labels:** `ai`, `backend`, `llm`

**Blocked by:** TASK-0.1, TASK-0.3 | **Blocks:** TASK-3.5

LLM-generated executive summary of transaction.

**Acceptance Criteria:**
- [ ] Create summary generation prompt
- [ ] Input: communications + transaction details
- [ ] Output: 1-2 page narrative
- [ ] Sections: Overview, Timeline, Decisions, Issues, Outcome
- [ ] Handle token limits
- [ ] Regeneration capability
- [ ] Edit support

---

### [TASK-3.5] Build Audit Package Wizard UI
**Priority:** Urgent | **Labels:** `frontend`, `export`, `audit`

**Blocked by:** TASK-1.3, TASK-2.4, TASK-3.2, TASK-3.3, TASK-3.4

Multi-step wizard for audit package generation.

**Acceptance Criteria:**
- [ ] New `AuditPackageWizard.tsx` component
- [ ] Step 1: Review transaction details
- [ ] Step 2: Confirm contacts and roles
- [ ] Step 3: Select communications
- [ ] Step 4: Configure export options
- [ ] Step 5: Generate & Download
- [ ] Progress indicator
- [ ] Preview before generation
- [ ] Error handling

---

### [TASK-3.6] Add Close Transaction Workflow
**Priority:** High | **Labels:** `frontend`, `backend`, `transactions`

**Blocked by:** TASK-3.5

Explicit workflow for transaction closure.

**Acceptance Criteria:**
- [ ] Add transaction status field (active/pending_close/closed)
- [ ] "Close Transaction" action
- [ ] Closing checklist
- [ ] Prompt for audit generation
- [ ] Visual closed indicator
- [ ] Archive view for closed transactions
- [ ] Edit protection for closed

---

## Cycle: Post-MVP Enhancements

### [TASK-4.1] Attachment Extraction & Organization
**Priority:** Medium | **Labels:** `backend`, `attachments`

Extract and categorize email attachments for audit packages.

---

### [TASK-4.2] Android Phone Support
**Priority:** Medium | **Labels:** `platform`, `android`

Add support for Android phone message extraction.

---

### [TASK-4.3] Timeline Visualization
**Priority:** Medium | **Labels:** `frontend`, `visualization`

Interactive timeline view of transaction events.

---

### [TASK-4.4] Smart Transaction Detection
**Priority:** Medium | **Labels:** `ai`, `automation`

Auto-detect new transactions from communication patterns.

---

### [TASK-4.5] Multi-Agent Collaboration
**Priority:** Low | **Labels:** `collaboration`

Share transactions between team members.

---

### [TASK-4.6] CRM Integrations
**Priority:** Low | **Labels:** `integrations`

Salesforce, Follow Up Boss, kvCORE integrations.

---

## Quick Stats

| Metric | Count |
|--------|-------|
| **Total MVP Tasks** | 16 |
| **P0 (Urgent)** | 14 |
| **P1 (High)** | 2 |
| **Post-MVP Tasks** | 6 |
| **Total Tasks** | 22 |

## Suggested Linear Workflow

1. Create Project: "Magic Audit"
2. Create Labels (see PROJECT_PLAN.md)
3. Create Cycles:
   - "MVP Phase 0: LLM Foundation"
   - "MVP Phase 1: Contact Analysis"
   - "MVP Phase 2: Communication Relevance"
   - "MVP Phase 3: Audit Generation"
   - "Post-MVP: Enhancements"
4. Import tasks into respective cycles
5. Set dependencies as noted in "Blocked by" fields
6. Assign to team members

## Parallel Execution Groups

**Can Start Immediately (No Dependencies):**
- TASK-0.1, TASK-0.2, TASK-0.3
- TASK-1.1
- TASK-3.1

**After Phase 0 Complete:**
- TASK-1.2, TASK-1.4
- TASK-2.1, TASK-2.2

**After Phase 1 + 2 Core Complete:**
- TASK-3.2, TASK-3.3, TASK-3.4, TASK-3.5
