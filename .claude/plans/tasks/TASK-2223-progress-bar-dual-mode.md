# TASK-2223: Progress Bar -- Dual-Mode Toggle (Status vs Effort) + Compact Legend

**Backlog ID:** BACKLOG-992
**Sprint:** SPRINT-141
**Phase:** 3 (Medium Features)
**Branch:** `feature/task-2223-progress-bar-dual-mode`
**Estimated Tokens:** ~20K (ui category, x1.0 multiplier)

---

## Objective

Create a reusable dual-mode progress bar component that can toggle between "Status mode" (completed items / total items) and "Effort mode" (actual tokens / estimated tokens). Include a compact legend showing the breakdown. Deploy the component on sprint detail and sprint list pages, and the project detail status summary.

---

## Context

Currently, progress bars across the PM module are simple single-mode bars:
- `SprintCard.tsx` (lines 61-74): `completed / total items` with green fill
- `SprintList.tsx` (lines 237-246): `completed / total items` with green fill
- Project detail page: `completed / total items` with green fill

All use the same pattern: `(completed / total) * 100` with a single green bar. The new component adds a toggle between item-based and token-based progress.

---

## Requirements

### Must Do:
1. **Create `DualProgressBar.tsx` component** in `admin-portal/app/dashboard/pm/components/`
2. **Status mode (default):** Shows `completed / total` items as percentage. Green fill bar.
3. **Effort mode:** Shows `actual_tokens / est_tokens` as percentage. Uses blue fill. If actual > est, show red fill for the overflow portion.
4. **Toggle button:** Small segmented control or toggle switch above the bar: `[Status | Effort]`
5. **Compact legend:** Below the bar, show breakdown:
   - Status mode: `Completed: X | In Progress: Y | Blocked: Z | Pending: W`
   - Effort mode: `Estimated: 45K | Actual: 38K | Variance: -16%`
6. **Deploy to sprint detail page** (`sprints/[id]/page.tsx`) -- replace the existing SprintCard progress bar
7. **Deploy to project detail page** (`projects/[id]/page.tsx`) -- replace the status summary progress bar
8. **Optionally deploy to sprint list** -- May be too compact for table rows; use judgment

### Must NOT Do:
- Do NOT remove the existing progress bar entirely (it is used by SprintCard/SprintList in other contexts)
- Do NOT modify `pm-queries.ts`
- Do NOT add new npm dependencies

---

## Acceptance Criteria

- [ ] `DualProgressBar` component exists in `pm/components/`
- [ ] Status mode shows green bar with `completed/total` percentage
- [ ] Effort mode shows blue bar with `actual/estimated` percentage
- [ ] Effort mode shows red overflow when actual > estimated
- [ ] Toggle between modes works (controlled via props or internal state)
- [ ] Compact legend renders below the bar
- [ ] Sprint detail page uses the new component
- [ ] Project detail page uses the new component
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## Files to Create

- `admin-portal/app/dashboard/pm/components/DualProgressBar.tsx` -- New dual-mode progress bar

## Files to Modify

- `admin-portal/app/dashboard/pm/sprints/[id]/page.tsx` -- Replace progress bar with DualProgressBar
- `admin-portal/app/dashboard/pm/projects/[id]/page.tsx` -- Replace progress bar with DualProgressBar

## Files to Read (for context)

- `admin-portal/app/dashboard/pm/components/SprintCard.tsx` -- Existing progress bar pattern (lines 61-74)
- `admin-portal/lib/pm-types.ts` -- `PmSprint` (item_counts, total_items), `SprintDetailResponse` (metrics)

---

## Implementation Notes

**Component interface:**

```typescript
interface DualProgressBarProps {
  // Status mode data
  completed: number;
  total: number;
  byStatus?: Record<string, number>;  // { pending: 5, in_progress: 3, ... }

  // Effort mode data
  estTokens: number;
  actualTokens: number;

  // Config
  defaultMode?: 'status' | 'effort';
  showToggle?: boolean;  // Can hide toggle for simple usage
  showLegend?: boolean;  // Can hide legend for compact usage
  className?: string;
}
```

