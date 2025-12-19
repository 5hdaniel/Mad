/**
 * Real Estate Email Fixtures
 * TASK-411: Test fixtures for hybrid extraction integration tests
 *
 * These fixtures provide realistic email scenarios for testing:
 * - Real estate transaction emails (various stages)
 * - Non-real estate emails (newsletters, personal, spam)
 * - Edge cases (minimal data, ambiguous content)
 */

import type { MessageInput } from '../../electron/services/extraction/types';

/**
 * Real estate email fixtures covering various transaction stages and types.
 */
export const realEstateEmails: MessageInput[] = [
  // Active Purchase - Initial Offer
  {
    id: 'msg-re-001',
    subject: 'RE: Offer on 123 Main St, San Francisco, CA 94102',
    body: `Hi Sarah,

I wanted to confirm that the buyer has approved the offer for $450,000 on the property at 123 Main Street, San Francisco, CA 94102.

The buyer is pre-approved for financing through Wells Fargo and can close within 30 days. Please find the attached earnest money details - $9,000 to be deposited within 3 business days.

Key terms:
- Purchase Price: $450,000
- Earnest Money: $9,000
- Closing Date: January 30, 2024
- Financing: Conventional 30-year fixed
- Contingencies: Inspection, Appraisal, Financing

Please let me know if you have any questions. Looking forward to working with you on this transaction.

Best regards,
John Smith
ABC Realty
john.smith@abcrealty.com
(415) 555-1234`,
    sender: 'john.smith@abcrealty.com',
    recipients: ['sarah.jones@sellerrealty.com', 'seller@email.com'],
    date: '2024-01-15T10:30:00Z',
  },

  // Active Purchase - Inspection Scheduling
  {
    id: 'msg-re-002',
    subject: 'Inspection Scheduled - 123 Main St',
    body: `Hello all,

The home inspection for 123 Main Street, San Francisco, CA 94102 has been scheduled for:

Date: January 20, 2024
Time: 10:00 AM - 1:00 PM
Inspector: Bay Area Home Inspections (Mike Johnson)

Please ensure the property is accessible. The seller has agreed to vacate during the inspection per the purchase agreement.

The inspection report will be provided within 24 hours after completion.

Thank you,
John Smith
Buyer's Agent`,
    sender: 'inspector@bayareahomeinspections.com',
    recipients: ['john.smith@abcrealty.com', 'sarah.jones@sellerrealty.com'],
    date: '2024-01-17T14:00:00Z',
  },

  // Closing Stage - Title Review
  {
    id: 'msg-re-003',
    subject: 'Title Commitment Ready - 123 Main St, SF',
    body: `Dear Parties,

The preliminary title commitment for 123 Main Street, San Francisco, CA 94102 is now ready for review.

Property Details:
- APN: 1234-567-890
- Legal Description: Lot 5, Block 12, Mission District Subdivision
- Vesting: John Doe and Jane Doe, husband and wife as joint tenants

Exceptions:
1. Property taxes for current fiscal year
2. CC&Rs recorded June 15, 1985
3. Utility easement along northern property line

Please review and let us know if you have any questions. Title insurance quote attached.

First American Title Company
escrow@firstam.com`,
    sender: 'escrow@firstam.com',
    recipients: ['john.smith@abcrealty.com', 'sarah.jones@sellerrealty.com', 'buyer@email.com', 'seller@email.com'],
    date: '2024-01-22T09:15:00Z',
  },

  // Lease Transaction
  {
    id: 'msg-re-004',
    subject: 'Lease Agreement - 456 Oak Avenue, Unit 2B',
    body: `Hi Jennifer,

Please find the lease agreement for 456 Oak Avenue, Unit 2B, Oakland, CA 94612.

Lease Terms:
- Monthly Rent: $2,500
- Security Deposit: $5,000 (2 months)
- Lease Start: February 1, 2024
- Lease End: January 31, 2025
- Pet Deposit: $500 (1 small dog approved)

The tenant has been screened and approved. Credit score 720, income verified at $8,500/month.

Please have the landlord sign and return by Friday.

Best,
Property Manager
Oak Avenue Apartments`,
    sender: 'manager@oakapts.com',
    recipients: ['landlord@email.com', 'tenant@email.com'],
    date: '2024-01-25T11:00:00Z',
  },

  // Sale Listing
  {
    id: 'msg-re-005',
    subject: 'New Listing: 789 Pine Street - $625,000',
    body: `Colleagues,

I'm excited to announce a new listing at 789 Pine Street, Berkeley, CA 94710.

Property Highlights:
- Price: $625,000
- Bedrooms: 3
- Bathrooms: 2
- Sq Ft: 1,450
- Lot Size: 5,000 sq ft
- Year Built: 1952
- MLS#: 24-12345

This charming Craftsman bungalow features original hardwood floors, updated kitchen, and a spacious backyard perfect for entertaining.

Open houses scheduled for:
- Saturday, Feb 3: 1-4 PM
- Sunday, Feb 4: 1-4 PM

Showing instructions: Supra lockbox, confirm all appointments through ShowingTime.

Let me know if you have interested buyers!

Lisa Chen
Berkeley Properties
MLS#: BER-24-12345`,
    sender: 'lisa.chen@berkeleyproperties.com',
    recipients: ['agents@berkeleyproperties.com'],
    date: '2024-01-28T16:00:00Z',
  },

  // Counteroffer
  {
    id: 'msg-re-006',
    subject: 'Counteroffer - 321 Elm Drive',
    body: `Hello,

The seller has reviewed the offer on 321 Elm Drive, Palo Alto, CA 94301 and would like to counter with the following terms:

Original Offer: $1,250,000
Counteroffer: $1,295,000

Additional terms:
- Seller requests 60-day close instead of 45 days
- Seller to retain washer/dryer
- No repairs to be made after inspection

This counter expires in 48 hours.

Please advise your client.

Thanks,
Mark Wilson
Seller's Agent`,
    sender: 'mark.wilson@luxuryrealty.com',
    recipients: ['buyer.agent@realty.com'],
    date: '2024-01-30T13:45:00Z',
  },
];

