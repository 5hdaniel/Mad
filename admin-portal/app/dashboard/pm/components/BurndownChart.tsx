'use client';

/**
 * BurndownChart -- PM Analytics
 *
 * Line chart showing remaining work within a sprint over time.
 * Displays both ideal burndown (linear) and actual burndown lines.
 * Data is passed via props (no direct RPC calls).
 */

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
  date: string; // e.g., "Mar 1"
  remaining: number; // Actual remaining items
  ideal: number; // Ideal remaining (linear)
}

interface BurndownChartProps {
  data: BurndownDataPoint[];
  totalItems: number;
}

export function BurndownChart({ data, totalItems }: BurndownChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Sprint Burndown ({totalItems} items)
        </h3>
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">
          No burndown data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Sprint Burndown ({totalItems} items)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={[0, 'dataMax + 2']} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
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