**Rendering:**

```tsx
export function DualProgressBar({
  completed, total, byStatus,
  estTokens, actualTokens,
  defaultMode = 'status', showToggle = true, showLegend = true,
  className,
}: DualProgressBarProps) {
  const [mode, setMode] = useState<'status' | 'effort'>(defaultMode);

  const statusPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const effortPct = estTokens > 0 ? Math.round((actualTokens / estTokens) * 100) : 0;
  const isOverBudget = actualTokens > estTokens;

  return (
    <div className={className}>
      {/* Toggle */}
      {showToggle && (
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => setMode('status')}
            className={`px-2 py-0.5 text-xs rounded-l-md border ${
              mode === 'status' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-500'
            }`}
          >Status</button>
          <button
            onClick={() => setMode('effort')}
            className={`px-2 py-0.5 text-xs rounded-r-md border border-l-0 ${
              mode === 'effort' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-500'
            }`}
          >Effort</button>
        </div>
      )}

      {/* Bar */}
      {mode === 'status' ? (
        <>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium text-gray-700">{statusPct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all"
                 style={{ width: `${statusPct}%` }} />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Effort</span>
            <span className={`font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-700'}`}>
              {effortPct}%
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`}
                 style={{ width: `${Math.min(effortPct, 100)}%` }} />
          </div>
        </>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
          {mode === 'status' && byStatus && (
            Object.entries(byStatus)
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <span key={status}>{STATUS_LABELS[status as ItemStatus] || status}: {count}</span>
              ))
          )}
          {mode === 'effort' && (
            <>
              <span>Est: {formatTokens(estTokens)}</span>
              <span>Actual: {formatTokens(actualTokens)}</span>
              <span className={isOverBudget ? 'text-red-500' : 'text-green-500'}>
                Variance: {estTokens > 0 ? `${((actualTokens - estTokens) / estTokens * 100).toFixed(0)}%` : 'N/A'}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

**Deploying to sprint detail page:**
Replace the SprintCard component or the existing progress bar section with:
```tsx
<DualProgressBar
  completed={metrics.completed_items}
  total={metrics.total_items}
  byStatus={sprint.item_counts}
  estTokens={metrics.total_est_tokens}
  actualTokens={metrics.total_actual_tokens}
/>
```

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Manual testing:**
  1. Sprint detail page: verify progress bar has Status/Effort toggle
  2. Status mode: green bar with percentage, legend shows status breakdown
  3. Effort mode: blue bar with token percentage, legend shows est/actual/variance
  4. Effort mode when over budget: bar turns red
  5. Project detail page: verify progress bar has the toggle

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `feat(pm): dual-mode progress bar with status/effort toggle`
- **Branch:** `feature/task-2223-progress-bar-dual-mode`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-03-17*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: session start
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test) -- N/A, no unit tests required
- [x] Type check passes (npm run type-check) -- pre-existing errors only
- [x] Lint passes (npm run lint) -- no new warnings

PR Submission:
- [x] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Single-mode green progress bar on sprint detail and project detail pages showing only completed/total items
- **After**: Dual-mode DualProgressBar component with Status/Effort toggle, green bar for status mode, blue/red bar for effort mode, and compact legend
- **Actual Tokens**: ~TBD (Est: 20K)
- **PR**: TBD

### Notes

**Deviations from plan:**
- Kept the status breakdown icons (Completed/In Progress/Remaining) on sprint detail page below the DualProgressBar, separated by a border-top, since they provide valuable quick-glance metrics not duplicated in the legend.
- On project detail page, set showLegend=false since the status badges below already show the breakdown, and token metric cards already show est/actual/variance.
- The project detail page was significantly redesigned from what the task file described (it now has collapsible sprint sections, backlog panel, etc.), so the integration was adapted to the current layout.

**Issues encountered:**
None

---

## Guardrails

**STOP and ask PM if:**
- Sprint metrics data does not include est/actual token totals (check `SprintDetailResponse.metrics`)
- The project detail page does not have token data available (may need additional RPC data)
- You encounter blockers not covered in the task file
