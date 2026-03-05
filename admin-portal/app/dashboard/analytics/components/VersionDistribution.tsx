'use client';

/**
 * Version Distribution — Analytics Dashboard
 *
 * Shows active users by app version with a bar chart
 * and a data table with counts and adoption percentages.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { VersionDistribution as VersionDistributionData } from '@/lib/analytics-queries';

interface Props {
  data: VersionDistributionData[];
}

const COLORS = [
  '#0ea5e9', // primary-500
  '#0284c7', // primary-600
  '#0369a1', // primary-700
  '#075985', // primary-800
  '#38bdf8', // primary-400
  '#7dd3fc', // primary-300
];

export function VersionDistribution({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Active Users by App Version
        </h3>
        <p className="text-sm text-gray-500">
          No device data available. Version distribution will appear once
          devices report their app version.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Active Users by App Version
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        Based on active devices seen in the last 30 days
      </p>

      {/* Bar Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="app_version"
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              formatter={(value: number | undefined) => [value ?? 0, 'Users']}
            />
            <Bar dataKey="user_count" radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-gray-500 font-medium">
                Version
              </th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">
                Users
              </th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">
                Adoption
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.app_version}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="py-2 px-3 font-mono text-gray-900">
                  {row.app_version}
                </td>
                <td className="text-right py-2 px-3 text-gray-700">
                  {row.user_count}
                </td>
                <td className="text-right py-2 px-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                    {row.adoption_pct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
