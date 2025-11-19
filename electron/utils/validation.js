/**
 * Input Validation Utilities for IPC Handlers
 * Provides comprehensive validation for all IPC handler inputs
 * Prevents injection attacks, type errors, and invalid data processing
 */

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validate user ID
 * @param {any} userId - User ID to validate (UUID string)
 * @param {boolean} required - Whether the field is required
 * @returns {string} Validated user ID
 * @throws {ValidationError} If validation fails
 */
function validateUserId(userId, required = true) {
  if (userId === null || userId === undefined || userId === '') {
    if (required) {
      throw new ValidationError('User ID is required', 'userId');
    }
    return null;
  }

  if (typeof userId !== 'string') {
    throw new ValidationError('User ID must be a string', 'userId');
  }

  // Validate UUID format (standard UUID v4 format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId.trim())) {
    throw new ValidationError('User ID must be a valid UUID', 'userId');
  }

  return userId.trim();
}

/**
 * Validate contact ID
 * @param {any} contactId - Contact ID to validate
 * @param {boolean} required - Whether the field is required
 * @returns {number} Validated contact ID
 * @throws {ValidationError} If validation fails
 */
function validateContactId(contactId, required = true) {
  if (contactId === null || contactId === undefined) {
    if (required) {
      throw new ValidationError('Contact ID is required', 'contactId');
    }
    return null;
  }

  const parsed = Number(contactId);
  if (isNaN(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new ValidationError('Contact ID must be a positive integer', 'contactId');
  }

  return parsed;
}

/**
 * Validate transaction ID
 * @param {any} transactionId - Transaction ID to validate (UUID string)
 * @param {boolean} required - Whether the field is required
 * @returns {string} Validated transaction ID
 * @throws {ValidationError} If validation fails
 */
function validateTransactionId(transactionId, required = true) {
  if (transactionId === null || transactionId === undefined || transactionId === '') {
    if (required) {
      throw new ValidationError('Transaction ID is required', 'transactionId');
    }
    return null;
  }

  if (typeof transactionId !== 'string') {
    throw new ValidationError('Transaction ID must be a string', 'transactionId');
  }

  // Validate UUID format (standard UUID v4 format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(transactionId.trim())) {
    throw new ValidationError('Transaction ID must be a valid UUID', 'transactionId');
  }

  return transactionId.trim();
}

/**
 * Validate email address
 * @param {any} email - Email to validate
 * @param {boolean} required - Whether the field is required
 * @returns {string|null} Validated email
 * @throws {ValidationError} If validation fails
 */
function validateEmail(email, required = true) {
  if (!email) {
    if (required) {
      throw new ValidationError('Email is required', 'email');
    }
    return null;
  }

  if (typeof email !== 'string') {
    throw new ValidationError('Email must be a string', 'email');
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', 'email');
  }

  // Prevent extremely long emails (potential DoS)
  if (email.length > 254) {
    throw new ValidationError('Email is too long', 'email');
  }

  return email.toLowerCase().trim();
}

/**
 * Validate string input
 * @param {any} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 * @param {Object} options - Validation options
 * @param {boolean} options.required - Whether the field is required
 * @param {number} options.minLength - Minimum length
 * @param {number} options.maxLength - Maximum length
 * @param {RegExp} options.pattern - Pattern to match
 * @returns {string|null} Validated string
 * @throws {ValidationError} If validation fails
 */
function validateString(value, fieldName, options = {}) {
  const { required = false, minLength = 0, maxLength = Infinity, pattern = null } = options;

  if (!value) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, fieldName);
    }
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters`,
      fieldName
    );
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be at most ${maxLength} characters`,
      fieldName
    );
  }

  if (pattern && !pattern.test(trimmed)) {
    throw new ValidationError(`${fieldName} has invalid format`, fieldName);
  }

  return trimmed;
}

/**
 * Validate OAuth authorization code
 * @param {any} authCode - Authorization code to validate
 * @returns {string} Validated auth code
 * @throws {ValidationError} If validation fails
 */
function validateAuthCode(authCode) {
  if (!authCode || typeof authCode !== 'string') {
    throw new ValidationError('Authorization code is required and must be a string', 'authCode');
  }

  const trimmed = authCode.trim();

  if (trimmed.length < 10) {
    throw new ValidationError('Authorization code is too short', 'authCode');
  }

  if (trimmed.length > 1000) {
    throw new ValidationError('Authorization code is too long', 'authCode');
  }

  // Auth codes should be alphanumeric with some special chars
  if (!/^[\w\-._~]+$/.test(trimmed)) {
    throw new ValidationError('Authorization code contains invalid characters', 'authCode');
  }

  return trimmed;
}

/**
 * Validate session token
 * @param {any} sessionToken - Session token to validate
 * @returns {string} Validated session token
 * @throws {ValidationError} If validation fails
 */
function validateSessionToken(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') {
    throw new ValidationError('Session token is required and must be a string', 'sessionToken');
  }

  const trimmed = sessionToken.trim();

  // Session tokens should be UUIDs or similar format
  if (trimmed.length < 20 || trimmed.length > 200) {
    throw new ValidationError('Session token has invalid length', 'sessionToken');
  }

  return trimmed;
}

