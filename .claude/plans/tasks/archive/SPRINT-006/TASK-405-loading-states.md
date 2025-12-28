# Task TASK-405: LLM Loading States Component

## Goal

Create reusable loading state components for LLM operations, including skeleton cards, progress indicators, and status messaging.

## Non-Goals

- Do NOT implement actual LLM calls
- Do NOT modify TransactionList (TASK-406-408)
- Do NOT add business logic

## Deliverables

1. New file: `src/components/LLMLoadingStates.tsx`

## Acceptance Criteria

- [ ] Skeleton card component for transaction cards
- [ ] Progress indicator for batch processing
- [ ] "Analyzing with AI..." messaging
- [ ] Estimated time remaining display
- [ ] All CI checks pass

## Implementation Notes

```typescript
// src/components/LLMLoadingStates.tsx
export function TransactionSkeleton() {
  return (
    <div className="transaction-skeleton animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/4" />
    </div>
  );
}

export function LLMProgressIndicator({ current, total, estimatedTimeRemaining }: Props) {
  const percent = (current / total) * 100;
  return (
    <div className="llm-progress">
      <div className="progress-bar" style={{ width: `${percent}%` }} />
      <span>Analyzing with AI... {current}/{total}</span>
      {estimatedTimeRemaining && <span>~{estimatedTimeRemaining}s remaining</span>}
    </div>
  );
}

export function LLMStatusMessage({ status }: { status: 'analyzing' | 'complete' | 'fallback' }) {
  const messages = {
    analyzing: 'Analyzing emails with AI...',
    complete: 'Analysis complete',
    fallback: 'Using pattern matching (LLM unavailable)',
  };
  return <div className="llm-status">{messages[status]}</div>;
}
```

## Integration Notes

- Exports to: `src/components/TransactionList.tsx`
- Depends on: None (pure UI components)

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: Yes (snapshot tests)

## PR Preparation

- **Title**: `feat(ui): add LLM loading states component [TASK-405]`
- **Labels**: `ui`, `ai-mvp`, `phase-2`

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`
**Estimated Totals:** 2 turns, ~8K tokens, ~15m
**Confidence:** High

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-405-loading-states

### Execution Classification
- **Parallel Safe:** Yes (with TASK-404)
- **Depends On:** None
- **Blocks:** None

---

## Implementation Summary (Engineer-Owned)

**Implementation Date:** 2025-12-18
**Engineer:** Claude Opus 4.5
**Status:** COMPLETE

### Files Created
1. `src/components/LLMLoadingStates.tsx` - All LLM loading state components
2. `src/components/__tests__/LLMLoadingStates.test.tsx` - Comprehensive unit tests (43 tests)

### Components Implemented
1. **TransactionSkeleton** - Skeleton placeholder for transaction cards with animate-pulse effect
2. **LLMProcessingIndicator** - Spinner with "Analyzing..." message and optional step description
3. **LLMProgressIndicator** - Progress bar showing current/total with estimated time remaining
4. **LLMProgressBar** - Progress bar with step indicators and descriptions
5. **LLMStatusMessage** - Status messaging for analyzing/complete/fallback states
6. **LLMErrorState** - Error display with optional retry button

### Design Patterns Used
- Tailwind CSS for styling (matching existing codebase patterns)
- ARIA accessibility attributes for screen readers
- TypeScript interfaces for all props
- Named exports for tree-shaking

### Test Coverage
- 43 unit tests covering all components
- Tests for prop variations, accessibility, and user interactions
- All tests passing

### Quality Checks
- TypeScript: PASS (no errors)
- ESLint: PASS (no new warnings in created files)
- Tests: 104 suites, 2518 tests passing

### Acceptance Criteria Status
- [x] Skeleton card component for transaction cards
- [x] Progress indicator for batch processing
- [x] "Analyzing with AI..." messaging
- [x] Estimated time remaining display
- [x] All CI checks pass

### Notes
- Pre-existing flaky test in `appleDriverService.test.ts` (timeout issue) confirmed on base branch
- All new components are self-contained with no external dependencies
- Components follow existing LLM component patterns (LLMErrorDisplay, LLMErrorBoundary)
