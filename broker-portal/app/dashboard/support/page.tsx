'use client';

/**
 * Support Tickets Page - Broker Portal Dashboard
 *
 * Shows the customer's tickets within the dashboard layout.
 */

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { TicketList } from '@/app/support/components/TicketList';

function SuccessBanner() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');

  if (!success) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
      <p className="text-sm text-green-700">
        Your ticket has been submitted successfully. We will get back to you soon.
      </p>
    </div>
  );
}

export default function DashboardSupportPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Support</h1>
          <p className="text-sm text-gray-500 mt-1">View and track your support requests</p>
        </div>
        <Link
          href="/support/new"
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          New Ticket
        </Link>
      </div>

      <Suspense fallback={null}>
        <SuccessBanner />
      </Suspense>

      <TicketList />
    </div>
  );
}
