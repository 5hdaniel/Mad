/**
 * Standardized Error Handling Utilities
 * Provides consistent error handling across the application
 */

const log = require('electron-log');

/**
 * Custom Error Classes
 */

class AppError extends Error {
  constructor(message, code, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 'VALIDATION_ERROR', 400);
    this.field = field;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
    this.resource = resource;
    this.id = id;
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 'DATABASE_ERROR', 500);
    this.originalError = originalError;
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message, originalError = null) {
    super(`${service} error: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502);
    this.service = service;
    this.originalError = originalError;
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.retryAfter = retryAfter;
  }
}

/**
 * Error Handler
 */
class ErrorHandler {
  /**
   * Handle error and return standardized error response
   * @param {Error} error - Error object
   * @param {string} context - Context where error occurred
   * @returns {Object} Standardized error response
   */
  static handle(error, context = 'Unknown') {
    // Log error
    this.logError(error, context);

    // Return standardized response
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          field: error.field,
          statusCode: error.statusCode,
        },
      };
    }

    // Handle unknown errors
    return {
      success: false,
      error: {
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      },
    };
  }

  /**
   * Log error with context
   * @param {Error} error - Error object
   * @param {string} context - Context where error occurred
   */
  static logError(error, context) {
    const errorInfo = {
      context,
      message: error.message,
      code: error.code || 'UNKNOWN',
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };

    if (error instanceof AppError && error.isOperational) {
      log.warn('[Operational Error]', errorInfo);
    } else {
      log.error('[Unexpected Error]', errorInfo);
    }
  }

  /**
   * Async error wrapper for IPC handlers
   * @param {Function} handler - Async handler function
   * @param {string} context - Context for error logging
   * @returns {Function} Wrapped handler
   */
  static asyncHandler(handler, context) {
    return async (...args) => {
      try {
        const result = await handler(...args);
        return { success: true, ...result };
      } catch (error) {
        return this.handle(error, context);
      }
    };
  }

  /**
   * Validate and throw if invalid
   * @param {boolean} condition - Validation condition
   * @param {string} message - Error message
   * @param {string} field - Field name (optional)
   * @throws {ValidationError}
   */
  static validate(condition, message, field = null) {
    if (!condition) {
      throw new ValidationError(message, field);
    }
  }

  /**
   * Assert resource exists or throw NotFoundError
   * @param {*} resource - Resource to check
   * @param {string} resourceName - Name of resource type
   * @param {string} id - Resource identifier
   * @throws {NotFoundError}
   */
  static assertExists(resource, resourceName, id = null) {
    if (!resource) {
      throw new NotFoundError(resourceName, id);
    }
  }

  /**
   * Retry operation with exponential backoff
   * @param {Function} operation - Async operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise} Result of operation
   */
  static async retry(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          log.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
            error: error.message,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new AppError(
      `Operation failed after ${maxRetries} retries: ${lastError.message}`,
      'RETRY_EXHAUSTED',
      500,
      false
    );
  }

  /**
   * Create safe error response for IPC (no sensitive data)
   * @param {Error} error - Error object
   * @returns {Object} Safe error response
   */
  static createSafeResponse(error) {
    return {
      success: false,
      error: {
        message: error instanceof AppError ? error.message : 'An error occurred',
        code: error.code || 'UNKNOWN_ERROR',
      },
    };
  }
}

/**
 * Utility Functions
 */

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Error context
 * @returns {Function} Wrapped function
 */
function withErrorHandling(fn, context) {
  return ErrorHandler.asyncHandler(fn, context);
}

/**
 * Create validation helper
 * @param {Object} rules - Validation rules
 * @returns {Function} Validator function
 */
function createValidator(rules) {
  return (data) => {
    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        throw new ValidationError(`${field} is required`, field);
      }

      if (value && rule.type && typeof value !== rule.type) {
        throw new ValidationError(
          `${field} must be of type ${rule.type}`,
          field
        );
      }

      if (value && rule.minLength && value.length < rule.minLength) {
        throw new ValidationError(
          `${field} must be at least ${rule.minLength} characters`,
          field
        );
      }

      if (value && rule.maxLength && value.length > rule.maxLength) {
        throw new ValidationError(
          `${field} must not exceed ${rule.maxLength} characters`,
          field
        );
      }

      if (value && rule.pattern && !rule.pattern.test(value)) {
        throw new ValidationError(
          `${field} has invalid format`,
          field
        );
      }

      if (value && rule.custom && !rule.custom(value)) {
        throw new ValidationError(
          rule.customMessage || `${field} validation failed`,
          field
        );
      }
    }

    return true;
  };
}

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  ExternalServiceError,
  RateLimitError,

  // Error handler
  ErrorHandler,

  // Utility functions
  withErrorHandling,
  createValidator,
};
