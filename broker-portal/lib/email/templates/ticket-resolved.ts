/**
 * Ticket resolved/closed notification email template.
 *
 * Sent to the requester when their support ticket is resolved or closed,
 * confirming the resolution and providing a link to reopen if needed.
 *
 * BACKLOG-1574: Ticket Lifecycle Emails (Resolved/Closed Notifications)
 */

import { baseLayout } from './base-layout';
import type { EmailContent, TicketResolvedParams } from '../types';

/**
 * Build the ticket resolved notification email (subject, HTML, plain text).
 *
 * Pure function -- no side effects, no async.
 */
export function buildTicketResolvedEmail(params: TicketResolvedParams): EmailContent {
  const { ticketSubject, ticketNumber, resolutionSummary, ticketLink, newStatus } = params;

  const statusLabel = newStatus === 'closed' ? 'Closed' : 'Resolved';
  const subject = `[${ticketNumber}] Your support request has been ${statusLabel.toLowerCase()}`;

  // Truncate resolution summary to 300 characters
  const summary =
    resolutionSummary && resolutionSummary.length > 300
      ? resolutionSummary.slice(0, 300) + '...'
      : resolutionSummary;

  const resolutionBlock = summary
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
        <tr>
          <td style="padding:16px; background-color:#f9fafb; border-left:4px solid #10b981; border-radius:0 4px 4px 0;">
            <p style="margin:0 0 8px 0; font-size:13px; font-weight:600; color:#10b981;">
              Resolution Summary
            </p>
            <p style="margin:0; font-size:14px; color:#374151; line-height:1.6;">
              ${escapeHtml(summary)}
            </p>
          </td>
        </tr>
      </table>`
    : '';

  const html = baseLayout({
    preheader: `Your support request ${ticketNumber} has been ${statusLabel.toLowerCase()}`,
    body: `
      <h1 style="margin:0 0 8px 0; font-size:20px; font-weight:700; color:#111827; line-height:1.3;">
        Your Support Request Has Been ${escapeHtml(statusLabel)}
      </h1>
      <p style="margin:0 0 24px 0; font-size:14px; color:#6b7280; line-height:1.5;">
        ${escapeHtml(ticketNumber)} &mdash; ${escapeHtml(ticketSubject)}
      </p>
      ${resolutionBlock}
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
        <tr>
          <td align="center" style="border-radius:6px; background-color:#4f46e5;">
            <a href="${escapeAttr(ticketLink)}"
               target="_blank"
               style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:6px; background-color:#4f46e5;">
              View Ticket
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px 0; font-size:14px; color:#374151; line-height:1.5;">
        If your issue isn&rsquo;t fully resolved, you can reopen this ticket from the link above.
      </p>
      <p style="margin:0; font-size:13px; color:#9ca3af; line-height:1.5;">
        You are receiving this because you submitted a support request.
      </p>
    `,
  });

  const text = [
    `Your support request has been ${statusLabel.toLowerCase()}: [${ticketNumber}] ${ticketSubject}`,
    '',
    ...(summary ? ['Resolution Summary:', summary, ''] : []),
    `View your ticket: ${ticketLink}`,
    '',
    "If your issue isn't fully resolved, you can reopen this ticket from the link above.",
    '',
    'You are receiving this because you submitted a support request.',
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
