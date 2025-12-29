/**
 * TransactionDetails Module Types
 * Shared type definitions for the transaction details feature
 */
import type { Transaction, Communication, Contact } from "@/types";

/**
 * Interface for AI-suggested contact assignment
 */
export interface SuggestedContact {
  role: string;
  contact_id: string;
  is_primary?: boolean;
  notes?: string;
}

/**
 * Interface for resolved suggested contact with contact details
 */
export interface ResolvedSuggestedContact extends SuggestedContact {
  contact?: Contact;
}

/**
 * Contact assignment from transaction details
 */
export interface ContactAssignment {
  id: string;
  contact_id: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_company?: string;
  role?: string;
  specific_role?: string;
  is_primary?: number;
  notes?: string;
}

/**
 * Props for TransactionDetails component
 */
export interface TransactionDetailsProps {
  transaction: Transaction;
  onClose: () => void;
  onTransactionUpdated?: () => void;
  /** If true, shows approve/reject buttons instead of export/delete (for pending review) */
  isPendingReview?: boolean;
  /** User ID for feedback recording */
  userId?: string;
  /** Toast handler for success messages - if provided, uses parent's toast system */
  onShowSuccess?: (message: string) => void;
  /** Toast handler for error messages - if provided, uses parent's toast system */
  onShowError?: (message: string) => void;
}

/**
 * Tab types for transaction details view
 */
export type TransactionTab = "details" | "contacts" | "messages";

/**
 * Communication type for local use
 */
export type { Communication };

/**
 * Re-export Transaction type
 */
export type { Transaction };
