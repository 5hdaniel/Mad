# Sprint Plan: SPRINT-053 - License Enhancement & AI Gating Verification

**Created**: 2026-01-23
**Updated**: 2026-01-25
**Status**: COMPLETED
**Goal**: Complete license UI enhancements and verify AI feature gating

---

## Sprint Goal

This sprint addresses two critical items from the user's development goals:

1. **License Enhancement**: Team license users should see BOTH Submit and Export options (not just Submit)
2. **AI Gating Verification**: Verify all AI features are properly hidden when AI add-on is disabled

Both items can be done immediately as they build on completed SPRINT-051 work.

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

### Phase 1: Schema Alignment (Sequential - Foundation)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-410 | Add AI Detection Columns to SQLite | ~10K | TASK-TBD |

### Phase 2: License Enhancement (Sequential)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-459 | Team License Export After Submission | ~20K | TASK-1176 |

### Phase 3: AI Features (Can be parallel)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-462 | Verify AI Add-on Feature Gating Completeness | ~15K | TASK-1177 |
| BACKLOG-081 | Consolidate AI Consent into T&C | ~20K | TASK-TBD |

---

## User Requirements Reference

### License Management
> Individual licenses: user sees ONLY export options
> Team licenses: user sees submit options first, then export options after submission

### AI Features Gating
> AI add-on is a separate flag (can be combined with individual OR team license)
> If user doesn't have AI add-on, hide:
> - Auto-detection button
> - AI consent in settings
> - AI detections in new audit button

---

## Reprioritized Backlog

| Priority | ID | Title | Est. Tokens | Phase | Dependencies |
|----------|-----|-------|-------------|-------|--------------|
| 1 | BACKLOG-410 | Add AI Detection Columns to SQLite | ~10K | 1 | None |
| 2 | BACKLOG-459 | Team License Export After Submission | ~20K | 2 | BACKLOG-427 (completed) |
| 3 | BACKLOG-462 | Verify AI Add-on Feature Gating | ~15K | 3 | BACKLOG-427 (completed) |
| 4 | BACKLOG-081 | Consolidate AI Consent into T&C | ~20K | 3 | None |

**Total Estimated Tokens**: ~65K

---

## Phase Plan

### Phase 1: Schema Alignment

**Goal**: Add missing AI detection columns to SQLite schema

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-TBD | Add AI Detection Columns | ~10K | Sequential |

**Note**: See BACKLOG-410 clarification note. The `detection_status` column already exists in schema.sql (lines 356-362). This task should verify existing columns and add only truly missing ones like `detected_at`.

**Deliverables**:
- Migration adds any missing columns without data loss
- TypeScript types align with schema
- Existing transactions unaffected

**Files Likely Modified**:
- `electron/database/migrations/XXXX_add_detection_columns.sql`
- `shared/types/transaction.ts` (if needed)

**Integration checkpoint**: Schema matches TypeScript types.

---

### Phase 2: License Enhancement

**Goal**: Show both Submit and Export for Team license users

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-1176 | Team License Export After Submission | ~20K | Sequential |

**Deliverables**:
- Team users see Submit for Review as primary action
- Team users see Export as secondary action
- Export available before and after submission
- Individual users unchanged (Export only)

**Files Likely Modified**:
- `src/components/transactionDetailsModule/TransactionDetailsHeader.tsx`
- `src/contexts/LicenseContext.tsx` (if needed)
- `src/components/common/LicenseGate.tsx` (if needed)

**Integration checkpoint**: Team users see both buttons, Individual users see only Export.

---

### Phase 3: AI Features (Can be parallel)

**Goal**: Verify AI gating and consolidate AI consent into T&C

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-1177 | Verify AI Add-on Feature Gating | ~15K | Can be parallel |
| TASK-TBD | Consolidate AI Consent into T&C | ~20K | Can be parallel |

**Verification Checklist** (BACKLOG-462):
1. Auto-detection button hidden without AI add-on
2. AI consent in settings hidden without AI add-on
3. AI detections in new audit hidden without AI add-on
4. AI transaction filters hidden without AI add-on

**AI Consent Consolidation** (BACKLOG-081):
1. Update Terms and Conditions with AI data processing section
2. Remove separate consent modal from LLMSettings.tsx
3. Track consent via T&C version

**Integration checkpoint**: All AI features properly gated, consent flow streamlined.

---

## Merge Plan

- **Main branch**: `develop`
- **Feature branch format**: `fix/TASK-XXXX-description`
- **No integration branches needed**: Tasks touch different areas

### Merge Order

```
Phase 1:
1. TASK-1176 -> develop (PR)

Phase 2 (parallel):
2. TASK-1177 -> develop (PR)
```

---

## Dependency Graph (YAML)

```yaml
dependency_graph:
  nodes:
    - id: TASK-1176
      type: task
      phase: 1
      title: "Team License Export After Submission"
      backlog: BACKLOG-459
    - id: TASK-1177
      type: task
      phase: 2
      title: "Verify AI Add-on Feature Gating"
      backlog: BACKLOG-462

  edges:
    # No dependencies between tasks - can run in parallel
    []
```

---

## File Conflict Matrix

