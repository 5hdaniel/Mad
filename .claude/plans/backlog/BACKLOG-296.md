# BACKLOG-296: Database Schema Alignment - Service Updates

**Created:** 2026-01-17
**Priority:** High
**Category:** Technical Debt / Data Integrity
**Source:** SR Engineer Database Schema Audit (`research/database-schema-audit` branch)
**Status:** In Progress
**Sprint:** SPRINT-042 (Database Schema Alignment)

---

## Problem Statement

The SR Engineer completed a comprehensive database schema audit identifying **14 architectural findings**. The recent thread-based schema refactor (SPRINT-036) addressed the communications/messages relationship, but exposed that several services still query the old schema patterns.

### Immediate Issue

Services are querying columns that no longer exist or have been deprecated:
- `communications.communication_type` - Channel is now in `messages.channel`
- `communications.sender` - Participants now in `messages.participants`
- `communications.recipients` - Participants now in `messages.participants`

### New Architecture Summary

| Old Pattern | New Pattern |
|-------------|-------------|
| `communications.communication_type` | `messages.channel` (via JOIN) |
| `communications.sender` | `messages.participants` (JSON) |
| `communications.recipients` | `messages.participants` (JSON) |
| `communications` stores email content | `communications` is junction table linking `thread_id` to `transaction_id` |
| Content in communications table | Content in `messages` table |

---

## Affected Services (Confirmed)

### 1. autoLinkService.ts (CRITICAL)

**Lines 191-231** query communications table assuming it stores email content:

```typescript
// Current (broken):
.map(() => "(LOWER(c.sender) LIKE ? OR LOWER(c.recipients) LIKE ?)")
...
AND c.communication_type = 'email'
```

**Impact:** Auto-linking cannot find emails to link to transactions.

### 2. enhancedExportService.ts (HIGH)

**Lines 153, 157, 326, 393, 440, 456, 572, 577** filter by `communication_type`:

```typescript
// Current (broken):
communications.filter((c) => c.communication_type === "email")
communications.filter((c) => c.communication_type === "text")
```

**Impact:** Exports show wrong counts, missing content.

### 3. folderExportService.ts (HIGH)

**Lines 70-71, 101-102, 245-246** filter by `communication_type`:

```typescript
// Current (broken):
emailCount: communications.filter((c) => c.communication_type === "email").length
textCount: communications.filter((c) => c.communication_type === "text").length
```

**Impact:** Folder exports have incorrect categorization.

### 4. pdfExportService.ts (HIGH)

**Lines 511-518** check `communication_type`:

```typescript
// Current (broken):
c.communication_type === 'email' ||
c.communication_type === 'sms' ||
c.communication_type === 'imessage'
```

**Impact:** PDF exports may miscategorize communications.

### 5. messageMatchingService.ts (MEDIUM)

Contains `communication_type` references - needs verification.

---

## Schema Audit Findings to Address

Full audit document: `.claude/docs/DATABASE-SCHEMA-AUDIT.md` (on `research/database-schema-audit` branch)

### CRITICAL Priority

| Finding | Description | Status |
|---------|-------------|--------|
| FINDING-01 | Duplicate junction tables (transaction_participants vs transaction_contacts) | TODO |
| FINDING-02 | Stale column reference in extracted_transaction_data (source_communication_id vs source_message_id) | TODO |
| FINDING-03 | Orphaned feedback service code (queries deleted user_feedback table) | TODO |

### HIGH Priority

| Finding | Description | Status |
|---------|-------------|--------|
| FINDING-04 | Dead FK columns on transactions (buyer_agent_id, seller_agent_id, etc.) | TODO |
| FINDING-05 | Communications table legacy content duplication (20+ columns) | PARTIAL (addressed by thread refactor) |
| FINDING-06 | Missing FK constraints on multiple tables | TODO |

### MEDIUM Priority

| Finding | Description | Status |
|---------|-------------|--------|
| FINDING-07 | Inconsistent naming conventions | TODO (documentation) |
| FINDING-08 | Redundant role storage in transaction_contacts | TODO |
| FINDING-09 | JSON storage patterns inconsistent | TODO |
| FINDING-10 | Potential orphan data risks (ON DELETE behaviors) | TODO |
| FINDING-11 | Index coverage gaps | TODO |

### LOW Priority

| Finding | Description | Status |
|---------|-------------|--------|
| FINDING-12 | Schema version tracking inconsistency | TODO |
| FINDING-13 | CHECK constraint inconsistencies | TODO |
| FINDING-14 | Deprecated fields still in schema | TODO (documented for future cleanup) |

