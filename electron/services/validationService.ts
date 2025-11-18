/**
 * Validation Service (TypeScript)
 * Demonstrates TypeScript conversion with strong typing
 */

// Use dynamic import for CommonJS modules
const errorHandler = require('../utils/errorHandler');
const { ValidationError } = errorHandler;

/**
 * Type Definitions
 */

export interface UserData {
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;
  oauth_provider: 'google' | 'microsoft';
  oauth_id: string;
  subscription_tier?: 'free' | 'pro' | 'enterprise';
  subscription_status?: 'trial' | 'active' | 'cancelled' | 'expired';
  trial_ends_at?: string;
  timezone?: string;
  theme?: 'light' | 'dark';
  company?: string;
  job_title?: string;
}

export interface TransactionData {
  property_address: string;
  property_street?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  property_coordinates?: {
    lat: number;
    lon: number;
  };
  transaction_type?: 'purchase' | 'sale' | 'lease' | 'other';
  transaction_status?: 'pending' | 'active' | 'completed' | 'cancelled';
  closing_date?: string;
  representation_start_date?: string;
}

export interface ContactData {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  source?: 'manual' | 'email' | 'import';
  is_imported?: number;
}

/**
 * Validation Rules
 */

const EMAIL_PATTERN = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
const PHONE_PATTERN = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validation Service Class
 */
export class ValidationService {
  /**
   * Validate User ID
   */
  static validateUserId(userId: unknown): string {
    if (typeof userId !== 'string' || !userId.trim()) {
      throw new ValidationError('User ID is required and must be a string', 'userId');
    }

    if (!UUID_PATTERN.test(userId)) {
      throw new ValidationError('User ID must be a valid UUID', 'userId');
    }

    return userId.trim();
  }

  /**
   * Validate Transaction ID
   */
  static validateTransactionId(transactionId: unknown): string {
    if (typeof transactionId !== 'string' || !transactionId.trim()) {
      throw new ValidationError('Transaction ID is required and must be a string', 'transactionId');
    }

    if (!UUID_PATTERN.test(transactionId)) {
      throw new ValidationError('Transaction ID must be a valid UUID', 'transactionId');
    }

    return transactionId.trim();
  }

  /**
   * Validate Contact ID
   */
  static validateContactId(contactId: unknown): string {
    if (typeof contactId !== 'string' || !contactId.trim()) {
      throw new ValidationError('Contact ID is required and must be a string', 'contactId');
    }

    if (!UUID_PATTERN.test(contactId)) {
      throw new ValidationError('Contact ID must be a valid UUID', 'contactId');
    }

    return contactId.trim();
  }

  /**
   * Validate Email
   */
  static validateEmail(email: unknown): string {
    if (typeof email !== 'string' || !email.trim()) {
      throw new ValidationError('Email is required and must be a string', 'email');
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    if (trimmedEmail.length > 255) {
      throw new ValidationError('Email must not exceed 255 characters', 'email');
    }

    return trimmedEmail;
  }

  /**
   * Validate Phone Number
   */
  static validatePhone(phone: unknown, required: boolean = false): string | null {
    if (!phone) {
      if (required) {
        throw new ValidationError('Phone number is required', 'phone');
      }
      return null;
    }

    if (typeof phone !== 'string') {
      throw new ValidationError('Phone must be a string', 'phone');
    }

    const trimmedPhone = phone.trim();

    if (!PHONE_PATTERN.test(trimmedPhone)) {
      throw new ValidationError('Invalid phone number format', 'phone');
    }

    return trimmedPhone;
  }

  /**
   * Validate ZIP Code
   */
  static validateZipCode(zip: unknown, required: boolean = false): string | null {
    if (!zip) {
      if (required) {
        throw new ValidationError('ZIP code is required', 'property_zip');
      }
      return null;
    }

    if (typeof zip !== 'string') {
      throw new ValidationError('ZIP code must be a string', 'property_zip');
    }

    const trimmedZip = zip.trim();

    if (!ZIP_PATTERN.test(trimmedZip)) {
      throw new ValidationError('Invalid ZIP code format', 'property_zip');
    }

    return trimmedZip;
  }

  /**
   * Validate User Data
   */
  static validateUserData(data: unknown, isUpdate: boolean = false): UserData {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('User data must be an object', 'userData');
    }

    const userData = data as Partial<UserData>;

    // Required fields (for creation)
    if (!isUpdate) {
      if (!userData.email) {
        throw new ValidationError('Email is required', 'email');
      }

      if (!userData.oauth_provider) {
        throw new ValidationError('OAuth provider is required', 'oauth_provider');
      }

      if (!userData.oauth_id) {
        throw new ValidationError('OAuth ID is required', 'oauth_id');
      }
    }

    // Validate email
    if (userData.email) {
      userData.email = this.validateEmail(userData.email);
    }

    // Validate OAuth provider
    if (userData.oauth_provider && !['google', 'microsoft'].includes(userData.oauth_provider)) {
      throw new ValidationError('Invalid OAuth provider. Must be "google" or "microsoft"', 'oauth_provider');
    }

    // Validate subscription tier
    if (userData.subscription_tier && !['free', 'pro', 'enterprise'].includes(userData.subscription_tier)) {
      throw new ValidationError('Invalid subscription tier', 'subscription_tier');
    }

    // Validate subscription status
    if (userData.subscription_status && !['trial', 'active', 'cancelled', 'expired'].includes(userData.subscription_status)) {
      throw new ValidationError('Invalid subscription status', 'subscription_status');
    }

    // Validate theme
    if (userData.theme && !['light', 'dark'].includes(userData.theme)) {
      throw new ValidationError('Invalid theme. Must be "light" or "dark"', 'theme');
    }

    return userData as UserData;
  }

