/**
 * Renderer-side logger
 * Wraps console methods with structured prefix and level control.
 * In production builds, debug-level logs are suppressed.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => {
    if (shouldLog('debug')) console.debug(`[DEBUG] ${msg}`, ...args);
  },
  info: (msg: string, ...args: unknown[]) => {
    if (shouldLog('info')) console.info(`[INFO] ${msg}`, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    if (shouldLog('warn')) console.warn(`[WARN] ${msg}`, ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    if (shouldLog('error')) console.error(`[ERROR] ${msg}`, ...args);
  },
};

export default logger;
