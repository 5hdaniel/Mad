/**
 * Audit Log Helper
 *
 * Client-side utility for writing audit log entries through the server-side
 * API route. The API route captures the client IP from request headers,
 * which is not available in client-side code.
 *
 * Usage:
 *   import { logAuditAction } from '@/lib/audit';
 *   await logAuditAction({
 *     action: 'user.suspend',
 *     target_type: 'user',
 *     target_id: userId,
 *     metadata: { reason: 'Policy violation' },
 *   });
 *
 * SOC 2 Control: CC6.1 - Security event logging with source identification
 * Task: TASK-2137 / BACKLOG-855
 */

export interface AuditLogParams {
  /** The action being performed (e.g., 'user.suspend', 'role.create') */
  action: string;
  /** The type of entity being acted upon (e.g., 'user', 'role', 'license') */
  target_type: string;
  /** The ID of the entity being acted upon */
  target_id: string;
  /** Optional additional context for the action */
  metadata?: Record<string, unknown>;
}

/**
 * Log an admin action through the server-side API route.
 * The API route extracts the client IP from Vercel request headers.
 *
 * @throws Error if the request fails or the server returns an error
 */
export async function logAuditAction(params: AuditLogParams): Promise<void> {
  const response = await fetch('/api/audit-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(data.error || `Audit log failed with status ${response.status}`);
  }
}
