/**
 * Core Data Models for Magic Audit
 * These types represent the main entities in the application
 */

// ============================================
// ENUMS
// ============================================

export type OAuthProvider = 'google' | 'microsoft';
export type OAuthPurpose = 'authentication' | 'mailbox';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'trial' | 'active' | 'cancelled' | 'expired';
export type Theme = 'light' | 'dark' | 'auto';
export type ContactSource = 'manual' | 'email' | 'contacts_app';
export type TransactionType = 'purchase' | 'sale';
export type TransactionStatus = 'completed' | 'pending';
export type Status = 'active' | 'closed';
export type ExportStatus = 'not_exported' | 'exported' | 're_export_needed';
export type ExportFormat = 'pdf' | 'csv' | 'json' | 'txt_eml' | 'excel';
export type CommunicationType = 'email' | 'text' | 'imessage';
export type FeedbackType = 'correction' | 'confirmation' | 'rejection';
export type SuggestedTransactionStatus = 'pending' | 'approved' | 'rejected';

// ============================================
// USER MODELS
// ============================================

export interface User {
  // Core Identity
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;

  // OAuth
  oauth_provider: OAuthProvider;
  oauth_id: string;

  // Subscription
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  trial_ends_at?: Date | string;

  // Account Status
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at?: Date | string;

  // Legal
  terms_accepted_at?: Date | string;
  terms_version_accepted?: string;
  privacy_policy_accepted_at?: Date | string;
  privacy_policy_version_accepted?: string;

  // Onboarding
  email_onboarding_completed_at?: Date | string;

  // Preferences
  timezone?: string;
  theme?: Theme;
  notification_preferences?: string | Record<string, unknown>;
  company?: string;
  job_title?: string;
  mobile_phone_type?: 'iphone' | 'android';

  // Sync
  last_cloud_sync_at?: Date | string;
}

export interface OAuthToken {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  purpose: OAuthPurpose;

  // Token Data (encrypted)
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date | string;
  scopes_granted?: string;

  // Mailbox
  connected_email_address?: string;
  mailbox_connected: boolean;
  permissions_granted_at?: Date | string;

  // Token Health
  token_last_refreshed_at?: Date | string;
  token_refresh_failed_count: number;
  last_sync_at?: Date | string;
  last_sync_error?: string;

  // Status
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Session {
  id: string;
  user_id: string;
  session_token: string;
  expires_at: Date | string;
  created_at: Date | string;
  last_accessed_at: Date | string;
}

export interface Subscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isActive: boolean;
  isTrial: boolean;
  trialEnded: boolean;
  trialDaysRemaining: number;
}

// ============================================
// CONTACT MODELS
// ============================================

export interface Contact {
  id: string;
  user_id: string;

  // Contact Information
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;

  // Source
  source: ContactSource;

  // Import tracking
  is_imported: boolean;

  // Metadata
  created_at: Date | string;
  updated_at: Date | string;
  last_interaction_at?: Date | string;
}

export interface TransactionContact {
  id: string;
  transaction_id: string;
  contact_id: string;
  role?: string;
  role_category?: string;
  specific_role?: string;
  is_primary: boolean;
  notes?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

// ============================================
// TRANSACTION MODELS
// ============================================

export interface Transaction {
  id: string;
  user_id: string;

  // Property Information
  property_address: string;
  property_street?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  property_coordinates?: string;

  // Transaction Details
  transaction_type?: TransactionType;
  transaction_status: TransactionStatus;
  status: Status;
  closing_date?: Date | string;
  representation_start_date?: Date | string;
  closing_date_verified: boolean;
  representation_start_confidence?: number;
  closing_date_confidence?: number;

  // Contact Associations
  buyer_agent_id?: string;
  seller_agent_id?: string;
  escrow_officer_id?: string;
  inspector_id?: string;
  other_contacts?: string; // JSON array of contact IDs

  // Metadata
  created_at: Date | string;
  updated_at: Date | string;

  // Export Tracking
  export_status: ExportStatus;
  export_format?: ExportFormat;
  export_count: number;
  last_exported_on?: Date | string;
  export_generated_at?: Date | string; // Deprecated

  // Extraction Stats
  communications_scanned: number;
  extraction_confidence?: number;

