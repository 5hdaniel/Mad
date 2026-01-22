# Feature: Update databaseService.ts for LLM/Agent-Ready Schema

## Summary

The database schema (`electron/database/schema.sql`) and TypeScript interfaces (`electron/types/models.ts`) have been redesigned to support LLM integration, agent-ready architecture, and retroactive contact matching. The `databaseService.ts` file needs to be updated to implement CRUD operations for the new tables and fields.

## Context

This work is part of the production-readiness effort based on consultant recommendations. The schema changes enable:

1. **LLM Classification Tracking** - Store confidence scores, classification methods (pattern/llm/user), and feedback
2. **Multi-Value Contact Support** - Contact child tables (`contact_emails`, `contact_phones`) for retroactive matching
3. **Transaction Stages** - Stage fields and history tracking for timeline features
4. **Audit Packages** - Structured export packages with completeness scoring
5. **Message Attachments** - Proper attachment tracking with hash-based deduplication

## Related PRs/Commits

- `64d20dc` - feat: redesign database schema for LLM/agent-ready architecture
- `1b6bdf0` - feat: update TypeScript interfaces to match new schema

## Technical Requirements

### New Tables to Implement

| Table | Purpose | Priority |
|-------|---------|----------|
| `messages` | Renamed from `communications`, adds classification fields | High |
| `attachments` | Message attachments with file hashes | High |
| `contact_emails` | Multi-value emails per contact | High |
| `contact_phones` | Multi-value phones per contact | High |
| `audit_packages` | Export package metadata | Medium |
| `transaction_stage_history` | Stage change audit trail | Medium |
| `classification_feedback` | User corrections for ML improvement | Low |

### Key Schema Changes

#### Messages Table (formerly communications)
```typescript
interface Message {
  // ... existing fields ...

  // NEW: Classification Results
  is_transaction_related: number | null;
  classification_confidence: number | null;
  classification_method: 'pattern' | 'llm' | 'user' | null;
  classified_at: string | null;

  // NEW: Stage Hint
  stage_hint: string | null;
  stage_hint_source: string | null;
  stage_hint_confidence: number | null;

  // NEW: Transaction Link
  transaction_id: string | null;
  transaction_link_confidence: number | null;
  transaction_linked_at: string | null;
  transaction_link_method: string | null;
}
```

#### Contact Child Tables
```typescript
interface ContactEmail {
  id: string;
  contact_id: string;
  email: string;
  is_primary: number;
  source: 'import' | 'manual' | 'inferred';
  confidence: number | null;
  verified_at: string | null;
  created_at: string;
}

interface ContactPhone {
  id: string;
  contact_id: string;
  phone: string;
  phone_type: 'mobile' | 'work' | 'home' | 'other' | null;
  is_primary: number;
  source: 'import' | 'manual' | 'inferred';
  confidence: number | null;
  verified_at: string | null;
  created_at: string;
}
```

### Implementation Tasks

1. **Update existing methods**
   - [ ] `saveContact()` - Also save to `contact_emails` and `contact_phones`
   - [ ] `getContact()` - Join with child tables
   - [ ] `updateContact()` - Handle child table updates
   - [ ] `saveCommunication()` - Rename to `saveMessage()`, add new fields
   - [ ] `getCommunications()` - Rename to `getMessages()`, add classification filters

2. **Add new methods**
   - [ ] `addContactEmail(contactId, email, options)`
   - [ ] `addContactPhone(contactId, phone, options)`
   - [ ] `removeContactEmail(id)`
   - [ ] `removeContactPhone(id)`
   - [ ] `findContactByEmail(email)` - For retroactive matching
   - [ ] `findContactByPhone(phone)` - For retroactive matching
   - [ ] `updateMessageClassification(messageId, classification)`
   - [ ] `linkMessageToTransaction(messageId, transactionId, confidence)`
   - [ ] `createAuditPackage(transactionId, options)`
   - [ ] `getAuditPackage(packageId)`
   - [ ] `recordStageChange(transactionId, stage, source)`
   - [ ] `recordClassificationFeedback(messageId, feedback)`

3. **Add indexes for performance**
   - Ensure indexes exist on `contact_emails.email` and `contact_phones.phone`
   - Add composite indexes for common query patterns

### Testing Considerations

- All existing tests should continue to pass (backwards compatibility)
- Add tests for retroactive contact matching
- Add tests for classification update flows
- Test transaction linking with confidence scores

## Acceptance Criteria

- [ ] All new tables have corresponding CRUD operations in databaseService.ts
- [ ] Contact queries return joined email/phone data
- [ ] Message classification updates work correctly
- [ ] Retroactive matching finds contacts by email/phone
- [ ] No breaking changes to existing API consumers
- [ ] TypeScript types match runtime behavior

## Estimated Scope

Medium-large feature (2-3 days of focused work)

## Files to Modify

- `electron/services/databaseService.ts` - Main implementation
- `electron/database/databaseService.test.ts` - Add/update tests
- Potentially update IPC handlers that call databaseService

## Notes

- The schema supports backwards compatibility via legacy type aliases
- iPhone sync flow UI is complete and ready for this backend work
- Consider implementing in phases: contacts first, then messages, then audit packages