/**
 * Validate OAuth provider
 * @param {any} provider - Provider to validate
 * @returns {string} Validated provider
 * @throws {ValidationError} If validation fails
 */
function validateProvider(provider) {
  if (!provider || typeof provider !== 'string') {
    throw new ValidationError('Provider is required and must be a string', 'provider');
  }

  const validProviders = ['google', 'microsoft'];
  const lowercase = provider.toLowerCase();

  if (!validProviders.includes(lowercase)) {
    throw new ValidationError(
      `Provider must be one of: ${validProviders.join(', ')}`,
      'provider'
    );
  }

  return lowercase;
}

/**
 * Validate contact data for creation/update
 * @param {any} contactData - Contact data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} Validated contact data
 * @throws {ValidationError} If validation fails
 */
function validateContactData(contactData, isUpdate = false) {
  if (!contactData || typeof contactData !== 'object') {
    throw new ValidationError('Contact data must be an object', 'contactData');
  }

  const validated = {};

  // Name is required for creation, optional for update
  if (!isUpdate || contactData.name !== undefined) {
    validated.name = validateString(contactData.name, 'name', {
      required: !isUpdate,
      minLength: 1,
      maxLength: 200,
    });
  }

  // Email is optional but must be valid if provided
  if (contactData.email !== undefined && contactData.email !== null) {
    validated.email = validateEmail(contactData.email, false);
  }

  // Phone is optional
  if (contactData.phone !== undefined && contactData.phone !== null) {
    validated.phone = validateString(contactData.phone, 'phone', {
      required: false,
      maxLength: 50,
    });
  }

  // Company is optional
  if (contactData.company !== undefined && contactData.company !== null) {
    validated.company = validateString(contactData.company, 'company', {
      required: false,
      maxLength: 200,
    });
  }

  // Title is optional
  if (contactData.title !== undefined && contactData.title !== null) {
    validated.title = validateString(contactData.title, 'title', {
      required: false,
      maxLength: 100,
    });
  }

  return validated;
}

/**
 * Validate transaction data for creation/update
 * @param {any} transactionData - Transaction data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} Validated transaction data
 * @throws {ValidationError} If validation fails
 */
function validateTransactionData(transactionData, isUpdate = false) {
  if (!transactionData || typeof transactionData !== 'object') {
    throw new ValidationError('Transaction data must be an object', 'transactionData');
  }

  const validated = {};

  // Property address is required for creation
  if (!isUpdate || transactionData.property_address !== undefined) {
    validated.property_address = validateString(
      transactionData.property_address,
      'property_address',
      {
        required: !isUpdate,
        minLength: 5,
        maxLength: 500,
      }
    );
  }

  // Transaction type
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

  // Amount (if provided)
  if (transactionData.amount !== undefined && transactionData.amount !== null) {
    const amount = Number(transactionData.amount);
    if (isNaN(amount) || amount < 0) {
      throw new ValidationError('Amount must be a non-negative number', 'amount');
    }
    validated.amount = amount;
  }

  // Status
  if (transactionData.status !== undefined) {
    const validStatuses = ['active', 'pending', 'closed', 'cancelled'];
    const status = transactionData.status?.toLowerCase();
    if (!validStatuses.includes(status)) {
      throw new ValidationError(
        `Status must be one of: ${validStatuses.join(', ')}`,
        'status'
      );
    }
    validated.status = status;
  }

  // Notes (optional)
  if (transactionData.notes !== undefined && transactionData.notes !== null) {
    validated.notes = validateString(transactionData.notes, 'notes', {
      required: false,
      maxLength: 10000,
    });
  }

  return validated;
}

/**
 * Validate file path for security
 * @param {any} filePath - File path to validate
 * @returns {string} Validated file path
 * @throws {ValidationError} If validation fails
 */
function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new ValidationError('File path is required and must be a string', 'filePath');
  }

  const trimmed = filePath.trim();

  // Prevent path traversal attacks
  if (trimmed.includes('..') || trimmed.includes('~')) {
    throw new ValidationError('File path contains invalid characters', 'filePath');
  }

  // Prevent extremely long paths (DoS)
  if (trimmed.length > 4096) {
    throw new ValidationError('File path is too long', 'filePath');
  }

  return trimmed;
}

/**
 * Validate URL for security
 * @param {any} url - URL to validate
 * @returns {string} Validated URL
 * @throws {ValidationError} If validation fails
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('URL is required and must be a string', 'url');
  }

  const trimmed = url.trim();

  try {
    const urlObj = new URL(trimmed);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new ValidationError('URL must use http or https protocol', 'url');
    }

    return trimmed;
  } catch (error) {
    throw new ValidationError('Invalid URL format', 'url');
  }
}

/**
 * Sanitize object to prevent prototype pollution
 * @param {any} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Prevent prototype pollution
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  const cleaned = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (!dangerous.includes(key)) {
        cleaned[key] = obj[key];
      }
    }
  }

  return cleaned;
}

module.exports = {
  ValidationError,
  validateUserId,
  validateContactId,
  validateTransactionId,
  validateEmail,
  validateString,
  validateAuthCode,
  validateSessionToken,
  validateProvider,
  validateContactData,
  validateTransactionData,
  validateFilePath,
  validateUrl,
  sanitizeObject,
};
