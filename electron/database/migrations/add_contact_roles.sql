-- ============================================
-- MIGRATION: Enhanced Contact Roles for Transactions
-- ============================================
-- Purpose: Support comprehensive contact role assignments in transactions
-- This enables the "Audit New Transaction" feature

-- Step 1: Add additional columns to transaction_contacts for better role management
ALTER TABLE transaction_contacts ADD COLUMN role_category TEXT CHECK (role_category IN (
  'client',
  'agent',
  'lending',
  'inspection',
  'title_escrow',
  'legal',
  'support',
  'property_management',
  'insurance'
));

-- Add specific role field with all supported roles
ALTER TABLE transaction_contacts ADD COLUMN specific_role TEXT CHECK (specific_role IN (
  'client',
  'buyer_agent',
  'seller_agent',
  'listing_agent',
  'appraiser',
  'inspector',
  'title_company',
  'escrow_officer',
  'mortgage_broker',
  'lender',
  'real_estate_attorney',
  'transaction_coordinator',
  'insurance_agent',
  'surveyor',
  'hoa_management',
  'condo_management',
  'other'
));

-- Add primary contact flag (for roles where there can be multiple contacts)
ALTER TABLE transaction_contacts ADD COLUMN is_primary INTEGER DEFAULT 0;

-- Add notes field for additional context
ALTER TABLE transaction_contacts ADD COLUMN notes TEXT;

-- Add updated_at timestamp
ALTER TABLE transaction_contacts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Create a view that maps old hardcoded fields to new structure
-- This maintains backward compatibility
CREATE VIEW IF NOT EXISTS transaction_contacts_unified AS
SELECT
  t.id as transaction_id,
  t.user_id,
  tc.contact_id,
  tc.specific_role,
  tc.role_category,
  tc.is_primary,
  tc.notes,
  c.name as contact_name,
  c.email as contact_email,
  c.phone as contact_phone,
  c.company as contact_company,
  c.title as contact_title
FROM transactions t
LEFT JOIN transaction_contacts tc ON t.id = tc.transaction_id
LEFT JOIN contacts c ON tc.contact_id = c.id;

-- Step 3: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_transaction_contacts_role ON transaction_contacts(specific_role);
CREATE INDEX IF NOT EXISTS idx_transaction_contacts_category ON transaction_contacts(role_category);
CREATE INDEX IF NOT EXISTS idx_transaction_contacts_primary ON transaction_contacts(is_primary);

-- Step 4: Create trigger to update timestamp
CREATE TRIGGER IF NOT EXISTS update_transaction_contacts_timestamp
AFTER UPDATE ON transaction_contacts
BEGIN
  UPDATE transaction_contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- ROLE DEFINITIONS AND CATEGORIES
-- ============================================
-- This is for documentation purposes

-- CLIENT CATEGORY
-- - client: The buyer or seller who hired the agent

-- AGENT CATEGORY
-- - buyer_agent: Agent representing the buyer
-- - seller_agent: Agent representing the seller
-- - listing_agent: Agent who listed the property

-- INSPECTION CATEGORY
-- - appraiser: Professional appraiser
-- - inspector: Home/property inspector
-- - surveyor: Land surveyor

-- TITLE/ESCROW CATEGORY
-- - title_company: Title insurance company
-- - escrow_officer: Escrow officer handling funds

-- LENDING CATEGORY
-- - mortgage_broker: Mortgage broker
-- - lender: Direct lender/bank

-- LEGAL CATEGORY
-- - real_estate_attorney: Real estate attorney

-- SUPPORT CATEGORY
-- - transaction_coordinator: Transaction coordinator/TC

-- INSURANCE CATEGORY
-- - insurance_agent: Insurance agent

-- PROPERTY MANAGEMENT CATEGORY
-- - hoa_management: HOA management company
-- - condo_management: Condo management company

-- OTHER
-- - other: Any other role not listed above
