/**
 * Common Zod schemas shared across domains.
 *
 * These schemas validate common field patterns (timestamps, UUIDs, pagination)
 * and provide reusable building blocks for domain-specific schemas.
 */
import { z } from 'zod/v4';

// ============================================
// COMMON FIELD SCHEMAS
// ============================================

/** ISO 8601 datetime string or similar timestamp */
export const TimestampSchema = z.string();

/** UUID string (loose validation -- accepts any non-empty string for compatibility) */
export const UuidSchema = z.string().min(1);

/** Optional nullable timestamp */
export const OptionalTimestamp = z.string().nullable().optional();

// ============================================
// PAGINATION & LIST RESPONSES
// ============================================

export const PaginationSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// ============================================
// ERROR RESPONSE
// ============================================

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================
// IPC RESPONSE WRAPPER
// ============================================

/**
 * Standard IPC response envelope.
 * Handlers return either { success: true, data } or { success: false, error }.
 */
export function createIpcResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.union([
    z.object({
      success: z.literal(true),
      data: dataSchema,
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
      code: z.string().optional(),
    }),
  ]);
}
