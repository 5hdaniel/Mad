'use client';

/**
 * StatsCards - Support Dashboard
 *
 * Displays key ticket metrics: Open, Unassigned, Urgent counts.
 */

import { useEffect, useState } from 'react';
import { Inbox, UserX, AlertTriangle } from 'lucide-react';
import { getTicketStats } from '@/lib/support-queries';
import type { TicketStats } from '@/lib/support-types';

export function StatsCards() {
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const data = await getTicketStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load ticket stats:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Open Tickets',
      value: stats?.total_open ?? 0,
      icon: Inbox,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Unassigned',
      value: stats?.unassigned ?? 0,
      icon: UserX,
      color: 'text-yellow-600 bg-yellow-50',
    },
    {
      label: 'Urgent',
      value: stats?.by_priority?.urgent ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4"
          >
            <div className={`rounded-lg p-3 ${card.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
