/**
 * Validation Service for user input validation
 * Provides comprehensive validation for emails, phones, user data, transactions, and contacts
 */

// Validation patterns
const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const PHONE_PATTERN = /^[\d\s\-\(\)\+\.]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZIP_CODE_PATTERN = /^\d{5}(-\d{4})?$/;

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Validation service with static methods
 */
export class ValidationService {
  /**
   * Validate UUID format
   */
  static validateUserId(userId: any): string {
    if (typeof userId !== 'string') {
      throw new ValidationError('User ID must be a string', 'userId');
    }

    if (!userId || userId.trim() === '') {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }

    const trimmed = userId.trim();
    if (!UUID_PATTERN.test(trimmed)) {
      throw new ValidationError('Invalid UUID format', 'userId');
    }

    return trimmed;
  }

  /**
   * Validate and normalize email address
   */
  static validateEmail(email: any, required: boolean = true): string | null {
    if (!email || (typeof email === 'string' && email.trim() === '')) {
      if (required) {
        throw new ValidationError('Email is required', 'email');
      }
      return null;
    }

    if (typeof email !== 'string') {
      throw new ValidationError('Email must be a string', 'email');
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    if (trimmedEmail.length > 255) {
      throw new ValidationError('Email exceeds maximum length', 'email');
    }

    return trimmedEmail;
  }

  /**
   * Validate phone number
   */
  static validatePhone(phone: any, required: boolean = false): string | null {
    if (!phone || (typeof phone === 'string' && phone.trim() === '')) {
      if (required) {
        throw new ValidationError('Phone number is required', 'phone');
      }
      return null;
    }

    if (typeof phone !== 'string') {
      throw new ValidationError('Phone must be a string', 'phone');
    }

    const trimmedPhone = phone.trim();

    // Phone must be at least 10 characters (minimum valid phone)
    if (trimmedPhone.length < 10) {
      throw new ValidationError('Invalid phone number format', 'phone');
    }

    if (!PHONE_PATTERN.test(trimmedPhone)) {
      throw new ValidationError('Invalid phone number format', 'phone');
    }

    return trimmedPhone;
  }

  /**
   * Validate ZIP code
   */
  static validateZipCode(zipCode: any, required: boolean = false): string | null {
    if (!zipCode || (typeof zipCode === 'string' && zipCode.trim() === '')) {
      if (required) {
        throw new ValidationError('ZIP code is required', 'zipCode');
      }
      return null;
    }

    if (typeof zipCode !== 'string') {
      throw new ValidationError('ZIP code must be a string', 'zipCode');
    }

    const trimmed = zipCode.trim();
    if (!ZIP_CODE_PATTERN.test(trimmed)) {
      throw new ValidationError('Invalid ZIP code format', 'zipCode');
    }

    return trimmed;
  }

  /**
   * Validate complete user data
   */
  static validateUserData(userData: any, isNew: boolean = false): any {
    if (!userData || typeof userData !== 'object') {
      throw new ValidationError('User data must be an object', 'userData');
    }

    const validated: any = {};

    // Email is required for new users
    if (isNew || userData.email !== undefined) {
      validated.email = this.validateEmail(userData.email, isNew);
    }

    // OAuth provider validation
    if (userData.oauth_provider !== undefined) {
      validated.oauth_provider = this.validateProvider(userData.oauth_provider);
    }

    // Subscription tier validation
    if (userData.subscription_tier !== undefined) {
      const validTiers = ['free', 'premium', 'enterprise'];
      const tier = userData.subscription_tier?.toLowerCase();
      if (!validTiers.includes(tier)) {
        throw new ValidationError(
          `Subscription tier must be one of: ${validTiers.join(', ')}`,
          'subscription_tier'
        );
      }
      validated.subscription_tier = tier;
    }

    return validated;
  }

  /**
   * Validate transaction data
   */
  static validateTransactionData(transactionData: any, isNew: boolean = false): any {
    if (!transactionData || typeof transactionData !== 'object') {
      throw new ValidationError('Transaction data must be an object', 'transactionData');
    }

    const validated: any = {};

    // Property address is required for new transactions
    if (isNew || transactionData.property_address !== undefined) {
      if (isNew && !transactionData.property_address) {
        throw new ValidationError('Property address is required', 'property_address');
      }
      if (transactionData.property_address) {
        if (typeof transactionData.property_address !== 'string') {
          throw new ValidationError('Property address must be a string', 'property_address');
        }
        const trimmed = transactionData.property_address.trim();
        if (trimmed.length < 5 || trimmed.length > 500) {
          throw new ValidationError('Property address length must be between 5 and 500', 'property_address');
        }
        validated.property_address = trimmed;
      }
    }

    // Transaction type validation
    if (transactionData.transaction_type !== undefined) {
      const validTypes = ['purchase', 'sale', 'lease', 'refinance', 'other'];
      const type = transactionData.transaction_type?.toLowerCase();
      if (!validTypes.includes(type)) {
        throw new ValidationError(
          `Transaction type must be one of: ${validTypes.join(', ')}`,
          'transaction_type'
        );
      }
      validated.transaction_type = type;
    }

    // Coordinates validation
    if (transactionData.latitude !== undefined || transactionData.longitude !== undefined) {
      if (transactionData.latitude !== undefined) {
        const lat = Number(transactionData.latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          throw new ValidationError('Invalid latitude', 'latitude');
        }
        validated.latitude = lat;
      }
      if (transactionData.longitude !== undefined) {
        const lng = Number(transactionData.longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          throw new ValidationError('Invalid longitude', 'longitude');
        }
        validated.longitude = lng;
      }
    }

    return validated;
  }

  /**
   * Validate contact data
   */
  static validateContactData(contactData: any, isNew: boolean = false): any {
    if (!contactData || typeof contactData !== 'object') {
      throw new ValidationError('Contact data must be an object', 'contactData');
    }

    const validated: any = {};

    // Name is required for new contacts
    if (isNew || contactData.name !== undefined) {
      if (isNew && !contactData.name) {
        throw new ValidationError('Name is required', 'name');
      }
      if (contactData.name) {
        if (typeof contactData.name !== 'string') {
          throw new ValidationError('Name must be a string', 'name');
        }
        const trimmed = contactData.name.trim();
        if (trimmed.length === 0 || trimmed.length > 200) {
          throw new ValidationError('Name length must be between 1 and 200', 'name');
        }
        validated.name = trimmed;
      }
    }

    // Source validation
    if (contactData.source !== undefined) {
      const validSources = ['manual', 'gmail', 'outlook', 'imported'];
      const source = contactData.source?.toLowerCase();
      if (!validSources.includes(source)) {
        throw new ValidationError(
          `Source must be one of: ${validSources.join(', ')}`,
          'source'
        );
      }
      validated.source = source;
    }

    return validated;
  }

  /**
   * Validate and normalize OAuth provider
   */
  static validateProvider(provider: any): string {
    if (!provider || typeof provider !== 'string') {
      throw new ValidationError('Provider is required and must be a string', 'provider');
    }

    const validProviders = ['google', 'microsoft'];
    const normalized = provider.toLowerCase().trim();

    if (!validProviders.includes(normalized)) {
      throw new ValidationError(
        `Provider must be one of: ${validProviders.join(', ')}`,
        'provider'
      );
    }

    return normalized;
  }

  /**
   * Sanitize object by removing null, undefined, and dangerous properties
   */
  static sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }

    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const cleaned: any = {};

    for (const key of Object.keys(obj)) {
      if (dangerous.includes(key)) {
        continue;
      }

      const value = obj[key];
      if (value !== null && value !== undefined) {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }
}

export default ValidationService;
