/**
 * API route for sending ticket confirmation emails.
 *
 * Called by:
 * 1. The broker portal after a user submits a support ticket (session auth).
 * 2. The admin portal proxy when an agent creates a ticket on behalf of a
 *    customer (API secret auth via x-api-secret header).
 *
 * BACKLOG-1565: Support Ticket Confirmation Email (admin-created tickets)
 * BACKLOG-1567: Email Delivery Observability (Sentry)
 */

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTicketConfirmationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // Authenticate via API secret (admin portal proxy) or session (broker portal)
    const apiSecret = request.headers.get('x-api-secret');
    const hasValidApiSecret =
      !!process.env.INTERNAL_API_SECRET && apiSecret === process.env.INTERNAL_API_SECRET;

    if (!hasValidApiSecret) {
      // Fallback to session auth for direct broker portal calls
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { ticketNumber, ticketSubject, requesterEmail, ticketLink } = await request.json();

    if (!ticketNumber || !ticketSubject || !requesterEmail || !ticketLink) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    Sentry.addBreadcrumb({
      category: 'email.route',
      message: 'Processing ticket-confirmation request',
      level: 'info',
      data: { ticketNumber, requesterEmail },
    });

    const result = await sendTicketConfirmationEmail({
      recipientEmail: requesterEmail,
      ticketSubject,
      ticketNumber,
      ticketLink,
    });

    if (!result.success) {
      Sentry.captureMessage(`Ticket confirmation email failed for ${requesterEmail}`, {
        level: 'warning',
        extra: { error: result.error, ticketNumber },
      });
    }

    return NextResponse.json({ success: result.success, error: result.error });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'email/ticket-confirmation' } });
    console.error('[TicketConfirmation] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
