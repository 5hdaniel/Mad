/**
 * API route for ticket resolved/closed email notifications.
 *
 * Called by the admin portal (fire-and-forget) when a ticket status
 * changes to 'resolved' or 'closed'. Notifies the requester with a
 * resolution summary and reopen link.
 *
 * Authentication: shared secret via `x-api-secret` header.
 *
 * BACKLOG-1574: Ticket Lifecycle Emails (Resolved/Closed Notifications)
 * BACKLOG-1567: Email Delivery Observability (Sentry)
 */

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { sendTicketResolvedEmail } from '@/lib/email';

// ---------------------------------------------------------------------------
// Request type
// ---------------------------------------------------------------------------

interface TicketResolvedRequest {
  ticketId: string;
  ticketNumber: string;
  ticketSubject: string;
  customerEmail: string;
  resolutionSummary?: string;
  ticketUrl: string;
  newStatus: 'resolved' | 'closed';
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Validate shared secret
    const secret = request.headers.get('x-api-secret');
    if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: TicketResolvedRequest = await request.json();

    if (!body.ticketId || !body.ticketNumber || !body.customerEmail || !body.newStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (body.newStatus !== 'resolved' && body.newStatus !== 'closed') {
      return NextResponse.json({ error: 'Invalid status: must be resolved or closed' }, { status: 400 });
    }

    Sentry.addBreadcrumb({
      category: 'email.route',
      message: `Processing ticket-resolved notification (${body.newStatus})`,
      level: 'info',
      data: { ticketNumber: body.ticketNumber, newStatus: body.newStatus },
    });

    const result = await sendTicketResolvedEmail({
      recipientEmail: body.customerEmail,
      ticketSubject: body.ticketSubject,
      ticketNumber: body.ticketNumber,
      resolutionSummary: body.resolutionSummary,
      ticketLink: body.ticketUrl,
      newStatus: body.newStatus,
    });

    if (!result.success) {
      Sentry.captureMessage(`Ticket resolved notification failed for ${body.customerEmail}`, {
        level: 'warning',
        extra: { error: result.error, ticketNumber: body.ticketNumber, newStatus: body.newStatus },
      });
    }

    return NextResponse.json({ success: result.success, error: result.error });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'email/ticket-resolved' } });
    console.error('[TicketResolved] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
