# SPRINT-025: Communications Architecture & Export Enhancement

**Created**: 2026-01-05
**Status**: COMPLETE (TASK-978 deferred)
**Type**: Architecture Refactor + Feature Sprint
**Retrospective**: See `SPRINT-025-retrospective.md`

---

## Sprint Goal

Establish a consistent data architecture where all communications (emails, texts, iMessages) flow through a unified reference layer, and enhance export capabilities with organized folder structure.

**Core Principle**: `Raw Tables -> Communications Reference -> Transactions`

---

## 1. Retrospective: Hotfixes Merged (2026-01-05)

### PRs Requiring SR Engineer Review

| PR | Description | Risk | Status |
|----|-------------|------|--------|
| #326 | fix(db): add missing `export_format` column | Low | Merged |
| #327 | fix(db): add missing `last_exported_on` column | Low | Merged |
| #328 | fix(export): clean up PDF report (remove extraction details, simplify communications) | Low | Merged |
| #329 | fix(contacts): use `display_name` when creating contacts | Low | Merged |
| #330 | fix(contacts): use `display_name` in `getOrCreateContactFromEmail` | Low | Merged |
| #331 | fix(contacts): prevent infinite loop in ContactSelectModal | Medium | Merged |
| #332 | fix(contacts): allow multiple contacts for all roles | Low | Merged |

### Lessons Learned

1. **Migration Gaps**: Two separate column additions needed due to incomplete migration tracking
2. **Field Naming**: Inconsistency between `name` vs `display_name`, `last_exported_at` vs `last_exported_on`
3. **React Dependencies**: Array references in useEffect dependencies cause infinite loops - use stable keys

---

## 2. Architecture Decision: Communications as Reference Table

### Current State (Problem)

```
emails (Gmail API) ──> communications table ──> transactions
                       (stores content)

messages (iPhone) ──> messages table ──> NOWHERE (disconnected!)
```

**Issue**: Emails bypass `messages` table entirely. iPhone texts stored in `messages` but never linked to `communications`. Result: texts don't appear in transactions.

### Target State (Option 1 - User Selected)

```
Gmail API ──┐
            ├──> messages table ──> communications table ──> transactions
iMessage ───┘    (raw storage)      (references only:       (linked via
                                     message_id +            communication_id)
                                     transaction_id)
```

**Design Principles**:
1. `messages` = single source of truth for ALL communication content
2. `communications` = lightweight junction table linking messages to transactions
3. All transaction queries join through `communications` to `messages`

---

## 3. Sprint Tasks

### Phase 1: Foundation (Sequential - Blocking)

#### TASK-975: Communications Reference Table Refactor
**Priority**: P0 (Critical Path)
**Estimate**: 8,000 tokens

Transform `communications` from content storage to reference layer:
1. Add `message_id` foreign key to `communications` table
2. Migrate existing email data to `messages` table
3. Update email scanning to store in `messages` first
4. Update all queries to join through `communications` to `messages`

**Depends on**: Nothing
**Blocks**: TASK-976, TASK-977, TASK-978

---

### Phase 2: Features (Can Parallelize After TASK-975)

#### TASK-976: Enhanced Export with Folder Structure
**Priority**: P1
**Estimate**: 5,000 tokens

Create organized export structure:
```
Transaction_123_Main_St/
├── Summary_Report.pdf        (transaction overview + email list)
├── emails/
│   ├── 001_RE_Inspection.pdf (full rich HTML email as PDF)
│   └── ...
├── texts/
│   └── (text message exports)
└── attachments/
    └── (email attachments)
```

**Depends on**: TASK-975

#### TASK-977: Auto-Link Texts to Transactions
**Priority**: P1
**Estimate**: 4,000 tokens

During transaction scanning, automatically link texts from contacts assigned to the transaction:
1. Get all contacts linked to transaction
2. Find all messages where sender/recipient matches contact
3. Create `communications` reference entries

**Depends on**: TASK-975

#### TASK-978: Manual Link Messages UI
**Priority**: P2
**Estimate**: 5,000 tokens

Add UI in transaction view to:
- Search contacts and see their text threads
- Manually link/unlink messages to the transaction
- Show all messages from contacts linked to the transaction

**Depends on**: TASK-975, TASK-977

---

## 4. Dependency Graph

```
TASK-975 (Communications Refactor)
    │
    ├──> TASK-976 (Export Folders)
    │
    ├──> TASK-977 (Auto-Link Texts)
    │         │
    │         └──> TASK-978 (Manual Link UI)
    │
    └──> TASK-978 (Manual Link UI)
```

---

## 5. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Data migration corrupts existing emails | High | Low | Backup before migration, incremental approach |
| Query performance degradation with joins | Medium | Medium | Add proper indexes on `message_id` |
| UI breaks during refactor | Medium | Medium | Feature flag to toggle old/new paths |

---

## 6. Related Backlog Items

- **BACKLOG-160**: Column naming consolidation (`last_exported_at` vs `last_exported_on`)

---

## 7. Success Criteria

- [x] All communications (email + text) visible in transactions (architecture ready, UI pending TASK-978)
- [x] Export creates organized folder structure ("Audit Package" option)
- [x] No data loss during migration (backward compatible with COALESCE)
- [x] Query performance maintained or improved (indexes added)
- [x] SR Engineer approves all PRs (including post-merge review for #333)
