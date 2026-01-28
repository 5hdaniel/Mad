"use strict";
/**
 * License Types - SPRINT-062
 * TypeScript interfaces for Supabase license and device tables
 *
 * These types match the database schema in:
 * - public.licenses table
 * - public.devices table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFFLINE_GRACE_PERIOD_HOURS = exports.TRIAL_DURATION_DAYS = exports.LICENSE_LIMITS = void 0;
// =============================================================================
// Constants
// =============================================================================
/**
 * License limits by type
 */
exports.LICENSE_LIMITS = {
    trial: { transactions: 5, devices: 1 },
    individual: { transactions: Infinity, devices: 2 },
    team: { transactions: Infinity, devices: 10 },
};
/**
 * Trial duration in days
 */
exports.TRIAL_DURATION_DAYS = 14;
/**
 * Offline grace period in hours
 * (how long the app can run without validating license online)
 */
exports.OFFLINE_GRACE_PERIOD_HOURS = 24;
