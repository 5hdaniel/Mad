'use client';

/**
 * New Ticket Page - Dashboard Layout
 *
 * Renders the ticket form inside the dashboard layout so authenticated
 * users keep the nav bar visible. The public /support/new route remains
 * for unauthenticated visitors.
 */

import { TicketForm } from '@/app/support/components/TicketForm';

export default function DashboardNewTicketPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Submit a Support Request</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill out the form below and we will get back to you as soon as possible.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TicketForm />
      </div>
    </div>
  );
}
