'use client';

/**
 * Public Support Landing Page - Broker Portal
 *
 * Redirects authenticated users to /dashboard/support.
 * Unauthenticated users see option to log in or submit a new ticket.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SupportPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/dashboard/support');
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Support</h1>
        <p className="text-sm text-gray-500 mt-1">Get help from the Keepr team</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm mb-4">
          Log in to view your support tickets, or submit a new request below.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/login?redirect=/dashboard/support"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/support/new"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Submit a New Ticket
          </Link>
        </div>
      </div>
    </div>
  );
}
