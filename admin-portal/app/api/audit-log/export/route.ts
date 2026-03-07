/**
 * API Route: Audit Log Export
 *
 * GET /api/audit-log/export?format=csv|json&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Server-side download route for SOC 2 auditors to extract audit logs.
 * Enforces authentication and audit.view permission.
 * Returns a downloadable CSV or JSON file for the specified date range.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { convertToCSV } from '@/lib/audit-export';

export async function GET(request: NextRequest) {
  // ── 1. Auth check ──────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Permission check ────────────────────────────────────────────
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    check_user_id: user.id,
    required_permission: 'audit.view',
  });

  if (!hasPerm) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── 3. Parse query params ──────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv';
  const dateFrom = searchParams.get('from');
  const dateTo = searchParams.get('to');

  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { error: 'Invalid format. Use "csv" or "json".' },
      { status: 400 }
    );
  }

  // ── 4. Fetch audit logs for the date range ─────────────────────────
  const params: Record<string, unknown> = {
    p_limit: 100000,
    p_offset: 0,
  };

  if (dateFrom) params.p_date_from = new Date(dateFrom).toISOString();
  if (dateTo) params.p_date_to = new Date(dateTo + 'T23:59:59').toISOString();

  const { data, error } = await supabase.rpc('admin_get_audit_logs', params);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { logs: Array<Record<string, unknown>>; total: number };
  const logs = result.logs || [];

  // ── 5. Build filename with date range ──────────────────────────────
  const fromStr = dateFrom || 'all';
  const toStr = dateTo || 'now';
  const filename = `audit-log-${fromStr}-to-${toStr}`;

  // ── 6. Return formatted response ───────────────────────────────────
  if (format === 'json') {
    return new NextResponse(JSON.stringify(logs, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      },
    });
  }

  const csv = convertToCSV(logs);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  });
}
