/**
 * Shared Export Utilities
 *
 * Common formatting functions used by pdfExportService and folderExportService.
 * Extracted from duplicated implementations in both services (TASK-2030).
 */

import { dbAll } from "../services/db/core/dbConnection";
import { normalizePhone as sharedNormalizePhone } from "../services/contactResolutionService";
import logService from "../services/logService";

/**
 * Escape HTML entities in text to prevent XSS in generated HTML.
 * Uses a single regex with lookup map for efficiency.
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Format a number as USD currency.
 * Returns "N/A" for null/undefined/zero values.
 */
export function formatCurrency(amount?: number | null): string {
  if (!amount) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a date string or Date object as a human-readable date.
 * Returns "N/A" for null/undefined values.
 * Example: "January 15, 2024"
 */
export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return "N/A";
  const date =
    typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a date string or Date object as a human-readable date and time.
 * Returns "N/A" for null/undefined values.
 * Example: "Jan 15, 2024, 02:30 PM"
 */
export function formatDateTime(dateString: string | Date): string {
  if (!dateString) return "N/A";
  const date =
    typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Look up contact names for phone numbers from imported contacts.
 * Synchronous version for use in HTML generation methods.
 *
 * Consolidated from pdfExportService and folderExportService (TASK-2030).
 * Uses the more robust SQL normalization from folderExportService
 * (strips +, -, and spaces before matching).
 */
export function getContactNamesByPhones(phones: string[]): Record<string, string> {
  if (phones.length === 0) return {};

  const result: Record<string, string> = {};

  try {
    // Normalize phones — email-safe (emails kept as-is, phones to last 10 digits)
    const normalizedPhones = phones.map((p) => sharedNormalizePhone(p));

    // Query contact_phones to find names
    const placeholders = normalizedPhones.map(() => "?").join(",");
    const sql = `
      SELECT
        cp.phone_e164,
        cp.phone_display,
        c.display_name
      FROM contact_phones cp
      JOIN contacts c ON cp.contact_id = c.id
      WHERE substr(replace(replace(replace(cp.phone_e164, '+', ''), '-', ''), ' ', ''), -10) IN (${placeholders})
         OR substr(replace(replace(replace(cp.phone_display, '+', ''), '-', ''), ' ', ''), -10) IN (${placeholders})
    `;

    const rows = dbAll<{ phone_e164: string; phone_display: string; display_name: string }>(
      sql,
      [...normalizedPhones, ...normalizedPhones]
    );

    for (const row of rows) {
      if (row.display_name) {
        if (row.phone_e164) {
          const norm = sharedNormalizePhone(row.phone_e164);
          result[norm] = row.display_name;
          result[row.phone_e164] = row.display_name;
        }
        if (row.phone_display) {
          const norm = sharedNormalizePhone(row.phone_display);
          result[norm] = row.display_name;
          result[row.phone_display] = row.display_name;
        }
      }
    }
  } catch (error) {
    logService.warn(
      "[Export] Failed to look up contact names from imported contacts",
      "ExportUtils",
      { error }
    );
  }

  return result;
}
