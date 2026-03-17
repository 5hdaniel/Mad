/**
 * Shared HTML email layout with Keepr branding.
 *
 * Uses table-based layout and inline CSS for maximum email client
 * compatibility (Gmail, Outlook, Apple Mail). No external stylesheets
 * or modern CSS (flexbox/grid).
 *
 * TASK-2197: Email Service Infrastructure
 */

interface LayoutParams {
  /** Hidden preheader text shown in email previews */
  preheader: string;
  /** HTML body content to render inside the layout */
  body: string;
}

/**
 * Wrap email body content in the standard Keepr branded layout.
 *
 * Includes:
 * - Hidden preheader text for inbox previews
 * - Branded header with Keepr name
 * - Content area with consistent padding
 * - Footer with company info
 */
export function baseLayout({ preheader, body }: LayoutParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Keepr</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, Helvetica, sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <!-- Preheader text (hidden, shown in email preview) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <!-- Preheader spacer to push hidden text -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; max-width:600px; width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px; background-color:#4f46e5;">
              <h2 style="margin:0; color:#ffffff; font-size:20px; font-weight:700; letter-spacing:-0.025em;">Keepr.</h2>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; background-color:#f9fafb; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:12px; color:#6b7280; line-height:1.5;">
                Keepr Compliance | Real Estate Transaction Auditing
              </p>
              <p style="margin:8px 0 0 0; font-size:11px; color:#9ca3af; line-height:1.5;">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS in email content.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
