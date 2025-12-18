/**
 * @jest-environment node
 */

import { ContentSanitizer, contentSanitizer } from '../contentSanitizer';

describe('ContentSanitizer', () => {
  let sanitizer: ContentSanitizer;

  beforeEach(() => {
    sanitizer = new ContentSanitizer();
  });

  describe('email masking', () => {
    it('should mask email addresses', () => {
      const result = sanitizer.sanitize('Contact john.doe@example.com for details');
      expect(result.sanitizedContent).toContain('[EMAIL:j***@e***.com]');
      expect(result.maskedItems).toHaveLength(1);
      expect(result.maskedItems[0].type).toBe('email');
    });

    it('should mask multiple email addresses', () => {
      const result = sanitizer.sanitize('From: a@b.com, To: c@d.org');
      expect(result.maskedItems.filter((i) => i.type === 'email')).toHaveLength(2);
    });

    it('should handle complex email addresses', () => {
      const result = sanitizer.sanitize('Email: user.name+tag@subdomain.example.co.uk');
      expect(result.maskedItems[0].type).toBe('email');
      expect(result.sanitizedContent).toContain('[EMAIL:');
    });
  });

  describe('phone masking', () => {
    it('should mask phone numbers', () => {
      const result = sanitizer.sanitize('Call me at (555) 123-4567');
      expect(result.sanitizedContent).toContain('[PHONE:***-***-4567]');
    });

    it('should handle various phone formats', () => {
      const formats = [
        '555-123-4567',
        '(555) 123-4567',
        '+1 555 123 4567',
        '555.123.4567',
        '5551234567',
      ];

      for (const phone of formats) {
        const result = sanitizer.sanitize(`Number: ${phone}`);
        expect(result.maskedItems.length).toBeGreaterThanOrEqual(1);
        // At least one should be phone
        const hasPhone = result.maskedItems.some((i) => i.type === 'phone');
        expect(hasPhone).toBe(true);
      }
    });

    it('should preserve last 4 digits', () => {
      const result = sanitizer.sanitize('Call 555-123-9999');
      expect(result.sanitizedContent).toContain('9999');
    });
  });

  describe('SSN masking', () => {
    it('should mask SSN', () => {
      const result = sanitizer.sanitize('SSN: 123-45-6789');
      expect(result.sanitizedContent).toContain('[SSN:***-**-****]');
      expect(result.maskedItems[0].type).toBe('ssn');
    });

    it('should mask SSN without dashes', () => {
      const result = sanitizer.sanitize('SSN: 123 45 6789');
      expect(result.sanitizedContent).toContain('[SSN:***-**-****]');
    });
  });

  describe('credit card masking', () => {
    it('should mask credit card numbers', () => {
      const result = sanitizer.sanitize('Card: 4111-1111-1111-1234');
      expect(result.sanitizedContent).toContain('[CARD:****-****-****-1234]');
      expect(result.maskedItems[0].type).toBe('credit_card');
    });

    it('should mask credit card with spaces', () => {
      const result = sanitizer.sanitize('Card: 4111 1111 1111 5678');
      expect(result.sanitizedContent).toContain('5678');
    });
  });

  describe('IP address masking', () => {
    it('should mask IP addresses', () => {
      const result = sanitizer.sanitize('Server IP: 192.168.1.100');
      expect(result.sanitizedContent).toContain('[IP:***.***.***.***]');
      expect(result.maskedItems[0].type).toBe('ip_address');
    });
  });

  describe('preservation', () => {
    it('should preserve property addresses', () => {
      const content = 'Property at 123 Main Street is listed at $450,000';
      const result = sanitizer.sanitize(content);
      expect(result.sanitizedContent).toContain('123 Main Street');
      expect(result.sanitizedContent).toContain('$450,000');
    });

    it('should preserve various street types', () => {
      const addresses = [
        '456 Oak Avenue',
        '789 Park Road',
        '101 Sunset Drive',
        '202 Maple Lane',
        '303 Cedar Court',
        '404 Pine Boulevard',
      ];

      for (const addr of addresses) {
        const result = sanitizer.sanitize(`Located at ${addr}`);
        expect(result.sanitizedContent).toContain(addr);
      }
    });

    it('should preserve MLS numbers', () => {
      const result = sanitizer.sanitize('MLS #12345678');
      expect(result.sanitizedContent).toContain('MLS #12345678');
    });

    it('should preserve transaction amounts', () => {
      const result = sanitizer.sanitize('Sale price: $1,250,000.00');
      expect(result.sanitizedContent).toContain('$1,250,000.00');
    });
  });

  describe('sanitizeEmail', () => {
    it('should sanitize all email parts', () => {
      const result = sanitizer.sanitizeEmail({
        subject: 'Call 555-123-4567',
        body: 'Email me at john@example.com',
        from: 'sender@email.com',
        to: ['recipient@email.com'],
      });

      expect(result.subject).toContain('[PHONE:');
      expect(result.body).toContain('[EMAIL:');
      expect(result.from).toContain('[EMAIL:');
      expect(result.to[0]).toContain('[EMAIL:');
    });

    it('should handle cc field', () => {
      const result = sanitizer.sanitizeEmail({
        subject: 'Test',
        body: 'Body',
        from: 'a@b.com',
        to: ['c@d.com'],
        cc: ['e@f.com', 'g@h.com'],
      });

      expect(result.cc).toHaveLength(2);
      expect(result.cc[0]).toContain('[EMAIL:');
      expect(result.cc[1]).toContain('[EMAIL:');
    });

    it('should collect all masked items', () => {
      const result = sanitizer.sanitizeEmail({
        subject: 'Contact john@test.com',
        body: 'Call 555-123-4567 or email jane@test.com',
        from: 'sender@test.com',
        to: ['recipient@test.com'],
      });

      expect(result.maskedItems.length).toBeGreaterThan(3);
    });
  });

  describe('containsPII', () => {
    it('should detect PII without modifying', () => {
      const content = 'SSN: 123-45-6789, Email: test@example.com';
      const result = sanitizer.containsPII(content);

      expect(result.hasPII).toBe(true);
      expect(result.types).toContain('ssn');
      expect(result.types).toContain('email');
    });

    it('should return false for clean content', () => {
      const result = sanitizer.containsPII('Property at 123 Main Street for $500,000');
      expect(result.hasPII).toBe(false);
    });

    it('should detect multiple PII types', () => {
      const content = 'Email: a@b.com, Phone: 555-123-4567, Card: 4111-1111-1111-1111';
      const result = sanitizer.containsPII(content);

      expect(result.hasPII).toBe(true);
      expect(result.types).toContain('email');
      expect(result.types).toContain('phone');
      expect(result.types).toContain('credit_card');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const result = sanitizer.sanitize(
        'Email: a@b.com, Phone: 555-123-4567, SSN: 123-45-6789'
      );
      const stats = sanitizer.getStats(result);

      expect(stats.itemsMasked).toBe(3);
      expect(stats.byType.email).toBe(1);
      expect(stats.byType.phone).toBe(1);
      expect(stats.byType.ssn).toBe(1);
    });

    it('should calculate reduction percent', () => {
      const result = sanitizer.sanitize('Email: verylongemail@verylongdomain.com');
      const stats = sanitizer.getStats(result);

      // Masked version should be different length
      expect(typeof stats.reductionPercent).toBe('number');
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = sanitizer.sanitize('');
      expect(result.sanitizedContent).toBe('');
      expect(result.maskedItems).toHaveLength(0);
      expect(result.originalLength).toBe(0);
    });

    it('should handle content with no PII', () => {
      const content = 'This is a regular message with no sensitive data.';
      const result = sanitizer.sanitize(content);
      expect(result.sanitizedContent).toBe(content);
      expect(result.maskedItems).toHaveLength(0);
    });

    it('should handle very long content', () => {
      const content = 'Email: test@test.com '.repeat(1000);
      const result = sanitizer.sanitize(content);
      expect(result.maskedItems.length).toBe(1000);
    });

    it('should handle mixed PII and preserved content', () => {
      const content =
        'Property at 123 Main Street ($500,000) - Contact agent@realty.com or call 555-123-4567';
      const result = sanitizer.sanitize(content);

      // Should preserve address and price
      expect(result.sanitizedContent).toContain('123 Main Street');
      expect(result.sanitizedContent).toContain('$500,000');

      // Should mask email and phone
      expect(result.sanitizedContent).toContain('[EMAIL:');
      expect(result.sanitizedContent).toContain('[PHONE:');
    });
  });

  describe('singleton export', () => {
    it('should export a working singleton', () => {
      const result = contentSanitizer.sanitize('Test email: test@example.com');
      expect(result.maskedItems).toHaveLength(1);
    });
  });
});
