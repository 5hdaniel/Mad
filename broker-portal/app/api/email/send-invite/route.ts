/**
 * API route for sending organization user invite emails.
 *
 * Called by the admin portal when inviting a user to an organization.
 * Authentication: shared secret via `x-api-secret` header.
 *
 * Follows the same pattern as:
 *  - /api/email/ticket-notification (support ticket emails)
 *  - /api/email/internal-invite (internal user emails)
 *
 * BACKLOG-1535: Proxy invite email through broker portal
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendInviteEmail } from '@/lib/email';

interface SendInviteRequest {
  recipientEmail: string;
  organizationName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
  expiresInDays: number;
}

export async function POST(request: NextRequest) {
  try {
    // Validate shared secret
    const secret = request.headers.get('x-api-secret');
    if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SendInviteRequest = await request.json();

    // Validate required fields
    if (!body.recipientEmail || !body.organizationName || !body.inviterName || !body.role || !body.inviteLink) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await sendInviteEmail({
      recipientEmail: body.recipientEmail,
      organizationName: body.organizationName,
      inviterName: body.inviterName,
      role: body.role,
      inviteLink: body.inviteLink,
      expiresInDays: body.expiresInDays || 7,
    });

    return NextResponse.json({ success: result.success, error: result.error });
  } catch (err) {
    console.error('[SendInvite] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
