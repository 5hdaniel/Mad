# Task TASK-407: Detection Badges

## Goal

Add visual badges to transaction cards indicating AI detection status and confidence levels.

## Non-Goals

- Do NOT add filter tabs (TASK-406)
- Do NOT add approve/reject actions (TASK-408)
- Do NOT modify card structure significantly

## Deliverables

1. Update: `src/components/TransactionList.tsx`

## Acceptance Criteria

- [ ] "AI Detected" badge (blue-purple gradient) for detection_source='auto'
- [ ] "Manual" badge (gray) for detection_source='manual'
- [ ] Confidence pill with color scale (red <60%, yellow 60-80%, green >80%)
- [ ] "Pending Review" warning badge for detection_status='pending'
- [ ] All CI checks pass

## Implementation Notes

```typescript
// Badge components to add:
function DetectionSourceBadge({ source }: { source: 'auto' | 'manual' }) {
  return (
    <span className={`badge ${source === 'auto' ? 'badge-ai' : 'badge-manual'}`}>
      {source === 'auto' ? 'AI Detected' : 'Manual'}
    </span>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const level = confidence < 0.6 ? 'low' : confidence < 0.8 ? 'medium' : 'high';
  return (
    <span className={`confidence-pill confidence-${level}`}>
      {Math.round(confidence * 100)}%
    </span>
  );
}

function PendingReviewBadge() {
  return <span className="badge badge-warning">Pending Review</span>;
}

// CSS:
// .badge-ai { background: linear-gradient(135deg, #3B82F6, #8B5CF6); }
// .badge-manual { background: #6B7280; }
// .confidence-low { background: #EF4444; }
// .confidence-medium { background: #F59E0B; }
// .confidence-high { background: #10B981; }
// .badge-warning { background: #F59E0B; }
```

## Integration Notes

- Depends on: TASK-406 (merged first)
- Used by: TASK-408 (adds actions next to badges)

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: Yes
- Tests: Badge renders correctly per status, confidence colors

## PR Preparation

- **Title**: `feat(ui): add detection badges to transaction cards [TASK-407]`
- **Labels**: `ui`, `ai-mvp`, `phase-2`
- **Depends on**: TASK-406

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`
**Estimated Totals:** 3 turns, ~10K tokens, ~20m
**Confidence:** High

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish (after TASK-406)
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-407-detection-badges

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-406
- **Blocks:** TASK-408

---

## Implementation Summary (Engineer-Owned)

*To be completed by engineer*
