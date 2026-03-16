/**
 * Server-side proxy for support ticket email notifications.
 *
 * Forwards notification requests from the client-side support queries
 * to the broker portal's email notification API with the shared secret.
 * This keeps INTERNAL_API_SECRET server-side only.
 *
 * TASK-2199: Support Ticket Notification Emails
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Verify the caller is an authenticated admin user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Read-only for this route
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const brokerPortalUrl = process.env.BROKER_PORTAL_URL;
    const apiSecret = process.env.INTERNAL_API_SECRET;

    if (!brokerPortalUrl || !apiSecret) {
      console.warn('[Support] Email notification skipped: BROKER_PORTAL_URL or INTERNAL_API_SECRET not configured');
      return NextResponse.json({ success: false, skipped: true });
    }

    const body = await request.json();

    const response = await fetch(`${brokerPortalUrl}/api/email/ticket-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': apiSecret,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (err) {
    console.error('[Support] Notification proxy error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
