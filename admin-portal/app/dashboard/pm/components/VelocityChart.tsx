'use client';

/**
 * VelocityChart -- PM Analytics
 *
 * Bar chart showing estimated vs actual tokens per sprint.
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
import type { SprintVelocityEntry } from '@/lib/pm-types';

interface VelocityChartProps {
  data: SprintVelocityEntry[];
}

export function VelocityChart({ data }: VelocityChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Sprint Velocity (Tokens in K)
        </h3>
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">
          No velocity data available
        </div>
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Sprint Velocity (Tokens in K)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            formatter={(value, name) => [
              `${Number(value) || 0}K tokens`,
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
