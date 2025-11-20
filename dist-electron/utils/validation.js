"use strict";
/**
 * Input Validation Utilities for IPC Handlers
 * Provides comprehensive validation for all IPC handler inputs
 * Prevents injection attacks, type errors, and invalid data processing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
exports.validateUserId = validateUserId;
exports.validateContactId = validateContactId;
exports.validateTransactionId = validateTransactionId;
exports.validateEmail = validateEmail;
exports.validateString = validateString;
exports.validateAuthCode = validateAuthCode;
exports.validateSessionToken = validateSessionToken;
exports.validateProvider = validateProvider;
exports.validateContactData = validateContactData;
exports.validateTransactionData = validateTransactionData;
exports.validateFilePath = validateFilePath;
exports.validateUrl = validateUrl;
exports.sanitizeObject = sanitizeObject;
/**
 * Validation error class
 */
class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
/**
 * Validate user ID
 * @param userId - User ID to validate (UUID string)
 * @param required - Whether the field is required
 * @returns Validated user ID
 * @throws ValidationError if validation fails
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
 * @param contactId - Contact ID to validate (UUID string)
 * @param required - Whether the field is required
 * @returns Validated contact ID
 * @throws ValidationError if validation fails
 */
function validateContactId(contactId, required = true) {
    if (contactId === null || contactId === undefined || contactId === '') {
        if (required) {
            throw new ValidationError('Contact ID is required', 'contactId');
        }
        return null;
    }
    if (typeof contactId !== 'string') {
        throw new ValidationError('Contact ID must be a string', 'contactId');
    }
    // Validate UUID format (standard UUID v4 format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(contactId.trim())) {
        throw new ValidationError('Contact ID must be a valid UUID', 'contactId');
    }
    return contactId.trim();
}
/**
 * Validate transaction ID
 * @param transactionId - Transaction ID to validate (UUID string)
 * @param required - Whether the field is required
 * @returns Validated transaction ID
 * @throws ValidationError if validation fails
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
 * @param email - Email to validate
 * @param required - Whether the field is required
 * @returns Validated email
 * @throws ValidationError if validation fails
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
 * @param value - Value to validate
 * @param fieldName - Field name for error messages
 * @param options - Validation options
 * @returns Validated string
 * @throws ValidationError if validation fails
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
        throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName);
    }
    if (trimmed.length > maxLength) {
        throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`, fieldName);
    }
    if (pattern && !pattern.test(trimmed)) {
        throw new ValidationError(`${fieldName} has invalid format`, fieldName);
    }
    return trimmed;
}
/**
 * Validate OAuth authorization code
 * @param authCode - Authorization code to validate
 * @returns Validated auth code
 * @throws ValidationError if validation fails
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
 * @param sessionToken - Session token to validate
 * @returns Validated session token
 * @throws ValidationError if validation fails
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
 * @param provider - Provider to validate
 * @returns Validated provider
 * @throws ValidationError if validation fails
 */
function validateProvider(provider) {
    if (!provider || typeof provider !== 'string') {
        throw new ValidationError('Provider is required and must be a string', 'provider');
    }
    const validProviders = ['google', 'microsoft'];
    const lowercase = provider.toLowerCase();
    if (!validProviders.includes(lowercase)) {
        throw new ValidationError(`Provider must be one of: ${validProviders.join(', ')}`, 'provider');
    }
    return lowercase;
}
/**
 * Validate contact data for creation/update
 * @param contactData - Contact data to validate
 * @param isUpdate - Whether this is an update operation
 * @returns Validated contact data
 * @throws ValidationError if validation fails
 */
function validateContactData(contactData, isUpdate = false) {
    if (!contactData || typeof contactData !== 'object') {
        throw new ValidationError('Contact data must be an object', 'contactData');
    }
    const data = contactData;
    const validated = {};
    // Name is required for creation, optional for update
    if (!isUpdate || data.name !== undefined) {
        validated.name = validateString(data.name, 'name', {
            required: !isUpdate,
            minLength: 1,
            maxLength: 200,
        });
    }
    // Email is optional but must be valid if provided
    if (data.email !== undefined && data.email !== null) {
        validated.email = validateEmail(data.email, false);
    }
    // Phone is optional
    if (data.phone !== undefined && data.phone !== null) {
        validated.phone = validateString(data.phone, 'phone', {
            required: false,
            maxLength: 50,
        });
    }
    // Company is optional
    if (data.company !== undefined && data.company !== null) {
        validated.company = validateString(data.company, 'company', {
            required: false,
            maxLength: 200,
        });
    }
    // Title is optional
    if (data.title !== undefined && data.title !== null) {
        validated.title = validateString(data.title, 'title', {
            required: false,
            maxLength: 100,
        });
    }
    return validated;
}
/**
 * Validate transaction data for creation/update
 * @param transactionData - Transaction data to validate
 * @param isUpdate - Whether this is an update operation
 * @returns Validated transaction data
 * @throws ValidationError if validation fails
 */
