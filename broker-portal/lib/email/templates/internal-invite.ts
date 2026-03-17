/**
 * Internal user invite email template.
 *
 * Sent when an admin adds a new internal user (support agent, etc.)
 * via the admin portal. Tells them to log in to activate their role.
 */

import { baseLayout } from './base-layout';
import type { EmailContent, InternalInviteEmailParams } from '../types';

export function buildInternalInviteEmail(params: InternalInviteEmailParams): EmailContent {
  const { roleName, loginUrl } = params;

  const subject = `You've been added to the Keepr team`;

  const html = baseLayout({
    preheader: `You've been added to the Keepr team as ${roleName}`,
    body: `
      <h1 style="margin:0 0 16px 0; font-size:24px; font-weight:700; color:#111827; line-height:1.3;">
        Welcome to the team!
      </h1>
      <p style="margin:0 0 8px 0; font-size:16px; color:#374151; line-height:1.6;">
        You've been added to the Keepr team.
      </p>
      <p style="margin:0 0 24px 0; font-size:14px; color:#6b7280; line-height:1.5;">
        Role: <strong>${escapeHtml(roleName)}</strong>
      </p>
      <p style="margin:0 0 24px 0; font-size:16px; color:#374151; line-height:1.6;">
        Sign in with your existing account to get started.
      </p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
        <tr>
          <td align="center" style="border-radius:6px; background-color:#4f46e5;">
            <a href="${escapeAttr(loginUrl)}"
               target="_blank"
               style="display:inline-block; padding:14px 32px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:6px; background-color:#4f46e5;">
              Sign In
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0; font-size:13px; color:#9ca3af; line-height:1.5;">
        If you didn't expect this, you can safely ignore this email.
      </p>
    `,
  });

  const text = [
    "You've been added to the Keepr team",
    '',
    `Role: ${roleName}`,
    '',
    'Sign in with your existing account to get started.',
    '',
    `Sign in: ${loginUrl}`,
    '',
    "If you didn't expect this, you can safely ignore this email.",
  ].join('\n');

  return { subject, html, text };
}

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