  /**
   * Validate Transaction Data
   */
  static validateTransactionData(data: unknown, isUpdate: boolean = false): TransactionData {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Transaction data must be an object', 'transactionData');
    }

    const txnData = data as Partial<TransactionData>;

    // Required fields (for creation)
    if (!isUpdate) {
      if (!txnData.property_address || typeof txnData.property_address !== 'string' || !txnData.property_address.trim()) {
        throw new ValidationError('Property address is required', 'property_address');
      }
    }

    // Validate property address
    if (txnData.property_address) {
      txnData.property_address = txnData.property_address.trim();

      if (txnData.property_address.length > 500) {
        throw new ValidationError('Property address must not exceed 500 characters', 'property_address');
      }
    }

    // Validate transaction type
    if (txnData.transaction_type && !['purchase', 'sale', 'lease', 'other'].includes(txnData.transaction_type)) {
      throw new ValidationError('Invalid transaction type', 'transaction_type');
    }

    // Validate transaction status
    if (txnData.transaction_status && !['pending', 'active', 'completed', 'cancelled'].includes(txnData.transaction_status)) {
      throw new ValidationError('Invalid transaction status', 'transaction_status');
    }

    // Validate ZIP code
    if (txnData.property_zip) {
      txnData.property_zip = this.validateZipCode(txnData.property_zip) || undefined;
    }

    // Validate coordinates
    if (txnData.property_coordinates) {
      const coords = txnData.property_coordinates;
      if (typeof coords.lat !== 'number' || typeof coords.lon !== 'number') {
        throw new ValidationError('Invalid property coordinates', 'property_coordinates');
      }

      if (coords.lat < -90 || coords.lat > 90) {
        throw new ValidationError('Latitude must be between -90 and 90', 'property_coordinates');
      }

      if (coords.lon < -180 || coords.lon > 180) {
        throw new ValidationError('Longitude must be between -180 and 180', 'property_coordinates');
      }
    }

    // Validate dates
    if (txnData.closing_date && !this.isValidDate(txnData.closing_date)) {
      throw new ValidationError('Invalid closing date format', 'closing_date');
    }

    if (txnData.representation_start_date && !this.isValidDate(txnData.representation_start_date)) {
      throw new ValidationError('Invalid representation start date format', 'representation_start_date');
    }

    return txnData as TransactionData;
  }

  /**
   * Validate Contact Data
   */
  static validateContactData(data: unknown, isUpdate: boolean = false): ContactData {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Contact data must be an object', 'contactData');
    }

    const contactData = data as Partial<ContactData>;

    // Required fields (for creation)
    if (!isUpdate) {
      if (!contactData.name || typeof contactData.name !== 'string' || !contactData.name.trim()) {
        throw new ValidationError('Contact name is required', 'name');
      }
    }

    // Validate name
    if (contactData.name) {
      contactData.name = contactData.name.trim();

      if (contactData.name.length > 255) {
        throw new ValidationError('Contact name must not exceed 255 characters', 'name');
      }
    }

    // Validate email
    if (contactData.email) {
      contactData.email = this.validateEmail(contactData.email);
    }

    // Validate phone
    if (contactData.phone) {
      contactData.phone = this.validatePhone(contactData.phone) || undefined;
    }

    // Validate source
    if (contactData.source && !['manual', 'email', 'import'].includes(contactData.source)) {
      throw new ValidationError('Invalid contact source', 'source');
    }

    return contactData as ContactData;
  }

  /**
   * Validate Provider
   */
  static validateProvider(provider: unknown): 'google' | 'microsoft' {
    if (typeof provider !== 'string') {
      throw new ValidationError('Provider must be a string', 'provider');
    }

    const lowerProvider = provider.toLowerCase();

    if (!['google', 'microsoft'].includes(lowerProvider)) {
      throw new ValidationError('Invalid provider. Must be "google" or "microsoft"', 'provider' as any);
    }

    return lowerProvider as 'google' | 'microsoft';
  }

  /**
   * Validate File Path
   */
  static validateFilePath(filePath: unknown): string {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new ValidationError('File path is required and must be a string', 'filePath' as any);
    }

    const trimmedPath = filePath.trim();

    // Basic path traversal prevention
    if (trimmedPath.includes('..')) {
      throw new ValidationError('File path contains invalid characters', 'filePath' as any);
    }

    return trimmedPath;
  }

  /**
   * Sanitize Object - Remove undefined/null values and potentially dangerous properties
   */
  static sanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized: Partial<T> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip __proto__, constructor, and prototype
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        continue;
      }

      // Skip undefined and null
      if (value === undefined || value === null) {
        continue;
      }

      sanitized[key as keyof T] = value;
    }

    return sanitized;
  }

  /**
   * Helper: Check if date string is valid
   */
  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }
}

/**
 * Export default instance
 */
export default ValidationService;
