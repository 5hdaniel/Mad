# BACKLOG-078: AI MVP Phase 5 - UI Enhancements

**Priority:** Medium
**Type:** Frontend
**Sprint:** SPRINT-006
**Estimated Effort:** 13 turns (~1.5h)
**Dependencies:** BACKLOG-076 (Pipeline), BACKLOG-077 (Feedback)

---

## Description

Enhance existing UI components to support AI detection features. This phase adds LLM settings, detection status filters, approval workflows, and visual indicators for AI-detected transactions.

---

## Tasks

### U01: LLM Settings Component
**Estimated:** 3 turns
**File:** `src/components/settings/LLMSettings.tsx`

Add to existing Settings page:
- Two tabs: OpenAI | Anthropic
- API key input with show/hide toggle
- "Validate Key" button with status indicator (✓ valid, ✗ invalid)
- Model selection dropdown per provider
- Usage display: "X tokens used this month (limit: Y)"
- Platform allowance toggle: "Use platform allowance instead"
- Feature toggles: Auto-detect, Role extraction
- **Consent checkbox** (Option C): "I understand my email content will be sent to [provider] for analysis"

**Acceptance Criteria:**
- [ ] API key saved securely
- [ ] Validation shows success/error states
- [ ] Usage stats display correctly
- [ ] Consent required before first use

### U02a: Add Detection Status Filter Tabs
**Estimated:** 3 turns
**File:** `src/components/TransactionList.tsx`

Add filter tabs to existing toolbar:
- `All | Confirmed | Pending Review | Rejected`
- Filter transactions by `detection_status` field
- Update URL params for bookmarkable filters
- Show count badge per tab

**Acceptance Criteria:**
- [ ] Tabs filter correctly
- [ ] Counts update in real-time
- [ ] URL reflects current filter

### U02b: Add Detection Badges to Transaction Cards
**Estimated:** 3 turns
**File:** `src/components/TransactionList.tsx`

Add visual indicators to transaction cards:
- "AI Detected" badge (blue-purple gradient) for `detection_source='auto'`
- "Manual" badge (gray) for `detection_source='manual'`
- Confidence pill: "85%" with color scale
  - Red: < 60%
  - Yellow: 60-80%
  - Green: > 80%
- "Pending Review" warning badge for `detection_status='pending'`

**Acceptance Criteria:**
- [ ] Badges render correctly
- [ ] Confidence colors match thresholds
- [ ] Pending transactions visually distinct

### U02c: Add Approve/Reject Actions
**Estimated:** 2 turns
**File:** `src/components/TransactionList.tsx`

Add action buttons for pending transactions:
- ✓ Approve button → Update `detection_status='confirmed'`, record feedback
- ✗ Reject button → Show reason modal, update status, record feedback
- Edit button → Open AuditTransactionModal in edit mode
- Record all actions to feedback service

**Acceptance Criteria:**
- [ ] Approve updates status and records feedback
- [ ] Reject shows reason modal
- [ ] Edit opens modal in edit mode
- [ ] Actions only show for pending transactions

### U03: Update AuditTransactionModal for Edit Mode
**Estimated:** 2 turns
**File:** `src/components/AuditTransactionModal.tsx`

Modify existing modal:
1. Accept `editTransaction?: Transaction` prop
2. If editing, pre-fill all fields from the transaction
3. Allow skipping address verification if already verified
4. Pre-populate suggested contacts from `transaction.suggested_contacts` JSON
5. On save: update transaction instead of create, record feedback if changed

**Acceptance Criteria:**
- [ ] Edit mode pre-fills fields
- [ ] Suggested contacts shown
- [ ] Save updates existing transaction
- [ ] Feedback recorded on changes

### U05: Suggested Contacts Display
**Estimated:** 2 turns
**File:** `src/components/TransactionDetails.tsx`

If `suggested_contacts` JSON exists and contacts not yet assigned:
- Show "AI Suggested Contacts" section
- Display each suggested contact with their suggested role
- "Accept All" button to apply all suggestions
- Individual accept/modify/reject per contact
- Record feedback on accept/reject

**Acceptance Criteria:**
- [ ] Suggestions displayed clearly
- [ ] Accept all applies suggestions
- [ ] Individual actions work
- [ ] Feedback recorded

### U06: Loading States for LLM Processing
**Estimated:** 2 turns
**File:** `src/components/LLMLoadingStates.tsx`

Skeleton and loading UI for LLM operations:
- Skeleton cards during transaction analysis
- Progress indicator for batch processing
- "Analyzing with AI..." messaging
- Estimated time remaining display

**Acceptance Criteria:**
- [ ] Skeleton renders during analysis
- [ ] Progress shown for batch operations
- [ ] User knows LLM is working

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/settings/LLMSettings.tsx` | LLM configuration UI |
| `src/components/LLMLoadingStates.tsx` | Loading/skeleton components |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/Settings.tsx` | Add LLM settings section |
| `src/components/TransactionList.tsx` | Add filters, badges, actions |
| `src/components/AuditTransactionModal.tsx` | Add edit mode |
| `src/components/TransactionDetails.tsx` | Add suggested contacts |

---

## Design Notes

### Badge Colors
```css
/* AI Detected badge */
background: linear-gradient(135deg, #3B82F6, #8B5CF6);

/* Manual badge */
background: #6B7280;

/* Confidence pills */
.confidence-low { background: #EF4444; }    /* < 60% */
.confidence-medium { background: #F59E0B; } /* 60-80% */
.confidence-high { background: #10B981; }   /* > 80% */

/* Pending Review badge */
background: #F59E0B;
```

### Consent Modal Text (Option C)
```
Before using AI features, please acknowledge:

Your email content will be sent to [OpenAI/Anthropic] for analysis.
This includes email subjects, bodies, and sender/recipient information.

Personal information is sanitized before sending, but some content
may still be transmitted to the AI provider.

[ ] I understand and consent to this data processing

[Cancel] [Accept & Continue]
```

---

## Quality Gate: UI Complete

Before marking complete, verify:
- [ ] All UI components functional
- [ ] Settings save and load correctly
- [ ] Filters work as expected
- [ ] Badges display correctly
- [ ] Approve/reject workflow complete
- [ ] Consent required before LLM use

---

## Metrics Tracking

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation | - | - | - |
| PR Review | - | - | - |
| Debugging/Fixes | - | - | - |
| **Total** | - | - | - |

*Fill in after completion*
