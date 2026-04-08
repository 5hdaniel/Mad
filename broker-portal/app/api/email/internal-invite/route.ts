/**
 * API route for sending internal user invite emails.
 *
 * Called by the admin portal when adding a new internal user.
 * Authentication: shared secret via `x-api-secret` header.
 *
 * BACKLOG-1567: Email Delivery Observability (Sentry)
 */

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { sendInternalInviteEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-api-secret');
    if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, roleName, loginUrl } = await request.json();

    if (!email || !roleName || !loginUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    Sentry.addBreadcrumb({
      category: 'email.route',
      message: 'Processing internal-invite request',
      level: 'info',
      data: { email, roleName },
    });

    const result = await sendInternalInviteEmail({
      recipientEmail: email,
      roleName,
      loginUrl,
    });

    if (!result.success) {
      Sentry.captureMessage(`Internal invite email failed for ${email}`, {
        level: 'warning',
        extra: { error: result.error, roleName },
      });
    }

    return NextResponse.json({ success: result.success, error: result.error });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'email/internal-invite' } });
    console.error('[InternalInvite] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
