/**
 * Onboarding Debug Utility
 *
 * Centralized logging for tracking state changes, flag values,
 * and render decisions during the onboarding flow.
 */

import logger from '../../../utils/logger';

// Enable/disable debug logging based on environment
const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';

/**
 * Log a state change with all relevant flags
 */
export function logStateChange(
  source: string,
  action: string,
  flags: Record<string, unknown>
): void {
  if (!DEBUG_ENABLED) return;

  const time = new Date().toISOString().split('T')[1].split('.')[0];

  logger.debug(
    `${time} | ${source} | ${action}`
  );
  logger.debug('Flags:', flags);
}

/**
 * Log step visibility decision
 */
export function logStepVisibility(
  stepId: string,
  shouldShow: boolean,
  reason: string,
  context: Record<string, unknown>
): void {
  if (!DEBUG_ENABLED) return;
  logger.debug(`[STEP] ${stepId}: ${shouldShow ? 'SHOW' : 'HIDE'}`, context);
}

/**
 * Log navigation event
 */
export function logNavigation(
  from: string,
  to: string,
  trigger: string
): void {
  if (!DEBUG_ENABLED) return;
  logger.debug(`[NAV] ${from} → ${to} (${trigger})`);
}

/**
 * Log all current flags
 */
export function logAllFlags(
  source: string,
  flags: Record<string, unknown>
): void {
  if (!DEBUG_ENABLED) return;
  logger.debug(`[FLAGS] ${source}:`, flags);
}
