/**
 * Invite email template.
 *
 * Sent when an admin invites a new user to join their organisation on Keepr.
 * Includes organisation name, inviter name, role, CTA button, and expiry notice.
 *
 * TASK-2197: Email Service Infrastructure
 */

import { baseLayout } from './base-layout';
import type { EmailContent, InviteEmailParams } from '../types';

/**
 * Build the invite email content (subject, HTML, plain text).
 *
 * Pure function -- no side effects, no async.
 */
export function buildInviteEmail(params: InviteEmailParams): EmailContent {
  const {
    organizationName,
    inviterName,
    role,
    inviteLink,
    expiresInDays,
  } = params;

  const subject = `${inviterName} has invited you to the ${organizationName} team on Keepr.`;

  const html = baseLayout({
    preheader: `${inviterName} has invited you to the ${organizationName} team on Keepr.`,
    body: `
      <h1 style="margin:0 0 16px 0; font-size:24px; font-weight:700; color:#111827; line-height:1.3;">
        You're Invited!
      </h1>
      <p style="margin:0 0 8px 0; font-size:16px; color:#374151; line-height:1.6;">
        ${escapeHtml(inviterName)} has invited you to the
        <strong>${escapeHtml(organizationName)}</strong> team on Keepr..
      </p>
      <p style="margin:0 0 24px 0; font-size:14px; color:#6b7280; line-height:1.5;">
        Role: <strong>${escapeHtml(role)}</strong>
      </p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
        <tr>
          <td align="center" style="border-radius:6px; background-color:#4f46e5;">
            <a href="${escapeAttr(inviteLink)}"
               target="_blank"
               style="display:inline-block; padding:14px 32px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:6px; background-color:#4f46e5;">
              Accept Invitation
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 16px 0; font-size:14px; color:#6b7280; line-height:1.5;">
        This invitation expires in ${expiresInDays} day${expiresInDays !== 1 ? 's' : ''}.
      </p>
      <p style="margin:0; font-size:13px; color:#9ca3af; line-height:1.5;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    `,
  });

  const text = [
    `${inviterName} has invited you to the ${organizationName} team on Keepr.`,
    '',
    `${inviterName} has invited you to the ${organizationName} team on Keepr..`,
    `Role: ${role}`,
    '',
    `Accept your invitation: ${inviteLink}`,
    '',
    `This invitation expires in ${expiresInDays} day${expiresInDays !== 1 ? 's' : ''}.`,
    '',
    'If you didn\'t expect this invitation, you can safely ignore this email.',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
