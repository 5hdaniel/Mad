/**
 * API Route: Sentry User Issues
 *
 * Proxies requests to the Sentry REST API to fetch issues
 * associated with a specific user email. Auth + internal role required.
 *
 * GET /api/sentry/user-issues?email=user@example.com
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchUserIssues } from '@/lib/sentry';

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Internal role check
  const { data: role } = await supabase
    .from('internal_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .single();

  if (!role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get and validate email parameter
  const email = request.nextUrl.searchParams.get('email');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'Missing or invalid email parameter' },
      { status: 400 }
    );
  }

  // Fetch issues from Sentry
  const issues = await fetchUserIssues(email);

  return NextResponse.json({ issues });
}
