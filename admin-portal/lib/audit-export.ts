/**
 * Audit Log Export Utilities
 *
 * CSV and JSON formatting for audit log exports.
 * Used by the /api/audit-log/export route for SOC 2 compliance.
 */

const CSV_HEADERS = [
  'id',
  'created_at',
  'action',
  'target_type',
  'target_id',
  'target_email',
  'target_name',
  'actor_id',
  'actor_email',
  'actor_name',
  'ip_address',
  'user_agent',
  'metadata',
] as const;

/**
 * Escape a value for safe CSV embedding.
 * - null/undefined become empty string
 * - objects are JSON-stringified with inner quotes escaped
 * - strings containing commas, quotes, or newlines are quoted
 */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    return `"${json.replace(/"/g, '""')}"`;
  }

  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert an array of audit log entries to CSV format.
 *
 * When `columns` is provided, only those fields are included in the CSV.
 * Otherwise all CSV_HEADERS are used.
 * Metadata (JSONB) is serialized as a JSON string in CSV.
 */
export function convertToCSV(logs: Array<Record<string, unknown>>, columns?: string[]): string {
  const headers = columns ?? [...CSV_HEADERS];

  if (logs.length === 0) {
    return headers.join(',');
  }

  const headerRow = headers.join(',');

  const dataRows = logs.map((log) =>
    headers.map((header) => escapeCSVField(log[header])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}
