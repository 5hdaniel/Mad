/**
 * Shared Types - Submission Models
 *
 * These types are shared between the desktop app (Electron) and
 * the broker portal (Next.js) for consistency.
 *
 * @see supabase/migrations/20260122_b2b_broker_portal.sql for schema
 */

// ============================================
// SUBMISSION STATUS
// ============================================

/**
 * Workflow status for transaction submissions
 */
export type SubmissionStatus =
  | 'not_submitted'  // Local only, not yet sent to broker
  | 'submitted'      // Sent to broker, awaiting review
  | 'under_review'   // Broker has started reviewing
  | 'needs_changes'  // Broker requests modifications
  | 'resubmitted'    // Agent has resubmitted after changes
  | 'approved'       // Broker approved the submission
  | 'rejected';      // Broker rejected the submission

// ============================================
// TRANSACTION SUBMISSION
// ============================================

/**
 * Transaction submission record in Supabase
 */
export interface TransactionSubmission {
  id: string;
  organization_id: string;
  submitted_by: string;
  local_transaction_id: string;

  // Property info
  property_address: string;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;

  // Transaction details
  transaction_type: 'purchase' | 'sale' | 'other';
  listing_price: number | null;
  sale_price: number | null;
  started_at: string | null;
  closed_at: string | null;

  // Status & review
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  review_deadline: string | null;

  // Version tracking
  version: number;
  parent_submission_id: string | null;

  // Counts
  message_count: number;
  attachment_count: number;

  // Metadata
  submission_metadata: Record<string, unknown> | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// SUBMISSION MESSAGE
// ============================================

/**
 * Message participants structure
 */
export interface MessageParticipants {
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
}

/**
 * Message record in submission
 */
export interface SubmissionMessage {
  id: string;
  submission_id: string;
  local_message_id: string | null;

  // Channel info
  channel: 'email' | 'sms' | 'imessage';
  direction: 'inbound' | 'outbound';

  // Content
  subject: string | null;
  body_text: string | null;
  participants: MessageParticipants;

  // Threading
  sent_at: string | null;
  thread_id: string | null;

  // Attachments
  has_attachments: boolean;
  attachment_count: number;

  // Timestamps
  created_at: string;
}

// ============================================
// SUBMISSION ATTACHMENT
// ============================================

/**
 * Document types for classification
 */
export type DocumentType =
  | 'offer'
  | 'inspection'
  | 'disclosure'
  | 'contract'
  | 'appraisal'
  | 'amendment'
  | 'addendum'
  | 'title'
  | 'closing'
  | 'other';

/**
 * Attachment record in submission
 */
export interface SubmissionAttachment {
  id: string;
  submission_id: string;
  message_id: string | null;

  // File info
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string;

  // Classification
  document_type: DocumentType | null;

  // Timestamps
  created_at: string;
}

// ============================================
// SUBMISSION COMMENT
// ============================================

/**
 * Review comment on a submission
 */
export interface SubmissionComment {
  id: string;
  submission_id: string;
  user_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

// ============================================
// ORGANIZATION
// ============================================

/**
 * Organization (brokerage) record
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  max_seats: number;
  retention_years: number;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Organization member roles
 */
export type OrganizationRole = 'admin' | 'broker' | 'agent';

/**
 * License status for agents
 */
export type LicenseStatus = 'pending' | 'active' | 'expired' | 'suspended';

/**
 * Organization member record
 */
export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string | null;
  role: OrganizationRole;
  license_status: LicenseStatus;
  joined_at: string | null;
  invited_email: string | null;
  invitation_token: string | null;
  invitation_expires_at: string | null;
  created_at: string;
  updated_at: string;
}
