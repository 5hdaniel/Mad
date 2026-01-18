# Task TASK-803: Update Joyride Demo for AI Detection

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Update the Joyride guided tour to showcase the new AI transaction detection features added in SPRINT-006 and SPRINT-007, ensuring new users understand how the AI-powered features work.

**Backlog Reference:** BACKLOG-014 - Update Joyride Demo for New Users

## Non-Goals

- Do NOT modify the AI detection logic itself
- Do NOT change the existing tour infrastructure (useTour hook)
- Do NOT add tours to screens that don't exist

## Deliverables

1. Update: `src/config/tourSteps.ts` - Add AI detection tour steps
2. Update: `src/components/Dashboard.tsx` - Add data-tour attributes
3. Update: `src/components/TransactionList/TransactionList.tsx` - Add data-tour for AI indicators
4. Update: `src/config/__tests__/tourSteps.test.ts` - Update tests

## Acceptance Criteria

- [ ] Dashboard tour includes step explaining AI auto-detection feature
- [ ] Tour highlights where to see detected transactions
- [ ] Tour explains AI confidence indicators if visible
- [ ] New tour steps have appropriate placement
- [ ] Tour steps use clear, non-technical language
- [ ] All data-tour attributes are unique
- [ ] Existing tour functionality preserved
- [ ] All CI checks pass

## Implementation Notes

### New Tour Steps to Add

```typescript
{
  target: '[data-tour="ai-detection-status"]',
  content: 'Magic Audit uses AI to automatically detect real estate transactions in your emails.',
  placement: 'bottom',
},
{
  target: '[data-tour="detected-transactions-count"]',
  content: 'This shows how many transactions were automatically detected.',
  placement: 'bottom',
},
```

### Required UI Updates

Add `data-tour` attributes to Dashboard.tsx:

```tsx
<div data-tour="ai-detection-status">
  {/* AI scanning status */}
</div>
```

## Integration Notes

- Depends on: None (AI features already exist from SPRINT-006/007)

## PR Preparation

- **Title**: `feat(tour): update Joyride demo with AI detection`
- **Labels**: `ui`, `enhancement`, `onboarding`

---

## SR Engineer Review Notes (Pre-Implementation)

**Review Date:** 2025-12-28 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** feature/TASK-803-joyride-ai

### Execution Classification
- **Parallel Safe:** YES - no shared files with TASK-800/801/802
- **Depends On:** None (AI features already exist from SPRINT-006/007)
- **Blocks:** None

### Shared File Analysis

| File | Tasks | Risk |
|------|-------|------|
| `src/config/tourSteps.ts` | TASK-803 only | None |
| `src/components/Dashboard.tsx` | TASK-803 only | None (adding data-tour attrs) |
| `src/components/TransactionList/TransactionList.tsx` | TASK-803 only | None |

### Technical Validation

1. **Existing Tour Structure:**
   - Reference: `src/config/tourSteps.ts`
   - Uses react-joyride Step interface
   - getDashboardTourSteps() and getExportTourSteps() functions
   - JOYRIDE_STYLES and JOYRIDE_LOCALE configs

2. **Current Dashboard Tour (6 steps):**
   - Welcome (center)
   - New Audit card
   - Transactions card
   - Contacts card
   - Profile button
   - Done (center)

3. **AI Features to Highlight:**
   - Auto-detection status indicator
   - Detected transactions count
   - Confidence indicators (if visible on dashboard)
   - Scan progress/status

### Technical Corrections

1. **Tour Step Insertion Point:**
   Insert AI steps AFTER "transactions-card" and BEFORE "contacts-card":
   ```typescript
   {
     target: '[data-tour="ai-detection-status"]',
     content: 'Magic Audit uses AI to automatically detect real estate transactions in your emails and messages.',
     placement: 'bottom',
     disableBeacon: true,
   },
   ```

2. **Verify AI UI Elements Exist:**
   Before adding tour steps, engineer must verify these elements exist:
   - Dashboard AI status indicator
   - Transaction count with AI badge
   - Scan status display

3. **data-tour Attribute Naming Convention:**
   Follow existing pattern:
   - `data-tour="ai-detection-status"`
   - `data-tour="detected-transactions-count"`
   - `data-tour="ai-confidence-indicator"` (if applicable)

### Technical Considerations
- Keep tour concise (add 1-2 steps max, not 5+)
- Use non-technical language ("finds transactions" not "runs ML classification")
- Test tour with actual AI detection running
- Ensure spotlightClicks works with AI status elements
- Consider conditional steps (only show if AI features are enabled)

### Risk Assessment
- **LOW:** Adding data-tour attributes has no functional impact
- **LOW:** Tour step configuration is declarative
- Verify tour doesn't break if AI features are disabled

### UI/UX Notes
- Tour should be quick (~30 seconds total)
- Don't overwhelm new users with AI complexity
- Focus on value ("finds transactions automatically") not mechanism

---

## PM Estimate

**Turns:** 6-10 | **Tokens:** ~30K-50K | **Time:** ~1-1.5h
