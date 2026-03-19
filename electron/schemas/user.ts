/**
 * Zod schemas for User-related types.
 *
 * These mirror the interfaces in electron/types/models.ts.
 * Schemas match reality (nullable/optional fields) rather than enforcing ideal constraints.
 */
import { z } from 'zod/v4';
import { TimestampSchema, OptionalTimestamp, UuidSchema } from './common';

// ============================================
// ENUM SCHEMAS
// ============================================

export const OAuthProviderSchema = z.enum(['google', 'microsoft', 'azure']);
export const SubscriptionTierSchema = z.enum(['free', 'pro', 'enterprise']);
export const SubscriptionStatusSchema = z.enum(['trial', 'active', 'cancelled', 'expired']);
export const ThemeSchema = z.enum(['light', 'dark', 'auto']);
export const LicenseTypeSchema = z.enum(['individual', 'team', 'enterprise']);

// ============================================
// USER SCHEMA
// ============================================

export const UserSchema = z.object({
  // Core Identity
  id: UuidSchema,
  email: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  display_name: z.string().optional(),
  avatar_url: z.string().nullable().optional(),

  // OAuth
  oauth_provider: OAuthProviderSchema,
  oauth_id: z.string(),

  // Subscription
  subscription_tier: SubscriptionTierSchema,
  subscription_status: SubscriptionStatusSchema,
  trial_ends_at: OptionalTimestamp,

  // Account Status
  is_active: z.union([z.boolean(), z.number()]), // SQLite returns 0/1
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  last_login_at: OptionalTimestamp,

  // Legal
  terms_accepted_at: OptionalTimestamp,
  terms_version_accepted: z.string().nullable().optional(),
  privacy_policy_accepted_at: OptionalTimestamp,
  privacy_policy_version_accepted: z.string().nullable().optional(),

  // Onboarding
  email_onboarding_completed_at: OptionalTimestamp,

  // Preferences
  timezone: z.string().nullable().optional(),
  theme: ThemeSchema.nullable().optional(),
  notification_preferences: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
  company: z.string().nullable().optional(),
  job_title: z.string().nullable().optional(),
  mobile_phone_type: z.enum(['iphone', 'android']).nullable().optional(),

  // License
  license_type: LicenseTypeSchema.nullable().optional(),
  ai_detection_enabled: z.union([z.boolean(), z.number()]).nullable().optional(),
  organization_id: z.string().nullable().optional(),

  // Sync
  last_cloud_sync_at: OptionalTimestamp,
});

export type ValidatedUser = z.infer<typeof UserSchema>;

// ============================================
// USER LICENSE SCHEMA
// ============================================

export const UserLicenseSchema = z.object({
  license_type: LicenseTypeSchema,
  ai_detection_enabled: z.union([z.boolean(), z.number()]),
  organization_id: z.string().nullable().optional(),
  organization_name: z.string().nullable().optional(),
});

export type ValidatedUserLicense = z.infer<typeof UserLicenseSchema>;
