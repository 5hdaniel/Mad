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

*To be completed by engineer*