/**
 * Non-real estate emails for testing false positive prevention.
 */
export const nonRealEstateEmails: MessageInput[] = [
  // Marketing Newsletter
  {
    id: 'msg-nr-001',
    subject: 'Weekly Tech Newsletter - Top Stories',
    body: `Hi there!

Check out this week's top tech stories:

1. Apple announces new MacBook Pro
2. Google updates search algorithm
3. Microsoft Azure expansion

Plus exclusive deals on software subscriptions!

Unsubscribe | Privacy Policy
TechNews Weekly`,
    sender: 'newsletter@technews.com',
    recipients: ['reader@email.com'],
    date: '2024-01-18T08:00:00Z',
  },

  // Personal Email
  {
    id: 'msg-nr-002',
    subject: 'Dinner plans for Saturday?',
    body: `Hey!

Are you free for dinner on Saturday? Thinking of trying that new Italian place on Main Street. They have amazing reviews!

Let me know what time works for you.

Cheers,
Mike`,
    sender: 'friend@email.com',
    recipients: ['user@email.com'],
    date: '2024-01-19T12:30:00Z',
  },

  // Work Email (non-RE)
  {
    id: 'msg-nr-003',
    subject: 'Q4 Budget Review Meeting',
    body: `Team,

Please join us for the Q4 budget review meeting tomorrow at 2pm in Conference Room B.

Agenda:
- Revenue review
- Expense analysis
- 2024 projections

Please bring your department reports.

Thanks,
Finance Team`,
    sender: 'finance@company.com',
    recipients: ['team@company.com'],
    date: '2024-01-20T15:00:00Z',
  },

  // Spam-like
  {
    id: 'msg-nr-004',
    subject: 'URGENT: You have won $1,000,000!',
    body: `CONGRATULATIONS!!!

You have been selected as the winner of our international lottery!

To claim your $1,000,000 prize, please send your bank details to...

This is definitely not a scam!`,
    sender: 'lottery@suspicious.com',
    recipients: ['victim@email.com'],
    date: '2024-01-21T03:00:00Z',
  },
];

