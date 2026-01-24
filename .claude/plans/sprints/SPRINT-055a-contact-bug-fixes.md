# Sprint Plan: SPRINT-055a - Contact Management Bug Fixes

**Created**: 2026-01-23
**Updated**: 2026-01-23
**Status**: Planning
**Goal**: Fix contact import bugs and polish contact display
**Split From**: SPRINT-055 (too large at ~145K tokens)

---

## Sprint Goal

This sprint addresses bug fixes and polish related to contact management. Split from SPRINT-055 to keep sprint size manageable.

**Rationale for Split**: SPRINT-055 was ~145K tokens, which exceeds recommended sprint capacity. Bug fixes (this sprint) are separated from the larger UX overhaul (SPRINT-055b) to allow faster delivery of fixes.

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] `git checkout develop && git pull origin develop`
- [ ] `npm install`
- [ ] `npm rebuild better-sqlite3-multiple-ciphers`
- [ ] `npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`
- [ ] Verify tests pass: `npm test`

---

## In Scope (4 Items)

### Phase 1: Import Deduplication (Sequential)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-143 | Prevent Duplicate Contact Imports | ~40K | TASK-TBD |
| BACKLOG-165 | Duplicate Contacts in Import Contacts Page | ~20K | TASK-TBD |

### Phase 2: UI Polish (Can be parallel)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-145 | Duplicate Contact Keys in ImportContactsModal | ~10K | TASK-TBD |
| BACKLOG-300 | Display Contact Roles in User-Friendly Format | ~5K | TASK-TBD |

---

## Reprioritized Backlog

| Priority | ID | Title | Est. Tokens | Phase | Dependencies |
|----------|-----|-------|-------------|-------|--------------|
| 1 | BACKLOG-143 | Prevent Duplicate Contact Imports | ~40K | 1 | None |
| 2 | BACKLOG-165 | Duplicate Contacts in Import Page | ~20K | 1 | BACKLOG-143 (related) |
| 3 | BACKLOG-145 | Duplicate Contact Keys | ~10K | 2 | Phase 1 |
| 4 | BACKLOG-300 | User-Friendly Role Display | ~5K | 2 | None |

**Total Estimated Tokens**: ~75K

---

## Phase Plan

### Phase 1: Import Deduplication

**Goal**: Eliminate duplicate contacts during import

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-TBD | Prevent Duplicate Contact Imports | ~40K | Sequential |
| TASK-TBD | Fix Duplicate Contacts in Import Page | ~20K | Sequential |

**BACKLOG-143 - Prevent Duplicates**:
- Filter already-imported contacts from import list
- Show count: "X contacts available (Y already imported)"
- Define matching criteria (email, phone, or name combination)

**BACKLOG-165 - Import Page Duplicates**:
- Root cause: `contacts:get-available` combines sources without deduplication
- Fix deduplication in `contact-handlers.ts`
- Dedupe by email/phone, not just name

**Files to Modify**:
- `electron/contact-handlers.ts`
- Contact import service and UI components

**Integration checkpoint**: Each contact appears once in import list.

---

### Phase 2: UI Polish

**Goal**: Fix React warnings and improve role display

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-TBD | Fix Duplicate Contact Keys | ~10K | Can be parallel |
| TASK-TBD | User-Friendly Role Display | ~5K | Can be parallel |

**BACKLOG-145 - Duplicate Keys**:
- Current ID: `contacts-app-${contactInfo.name}` (not unique)
- Fix: Use UUID or index+timestamp+name

**BACKLOG-300 - Role Display**:
- Format snake_case to Title Case
- `seller_agent` -> "Seller Agent"

**Files to Modify**:
- `electron/contact-handlers.ts:182`
- Role display components

**Integration checkpoint**: No React key warnings, readable role labels.

---

## Merge Plan

- **Main branch**: `develop`
- **Feature branch format**: `fix/TASK-XXXX-description`

### Merge Order

```
Phase 1:
1. BACKLOG-143 -> develop (PR)
2. BACKLOG-165 -> develop (PR)

Phase 2 (can be parallel after Phase 1):
3. BACKLOG-145 -> develop (PR)
4. BACKLOG-300 -> develop (PR)
```

