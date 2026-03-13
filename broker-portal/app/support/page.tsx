'use client';

/**
 * Customer Ticket List Page - Broker Portal
 *
 * Shows the customer's tickets. For authenticated users, auto-loads by email.
 * For unauthenticated users, prompts for email lookup.
 */

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { TicketList } from './components/TicketList';

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

export default function SupportPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Tickets</h1>
        <p className="text-sm text-gray-500 mt-1">View and track your support requests</p>
      </div>

      <Suspense fallback={null}>
        <SuccessBanner />
      </Suspense>

      <TicketList />
    </div>
  );
}
