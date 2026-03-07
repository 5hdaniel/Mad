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

function timestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

function relay(level: LogLevel, msg: string, args: unknown[]): void {
  try {
    const argsStr = args.length > 0
      ? ' ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
      : '';
    (window as unknown as { api?: { log?: { send: (level: string, message: string) => void } } })
      .api?.log?.send(level, `[${timestamp()}] ${msg}${argsStr}`);
  } catch {
    // IPC not available (e.g. tests) — ignore
  }
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => {
    if (shouldLog('debug')) { console.debug(`[${timestamp()}] [DEBUG] ${msg}`, ...args); relay('debug', msg, args); }
  },
  info: (msg: string, ...args: unknown[]) => {
    if (shouldLog('info')) { console.info(`[${timestamp()}] [INFO] ${msg}`, ...args); relay('info', msg, args); }
  },
  warn: (msg: string, ...args: unknown[]) => {
    if (shouldLog('warn')) { console.warn(`[${timestamp()}] [WARN] ${msg}`, ...args); relay('warn', msg, args); }
  },
  error: (msg: string, ...args: unknown[]) => {
    if (shouldLog('error')) { console.error(`[${timestamp()}] [ERROR] ${msg}`, ...args); relay('error', msg, args); }
  },
};

export default logger;
