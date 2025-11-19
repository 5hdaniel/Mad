/**
 * Transaction Extractor Service Tests
 * Tests email analysis and transaction data extraction
 */

const TransactionExtractorService = require('../transactionExtractorService');

describe('TransactionExtractorService', () => {
  let service;

  beforeEach(() => {
    service = new TransactionExtractorService();
  });

  describe('analyzeEmail', () => {
    it('should identify real estate related emails', () => {
      const email = {
        subject: 'Closing Documents for 123 Main St',
        body: 'Please review the escrow documents for the property purchase.',
        from: 'agent@realestate.com',
        date: new Date('2024-01-15'),
      };

      const result = service.analyzeEmail(email);

      expect(result.isRealEstateRelated).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should reject non-real estate emails', () => {
      const email = {
        subject: 'Weekly Newsletter',
        body: 'Check out our latest blog posts and updates.',
        from: 'newsletter@example.com',
        date: new Date(),
      };

      const result = service.analyzeEmail(email);

      expect(result.isRealEstateRelated).toBe(false);
    });

    it('should extract addresses from email content', () => {
      const email = {
        subject: 'Property Showing',
        body: 'Showing scheduled for 456 Oak Avenue, Springfield, CA 90210 tomorrow at 2pm.',
        from: 'agent@realestate.com',
        date: new Date(),
      };

      const result = service.analyzeEmail(email);

      expect(result.addresses).toBeDefined();
      expect(result.addresses.length).toBeGreaterThan(0);
    });

    it('should detect purchase transactions', () => {
      const email = {
        subject: 'Offer Accepted',
        body: 'Congratulations! Your offer to purchase the property has been accepted by the seller.',
        from: 'agent@realestate.com',
        date: new Date(),
      };

      const result = service.analyzeEmail(email);

      expect(result.transactionType).toBe('purchase');
    });

    it('should detect sale transactions', () => {
      const email = {
        subject: 'Listing Agreement',
        body: 'Thank you for choosing us to list your property for sale.',
        from: 'agent@realestate.com',
        date: new Date(),
      };

      const result = service.analyzeEmail(email);

      expect(result.transactionType).toBe('sale');
    });

    it('should extract monetary amounts', () => {
      const email = {
        subject: 'Purchase Price',
        body: 'The agreed purchase price is $500,000.00 for the property.',
        from: 'escrow@title.com',
        date: new Date(),
      };

      const result = service.analyzeEmail(email);

      expect(result.amounts).toBeDefined();
      expect(result.amounts.length).toBeGreaterThan(0);
    });

    it('should extract dates from email', () => {
      const email = {
        subject: 'Closing Date',
        body: 'The closing is scheduled for December 15, 2024 at the title company.',
        from: 'escrow@title.com',
        date: new Date(),
      };

      const result = service.analyzeEmail(email);

      expect(result.dates).toBeDefined();
      expect(result.dates.length).toBeGreaterThan(0);
    });

    it('should extract MLS numbers', () => {
      const email = {
        subject: 'New Listing',
        body: 'Check out this new listing MLS #123456789 in your area.',
        from: 'agent@realestate.com',
        date: new Date(),
      };

      const result = service.analyzeEmail(email);

      expect(result.mlsNumbers).toBeDefined();
      expect(result.mlsNumbers.length).toBeGreaterThan(0);
    });

    it('should include email metadata in results', () => {
      const email = {
        subject: 'Test Subject',
        from: 'test@example.com',
        date: new Date('2024-01-01'),
        body: 'Test body',
      };

      const result = service.analyzeEmail(email);

      expect(result.subject).toBe('Test Subject');
      expect(result.from).toBe('test@example.com');
      expect(result.date).toEqual(email.date);
    });
  });

  describe('_isRealEstateRelated', () => {
    it('should return true when multiple keywords match', () => {
      const text = 'closing escrow property transaction';

      const result = service._isRealEstateRelated(text);

      expect(result).toBe(true);
    });

    it('should return false when only one keyword matches', () => {
      const text = 'property for rent in the city';

      const result = service._isRealEstateRelated(text);

      expect(result).toBe(false);
    });

    it('should be case insensitive', () => {
      const text = 'CLOSING ESCROW PROPERTY TRANSACTION';

      const result = service._isRealEstateRelated(text);

      expect(result).toBe(true);
    });

    it('should return false for empty text', () => {
      const result = service._isRealEstateRelated('');

      expect(result).toBe(false);
    });
  });

  describe('_detectTransactionType', () => {
    it('should detect purchase when purchase keywords dominate', () => {
      const text = 'buyer purchasing property offer to purchase';

      const result = service._detectTransactionType(text);

      expect(result).toBe('purchase');
    });

    it('should detect sale when sale keywords dominate', () => {
      const text = 'seller listing property for sale listing agreement';

      const result = service._detectTransactionType(text);

      expect(result).toBe('sale');
    });

    it('should return null when keywords are equal', () => {
      const text = 'real estate transaction';

      const result = service._detectTransactionType(text);

      expect(result).toBeNull();
    });

    it('should return null when no keywords match', () => {
      const text = 'random text without keywords';

      const result = service._detectTransactionType(text);

      expect(result).toBeNull();
    });
  });

  describe('_calculateConfidence', () => {
    it('should return higher confidence for emails with many keywords', () => {
      const text = 'closing escrow earnest money offer acceptance purchase agreement buyer seller property';

      const result = service._calculateConfidence(text);

      expect(result).toBeGreaterThan(50);
    });

    it('should return low confidence for emails with few keywords', () => {
      const text = 'property available for viewing';

      const result = service._calculateConfidence(text);

      expect(result).toBeLessThan(50);
    });

    it('should return 0 for emails with no keywords', () => {
      const text = 'completely unrelated content about gardening';

      const result = service._calculateConfidence(text);

      expect(result).toBe(0);
    });

    it('should cap confidence at 100', () => {
      // Create text with tons of keywords
      const text = service.keywords.transaction.join(' ').repeat(10);

      const result = service._calculateConfidence(text);

      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('_extractAddresses', () => {
    it('should extract valid street addresses', () => {
      const text = 'Property located at 123 Main Street, Springfield, CA 90210';

      const result = service._extractAddresses(text);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain('123 Main Street');
    });

    it('should extract multiple addresses', () => {
      const text = `
        Subject property: 456 Oak Avenue, Los Angeles, CA 90001
        Comparable property: 789 Pine Road, Los Angeles, CA 90002
      `;

      const result = service._extractAddresses(text);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle different address formats', () => {
      const text = `
        100 First St, City, CA 12345
        200 Second Avenue, Town, NY 54321
        300 Third Drive, Village, TX 98765-1234
      `;

      const result = service._extractAddresses(text);

      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array for text without addresses', () => {
      const text = 'No addresses in this text';

      const result = service._extractAddresses(text);

      expect(result).toEqual([]);
    });
  });

  describe('_extractAmounts', () => {
    it('should extract dollar amounts', () => {
      const text = 'Purchase price of $500,000.00';

      const result = service._extractAmounts(text);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain('500,000');
    });

    it('should extract multiple amounts', () => {
      const text = 'Purchase price $500,000 and earnest money $10,000';

      const result = service._extractAmounts(text);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle amounts with and without decimals', () => {
      const text = 'Price $500,000.00 and deposit $5,000';

      const result = service._extractAmounts(text);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no amounts found', () => {
      const text = 'No monetary amounts here';

      const result = service._extractAmounts(text);

      expect(result).toEqual([]);
    });
  });

  describe('_extractDates', () => {
    it('should extract text dates', () => {
      const text = 'Closing scheduled for December 15, 2024';

      const result = service._extractDates(text);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain('December 15, 2024');
    });

    it('should extract numeric dates', () => {
      const text = 'Inspection on 12/15/2024';

      const result = service._extractDates(text);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should extract multiple dates', () => {
      const text = `
        Inspection: January 10, 2024
        Appraisal: January 15, 2024
        Closing: 01/31/2024
      `;

      const result = service._extractDates(text);

      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array when no dates found', () => {
      const text = 'No dates in this text';

      const result = service._extractDates(text);

      expect(result).toEqual([]);
    });
  });

  describe('_extractMLSNumbers', () => {
    it('should extract MLS numbers with hash', () => {
      const text = 'Listed as MLS#123456';

      const result = service._extractMLSNumbers(text);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain('123456');
    });

    it('should extract MLS numbers with space', () => {
      const text = 'MLS 789012';

      const result = service._extractMLSNumbers(text);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should be case insensitive', () => {
      const text = 'mls#456789';

      const result = service._extractMLSNumbers(text);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when no MLS numbers found', () => {
      const text = 'No MLS numbers here';

      const result = service._extractMLSNumbers(text);

      expect(result).toEqual([]);
    });
  });

  describe('batchAnalyze', () => {
    it('should analyze multiple emails', () => {
      const emails = [
        { subject: 'Closing Documents', body: 'escrow closing property', from: 'agent@test.com', date: new Date() },
        { subject: 'Listing Agreement', body: 'listing sale property', from: 'agent@test.com', date: new Date() },
        { subject: 'Newsletter', body: 'weekly updates', from: 'news@test.com', date: new Date() },
      ];

      const results = service.batchAnalyze(emails);

      expect(results.length).toBe(3);
      expect(results[0].isRealEstateRelated).toBe(true);
      expect(results[1].isRealEstateRelated).toBe(true);
      expect(results[2].isRealEstateRelated).toBe(false);
    });

    it('should handle empty array', () => {
      const results = service.batchAnalyze([]);

      expect(results).toEqual([]);
    });

    it('should preserve email order', () => {
      const emails = [
        { subject: 'First', body: 'closing escrow', from: 'a@test.com', date: new Date() },
        { subject: 'Second', body: 'listing sale', from: 'b@test.com', date: new Date() },
        { subject: 'Third', body: 'purchase buyer', from: 'c@test.com', date: new Date() },
      ];

      const results = service.batchAnalyze(emails);

      expect(results[0].subject).toBe('First');
      expect(results[1].subject).toBe('Second');
      expect(results[2].subject).toBe('Third');
    });
  });

  describe('groupByProperty', () => {
    it('should group emails by extracted property address', () => {
      const analyzedEmails = [
        { addresses: ['123 Main St, City, CA 90210'], subject: 'Email 1' },
        { addresses: ['123 Main St, City, CA 90210'], subject: 'Email 2' },
        { addresses: ['456 Oak Ave, Town, CA 90211'], subject: 'Email 3' },
      ];

      const grouped = service.groupByProperty(analyzedEmails);

      expect(Object.keys(grouped).length).toBeGreaterThanOrEqual(1);
    });

    it('should handle emails without addresses', () => {
      const analyzedEmails = [
        { addresses: [], subject: 'Email 1' },
        { addresses: ['123 Main St, City, CA 90210'], subject: 'Email 2' },
      ];

      const grouped = service.groupByProperty(analyzedEmails);

      expect(grouped).toBeDefined();
    });

    it('should return empty object for empty input', () => {
      const grouped = service.groupByProperty([]);

      expect(grouped).toEqual({});
    });
  });

  describe('generateTransactionSummary', () => {
    it('should generate summary from email group', () => {
      const emailGroup = [
        {
          addresses: ['123 Main St, City, CA 90210'],
          amounts: ['$500,000'],
          dates: ['December 15, 2024'],
          transactionType: 'purchase',
          confidence: 85,
          date: new Date('2024-01-01'),
        },
        {
          addresses: ['123 Main St, City, CA 90210'],
          amounts: ['$10,000'],
          dates: ['January 10, 2024'],
          transactionType: 'purchase',
          confidence: 90,
          date: new Date('2024-01-15'),
        },
      ];

      const summary = service.generateTransactionSummary(emailGroup);

      expect(summary.propertyAddress).toBeDefined();
      expect(summary.communicationsCount).toBe(2);
      expect(summary.transactionType).toBeDefined();
    });

    it('should handle single email', () => {
      const emailGroup = [
        {
          addresses: ['123 Main St, City, CA 90210'],
          transactionType: 'sale',
          confidence: 75,
          date: new Date(),
        },
      ];

      const summary = service.generateTransactionSummary(emailGroup);

      expect(summary.communicationsCount).toBe(1);
    });
  });
});
