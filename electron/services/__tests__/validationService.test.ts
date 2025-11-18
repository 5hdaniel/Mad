/**
 * Validation Service Tests (TypeScript)
 * Tests for type-safe validation service
 */

import { ValidationService, UserData, TransactionData, ContactData } from '../validationService';
import { ValidationError } from '../../utils/errorHandler';

describe('ValidationService', () => {
  describe('validateUserId', () => {
    it('should validate valid UUID', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(ValidationService.validateUserId(validUuid)).toBe(validUuid);
    });

    it('should throw ValidationError for invalid UUID', () => {
      expect(() => ValidationService.validateUserId('invalid-uuid'))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for empty string', () => {
      expect(() => ValidationService.validateUserId(''))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for non-string', () => {
      expect(() => ValidationService.validateUserId(12345))
        .toThrow(ValidationError);
    });
  });

  describe('validateEmail', () => {
    it('should validate and normalize email', () => {
      const email = '  TEST@EXAMPLE.COM  ';
      expect(ValidationService.validateEmail(email)).toBe('test@example.com');
    });

    it('should accept valid email formats', () => {
      expect(ValidationService.validateEmail('user@example.com')).toBe('user@example.com');
      expect(ValidationService.validateEmail('user.name@example.co.uk')).toBe('user.name@example.co.uk');
      expect(ValidationService.validateEmail('user+tag@example.com')).toBe('user+tag@example.com');
    });

    it('should reject invalid email formats', () => {
      expect(() => ValidationService.validateEmail('invalid'))
        .toThrow(ValidationError);

      expect(() => ValidationService.validateEmail('invalid@'))
        .toThrow(ValidationError);

      expect(() => ValidationService.validateEmail('@example.com'))
        .toThrow(ValidationError);
    });

    it('should reject emails exceeding 255 characters', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(() => ValidationService.validateEmail(longEmail))
        .toThrow(ValidationError);
    });
  });

  describe('validatePhone', () => {
    it('should validate phone numbers', () => {
      expect(ValidationService.validatePhone('555-123-4567')).toBe('555-123-4567');
      expect(ValidationService.validatePhone('(555) 123-4567')).toBe('(555) 123-4567');
      expect(ValidationService.validatePhone('+1-555-123-4567')).toBe('+1-555-123-4567');
    });

    it('should return null for empty phone when not required', () => {
      expect(ValidationService.validatePhone('', false)).toBeNull();
      expect(ValidationService.validatePhone(null, false)).toBeNull();
    });

    it('should throw ValidationError when required but empty', () => {
      expect(() => ValidationService.validatePhone('', true))
        .toThrow(ValidationError);
    });

    it('should reject invalid phone formats', () => {
      expect(() => ValidationService.validatePhone('123'))
        .toThrow(ValidationError);
    });
  });

  describe('validateZipCode', () => {
    it('should validate ZIP codes', () => {
      expect(ValidationService.validateZipCode('12345')).toBe('12345');
      expect(ValidationService.validateZipCode('12345-6789')).toBe('12345-6789');
    });

    it('should return null for empty ZIP when not required', () => {
      expect(ValidationService.validateZipCode('', false)).toBeNull();
    });

    it('should throw ValidationError for invalid ZIP codes', () => {
      expect(() => ValidationService.validateZipCode('123'))
        .toThrow(ValidationError);

      expect(() => ValidationService.validateZipCode('abcde'))
        .toThrow(ValidationError);
    });
  });

  describe('validateUserData', () => {
    it('should validate complete user data', () => {
      const userData: UserData = {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        oauth_provider: 'google',
        oauth_id: 'google-123',
        subscription_tier: 'pro',
        theme: 'dark',
      };

      const validated = ValidationService.validateUserData(userData);
      expect(validated.email).toBe('test@example.com');
      expect(validated.oauth_provider).toBe('google');
    });

    it('should require email for new users', () => {
      expect(() => ValidationService.validateUserData({
        oauth_provider: 'google',
        oauth_id: 'google-123',
      })).toThrow(ValidationError);
    });

    it('should validate OAuth provider', () => {
      expect(() => ValidationService.validateUserData({
        email: 'test@example.com',
        oauth_provider: 'invalid' as any,
        oauth_id: 'id-123',
      })).toThrow(ValidationError);
    });

    it('should validate subscription tier', () => {
      expect(() => ValidationService.validateUserData({
        email: 'test@example.com',
        oauth_provider: 'google',
        oauth_id: 'id-123',
        subscription_tier: 'invalid' as any,
      })).toThrow(ValidationError);
    });
  });

  describe('validateTransactionData', () => {
    it('should validate complete transaction data', () => {
      const txnData: TransactionData = {
        property_address: '123 Main St',
        property_city: 'San Francisco',
        property_state: 'CA',
        property_zip: '94102',
        transaction_type: 'purchase',
        transaction_status: 'active',
        closing_date: '2024-12-31',
      };

      const validated = ValidationService.validateTransactionData(txnData);
      expect(validated.property_address).toBe('123 Main St');
      expect(validated.property_zip).toBe('94102');
    });

    it('should require property address for new transactions', () => {
      expect(() => ValidationService.validateTransactionData({}))
        .toThrow(ValidationError);
    });

    it('should validate transaction type', () => {
      expect(() => ValidationService.validateTransactionData({
        property_address: '123 Main St',
        transaction_type: 'invalid' as any,
      })).toThrow(ValidationError);
    });

    it('should validate coordinates', () => {
      expect(() => ValidationService.validateTransactionData({
        property_address: '123 Main St',
        property_coordinates: { lat: 100, lon: 0 }, // Invalid lat
      })).toThrow(ValidationError);

      expect(() => ValidationService.validateTransactionData({
        property_address: '123 Main St',
        property_coordinates: { lat: 0, lon: 200 }, // Invalid lon
      })).toThrow(ValidationError);
    });

    it('should accept valid coordinates', () => {
      const validated = ValidationService.validateTransactionData({
        property_address: '123 Main St',
        property_coordinates: { lat: 37.7749, lon: -122.4194 },
      });

      expect(validated.property_coordinates).toEqual({ lat: 37.7749, lon: -122.4194 });
    });
  });

  describe('validateContactData', () => {
    it('should validate complete contact data', () => {
      const contactData: ContactData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-123-4567',
        company: 'Acme Corp',
        title: 'Agent',
        source: 'manual',
      };

      const validated = ValidationService.validateContactData(contactData);
      expect(validated.name).toBe('Jane Smith');
      expect(validated.email).toBe('jane@example.com');
    });

    it('should require name for new contacts', () => {
      expect(() => ValidationService.validateContactData({}))
        .toThrow(ValidationError);
    });

    it('should validate source', () => {
      expect(() => ValidationService.validateContactData({
        name: 'John Doe',
        source: 'invalid' as any,
      })).toThrow(ValidationError);
    });

    it('should trim and validate name length', () => {
      const longName = 'a'.repeat(256);
      expect(() => ValidationService.validateContactData({ name: longName }))
        .toThrow(ValidationError);
    });
  });

  describe('validateProvider', () => {
    it('should validate and normalize provider', () => {
      expect(ValidationService.validateProvider('Google')).toBe('google');
      expect(ValidationService.validateProvider('MICROSOFT')).toBe('microsoft');
    });

    it('should reject invalid providers', () => {
      expect(() => ValidationService.validateProvider('yahoo'))
        .toThrow(ValidationError);
    });
  });

  describe('sanitizeObject', () => {
    it('should remove undefined and null values', () => {
      const obj = {
        a: 'value',
        b: undefined,
        c: null,
        d: 0,
        e: false,
      };

      const sanitized = ValidationService.sanitizeObject(obj);

      expect(sanitized).toEqual({
        a: 'value',
        d: 0,
        e: false,
      });
    });

    it('should remove dangerous properties', () => {
      const obj = {
        name: 'Test',
        __proto__: { malicious: true },
        constructor: 'bad',
        prototype: 'bad',
      };

      const sanitized = ValidationService.sanitizeObject(obj);

      expect(sanitized).toEqual({ name: 'Test' });
      expect(sanitized).not.toHaveProperty('__proto__');
      expect(sanitized).not.toHaveProperty('constructor');
      expect(sanitized).not.toHaveProperty('prototype');
    });
  });
});
