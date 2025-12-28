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

## PM Estimate

**Turns:** 6-10 | **Tokens:** ~30K-50K | **Time:** ~1-1.5h
