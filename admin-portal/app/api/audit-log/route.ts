/**
 * API Route: Audit Log Entry
 *
 * Server-side route that captures the client IP address and User-Agent from
 * request headers and writes an audit log entry via the log_admin_action RPC.
 *
 * POST /api/audit-log
 * Body: { action: string, target_type: string, target_id: string, metadata?: object }
 *
 * SOC 2 Control: CC6.1 - Security event logging with source identification
 * Task: TASK-2137 / BACKLOG-855, TASK-2142 / BACKLOG-860
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse request body
  let action: string;
  let targetType: string;
  let targetId: string;
  let metadata: Record<string, unknown> | null;

  try {
    const body = await request.json();
    action = typeof body.action === 'string' ? body.action.trim() : '';
    targetType = typeof body.target_type === 'string' ? body.target_type.trim() : '';
    targetId = typeof body.target_id === 'string' ? body.target_id.trim() : '';
    metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : null;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }
  if (!targetType) {
    return NextResponse.json({ error: 'Missing target_type' }, { status: 400 });
  }
  if (!targetId) {
    return NextResponse.json({ error: 'Missing target_id' }, { status: 400 });
  }

  // 3. Extract client IP from request headers
  // On Vercel, x-forwarded-for contains the client IP as the first entry.
  // Falls back to x-real-ip, then 'unknown' if neither header is present.
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') || 'unknown';

  // 4. Extract User-Agent from request headers (SOC 2 CC6.1 - TASK-2142)
  // Browsers send this automatically; stored as-is without parsing.
  const userAgent = request.headers.get('user-agent') || null;

  // 5. Call RPC to insert audit log entry with IP and user agent
  const { error } = await supabase.rpc('log_admin_action', {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_metadata: metadata,
    p_ip_address: ip,
    p_user_agent: userAgent,
  });

  if (error) {
    console.error('[audit-log] RPC error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