| File/Area | Tasks | Conflict Risk | Resolution |
|-----------|-------|---------------|------------|
| `TransactionDetailsHeader.tsx` | 1176 | None | Single task modifies |
| `LicenseContext.tsx` | 1176 | None | May add computed flag |
| Dashboard AI components | 1177 | None | Verification + possible fixes |
| Settings AI components | 1177 | None | Verification + possible fixes |

---

## Testing & Quality Plan

### TASK-1176 Test Scenarios

1. **Team User - Before Submission**:
   - [ ] Submit button visible (primary)
   - [ ] Export button visible (secondary)

2. **Team User - After Submission**:
   - [ ] Status badge shows current status
   - [ ] Export button still visible

3. **Individual User**:
   - [ ] Only Export button visible
   - [ ] No Submit button

### TASK-1177 Test Scenarios

1. **AI Add-on Disabled**:
   - [ ] Dashboard: No auto-detection button
   - [ ] Settings: No AI consent section
   - [ ] New Audit: No AI detection options
   - [ ] Transaction filters: No AI filters

2. **AI Add-on Enabled**:
   - [ ] All AI features visible

### CI / CD Quality Gates

- [ ] Unit tests
- [ ] Type checking (`npm run type-check`)
- [ ] Linting (`npm run lint`)
- [ ] Build step (`npm run build`)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Export button styling inconsistent | Low | Low | Follow existing button patterns |
| Missing AI gating in obscure screen | Medium | Medium | Comprehensive verification checklist |
| LicenseContext changes break existing | Low | Medium | Careful testing of both license types |

---

## Estimated Effort Summary

| Phase | Tasks | Est. Tokens | Execution |
|-------|-------|-------------|-----------|
| Phase 1: Schema | BACKLOG-410 | ~10K | Sequential |
| Phase 2: License | TASK-1176 | ~20K | Sequential |
| Phase 3: AI Features | TASK-1177, BACKLOG-081 | ~35K | Parallel |
| **Total** | **4 tasks** | **~65K** | - |

**SR Review Overhead**: Add ~15K for reviews
**Contingency**: ~10K (15%)

**Sprint Total**: ~90K tokens

---

## SR Engineer Review Checklist

Before execution, SR Engineer must validate:

- [ ] BACKLOG-427 changes are compatible with enhancement
- [ ] File conflict matrix is complete
- [ ] Parallel execution is safe
- [ ] Token estimates are reasonable
- [ ] AI verification checklist is comprehensive

---

## Task Execution Status

| Phase | Task | Backlog | Status | Engineer | PR | Actual Tokens |
|-------|------|---------|--------|----------|-----|---------------|
| 1 | TASK-TBD | BACKLOG-410 | Skipped | - | - | - |
| 2 | TASK-1176 | BACKLOG-459 | **MERGED** | Claude | #569 | - |
| 3 | TASK-1177 | BACKLOG-462 | **MERGED** | Claude | #570 | - |
| 3 | TASK-1178 | BACKLOG-462 | **MERGED** | Claude | #592 | - |
| 3 | TASK-TBD | BACKLOG-081 | Deferred | - | - | - |

### Notes
- BACKLOG-410 (Schema): Skipped - columns already exist in schema.sql
- BACKLOG-459 (Team Export): Complete - team users see both Submit and Export
- BACKLOG-462 (AI Gating): Complete - TASK-1177 (Settings), TASK-1178 (Rejected filter/status)
- BACKLOG-081 (AI Consent in T&C): Deferred to future sprint
- Dev toggle for AI add-on testing: `window.api.license.devToggleAIAddon(userId, true/false)`

---

## End-of-Sprint Validation Checklist

- [x] Core tasks merged to develop (459, 462 partial)
- [ ] All CI checks passing (App.test.tsx has pre-existing failures)

**License Enhancement (TASK-1176 / PR #569):** ✅ PASS
- [x] Team users see Submit button (primary)
- [x] Team users see Export button (secondary)
- [x] Individual users see only Export
- [x] Both buttons functional

**AI Verification (TASK-1177 / PR #570):** Partially Complete
- [x] Auto-detection button hidden without AI add-on (verified - already gated)
- [x] AI consent in Settings hidden without AI add-on (fixed in PR #570)
- [x] AI in new audit modal hidden without AI add-on (verified - already gated via LicenseGate)
- [x] Modal subtitle changes text based on AI add-on (verified - already implemented)
- [x] Manual pill on transaction cards hidden without AI add-on (verified - ManualEntryBadge checks hasAIAddon)
- [x] Pending Review tab hidden without AI add-on (verified - already gated)
- [x] All features appear with AI add-on enabled

**Remaining Work for BACKLOG-462 (TASK-1178):**
- [ ] Rejected filter tab in toolbar should hide without AI add-on
- [ ] Rejected status styling on transaction cards should hide without AI add-on (show as Active instead)

---

## Related Documentation

- **SPRINT-051**: License System foundation
- **BACKLOG-427**: License-Aware UI Components (completed)
- **Engineer Workflow**: `.claude/docs/ENGINEER-WORKFLOW.md`
- **PR-SOP**: `.claude/docs/PR-SOP.md`
