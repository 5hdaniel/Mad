/**
 * Zod Schema Barrel Export
 *
 * This is the canonical location for all Zod runtime validation schemas.
 * Import from 'electron/schemas' for schema access.
 *
 * Usage:
 *   import { UserSchema, validateResponse } from '../schemas';
 *   const user = validateResponse(UserSchema, rawData, 'getUser');
 */

// Validation utilities
export { validateResponse, safeValidate, validateArray } from './validate';

// Common schemas
export {
  TimestampSchema,
  UuidSchema,
  OptionalTimestamp,
  PaginationSchema,
  ErrorResponseSchema,
  createIpcResponseSchema,
} from './common';
export type { Pagination, ErrorResponse } from './common';

// User schemas
export {
  OAuthProviderSchema,
  SubscriptionTierSchema,
  SubscriptionStatusSchema,
  ThemeSchema,
  LicenseTypeSchema,
  UserSchema,
  UserLicenseSchema,
} from './user';
export type { ValidatedUser, ValidatedUserLicense } from './user';

// Contact schemas
export {
  ContactSourceSchema,
  ContactInfoSourceSchema,
  ContactSchema,
  ContactEmailSchema,
  ContactPhoneSchema,
  CreateContactInputSchema,
} from './contact';
export type {
  ValidatedContact,
  ValidatedContactEmail,
  ValidatedContactPhone,
  CreateContactInput,
} from './contact';

// Transaction schemas
export {
  TransactionTypeSchema,
  TransactionStatusSchema,
  ExportStatusSchema,
  TransactionStageSchema,
  SubmissionStatusSchema,
  TransactionSchema,
  CreateTransactionInputSchema,
} from './transaction';
export type { ValidatedTransaction, CreateTransactionInput } from './transaction';
