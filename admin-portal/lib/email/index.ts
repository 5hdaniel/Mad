/**
 * Email service module for the admin portal.
 *
 * Wraps Microsoft Graph API (client credentials flow) to send
 * transactional emails. Currently only supports invite emails
 * for organization user invitations.
 *
 * BACKLOG-1492: Admin invite users
 */

// Core send function
export { sendEmail } from './send-email';

// Template builders
export { buildInviteEmail } from './templates/invite';

// Types
export type {
  SendEmailParams,
  SendEmailResult,
  EmailContent,
  InviteEmailParams,
} from './types';

// ---------------------------------------------------------------------------
// Convenience wrapper that composes template + send
// ---------------------------------------------------------------------------

import { sendEmail } from './send-email';
import { buildInviteEmail } from './templates/invite';
import type {
  InviteEmailParams,
  SendEmailResult,
} from './types';

/**
 * Send an invite email to a new user.
 *
 * Composes the invite template and sends it via Graph API.
 */
export async function sendInviteEmail(
  params: InviteEmailParams,
): Promise<SendEmailResult> {
  const { subject, html, text } = buildInviteEmail(params);
  return sendEmail({ to: params.recipientEmail, subject, html, text });
}
