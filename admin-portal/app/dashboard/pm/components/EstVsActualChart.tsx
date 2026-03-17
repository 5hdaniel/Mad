'use client';

/**
 * EstVsActualChart -- PM Analytics
 *
 * Grouped bar chart comparing estimated vs actual tokens per item.
 * Data is passed via props (no direct RPC calls).
 */

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
  name: string; // Item legacy_id or title (truncated)
  estimated: number; // In K tokens
  actual: number; // In K tokens
}

interface EstVsActualChartProps {
  data: EstVsActualEntry[];
}

export function EstVsActualChart({ data }: EstVsActualChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Estimated vs Actual (K Tokens)
        </h3>
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">
          No estimate vs actual data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Estimated vs Actual (K Tokens)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            formatter={(value: number | undefined, name: string | undefined) => [
              `${value ?? 0}K`,
              name === 'estimated' ? 'Estimated' : 'Actual',
            ]}
          />
          <Legend />
          <Bar
            dataKey="estimated"
            fill="#93c5fd"
            name="Estimated"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="actual"
            fill="#3b82f6"
            name="Actual"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
