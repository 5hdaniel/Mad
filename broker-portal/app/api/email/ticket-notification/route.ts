/**
 * API route for support ticket email notifications.
 *
 * Called by the admin portal (fire-and-forget) when:
 * - An agent replies to a ticket -> customer gets notified
 * - A ticket is assigned to an agent -> agent gets notified
 *
 * Authentication: shared secret via `x-api-secret` header.
 *
 * TASK-2199: Support Ticket Notification Emails
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  sendTicketReplyNotification,
  sendTicketAssignmentNotification,
} from '@/lib/email';

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface TicketReplyNotificationRequest {
  type: 'reply';
  ticketId: string;
  ticketNumber: string;
  ticketSubject: string;
  customerEmail: string;
  agentName: string;
  replyPreview: string;
  ticketUrl: string;
}

interface TicketAssignmentNotificationRequest {
  type: 'assignment';
  ticketId: string;
  ticketNumber: string;
  ticketSubject: string;
  agentEmail: string;
  customerName: string;
  priority: string;
  ticketUrl: string;
}

type NotificationRequest =
  | TicketReplyNotificationRequest
  | TicketAssignmentNotificationRequest;

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

    const body: NotificationRequest = await request.json();

    if (body.type === 'reply') {
      const result = await sendTicketReplyNotification({
        recipientEmail: body.customerEmail,
        ticketSubject: body.ticketSubject,
        ticketNumber: body.ticketNumber,
        agentName: body.agentName,
        replyPreview: body.replyPreview,
        ticketLink: body.ticketUrl,
      });
      return NextResponse.json({ success: result.success, error: result.error });
    }

    if (body.type === 'assignment') {
      const result = await sendTicketAssignmentNotification({
        recipientEmail: body.agentEmail,
        ticketSubject: body.ticketSubject,
        ticketNumber: body.ticketNumber,
        customerName: body.customerName,
        priority: body.priority,
        ticketLink: body.ticketUrl,
      });
      return NextResponse.json({ success: result.success, error: result.error });
    }

    return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
  } catch (err) {
    console.error('[TicketNotification] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