/**
 * Edge case emails for testing robustness.
 */
export const edgeCaseEmails: MessageInput[] = [
  // Minimal content
  {
    id: 'msg-edge-001',
    subject: 'RE: property',
    body: 'See attached.',
    sender: 'agent@email.com',
    recipients: ['client@email.com'],
    date: '2024-01-22T10:00:00Z',
  },

  // Very long email
  {
    id: 'msg-edge-002',
    subject: 'Complete Transaction Summary - 555 Market Street',
    body: `${'This is a detailed transaction summary for 555 Market Street, San Francisco, CA 94105. '.repeat(50)}

Final Sale Price: $2,500,000
Closing Date: March 15, 2024
MLS#: SF-24-98765`,
    sender: 'attorney@lawfirm.com',
    recipients: ['all.parties@email.com'],
    date: '2024-01-23T09:00:00Z',
  },

  // Ambiguous - mentions property but not RE transaction
  {
    id: 'msg-edge-003',
    subject: 'About your property inquiry',
    body: `Hi,

Thank you for your interest in our intellectual property licensing program. Our patents cover various technologies in the semiconductor space.

Please schedule a call to discuss further.

Best,
IP Licensing Team`,
    sender: 'licensing@techcorp.com',
    recipients: ['inquiry@email.com'],
    date: '2024-01-24T11:00:00Z',
  },

  // Empty recipients
  {
    id: 'msg-edge-004',
    subject: 'Draft: Offer on 999 Test Lane',
    body: 'Draft offer for 999 Test Lane, $500,000. Do not send.',
    sender: 'agent@realty.com',
    recipients: [],
    date: '2024-01-25T08:00:00Z',
  },

  // HTML-like content (stripped)
  {
    id: 'msg-edge-005',
    subject: 'Property Update',
    body: `Property at 100 Beach Road is now UNDER CONTRACT!

Sale Price: $750,000
Buyer: Qualified cash buyer
Close by: End of month

Contact me for similar listings.`,
    sender: 'agent@beachrealty.com',
    recipients: ['interested.buyers@email.com'],
    date: '2024-01-26T14:30:00Z',
  },
];

/**
 * Combined mock emails object for easy import.
 */
export const mockEmails = {
  realEstate: realEstateEmails,
  nonRealEstate: nonRealEstateEmails,
  edgeCases: edgeCaseEmails,
  all: [...realEstateEmails, ...nonRealEstateEmails, ...edgeCaseEmails],
};

/**
 * Existing transaction references for clustering tests.
 */
export const existingTransactions = [
  {
    id: 'tx-existing-001',
    propertyAddress: '123 Main Street, San Francisco, CA 94102',
    transactionType: 'purchase' as const,
  },
  {
    id: 'tx-existing-002',
    propertyAddress: '789 Pine Street, Berkeley, CA 94710',
    transactionType: 'sale' as const,
  },
];

/**
 * Known contacts for role extraction tests.
 */
export const knownContacts = [
  {
    id: 'contact-001',
    user_id: 'test-user',
    display_name: 'John Smith',
    name: 'John Smith',
    email: 'john.smith@abcrealty.com',
    phone: '415-555-1234',
    source: 'manual' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'contact-002',
    user_id: 'test-user',
    display_name: 'Sarah Jones',
    name: 'Sarah Jones',
    email: 'sarah.jones@sellerrealty.com',
    phone: '415-555-5678',
    source: 'manual' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

export default mockEmails;
