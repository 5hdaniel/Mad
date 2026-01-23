# SPRINT-052 Planning Notes

**Created**: 2026-01-23
**Status**: Planning

## Confirmed Items for Next Sprint

The following items have been confirmed by the user for inclusion in SPRINT-052:

### 1. BACKLOG-433: Prevent UI Freezing - Decouple Backend Services (P0 CRITICAL)
- **Priority**: P0 - Critical
- **Effort**: ~60K tokens
- **Description**:
  - Decouple backend services from renderer to prevent UI freezing
  - Fix freezing during data loading, message/contact processing
  - Move heavy operations off main thread
  - Implement proper async patterns

### 2. BACKLOG-434: Add Progress Bar for Text Import
- **Priority**: P1
- **Effort**: ~15K tokens
- **Description**:
  - Show progress bar during text message import
  - Display count, percentage, estimated time
  - Show completion notification
  - Works after database deletion and during onboarding

### 3. BACKLOG-432: Unified Contact Selection & Auto-Import from Group Chats
- **Priority**: P1
- **Effort**: ~35K tokens
- **Description**:
  - Unify import screen with select contact screen
  - Streamline contact selection for new audits
  - Auto-import contacts that appear in group chats but weren't selected

### 4. BACKLOG-431: Add Sale Price and Listing Price to Transaction Details Step
- **Priority**: P2
- **Effort**: ~8K tokens
- **Description**: Add missing Sale Price and Listing Price fields to Step 1 of "Audit New Transaction"

### 5. BACKLOG-430: Default Representation Start Date to 6 Months Ago
- **Priority**: P3
- **Effort**: ~5K tokens
- **Description**: Set default value of "Representation Start Date" field to 6 months before today

### 6. BACKLOG-435: Contact Card View Details & Edit Button
- **Priority**: P2
- **Effort**: ~20K tokens
- **Description**:
  - Add "View Details" button to contact cards
  - Open modal/panel showing all contact info
  - Add edit functionality for contact details
  - Allow editing name, emails, phones, notes, etc.

### 7. BACKLOG-436: Edit External Contacts with Auto-Import & Merge Conflict Handling
- **Priority**: P1
- **Effort**: ~45K tokens
- **Description**:
  - Allow editing external (not-yet-imported) contacts
  - Auto-import to local DB when Edit clicked (invisible to user)
  - Show "local changes only" warning on save
  - Track external source, sync timestamps, local edit flags
  - Detect merge conflicts when external data changes after local edit
  - Conflict resolution UI: Keep Local / Use External / Merge Both

## Total Estimated Effort

~188K tokens (implementation only, excludes SR review overhead)

## Priority Order

1. **BACKLOG-433** (P0) - Must fix UI freezing first - foundational
2. **BACKLOG-434** (P1) - Progress bar depends on non-frozen UI
3. **BACKLOG-432** (P1) - Contact UX improvements
4. **BACKLOG-436** (P1) - External contact edit + merge conflicts
5. **BACKLOG-431** (P2) - Missing price fields
6. **BACKLOG-435** (P2) - Contact view/edit details
7. **BACKLOG-430** (P3) - Default date value

## Sprint Scope Note

At ~188K tokens, this may need to be split across SPRINT-052 and SPRINT-053.

**Suggested Split:**
- SPRINT-052: BACKLOG-433, 434, 432 (~110K) - Core performance + contact UX
- SPRINT-053: BACKLOG-436, 435, 431, 430 (~78K) - Contact edit flow + polish

## Sprint Planning Checklist

- [ ] Complete SPRINT-051 manual testing (TASK-1166, TASK-1167)
- [ ] Close SPRINT-051
- [ ] Create SPRINT-052.md with full task breakdown
- [ ] Generate TASK files for each backlog item
- [ ] Begin implementation

## Notes

User confirmed these items on 2026-01-23 during SPRINT-051 testing phase.
