# Task TASK-2212: Chart Components (VelocityChart, BurndownChart, EstVsActualChart)

**Status:** Pending
**Backlog ID:** BACKLOG-972
**Sprint:** SPRINT-138
**Phase:** Phase 2a -- Components (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2212-chart-components`
**Estimated Tokens:** ~22K
**Depends On:** TASK-2208 (foundation)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Build three analytics chart components using recharts (already installed): a velocity chart showing tokens per sprint, a burndown chart showing remaining work over time within a sprint, and an estimate-vs-actual bar chart comparing token estimates to actuals. These are used by the Sprint pages (TASK-2215) and potentially the PM Dashboard.

## Non-Goals

- Do NOT build the sprint pages (TASK-2215)
- Do NOT build the PM dashboard (already exists from Sprint B)
- Do NOT modify pm-types.ts or pm-queries.ts
- Do NOT add npm dependencies (recharts is already installed)
- Do NOT implement real-time chart updates

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/components/VelocityChart.tsx` (~120 lines)
2. New file: `admin-portal/app/dashboard/pm/components/BurndownChart.tsx` (~120 lines)
3. New file: `admin-portal/app/dashboard/pm/components/EstVsActualChart.tsx` (~100 lines)

## File Boundaries

### Files to create (owned by this task):

- `admin-portal/app/dashboard/pm/components/VelocityChart.tsx`
- `admin-portal/app/dashboard/pm/components/BurndownChart.tsx`
- `admin-portal/app/dashboard/pm/components/EstVsActualChart.tsx`

### Files this task must NOT modify:

- All existing PM components
- `admin-portal/lib/pm-types.ts`
- `admin-portal/lib/pm-queries.ts`
- Any page files
- `admin-portal/app/dashboard/analytics/` components (do NOT modify existing analytics charts)

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] VelocityChart renders a bar chart with sprints on X-axis and tokens (est + actual) on Y-axis
- [ ] VelocityChart handles empty data gracefully (shows "No data" message)
- [ ] BurndownChart renders a line chart with days on X-axis and remaining items on Y-axis
- [ ] BurndownChart shows both ideal burndown line and actual burndown line
- [ ] BurndownChart handles empty data gracefully
- [ ] EstVsActualChart renders a grouped bar chart comparing estimated vs actual tokens per item
- [ ] EstVsActualChart handles empty data gracefully
- [ ] All charts use recharts ResponsiveContainer for responsive sizing
- [ ] All charts use 'use client' directive
- [ ] All charts accept data via props (no direct RPC calls)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### Reference Pattern

Follow the existing recharts usage in `admin-portal/app/dashboard/analytics/components/VersionDistribution.tsx`. Key patterns:
- Import from `recharts` directly
- Use `ResponsiveContainer` wrapper
- Use Tailwind color values for chart colors
- Handle empty state outside the chart

### VelocityChart.tsx (~120 lines)

Shows tokens per sprint -- estimated vs actual as grouped bars.

```tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { SprintVelocityEntry } from '@/lib/pm-types';

interface VelocityChartProps {
  data: SprintVelocityEntry[];
}

export function VelocityChart({ data }: VelocityChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        No velocity data available
      </div>
    );
  }

  const chartData = data.map((entry) => ({
    name: entry.legacy_id || entry.sprint_name,
    estimated: Math.round((entry.total_est_tokens || 0) / 1000),
    actual: Math.round((entry.total_actual_tokens || 0) / 1000),
    items: entry.completed_items,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Sprint Velocity (Tokens in K)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value}K tokens`,
              name === 'estimated' ? 'Estimated' : 'Actual',
            ]}
          />
          <Legend />
          <Bar dataKey="estimated" fill="#93c5fd" name="Estimated" radius={[2, 2, 0, 0]} />
          <Bar dataKey="actual" fill="#3b82f6" name="Actual" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### BurndownChart.tsx (~120 lines)

Shows remaining work within a sprint over time.

