/**
 * useTransactionAttachments Hook
 * Fetches and manages email attachments linked to a transaction
 */
import { useState, useEffect, useCallback } from "react";
import type { Transaction, Communication } from "@/types";

/**
 * Interface for parsed email attachment metadata
 */
export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Interface for transaction attachment with email context
 */
export interface TransactionAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  emailId: string;
  emailSubject: string;
  emailDate: string;
}

/**
 * Interface for attachment counts from the actual attachments table (TASK-1781)
 * These counts match what the submission service will upload
 */
export interface AttachmentCounts {
  textAttachments: number;
  emailAttachments: number;
  total: number;
  totalSizeBytes: number;
}

interface UseTransactionAttachmentsResult {
  /** Attachments from emails linked to the transaction */
  attachments: TransactionAttachment[];
  /** Whether attachments are currently being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Total count of attachments */
  count: number;
  /** Refresh the attachments list */
  refresh: () => Promise<void>;
}

interface UseAttachmentCountsResult {
  /** Counts from actual downloaded attachments in DB */
  counts: AttachmentCounts;
  /** Whether counts are being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refresh the counts */
  refresh: () => Promise<void>;
}

/**
 * Parse attachment metadata from communication
 * Handles both JSON string and already-parsed array formats
 */
function parseAttachmentMetadata(
  metadataStr: string | undefined | null
): EmailAttachment[] {
  if (!metadataStr) return [];

  try {
    const parsed = JSON.parse(metadataStr);
    if (Array.isArray(parsed)) {
      return parsed.map((att, index) => ({
        id: att.id || `attachment-${index}`,
        filename: att.filename || att.name || "Unknown file",
        mimeType: att.mimeType || att.contentType || "application/octet-stream",
        size: att.size || 0,
      }));
    }
    return [];
  } catch {
    // Return empty array if parsing fails
    return [];
  }
}

/**
 * Hook for fetching email attachments linked to a transaction.
 * Extracts attachment metadata from email communications.
 *
 * @param transaction - The transaction to fetch attachments for
 * @returns Attachments data, loading state, error state, and refresh function
 */
export function useTransactionAttachments(
  transaction: Transaction
): UseTransactionAttachmentsResult {
  const [attachments, setAttachments] = useState<TransactionAttachment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load attachments from transaction details
   * Filters communications to emails with attachments and extracts metadata
   */
  const loadAttachments = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.transactions.getDetails(transaction.id);

      if (result.success && result.transaction) {
        const allCommunications: Communication[] =
          result.transaction.communications || [];

        // Filter for emails with attachments and extract attachment metadata
        const emailAttachments: TransactionAttachment[] = allCommunications
          .filter(
            (comm: Communication) =>
              comm.channel === "email" && comm.has_attachments
          )
          .flatMap((email: Communication) => {
            const metadata = parseAttachmentMetadata(email.attachment_metadata);
            return metadata.map((att) => ({
              id: att.id,
              filename: att.filename,
              mimeType: att.mimeType,
              size: att.size,
              emailId: email.id,
              emailSubject: email.subject || "No Subject",
              emailDate: email.sent_at?.toString() || email.received_at?.toString() || "",
            }));
          });

        // Sort by email date, most recent first
        emailAttachments.sort((a, b) => {
          const dateA = a.emailDate ? new Date(a.emailDate).getTime() : 0;
          const dateB = b.emailDate ? new Date(b.emailDate).getTime() : 0;
          return dateB - dateA;
        });

        setAttachments(emailAttachments);
      } else {
        setAttachments([]);
      }
    } catch (err) {
      console.error("Failed to load attachments:", err);
      setError("Failed to load attachments");
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [transaction.id]);

  /**
   * Load attachments when transaction changes
   */
  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  return {
    attachments,
    loading,
    error,
    count: attachments.length,
    refresh: loadAttachments,
  };
}

/**
 * Hook for fetching accurate attachment counts from the attachments table.
 * TASK-1781: These counts match what the submission service will actually upload.
 *
 * @param transactionId - Transaction ID to get counts for
 * @param auditStart - Optional audit start date (ISO string or Date)
 * @param auditEnd - Optional audit end date (ISO string or Date)
 * @returns Attachment counts, loading state, error state, and refresh function
 */
export function useAttachmentCounts(
  transactionId: string,
  auditStart?: string | Date | null,
  auditEnd?: string | Date | null
): UseAttachmentCountsResult {
  const [counts, setCounts] = useState<AttachmentCounts>({
    textAttachments: 0,
    emailAttachments: 0,
    total: 0,
    totalSizeBytes: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadCounts = useCallback(async (): Promise<void> => {
    if (!transactionId) {
      setCounts({ textAttachments: 0, emailAttachments: 0, total: 0, totalSizeBytes: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert dates to ISO strings if needed
      const startStr = auditStart
        ? (auditStart instanceof Date ? auditStart.toISOString() : auditStart)
        : undefined;
      const endStr = auditEnd
        ? (auditEnd instanceof Date ? auditEnd.toISOString() : auditEnd)
        : undefined;

      // Use type assertion for new API method (TASK-1781)
      // Note: The window.d.ts types after onSubmitProgress have a known TS parsing issue
      const transactions = window.api.transactions as typeof window.api.transactions & {
        getAttachmentCounts: (
          transactionId: string,
          auditStart?: string,
          auditEnd?: string
        ) => Promise<{
          success: boolean;
          data?: {
            textAttachments: number;
            emailAttachments: number;
            total: number;
            totalSizeBytes: number;
          };
          error?: string;
        }>;
      };

      const result = await transactions.getAttachmentCounts(
        transactionId,
        startStr,
        endStr
      );

      if (result.success && result.data) {
        setCounts({
          ...result.data,
          totalSizeBytes: result.data.totalSizeBytes || 0,
        });
      } else {
        setError(result.error || "Failed to load attachment counts");
        setCounts({ textAttachments: 0, emailAttachments: 0, total: 0, totalSizeBytes: 0 });
      }
    } catch (err) {
      console.error("Failed to load attachment counts:", err);
      setError("Failed to load attachment counts");
      setCounts({ textAttachments: 0, emailAttachments: 0, total: 0, totalSizeBytes: 0 });
    } finally {
      setLoading(false);
    }
  }, [transactionId, auditStart, auditEnd]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  return {
    counts,
    loading,
    error,
    refresh: loadCounts,
  };
}
