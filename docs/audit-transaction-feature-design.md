# Audit New Transaction - Feature Design

## Overview
The "Audit New Transaction" feature allows agents to manually create and configure a transaction with full contact role assignments, verified property addresses, and comprehensive setup.

## User Flow

### Step 1: Address Entry & Verification
```
┌─────────────────────────────────────────┐
│   Audit New Transaction                 │
├─────────────────────────────────────────┤
│                                         │
│  Property Address *                     │
│  ┌───────────────────────────────────┐ │
│  │ 123 Main St, Anytown, CA 12345   │ │
│  └───────────────────────────────────┘ │
│              ↓                          │
│  [Google Places API Autocomplete]       │
│  ┌───────────────────────────────────┐ │
│  │ ✓ 123 Main St                     │ │
│  │   Anytown, CA 12345               │ │
│  │   ✓ Verified Address              │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Transaction Type:                      │
│  ( ) Purchase  ( ) Sale                 │
│                                         │
│  [Continue to Contact Assignment →]    │
└─────────────────────────────────────────┘
```

### Step 2: Contact Role Assignment
```
┌──────────────────────────────────────────────┐
│   Assign Contacts - Step 2 of 3             │
├──────────────────────────────────────────────┤
│                                              │
│  Client & Agent Roles                        │
│  ┌──────────────────────────────────────┐   │
│  │ Client (Buyer/Seller) *              │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ Buyer Agent                          │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ Seller/Listing Agent                 │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [← Back]  [Skip]  [Continue to Step 3 →]   │
└──────────────────────────────────────────────┘
```

### Step 3: Professional Services
```
┌──────────────────────────────────────────────┐
│   Professional Services - Step 3 of 3        │
├──────────────────────────────────────────────┤
│                                              │
│  Title & Escrow                              │
│  ┌──────────────────────────────────────┐   │
│  │ Title/Escrow Company                 │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Inspection & Appraisal                      │
│  ┌──────────────────────────────────────┐   │
│  │ Inspector(s)                         │   │
│  │ [Inspector 1 ▼] [+ Add Another]     │   │
│  │ [Inspector 2 ▼] [Remove]            │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ Appraiser                            │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ Surveyor                             │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Lending                                     │
│  ┌──────────────────────────────────────┐   │
│  │ Mortgage Broker                      │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Legal & Support                             │
│  ┌──────────────────────────────────────┐   │
│  │ Real Estate Attorney                 │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ Transaction Coordinator              │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Other Services                              │
│  ┌──────────────────────────────────────┐   │
│  │ Insurance Agent                      │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ HOA/Condo Management                 │   │
│  │ [Select Contact ▼] [+ New Contact]   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [← Back]  [Skip All]  [Create Transaction]  │
└──────────────────────────────────────────────┘
```

## Role Categories

### 1. Client & Agent (Required)
- **Client** (Buyer or Seller) - REQUIRED
- **Buyer Agent** - Your representation
- **Seller/Listing Agent** - Other side's representation

### 2. Title & Escrow
- **Title/Escrow Company** - Handles title insurance and closing
- Can store as company contact with multiple officers

### 3. Inspection & Appraisal
- **Inspector(s)** - MULTIPLE ALLOWED
  - General inspection
  - Roof inspection
  - Pest inspection
  - Structural engineer
- **Appraiser** - Property valuation
- **Surveyor** - Land/boundary survey

### 4. Lending
- **Mortgage Broker** - Loan officer/mortgage broker
- Can link multiple if client shops around

### 5. Legal & Support
- **Real Estate Attorney** - Legal representation
- **Transaction Coordinator (TC)** - Administrative support

### 6. Other Services
- **Insurance Agent** - Home/property insurance
- **HOA/Condo Management** - Property management

## Database Storage

Each contact assignment creates a row in `transaction_contacts`:

```sql
INSERT INTO transaction_contacts VALUES (
  'tc_uuid',
  'transaction_123',        -- transaction_id
  'contact_456',            -- contact_id
  'inspection',             -- role_category
  'inspector',              -- specific_role
  1,                        -- is_primary (if first inspector)
  'General home inspection' -- notes
);
```

## Google Places API Integration

### Address Verification Flow
1. User types address
2. Google Places Autocomplete suggests verified addresses
3. On selection:
   - Extract structured address (street, city, state, zip)
   - Get coordinates (lat/lng)
   - Validate address exists
4. Store verified address in transaction

### API Requirements
- Google Maps JavaScript API
- Places API (Autocomplete)
- Environment variable: `GOOGLE_MAPS_API_KEY`

## Implementation Components

### 1. Frontend Components
- `AuditTransactionModal.jsx` - Main modal container
- `AddressVerificationStep.jsx` - Step 1: Address input
- `ContactRoleAssignmentStep.jsx` - Steps 2-3: Contact assignment
- `RoleSelector.jsx` - Reusable contact selector with role

### 2. Backend Services
- `transactionService.js` - Enhanced with audit operations
  - `createAuditedTransaction()`
  - `assignContactToRole()`
  - `updateContactRole()`
  - `removeContactFromRole()`
- `addressVerificationService.js` - Google Places integration
  - `verifyAddress()`
  - `getAddressComponents()`

### 3. IPC Handlers
- `transactions.createAudited` - Create transaction with contacts
- `transactions.assignContact` - Add/update contact role
- `transactions.removeContact` - Remove contact from role
- `contacts.searchByRole` - Find contacts by their typical roles

## Benefits Over Current Manual Flow

### Current (Manual Transaction Creation)
1. Enter address manually
2. No verification
3. No contact assignment
4. Have to go back later to add contacts

### New (Audit Transaction)
1. ✅ Address verified via Google
2. ✅ All contacts assigned upfront
3. ✅ Organized by role/category
4. ✅ Support multiple contacts per role
5. ✅ Create new contacts inline
6. ✅ Complete transaction setup in one flow

## Future Enhancements

1. **Template Saving**: Save common contact configurations as templates
2. **Smart Suggestions**: Suggest contacts based on past transactions
3. **Bulk Import**: Import transaction roster from CSV
4. **Validation Rules**: Require certain roles based on transaction type
5. **Contact Preferences**: Remember preferred contacts for each role
6. **Integration**: Sync with MLS or other real estate platforms
