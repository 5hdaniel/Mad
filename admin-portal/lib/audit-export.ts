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
 * Headers: id, created_at, action, target_type, target_id, actor_id, actor_email, actor_name, ip_address, metadata
 * Metadata (JSONB) is serialized as a JSON string in CSV.
 */
export function convertToCSV(logs: Array<Record<string, unknown>>): string {
  if (logs.length === 0) {
    return CSV_HEADERS.join(',');
  }

  const headerRow = CSV_HEADERS.join(',');

  const dataRows = logs.map((log) =>
    CSV_HEADERS.map((header) => escapeCSVField(log[header])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}