function validateTransactionData(transactionData, isUpdate = false) {
    if (!transactionData || typeof transactionData !== 'object') {
        throw new ValidationError('Transaction data must be an object', 'transactionData');
    }
    const data = transactionData;
    const validated = {};
    // Property address is required for creation
    if (!isUpdate || data.property_address !== undefined) {
        validated.property_address = validateString(data.property_address, 'property_address', {
            required: !isUpdate,
            minLength: 5,
            maxLength: 500,
        });
    }
    // Transaction type
    if (data.transaction_type !== undefined) {
        const validTypes = ['purchase', 'sale', 'lease', 'refinance', 'other'];
        const type = typeof data.transaction_type === 'string' ? data.transaction_type.toLowerCase() : '';
        if (!validTypes.includes(type)) {
            throw new ValidationError(`Transaction type must be one of: ${validTypes.join(', ')}`, 'transaction_type');
        }
        validated.transaction_type = type;
    }
    // Amount (if provided)
    if (data.amount !== undefined && data.amount !== null) {
        const amount = Number(data.amount);
        if (isNaN(amount) || amount < 0) {
            throw new ValidationError('Amount must be a non-negative number', 'amount');
        }
        validated.amount = amount;
    }
    // Status
    if (data.status !== undefined) {
        const validStatuses = ['active', 'pending', 'closed', 'cancelled'];
        const status = typeof data.status === 'string' ? data.status.toLowerCase() : '';
        if (!validStatuses.includes(status)) {
            throw new ValidationError(`Status must be one of: ${validStatuses.join(', ')}`, 'status');
        }
        validated.status = status;
    }
    // Notes (optional)
    if (data.notes !== undefined && data.notes !== null) {
        validated.notes = validateString(data.notes, 'notes', {
            required: false,
            maxLength: 10000,
        });
    }
    // Sale price (optional)
    if (data.sale_price !== undefined && data.sale_price !== null) {
        const price = Number(data.sale_price);
        if (isNaN(price) || price < 0) {
            throw new ValidationError('Sale price must be a non-negative number', 'sale_price');
        }
        validated.sale_price = price;
    }
    // Listing price (optional)
    if (data.listing_price !== undefined && data.listing_price !== null) {
        const price = Number(data.listing_price);
        if (isNaN(price) || price < 0) {
            throw new ValidationError('Listing price must be a non-negative number', 'listing_price');
        }
        validated.listing_price = price;
    }
    // Representation start date (optional, must be valid date string)
    if (data.representation_start_date !== undefined && data.representation_start_date !== null) {
        if (typeof data.representation_start_date === 'string' && data.representation_start_date.trim()) {
            // Validate it's a valid date format (YYYY-MM-DD or ISO date string)
            const dateStr = data.representation_start_date.trim();
            if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                throw new ValidationError('Representation start date must be in YYYY-MM-DD format', 'representation_start_date');
            }
            validated.representation_start_date = dateStr;
        }
    }
    // Closing date (optional, must be valid date string)
    if (data.closing_date !== undefined && data.closing_date !== null) {
        if (typeof data.closing_date === 'string' && data.closing_date.trim()) {
            // Validate it's a valid date format (YYYY-MM-DD or ISO date string)
            const dateStr = data.closing_date.trim();
            if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                throw new ValidationError('Closing date must be in YYYY-MM-DD format', 'closing_date');
            }
            validated.closing_date = dateStr;
        }
    }
    // Closing date verified flag (optional, must be 0 or 1)
    if (data.closing_date_verified !== undefined && data.closing_date_verified !== null) {
        const verified = Number(data.closing_date_verified);
        if (verified !== 0 && verified !== 1) {
            throw new ValidationError('Closing date verified must be 0 or 1', 'closing_date_verified');
        }
        validated.closing_date_verified = verified;
    }
    return validated;
}
/**
 * Validate file path for security
 * @param filePath - File path to validate
 * @returns Validated file path
 * @throws ValidationError if validation fails
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
 * @param url - URL to validate
 * @returns Validated URL
 * @throws ValidationError if validation fails
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
    }
    catch (error) {
        throw new ValidationError('Invalid URL format', 'url');
    }
}
/**
 * Sanitize object to prevent prototype pollution
 * @param obj - Object to sanitize
 * @returns Sanitized object
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
