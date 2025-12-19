# Task TASK-410: Suggested Contacts Display

## Goal

Display AI-suggested contacts on TransactionDetails page, allowing users to accept or reject suggestions with feedback recording.

## Non-Goals

- Do NOT modify contact assignment logic
- Do NOT implement contact creation
- Do NOT modify AuditTransactionModal (TASK-409)

## Deliverables

1. Update: `src/components/TransactionDetails.tsx`

## Acceptance Criteria

- [x] Show "AI Suggested Contacts" section if suggested_contacts exists
- [x] Display each contact with suggested role
- [x] "Accept All" button applies all suggestions
- [x] Individual accept/modify/reject per contact
- [x] Feedback recorded on accept/reject
- [x] Section hidden after all suggestions processed
- [x] All CI checks pass

## Implementation Notes

```typescript
// Add to TransactionDetails.tsx:
function SuggestedContactsSection({ transaction, onUpdate }: Props) {
  const suggestedContacts = useMemo(() => {
    try {
      return JSON.parse(transaction.suggested_contacts || '{}');
    } catch { return {}; }
  }, [transaction.suggested_contacts]);

  if (!Object.keys(suggestedContacts).length) return null;

  const handleAcceptAll = async () => {
    for (const [contactId, role] of Object.entries(suggestedContacts)) {
      await window.api.transactions.assignContact(transaction.id, contactId, role as string);
      await window.api.feedback.recordRole(userId, {
        transactionId: transaction.id,
        contactId,
        originalRole: role as string,
        correctedRole: role as string,
      });
    }
    await clearSuggestedContacts(transaction.id);
    onUpdate();
  };

  const handleAccept = async (contactId: string, role: string) => {
    await window.api.transactions.assignContact(transaction.id, contactId, role);
    await removeSuggestion(contactId);
    onUpdate();
  };

  const handleReject = async (contactId: string) => {
    await removeSuggestion(contactId);
    onUpdate();
  };

  return (
    <section className="suggested-contacts">
      <h3>AI Suggested Contacts</h3>
      <button onClick={handleAcceptAll} className="btn-accept-all">Accept All</button>
      {Object.entries(suggestedContacts).map(([contactId, role]) => (
        <SuggestedContactCard
          key={contactId}
          contactId={contactId}
          suggestedRole={role as string}
          onAccept={() => handleAccept(contactId, role as string)}
          onReject={() => handleReject(contactId)}
        />
      ))}
    </section>
  );
}
```

## Integration Notes

- Imports from: `window.api.transactions`, `window.api.feedback`
- Used by: TransactionDetails page
- Depends on: TASK-409

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: Yes
- Tests: Suggestions display, accept/reject flow, feedback recording

## PR Preparation

- **Title**: `feat(ui): add suggested contacts display [TASK-410]`
- **Labels**: `ui`, `ai-mvp`, `phase-2`
- **Depends on**: TASK-409

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`
**Estimated Totals:** 2 turns, ~8K tokens, ~15m
**Confidence:** High

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish (after TASK-409)
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-410-suggested-contacts

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-409
- **Blocks:** Phase 3 (TASK-411, 412)

---

## Implementation Summary (Engineer-Owned)

### Changes Made

**Files Modified:**
1. `src/components/TransactionDetails.tsx` - Added AI Suggested Contacts section to the Contacts tab

**Implementation Details:**
- Added `SuggestedContact` and `ResolvedSuggestedContact` interfaces for type safety
- Added state: `resolvedSuggestions`, `processingContactId`, `processingAll`
- Added `useMemo` to parse suggested_contacts JSON safely
- Added `useEffect` to resolve contact details from contact IDs
- Implemented `handleAcceptSuggestion` - assigns contact, records feedback, removes from suggestions
- Implemented `handleRejectSuggestion` - records rejection feedback, removes from suggestions
- Implemented `handleAcceptAll` - batch processes all suggestions
- Added purple-themed UI section with:
  - AI lightbulb icon and header
  - Suggestion count badge
  - "Accept All" button with loading state
  - Individual suggestion cards with contact details, role badges, accept/reject buttons
  - Loading spinners during processing
  - Disabled states to prevent concurrent operations

**Tests Added:**
- `src/components/__tests__/TransactionDetails.test.tsx` - 14 new test cases covering:
  - Suggestions display when present/absent
  - Accept single suggestion flow (API calls, feedback, UI update)
  - Reject single suggestion flow (feedback, UI update)
  - Accept All functionality (batch processing, UI hidden after)
  - Edge cases (invalid JSON, empty array, contact resolution failure)

### Engineer Checklist
- [x] Code compiles without errors
- [x] All tests pass (14/14 new tests)
- [x] Lint passes (no new errors)
- [x] Implementation matches acceptance criteria
- [x] No business logic in entry files
- [x] Follows existing patterns

### Results
- **Estimated**: 2 turns, ~8K tokens, ~15m
- **Actual**: 3 turns, ~16K tokens, ~20m (Plan: 1, Impl: 2)
- **Deviation**: Slightly over due to comprehensive test suite creation