```tsx
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export interface BurndownDataPoint {
  date: string;       // e.g., "Mar 1"
  remaining: number;  // Actual remaining items
  ideal: number;      // Ideal remaining (linear)
}

interface BurndownChartProps {
  data: BurndownDataPoint[];
  totalItems: number;
}

export function BurndownChart({ data, totalItems }: BurndownChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        No burndown data available
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Sprint Burndown ({totalItems} items)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={[0, 'dataMax + 2']} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#d1d5db"
            strokeDasharray="5 5"
            name="Ideal"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="remaining"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Actual"
            dot={{ r: 3 }}
          />
          <ReferenceLine y={0} stroke="#10b981" strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Note on burndown data:** The sprint detail page (TASK-2215) will need to compute the burndown data from the sprint's events/item history. The chart component just renders whatever data it receives.

### EstVsActualChart.tsx (~100 lines)

Grouped bar chart comparing estimated vs actual tokens per item.

```tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface EstVsActualEntry {
  name: string;       // Item legacy_id or title (truncated)
  estimated: number;  // In K tokens
  actual: number;     // In K tokens
}

interface EstVsActualChartProps {
  data: EstVsActualEntry[];
}

export function EstVsActualChart({ data }: EstVsActualChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        No estimate vs actual data available
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Estimated vs Actual (K Tokens)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value}K`,
              name === 'estimated' ? 'Estimated' : 'Actual',
            ]}
          />
          <Legend />
          <Bar dataKey="estimated" fill="#93c5fd" name="Estimated" radius={[2, 2, 0, 0]} />
          <Bar dataKey="actual" fill="#3b82f6" name="Actual" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

## Integration Notes

- **Imports from:** `recharts` (already installed), `@/lib/pm-types` (VelocityChart uses `SprintVelocityEntry`)
- **Used by:** TASK-2215 (Sprint detail page uses BurndownChart + EstVsActualChart; Sprint list page uses VelocityChart)
- **Parallel with:** TASK-2209, TASK-2210, TASK-2211, TASK-2213
- **Exports:** `BurndownDataPoint` and `EstVsActualEntry` interfaces (used by sprint pages for data preparation)

## Do / Don't

### Do:
- Follow the recharts pattern from `admin-portal/app/dashboard/analytics/components/VersionDistribution.tsx`
- Use `ResponsiveContainer` for all charts
- Add 'use client' directive to all chart files
- Export data point interfaces (BurndownDataPoint, EstVsActualEntry) for use by page components
- Handle empty data arrays with a "No data" message
- Convert token values to K (divide by 1000) for readability

### Don't:
- Do NOT make RPC calls inside chart components (data comes from parent)
- Do NOT use dynamic imports (recharts works fine with 'use client')
- Do NOT implement chart animations beyond recharts defaults
- Do NOT add a Gantt chart (removed from scope per SR Engineer review)

## When to Stop and Ask

- If recharts causes SSR hydration errors in Next.js 15
- If you need to install additional recharts sub-packages
- If SprintVelocityEntry type is missing expected fields

## Testing Expectations

### Unit Tests
- **Required:** No (presentational components, verified via type-check + visual)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add velocity, burndown, and estimate vs actual chart components`
- **Branch:** `feature/TASK-2212-chart-components`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~22K

**Token Cap:** 88K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 3 new component files | +6K |
| Code volume | ~340 lines total | +7K |
| recharts familiarity | Already used in analytics | -3K |
| Chart configuration | 3 different chart types | +5K |
| Build verification | Type check + lint + build | +3K |

**Confidence:** High (recharts is already proven in this codebase; all charts are standard types)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] admin-portal/app/dashboard/pm/components/VelocityChart.tsx
- [ ] admin-portal/app/dashboard/pm/components/BurndownChart.tsx
- [ ] admin-portal/app/dashboard/pm/components/EstVsActualChart.tsx

Verification:
- [ ] npx tsc --noEmit passes
- [ ] npm run lint passes
- [ ] npm run build passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

**Variance:** PM Est ~22K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
