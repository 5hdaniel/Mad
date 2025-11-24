"use strict";
/**
 * Database-specific types for Magic Audit
 * These types represent database operations, query results, and service interfaces
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.ValidationError = exports.DatabaseError = void 0;
// ============================================
// ERROR TYPES
// ============================================
class DatabaseError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
class ValidationError extends Error {
    constructor(message, field, value) {
        super(message);
        this.field = field;
        this.value = value;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends Error {
    constructor(message, resourceType, resourceId) {
        super(message);
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
