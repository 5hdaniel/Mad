/**
 * API route for sending internal user invite emails.
 *
 * Called by the admin portal when adding a new internal user.
 * Authentication: shared secret via `x-api-secret` header.
 */

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

    const result = await sendInternalInviteEmail({
      recipientEmail: email,
      roleName,
      loginUrl,
    });

    return NextResponse.json({ success: result.success, error: result.error });
  } catch (err) {
    console.error('[InternalInvite] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
