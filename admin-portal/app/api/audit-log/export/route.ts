/**
 * API Route: Audit Log Export
 *
 * GET /api/audit-log/export?format=csv|json&from=YYYY-MM-DD&to=YYYY-MM-DD&columns=action,target,...
 *
 * Server-side download route for SOC 2 auditors to extract audit logs.
 * Enforces authentication and audit.view permission.
 * Returns a downloadable CSV or JSON file for the specified date range.
 *
 * BACKLOG-921: Respects column selection from the UI.
 * BACKLOG-922: Filename includes export datetime.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { convertToCSV } from '@/lib/audit-export';

// Map UI column keys to data field names for filtering
const COLUMN_TO_FIELDS: Record<string, string[]> = {
  action: ['action'],
  target: ['target_type', 'target_id', 'target_email', 'target_name'],
  metadata: ['metadata'],
  ip_address: ['ip_address'],
  user_agent: ['user_agent'],
  actor: ['actor_id', 'actor_email', 'actor_name'],
  timestamp: ['created_at'],
};

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
  const actionFilter = searchParams.get('action');
  const columnsParam = searchParams.get('columns');

  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { error: 'Invalid format. Use "csv" or "json".' },
      { status: 400 }
    );
  }

  // ── 4. Resolve selected columns to data fields ────────────────────
  let selectedFields: string[] | null = null;
  if (columnsParam) {
    const columnKeys = columnsParam.split(',').filter(Boolean);
    const fields = new Set<string>();
    // Always include id for uniqueness
    fields.add('id');
    for (const key of columnKeys) {
      const mapped = COLUMN_TO_FIELDS[key];
      if (mapped) mapped.forEach((f) => fields.add(f));
    }
    selectedFields = Array.from(fields);
  }

  // ── 5. Fetch audit logs for the date range ─────────────────────────
  const params: Record<string, unknown> = {
    p_limit: 100000,
    p_offset: 0,
  };

  if (actionFilter) params.p_action = actionFilter;
  if (dateFrom) params.p_date_from = new Date(dateFrom).toISOString();
  if (dateTo) params.p_date_to = new Date(dateTo + 'T23:59:59').toISOString();

  const { data, error } = await supabase.rpc('admin_get_audit_logs', params);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { logs: Array<Record<string, unknown>>; total: number };
  let logs = result.logs || [];

  // Filter to selected columns if specified
  if (selectedFields) {
    logs = logs.map((log) => {
      const filtered: Record<string, unknown> = {};
      for (const field of selectedFields!) {
        if (field in log) filtered[field] = log[field];
      }
      return filtered;
    });
  }

  // ── 6. Build filename with date range and export timestamp ─────────
  const fromStr = dateFrom || 'all';
  const toStr = dateTo || 'now';
  const exportTime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `audit-log-${fromStr}-to-${toStr}_exported-${exportTime}`;

  // ── 7. Return formatted response ───────────────────────────────────
  if (format === 'json') {
    return new NextResponse(JSON.stringify(logs, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      },
    });
  }

  const csv = convertToCSV(logs, selectedFields ?? undefined);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  });
}
