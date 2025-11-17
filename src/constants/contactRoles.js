/**
 * Contact Role Constants
 * Defines all available contact roles and categories for transaction management
 */

export const ROLE_CATEGORIES = {
  CLIENT: 'client',
  AGENT: 'agent',
  LENDING: 'lending',
  INSPECTION: 'inspection',
  TITLE_ESCROW: 'title_escrow',
  LEGAL: 'legal',
  SUPPORT: 'support',
  PROPERTY_MANAGEMENT: 'property_management',
  INSURANCE: 'insurance',
};

export const SPECIFIC_ROLES = {
  // Client
  CLIENT: 'client',

  // Agents
  BUYER_AGENT: 'buyer_agent',
  SELLER_AGENT: 'seller_agent',
  LISTING_AGENT: 'listing_agent',

  // Inspection & Appraisal
  APPRAISER: 'appraiser',
  INSPECTOR: 'inspector',
  SURVEYOR: 'surveyor',

  // Title & Escrow
  TITLE_COMPANY: 'title_company',
  ESCROW_OFFICER: 'escrow_officer',

  // Lending
  MORTGAGE_BROKER: 'mortgage_broker',
  LENDER: 'lender',

  // Legal
  REAL_ESTATE_ATTORNEY: 'real_estate_attorney',

  // Support
  TRANSACTION_COORDINATOR: 'transaction_coordinator',

  // Insurance
  INSURANCE_AGENT: 'insurance_agent',

  // Property Management
  HOA_MANAGEMENT: 'hoa_management',
  CONDO_MANAGEMENT: 'condo_management',

  // Other
  OTHER: 'other',
};

export const ROLE_DISPLAY_NAMES = {
  [SPECIFIC_ROLES.CLIENT]: 'Client (Buyer/Seller)',
  [SPECIFIC_ROLES.BUYER_AGENT]: 'Buyer Agent',
  [SPECIFIC_ROLES.SELLER_AGENT]: 'Seller Agent',
  [SPECIFIC_ROLES.LISTING_AGENT]: 'Listing Agent',
  [SPECIFIC_ROLES.APPRAISER]: 'Appraiser',
  [SPECIFIC_ROLES.INSPECTOR]: 'Inspector',
  [SPECIFIC_ROLES.SURVEYOR]: 'Surveyor',
  [SPECIFIC_ROLES.TITLE_COMPANY]: 'Title Company',
  [SPECIFIC_ROLES.ESCROW_OFFICER]: 'Escrow Officer',
  [SPECIFIC_ROLES.MORTGAGE_BROKER]: 'Mortgage Broker',
  [SPECIFIC_ROLES.LENDER]: 'Lender',
  [SPECIFIC_ROLES.REAL_ESTATE_ATTORNEY]: 'Real Estate Attorney',
  [SPECIFIC_ROLES.TRANSACTION_COORDINATOR]: 'Transaction Coordinator (TC)',
  [SPECIFIC_ROLES.INSURANCE_AGENT]: 'Insurance Agent',
  [SPECIFIC_ROLES.HOA_MANAGEMENT]: 'HOA Management',
  [SPECIFIC_ROLES.CONDO_MANAGEMENT]: 'Condo Management',
  [SPECIFIC_ROLES.OTHER]: 'Other',
};

export const CATEGORY_DISPLAY_NAMES = {
  [ROLE_CATEGORIES.CLIENT]: 'Client & Agent',
  [ROLE_CATEGORIES.AGENT]: 'Agents',
  [ROLE_CATEGORIES.LENDING]: 'Lending',
  [ROLE_CATEGORIES.INSPECTION]: 'Inspection & Appraisal',
  [ROLE_CATEGORIES.TITLE_ESCROW]: 'Title & Escrow',
  [ROLE_CATEGORIES.LEGAL]: 'Legal',
  [ROLE_CATEGORIES.SUPPORT]: 'Support Services',
  [ROLE_CATEGORIES.PROPERTY_MANAGEMENT]: 'Property Management',
  [ROLE_CATEGORIES.INSURANCE]: 'Insurance',
};

// Map specific roles to their categories
export const ROLE_TO_CATEGORY = {
  [SPECIFIC_ROLES.CLIENT]: ROLE_CATEGORIES.CLIENT,
  [SPECIFIC_ROLES.BUYER_AGENT]: ROLE_CATEGORIES.AGENT,
  [SPECIFIC_ROLES.SELLER_AGENT]: ROLE_CATEGORIES.AGENT,
  [SPECIFIC_ROLES.LISTING_AGENT]: ROLE_CATEGORIES.AGENT,
  [SPECIFIC_ROLES.APPRAISER]: ROLE_CATEGORIES.INSPECTION,
  [SPECIFIC_ROLES.INSPECTOR]: ROLE_CATEGORIES.INSPECTION,
  [SPECIFIC_ROLES.SURVEYOR]: ROLE_CATEGORIES.INSPECTION,
  [SPECIFIC_ROLES.TITLE_COMPANY]: ROLE_CATEGORIES.TITLE_ESCROW,
  [SPECIFIC_ROLES.ESCROW_OFFICER]: ROLE_CATEGORIES.TITLE_ESCROW,
  [SPECIFIC_ROLES.MORTGAGE_BROKER]: ROLE_CATEGORIES.LENDING,
  [SPECIFIC_ROLES.LENDER]: ROLE_CATEGORIES.LENDING,
  [SPECIFIC_ROLES.REAL_ESTATE_ATTORNEY]: ROLE_CATEGORIES.LEGAL,
  [SPECIFIC_ROLES.TRANSACTION_COORDINATOR]: ROLE_CATEGORIES.SUPPORT,
  [SPECIFIC_ROLES.INSURANCE_AGENT]: ROLE_CATEGORIES.INSURANCE,
  [SPECIFIC_ROLES.HOA_MANAGEMENT]: ROLE_CATEGORIES.PROPERTY_MANAGEMENT,
  [SPECIFIC_ROLES.CONDO_MANAGEMENT]: ROLE_CATEGORIES.PROPERTY_MANAGEMENT,
};

// Organized roles by step in the wizard
export const AUDIT_WORKFLOW_STEPS = [
  {
    title: 'Client & Agents',
    description: 'Core parties to the transaction',
    roles: [
      { role: SPECIFIC_ROLES.CLIENT, required: true, multiple: false },
      { role: SPECIFIC_ROLES.BUYER_AGENT, required: false, multiple: false },
      { role: SPECIFIC_ROLES.SELLER_AGENT, required: false, multiple: false },
    ],
  },
  {
    title: 'Professional Services',
    description: 'Title, escrow, inspection, and other professionals',
    roles: [
      { role: SPECIFIC_ROLES.TITLE_COMPANY, required: false, multiple: false },
      { role: SPECIFIC_ROLES.ESCROW_OFFICER, required: false, multiple: false },
      { role: SPECIFIC_ROLES.INSPECTOR, required: false, multiple: true },
      { role: SPECIFIC_ROLES.APPRAISER, required: false, multiple: false },
      { role: SPECIFIC_ROLES.SURVEYOR, required: false, multiple: false },
      { role: SPECIFIC_ROLES.MORTGAGE_BROKER, required: false, multiple: false },
      { role: SPECIFIC_ROLES.REAL_ESTATE_ATTORNEY, required: false, multiple: false },
      { role: SPECIFIC_ROLES.TRANSACTION_COORDINATOR, required: false, multiple: false },
      { role: SPECIFIC_ROLES.INSURANCE_AGENT, required: false, multiple: false },
      { role: SPECIFIC_ROLES.HOA_MANAGEMENT, required: false, multiple: false },
    ],
  },
];