---

## Dependency Graph (YAML)

```yaml
dependency_graph:
  nodes:
    - id: TASK-143
      type: task
      phase: 1
      title: "Prevent Duplicate Contact Imports"
      backlog: BACKLOG-143
    - id: TASK-165
      type: task
      phase: 1
      title: "Fix Duplicate Contacts in Import Page"
      backlog: BACKLOG-165
    - id: TASK-145
      type: task
      phase: 2
      title: "Fix Duplicate Contact Keys"
      backlog: BACKLOG-145
    - id: TASK-300
      type: task
      phase: 2
      title: "User-Friendly Role Display"
      backlog: BACKLOG-300

  edges:
    - from: TASK-143
      to: TASK-165
      type: related
      reason: "Both address duplicate contact issues"
    - from: TASK-165
      to: TASK-145
      type: depends_on
      reason: "Key fix follows import page fix"
```

---

## File Conflict Matrix

| File/Area | Tasks | Conflict Risk | Resolution |
|-----------|-------|---------------|------------|
| `electron/contact-handlers.ts` | 143, 165, 145 | High | Sequential execution |
| Contact import UI | 143, 165 | Medium | Sequential |
| Role display components | 300 | None | Independent |

---

## Testing & Quality Plan

### Phase 1 Test Scenarios

1. **Duplicate Prevention**:
   - [ ] Already-imported contacts filtered from list
   - [ ] Count shows available vs. already imported
   - [ ] Matching works by email, phone, name

2. **Import Page**:
   - [ ] Each contact appears once
   - [ ] iPhone sync and macOS contacts properly merged

### Phase 2 Test Scenarios

1. **React Key Warnings**:
   - [ ] No console warnings about duplicate keys
   - [ ] Selection works correctly

2. **Role Display**:
   - [ ] Roles show as "Seller Agent" not "seller_agent"
   - [ ] Unknown roles fallback gracefully

### CI / CD Quality Gates

- [ ] Unit tests for deduplication logic
- [ ] Type checking (`npm run type-check`)
- [ ] Linting (`npm run lint`)
- [ ] Build step (`npm run build`)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Matching criteria too strict | Medium | Medium | Allow fuzzy matching option |
| Matching criteria too loose | Medium | Medium | Start conservative, tune later |
| Performance with large contact lists | Low | Medium | Test with 1000+ contacts |

---

## Estimated Effort Summary

| Phase | Tasks | Est. Tokens | Execution |
|-------|-------|-------------|-----------|
| Phase 1: Deduplication | BACKLOG-143, 165 | ~60K | Sequential |
| Phase 2: UI Polish | BACKLOG-145, 300 | ~15K | Parallel |
| **Total** | **4 tasks** | **~75K** | - |

**SR Review Overhead**: Add ~15K for reviews
**Contingency**: ~10K (13%)

**Sprint Total**: ~100K tokens

---

## Task Execution Status

| Phase | Task | Backlog | Status | Engineer | PR | Actual Tokens |
|-------|------|---------|--------|----------|-----|---------------|
| 1 | TASK-TBD | BACKLOG-143 | Pending | - | - | - |
| 1 | TASK-TBD | BACKLOG-165 | Pending | - | - | - |
| 2 | TASK-TBD | BACKLOG-145 | Pending | - | - | - |
| 2 | TASK-TBD | BACKLOG-300 | Pending | - | - | - |

---

## End-of-Sprint Validation Checklist

- [ ] All tasks merged to develop
- [ ] All CI checks passing

**Duplicate Prevention (Phase 1):**
- [ ] Already-imported contacts filtered from import list
- [ ] Each contact appears once in import page
- [ ] Deduplication works by email/phone/name

**UI Polish (Phase 2):**
- [ ] No React key warnings in console
- [ ] Role pills display human-readable labels

---

## Related Documentation

- **SPRINT-055b**: UX Overhaul (second half of original SPRINT-055)
- **Engineer Workflow**: `.claude/docs/ENGINEER-WORKFLOW.md`
- **PR-SOP**: `.claude/docs/PR-SOP.md`
