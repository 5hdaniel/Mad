/**
 * Ticket assignment notification email template.
 *
 * Sent to an agent when a support ticket is assigned to them.
 * Includes ticket subject, number, customer name, priority, and link.
 *
 * TASK-2197: Email Service Infrastructure
 */

import { baseLayout } from './base-layout';
import type { EmailContent, TicketAssignmentNotificationParams } from '../types';

/**
 * Build the ticket assignment notification email (subject, HTML, plain text).
 *
 * Pure function -- no side effects, no async.
 */
export function buildTicketAssignmentNotification(
  params: TicketAssignmentNotificationParams,
): EmailContent {
  const {
    ticketSubject,
    ticketNumber,
    customerName,
    priority,
    ticketLink,
  } = params;

  const subject = `Ticket assigned to you: [${ticketNumber}] ${ticketSubject}`;

  const priorityColor = getPriorityColor(priority);

  const html = baseLayout({
    preheader: `You have been assigned ticket ${ticketNumber}`,
    body: `
      <h1 style="margin:0 0 8px 0; font-size:20px; font-weight:700; color:#111827; line-height:1.3;">
        Ticket Assigned to You
      </h1>
      <p style="margin:0 0 24px 0; font-size:14px; color:#6b7280; line-height:1.5;">
        A support ticket has been assigned to you for action.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
        <tr>
          <td style="padding:16px 20px; border-bottom:1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:12px; color:#6b7280; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">
                  Ticket
                </td>
                <td style="font-size:14px; color:#111827; text-align:right;">
                  ${escapeHtml(ticketNumber)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px; border-bottom:1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:12px; color:#6b7280; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">
                  Subject
                </td>
                <td style="font-size:14px; color:#111827; text-align:right;">
                  ${escapeHtml(ticketSubject)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px; border-bottom:1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:12px; color:#6b7280; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">
                  Customer
                </td>
                <td style="font-size:14px; color:#111827; text-align:right;">
                  ${escapeHtml(customerName)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:12px; color:#6b7280; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">
                  Priority
                </td>
                <td style="text-align:right;">
                  <span style="display:inline-block; padding:2px 10px; font-size:12px; font-weight:600; color:#ffffff; background-color:${priorityColor}; border-radius:9999px;">
                    ${escapeHtml(priority)}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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
      <p style="margin:0; font-size:13px; color:#9ca3af; line-height:1.5;">
        You are receiving this because a ticket was assigned to you.
      </p>
    `,
  });

  const text = [
    `Ticket assigned to you: [${ticketNumber}] ${ticketSubject}`,
    '',
    'A support ticket has been assigned to you for action.',
    '',
    `Ticket: ${ticketNumber}`,
    `Subject: ${ticketSubject}`,
    `Customer: ${customerName}`,
    `Priority: ${priority}`,
    '',
    `View the ticket: ${ticketLink}`,
    '',
    'You are receiving this because a ticket was assigned to you.',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPriorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'urgent':
    case 'critical':
      return '#dc2626'; // red-600
    case 'high':
      return '#ea580c'; // orange-600
    case 'medium':
    case 'normal':
      return '#ca8a04'; // yellow-600
    case 'low':
      return '#16a34a'; // green-600
    default:
      return '#6b7280'; // gray-500
  }
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