---

## Implementation Phases

### Phase 1: Critical Service Updates (Sprint-ready)

Update services to work with new schema:

1. **Update autoLinkService.ts**
   - Join communications -> messages to access content
   - Query `messages.channel` instead of `communication_type`
   - Query `messages.participants` for sender/recipients
   - Estimated: 2-3K tokens

2. **Update enhancedExportService.ts**
   - Change all `communication_type` filters to `channel`
   - Ensure proper JOIN to messages table
   - Estimated: 3-4K tokens

3. **Update folderExportService.ts**
   - Change type filters
   - Verify export structure matches new data model
   - Estimated: 2K tokens

4. **Update pdfExportService.ts**
   - Change type checks
   - Verify PDF content rendering
   - Estimated: 2K tokens

5. **Update messageMatchingService.ts**
   - Verify and update any communication_type usage
   - Estimated: 1K tokens

### Phase 2: Data Integrity Fixes

1. **Consolidate junction tables (FINDING-01)**
   - Migrate transaction_participants data to transaction_contacts
   - Update transaction_summary view
   - Drop transaction_participants table
   - Estimated: 3-4K tokens

2. **Fix extracted_transaction_data (FINDING-02)**
   - Update communicationDbService.ts to use source_message_id
   - Migration to fix existing data
   - Estimated: 2K tokens

3. **Remove orphaned feedback service (FINDING-03)**
   - Delete feedbackDbService.ts
   - Remove any references
   - Estimated: 1K tokens

### Phase 3: Schema Hardening

1. **Add missing FK constraints (FINDING-06)**
   - Add FKs for transaction contact columns
   - Add FK for ignored_communications
   - Estimated: 2K tokens

2. **Remove dead FK columns (FINDING-04)**
   - Migration to drop buyer_agent_id, seller_agent_id, etc.
   - Update contactDbService backward compatibility code
   - Estimated: 2-3K tokens

3. **Drop legacy communications columns (FINDING-05)**
   - Final cleanup of 20+ deprecated columns
   - Update any remaining COALESCE queries
   - Estimated: 3K tokens

### Phase 4: Index & Constraint Optimization

1. **Add missing indexes (FINDING-11)**
   - Composite indexes for common query patterns
   - Estimated: 1K tokens

2. **Fix CHECK constraints (FINDING-13)**
   - Add 'archived' to transactions status
   - Align 'text' vs 'sms' naming
   - Estimated: 1K tokens

3. **Normalize role storage (FINDING-08)**
   - Consolidate role/role_category/specific_role
   - Migration for existing data
   - Estimated: 2K tokens

---

## Acceptance Criteria

### Phase 1 Complete
- [ ] All export services produce correct output with new schema
- [ ] Auto-linking correctly finds emails by contact email address
- [ ] No runtime errors in affected services
- [ ] Existing tests pass (update if needed)

### Phase 2 Complete
- [ ] Single source of truth for transaction contacts
- [ ] extracted_transaction_data correctly references messages
- [ ] No dead code referencing deleted tables

### Phase 3 Complete
- [ ] All FKs enforced at database level
- [ ] No duplicate storage of contact assignments
- [ ] Communications table is lean junction table

### Phase 4 Complete
- [ ] Query performance improved for common patterns
- [ ] Consistent naming and constraints

---

## Dependencies

- **SPRINT-036** (Completed): Thread-based message parsing
- **Research Branch**: `research/database-schema-audit` contains full audit

## Risks

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Backup before each migration, reversible steps |
| Breaking queries | Phase 1 focuses on reads, verify before writes |
| Export format changes | Verify output matches expected format |

---

## Related

- `.claude/docs/DATABASE-SCHEMA-AUDIT.md` (on research branch)
- SPRINT-036: Deterministic Message Parsing
- BACKLOG-230: NULL thread_id Investigation

---

## Estimated Total Effort

| Phase | Estimated Tokens | Sprint Sizing |
|-------|-----------------|---------------|
| Phase 1 | 10-12K | 1 sprint |
| Phase 2 | 6-8K | 1 sprint |
| Phase 3 | 7-8K | 1 sprint |
| Phase 4 | 4-5K | 0.5 sprint |
| **Total** | **27-33K** | **3-4 sprints** |

---

## Notes

This backlog item consolidates all schema-related technical debt identified by the SR Engineer audit. Individual tasks should be created when sprint planning begins. Phase 1 is the most urgent as it directly affects current functionality.
