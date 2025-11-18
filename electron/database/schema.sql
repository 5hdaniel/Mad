-- ============================================
-- MAD - LOCAL SQLite DATABASE SCHEMA
-- ============================================
-- Purpose: Store user data, transactions, communications locally
-- Privacy: All sensitive data encrypted, local-first approach
-- Sync: Users table synced from Supabase cloud

-- ============================================
-- USERS TABLE (Local Copy)
-- ============================================
CREATE TABLE IF NOT EXISTS users_local (
  -- Core Identity (synced from cloud)
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  avatar_url TEXT,

  -- OAuth Reference
  oauth_provider TEXT NOT NULL CHECK (oauth_provider IN ('google', 'microsoft')),
  oauth_id TEXT NOT NULL,

  -- Subscription (synced from cloud)
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired')),
  trial_ends_at DATETIME,

  -- Account Status
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,

  -- Legal compliance
  terms_accepted_at DATETIME,
  terms_version_accepted TEXT,
  privacy_policy_accepted_at DATETIME,
  privacy_policy_version_accepted TEXT,

  -- Preferences (local, synced to cloud)
  timezone TEXT DEFAULT 'America/Los_Angeles',
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  notification_preferences TEXT DEFAULT '{}',
  company TEXT,
  job_title TEXT,

  -- Sync tracking
  last_cloud_sync_at DATETIME,

  UNIQUE(oauth_provider, oauth_id)
);

-- ============================================
-- OAUTH TOKENS TABLE (Local, Encrypted)
-- ============================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  purpose TEXT NOT NULL CHECK (purpose IN ('authentication', 'mailbox')),

  -- Token Data (encrypted using Electron safeStorage)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,
  scopes_granted TEXT,

  -- Mailbox Specific
  connected_email_address TEXT,
  mailbox_connected INTEGER DEFAULT 0,
  permissions_granted_at DATETIME,

  -- Token Health
  token_last_refreshed_at DATETIME,
  token_refresh_failed_count INTEGER DEFAULT 0,
  last_sync_at DATETIME,
  last_sync_error TEXT,

  -- Status
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
  UNIQUE(user_id, provider, purpose)
);

-- ============================================
-- SESSIONS TABLE (Local)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE
);

-- ============================================
-- CONTACTS TABLE (Local)
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Contact Information
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,

  -- Source
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'contacts_app')),

  -- Import tracking
  is_imported INTEGER DEFAULT 1,

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_interaction_at DATETIME,

  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE
);