  // Auto-Extracted Data
  first_communication_date?: Date | string;
  last_communication_date?: Date | string;
  total_communications_count: number;
  mutual_acceptance_date?: Date | string;
  earnest_money_amount?: number;
  earnest_money_delivered_date?: Date | string;
  listing_price?: number;
  sale_price?: number;
  other_parties?: string;
  offer_count: number;
  failed_offers_count: number;
  key_dates?: string;
}

// ============================================
// SUGGESTED TRANSACTION MODELS
// ============================================

export interface DetectedParty {
  name: string;
  email?: string;
  role?: string;
}

export interface SuggestedTransaction {
  id: string;
  user_id: string;

  // Property Information (May be partial)
  property_address?: string;
  property_street?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  property_coordinates?: string;

  // Transaction Details (Detected from emails)
  transaction_type?: TransactionType;
  closing_date?: Date | string;
  representation_start_date?: Date | string;

  // Extracted Data
  first_communication_date?: Date | string;
  last_communication_date?: Date | string;
  communications_count: number;
  extraction_confidence?: number;

  // Financial Data
  sale_price?: number;
  listing_price?: number;
  earnest_money_amount?: number;

  // Parties & Contacts
  other_parties?: DetectedParty[];
  detected_contacts?: DetectedParty[];

  // Source Email Information
  source_communication_ids: string[];

  // Review Status
  status: SuggestedTransactionStatus;
  reviewed_at?: Date | string;
  reviewed_by_user: boolean;

  // User Edits (before approval)
  user_edits?: Record<string, unknown>;

  // Timestamps
  created_at: Date | string;
  updated_at: Date | string;
}

// ============================================
// COMMUNICATION MODELS
// ============================================

export interface Communication {
  id: string;
  user_id: string;
  transaction_id?: string;

  // Communication Metadata
  communication_type?: CommunicationType;
  source?: string;
  email_thread_id?: string;

  // Participants
  sender?: string;
  recipients?: string;
  cc?: string;
  bcc?: string;

  // Content
  subject?: string;
  body?: string;
  body_plain?: string;

  // Timestamps
  sent_at?: Date | string;
  received_at?: Date | string;

  // Attachments
  has_attachments: boolean;
  attachment_count: number;
  attachment_metadata?: string;

  // Analysis
  keywords_detected?: string;
  parties_involved?: string;
  communication_category?: string;
  flagged_for_review: boolean;
  is_compliance_related: boolean;

  // Linking
  relevance_score?: number;

  created_at: Date | string;
}

export interface ExtractedTransactionData {
  id: string;
  transaction_id: string;

  // Extracted Field
  field_name: string;
  field_value?: string;

  // Source
  source_communication_id?: string;
  extraction_method?: string;
  confidence_score?: number;

  // Verification
  manually_verified: boolean;
  verified_at?: Date | string;

  created_at: Date | string;
}

// ============================================
// FEEDBACK MODELS
// ============================================

export interface UserFeedback {
  id: string;
  user_id: string;
  transaction_id?: string;
  communication_id?: string;
  feedback_type: FeedbackType;
  field_name?: string;
  original_value?: string;
  corrected_value?: string;
  feedback_text?: string;
  created_at: Date | string;
}

// ============================================
// UTILITY TYPES
// ============================================

// Type for creating new records (omit auto-generated fields)
export type NewUser = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type NewContact = Omit<Contact, 'id' | 'created_at' | 'updated_at'>;
export type NewTransaction = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>;
export type NewCommunication = Omit<Communication, 'id' | 'created_at'>;
export type NewSuggestedTransaction = Omit<SuggestedTransaction, 'id' | 'created_at' | 'updated_at'>;

// Type for updating records (all fields optional except id)
export type UpdateUser = Partial<Omit<User, 'id'>> & { id: string };
export type UpdateContact = Partial<Omit<Contact, 'id'>> & { id: string };
export type UpdateTransaction = Partial<Omit<Transaction, 'id'>> & { id: string };
export type UpdateCommunication = Partial<Omit<Communication, 'id'>> & { id: string };
export type UpdateSuggestedTransaction = Partial<Omit<SuggestedTransaction, 'id'>> & { id: string };

// Filters for querying
export interface TransactionFilters {
  user_id?: string;
  transaction_type?: TransactionType;
  transaction_status?: TransactionStatus;
  status?: Status;
  export_status?: ExportStatus;
  start_date?: Date | string;
  end_date?: Date | string;
  property_address?: string;
}

export interface CommunicationFilters {
  user_id?: string;
  transaction_id?: string;
  communication_type?: CommunicationType;
  start_date?: Date | string;
  end_date?: Date | string;
  has_attachments?: boolean;
}

export interface ContactFilters {
  user_id?: string;
  source?: ContactSource;
  is_imported?: boolean;
}
