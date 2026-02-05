/**
 * Onboarding Debug Utility
 *
 * Centralized logging for tracking state changes, flag values,
 * and render decisions during the onboarding flow.
 */

// Enable/disable debug logging
const DEBUG_ENABLED = true;

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

  console.log(
    `%c[DEBUG] ${time} | ${source} | ${action}`,
    'background: #222; color: #bada55; font-weight: bold;'
  );
  console.log('Flags:', flags);
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
  console.log(`[STEP] ${stepId}: ${shouldShow ? 'SHOW' : 'HIDE'}`, context);
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
  console.log(`[NAV] ${from} → ${to} (${trigger})`);
}

/**
 * Log all current flags
 */
export function logAllFlags(
  source: string,
  flags: Record<string, unknown>
): void {
  if (!DEBUG_ENABLED) return;
  console.log(`[FLAGS] ${source}:`, flags);
}