-- ============================================
-- TRANSACTIONS TABLE (Local)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Property Information (USER INPUT)
  property_address TEXT NOT NULL,
  property_street TEXT,
  property_city TEXT,
  property_state TEXT,
  property_zip TEXT,
  property_coordinates TEXT,

  -- Transaction Details (AUTO-DETECTED + USER INPUT)
  transaction_type TEXT CHECK (transaction_type IN ('purchase', 'sale')),
  transaction_status TEXT DEFAULT 'completed' CHECK (transaction_status IN ('completed', 'pending')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  closing_date DATE,
  representation_start_date DATE,
  closing_date_verified INTEGER DEFAULT 0,
  representation_start_confidence INTEGER,
  closing_date_confidence INTEGER,

  -- Contact Associations
  buyer_agent_id TEXT,
  seller_agent_id TEXT,
  escrow_officer_id TEXT,
  inspector_id TEXT,
  other_contacts TEXT, -- JSON array of contact IDs

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Export Tracking
  export_status TEXT DEFAULT 'not_exported' CHECK (export_status IN ('not_exported', 'exported', 're_export_needed')),
  export_format TEXT CHECK (export_format IN ('pdf', 'csv', 'json', 'txt_eml', 'excel')),
  export_count INTEGER DEFAULT 0,
  last_exported_on DATETIME,
  export_generated_at DATETIME, -- Deprecated: Use last_exported_on instead

  -- Extraction Stats
  communications_scanned INTEGER DEFAULT 0,
  extraction_confidence INTEGER,

  -- Auto-Extracted Data
  first_communication_date DATETIME,
  last_communication_date DATETIME,
  total_communications_count INTEGER DEFAULT 0,
  mutual_acceptance_date DATE,
  earnest_money_amount DECIMAL(10, 2),
  earnest_money_delivered_date DATE,
  listing_price DECIMAL(12, 2),
  sale_price DECIMAL(12, 2),
  other_parties TEXT,
  offer_count INTEGER DEFAULT 0,
  failed_offers_count INTEGER DEFAULT 0,
  key_dates TEXT,

  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_agent_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (seller_agent_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (escrow_officer_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (inspector_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- ============================================
-- TRANSACTION CONTACTS (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS transaction_contacts (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  role TEXT,
  role_category TEXT,
  specific_role TEXT,
  is_primary INTEGER DEFAULT 0,
  notes TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  UNIQUE(transaction_id, contact_id)
);

-- ============================================
-- COMMUNICATIONS TABLE (Cached Emails/Texts)
-- ============================================
CREATE TABLE IF NOT EXISTS communications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_id TEXT,

  -- Communication Metadata
  communication_type TEXT CHECK (communication_type IN ('email', 'text', 'imessage')),
  source TEXT,
  email_thread_id TEXT,

  -- Participants
  sender TEXT,
  recipients TEXT,
  cc TEXT,
  bcc TEXT,

  -- Content
  subject TEXT,
  body TEXT,
  body_plain TEXT,

  -- Timestamps
  sent_at DATETIME,
  received_at DATETIME,

  -- Attachments
  has_attachments INTEGER DEFAULT 0,
  attachment_count INTEGER DEFAULT 0,
  attachment_metadata TEXT,

  -- Analysis
  keywords_detected TEXT,
  parties_involved TEXT,
  communication_category TEXT,
  flagged_for_review INTEGER DEFAULT 0,
  is_compliance_related INTEGER DEFAULT 0,

  -- Linking
  relevance_score INTEGER,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- ============================================
-- EXTRACTED TRANSACTION DATA (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS extracted_transaction_data (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,

  -- Extracted Field
  field_name TEXT NOT NULL,
  field_value TEXT,

  -- Source
  source_communication_id TEXT,
  extraction_method TEXT,
  confidence_score INTEGER,

  -- Verification
  manually_verified INTEGER DEFAULT 0,
  verified_at DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_communication_id) REFERENCES communications(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES (Performance Optimization)
-- ============================================
-- Note: Indexes for migration-added columns are created in the migration code
CREATE INDEX IF NOT EXISTS idx_users_local_email ON users_local(email);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider, purpose);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_is_imported ON contacts(is_imported);
CREATE INDEX IF NOT EXISTS idx_contacts_user_imported ON contacts(user_id, is_imported);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_property ON transactions(property_address);
CREATE INDEX IF NOT EXISTS idx_transaction_contacts_transaction_id ON transaction_contacts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_communications_user_id ON communications(user_id);
CREATE INDEX IF NOT EXISTS idx_communications_transaction_id ON communications(transaction_id);
CREATE INDEX IF NOT EXISTS idx_communications_sent_at ON communications(sent_at);
CREATE INDEX IF NOT EXISTS idx_extracted_data_transaction_id ON extracted_transaction_data(transaction_id);

-- ============================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================
-- Note: Additional triggers are created in the migration code
-- after ensuring required columns exist

CREATE TRIGGER IF NOT EXISTS update_users_local_timestamp
AFTER UPDATE ON users_local
BEGIN
  UPDATE users_local SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_oauth_tokens_timestamp
AFTER UPDATE ON oauth_tokens
BEGIN
  UPDATE oauth_tokens SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_contacts_timestamp
AFTER UPDATE ON contacts
BEGIN
  UPDATE contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
