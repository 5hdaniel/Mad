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

- [ ] Show "AI Suggested Contacts" section if suggested_contacts exists
- [ ] Display each contact with suggested role
- [ ] "Accept All" button applies all suggestions
- [ ] Individual accept/modify/reject per contact
- [ ] Feedback recorded on accept/reject
- [ ] Section hidden after all suggestions processed
- [ ] All CI checks pass

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

*To be completed by engineer*
