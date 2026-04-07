/**
 * API route for sending ticket confirmation emails.
 *
 * Called by the broker portal after a user submits a support ticket.
 * Authenticated via Supabase session (the user must be logged in).
 *
 * BACKLOG-1567: Email Delivery Observability (Sentry)
 */

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTicketConfirmationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // Authenticate via session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
