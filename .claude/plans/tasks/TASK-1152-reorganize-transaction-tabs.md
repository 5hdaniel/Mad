# TASK-1152: Reorganize Transaction Details Tabs - Move Emails to Own Tab

**Backlog ID:** BACKLOG-363
**Sprint:** SPRINT-048
**Phase:** 1 (Track C - Transaction Details, First Task)
**Branch:** `feature/task-1152-reorganize-tabs`
**Estimated Turns:** 12-18
**Estimated Tokens:** 30K-40K

---

## Objective

Reorganize the transaction details page tabs to create a dedicated "Emails" tab and enhance the default Overview tab with audit dates and contact summary. This improves navigation and makes email threads more accessible.

---

## Context

Currently the transaction details page has:
- **Transaction Details** tab: Contains "Related Emails" section + transaction dates
- **Roles & Contacts** tab: Contact list
- **Messages** tab: Text conversations

Problems:
1. Emails are buried in the Details tab with other info
2. No dedicated space for email threads
3. Audit date range not prominently displayed
4. Users need to navigate to Contacts tab to see who's involved

---

## Requirements

### Must Do:
1. Create new "Emails" tab for email threads
2. Move "Related Emails" section from Details tab to new Emails tab
3. Rename "Transaction Details" to "Overview"
4. Add audit period (start date - end date) prominently to Overview
5. Add contact summary with roles to Overview (can duplicate from Contacts tab)
6. Update tab navigation to include Emails tab
7. Add email count badge to Emails tab

### Must NOT Do:
- Change email threading logic
- Modify how emails are fetched or linked
- Remove the Contacts tab (keep for detailed editing)
- Change the Messages tab

---

## Acceptance Criteria

- [ ] New "Emails" tab created and functional
- [ ] Email threads moved from Details to Emails tab
- [ ] "Transaction Details" renamed to "Overview"
- [ ] Audit date range shown prominently in Overview
- [ ] Contacts with roles summary in Overview
- [ ] Tab navigation includes: Overview, Messages, Emails, Contacts
- [ ] Email count badge on Emails tab header
- [ ] Navigation between tabs works smoothly

---

## Files to Modify

- `src/components/transactionDetailsModule/components/TransactionTabs.tsx` - Add Emails tab
- `src/components/transactionDetailsModule/components/TransactionDetailsTab.tsx` - Remove emails, add contacts summary
- `src/components/transactionDetailsModule/types.ts` - Add "emails" to TransactionTab type
- Create: `src/components/transactionDetailsModule/components/TransactionEmailsTab.tsx` - New emails tab component

## Files to Read (for context)

- `src/components/transactionDetailsModule/components/TransactionTabs.tsx` - Current tab structure (72 lines)
- `src/components/transactionDetailsModule/components/TransactionDetailsTab.tsx` - Related Emails section (161 lines)
- `src/components/transactionDetailsModule/types.ts` - TransactionTab type
- `src/components/transactionDetailsModule/components/TransactionContactsTab.tsx` - Contact display for reference

---

## Technical Notes

### Current Tab Type
```typescript
// In types.ts
type TransactionTab = "details" | "contacts" | "messages" | "attachments";
```

Should become:
```typescript
type TransactionTab = "overview" | "messages" | "emails" | "contacts" | "attachments";
```

### Tab Order
1. Overview (default)
2. Messages (text threads)
3. Emails (email threads)
4. Contacts (detailed contact management)

### Overview Tab Content
```
┌─────────────────────────────────────────────────────┐
│ Overview                                              │
├─────────────────────────────────────────────────────┤
│ Audit Period                                          │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │ Start Date  │ │ Closing     │ │ End Date    │    │
│ │ Jan 1, 2026 │ │ Jan 10, 2026│ │ Jan 15, 2026│    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                       │
│ Key Contacts                                          │
│ ┌─────────────────────────────────────────────────┐  │
│ │ John Smith - Buyer's Agent                       │  │
│ │ Jane Doe - Seller                                │  │
│ │ Escrow Corp - Escrow Officer                     │  │
│ └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Emails Tab
- Reuse CommunicationCard component from TransactionDetailsTab
- Display email count in tab badge

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI restructuring)
- **Existing tests to update:** Update any tests that reference "details" tab to "overview"

### Manual Testing
- [ ] Navigate to transaction details - Overview tab is default
- [ ] Click each tab - all navigate correctly
- [ ] Emails tab shows email threads
- [ ] Overview shows audit dates
- [ ] Overview shows contact summary
- [ ] Email count badge shows correct number

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(ui): reorganize transaction details tabs with dedicated emails tab`
- **Branch:** `feature/task-1152-reorganize-tabs`
- **Target:** `int/sprint-ui-export-and-details`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from int/sprint-ui-export-and-details
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Emails in Details tab, no audit dates summary
- **After**: Dedicated Emails tab, Overview with dates and contacts
- **Actual Turns**: X (Est: 12-18)
- **Actual Tokens**: ~XK (Est: 30-40K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The transaction data model doesn't have the fields needed
- You need to add new API calls for contact data
- Breaking changes to existing tab navigation
- You encounter blockers not covered in the task file
