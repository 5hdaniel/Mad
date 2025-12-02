/**
 * Unit tests for Phone Normalization Utilities
 * Tests E.164-style normalization used for iOS contacts matching
 */

import {
  normalizePhoneNumber,
  phoneNumbersMatch,
  isPhoneNumber,
  extractDigits,
  getTrailingDigits,
} from '../phoneNormalization';

describe('phoneNormalization', () => {
  describe('normalizePhoneNumber', () => {
    it('should add country code to 10-digit US numbers', () => {
      expect(normalizePhoneNumber('5551234567')).toBe('+15551234567');
    });

    it('should preserve 11-digit numbers with country code', () => {
      expect(normalizePhoneNumber('15551234567')).toBe('+15551234567');
    });

    it('should remove formatting from phone numbers', () => {
      expect(normalizePhoneNumber('(555) 123-4567')).toBe('+15551234567');
    });

    it('should remove spaces from phone numbers', () => {
      expect(normalizePhoneNumber('+1 555 123 4567')).toBe('+15551234567');
    });

    it('should remove dots from phone numbers', () => {
      expect(normalizePhoneNumber('555.123.4567')).toBe('+15551234567');
    });

    it('should handle international numbers', () => {
      expect(normalizePhoneNumber('+44 20 7946 0958')).toBe('+442079460958');
    });

    it('should handle empty string', () => {
      expect(normalizePhoneNumber('')).toBe('+');
    });

    it('should handle short numbers', () => {
      expect(normalizePhoneNumber('1234567')).toBe('+1234567');
    });
  });

  describe('phoneNumbersMatch', () => {
    it('should match identical formatted numbers', () => {
      expect(phoneNumbersMatch('(555) 123-4567', '555-123-4567')).toBe(true);
    });

    it('should match numbers with and without country code', () => {
      expect(phoneNumbersMatch('5551234567', '+1 555 123 4567')).toBe(true);
      expect(phoneNumbersMatch('15551234567', '5551234567')).toBe(true);
    });

    it('should match after normalization', () => {
      expect(phoneNumbersMatch('(555) 123-4567', '+15551234567')).toBe(true);
    });

    it('should not match different numbers', () => {
      expect(phoneNumbersMatch('5551234567', '5559876543')).toBe(false);
    });

    it('should handle international numbers with suffix matching', () => {
      // UK number - last 10 digits should match
      expect(phoneNumbersMatch('+44 20 7946 0958', '2079460958')).toBe(true);
    });

    it('should handle exact matches', () => {
      expect(phoneNumbersMatch('+15551234567', '+15551234567')).toBe(true);
    });
  });

  describe('isPhoneNumber', () => {
    it('should return true for phone numbers', () => {
      expect(isPhoneNumber('5551234567')).toBe(true);
      expect(isPhoneNumber('(555) 123-4567')).toBe(true);
      expect(isPhoneNumber('+1 555 123 4567')).toBe(true);
    });

    it('should return false for email addresses', () => {
      expect(isPhoneNumber('test@example.com')).toBe(false);
      expect(isPhoneNumber('user@domain.org')).toBe(false);
    });

    it('should return false for short strings', () => {
      expect(isPhoneNumber('12345')).toBe(false);
    });

    it('should handle mixed content', () => {
      // Contains @ so it's an email
      expect(isPhoneNumber('555@company.com')).toBe(false);
    });
  });

  describe('extractDigits', () => {
    it('should extract only digits', () => {
      expect(extractDigits('(555) 123-4567')).toBe('5551234567');
    });

    it('should handle already clean numbers', () => {
      expect(extractDigits('5551234567')).toBe('5551234567');
    });

    it('should handle numbers with country code', () => {
      expect(extractDigits('+1 555 123 4567')).toBe('15551234567');
    });

    it('should return empty string for no digits', () => {
      expect(extractDigits('abc')).toBe('');
    });
  });

  describe('getTrailingDigits', () => {
    it('should return last 10 digits by default', () => {
      expect(getTrailingDigits('15551234567')).toBe('5551234567');
    });

    it('should return specified number of digits', () => {
      expect(getTrailingDigits('5551234567', 7)).toBe('1234567');
    });

    it('should return all digits if fewer than requested', () => {
      expect(getTrailingDigits('1234567', 10)).toBe('1234567');
    });

    it('should handle formatted numbers', () => {
      expect(getTrailingDigits('(555) 123-4567', 10)).toBe('5551234567');
    });
  });

  describe('sample test cases from task', () => {
    // These should all result in matching (from TASK-005.md)
    const testNumbers = [
      '(555) 123-4567',
      '555-123-4567',
      '+1 555 123 4567',
      '15551234567',
      '5551234567',
    ];

    it('should normalize all variations to match', () => {
      const normalized = testNumbers.map(n => getTrailingDigits(n, 10));
      const expected = '5551234567';

      for (const num of normalized) {
        expect(num).toBe(expected);
      }
    });

    it('should match all variations against each other', () => {
      for (let i = 0; i < testNumbers.length; i++) {
        for (let j = i + 1; j < testNumbers.length; j++) {
          expect(phoneNumbersMatch(testNumbers[i], testNumbers[j])).toBe(true);
        }
      }
    });
  });
});
