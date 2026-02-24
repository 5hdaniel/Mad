/**
 * Application Constants
 * Centralized location for all magic numbers and strings
 */

// Date/Time Constants
export const MAC_EPOCH: number = new Date("2001-01-01T00:00:00Z").getTime();
export const FIVE_YEARS_IN_MS: number = 5 * 365 * 24 * 60 * 60 * 1000;

// Database Constants
export const MIN_CONTACT_RECORD_COUNT: number = 10;
export const CONTACTS_BASE_DIR: string =
  "Library/Application Support/AddressBook";
export const DEFAULT_CONTACTS_DB: string =
  "Library/Application Support/AddressBook/AddressBook-v22.abcddb";
export const MESSAGES_DB_PATH: string = "Library/Messages/chat.db";

// Message Text Parsing Constants
export const MAX_MESSAGE_TEXT_LENGTH: number = 10000;
export const MIN_MESSAGE_TEXT_LENGTH: number = 1;
export const MIN_CLEANED_TEXT_LENGTH: number = 2;
export const STREAMTYPED_MARKER: string = "streamtyped";
export const STREAMTYPED_OFFSET: number = 11; // Length of 'streamtyped'

// Regular Expressions
export const REGEX_PATTERNS: Record<string, RegExp> = {
  // Phone number normalization - remove all non-digit characters
  PHONE_NORMALIZE: /\D/g,

  // File name sanitization - allow only alphanumeric characters
  FILE_SANITIZE: /[^a-z0-9]/gi,

  // File name with spaces - allow alphanumeric and spaces
  FILE_SANITIZE_WITH_SPACES: /[^a-z0-9 ]/gi,

  // Message text extraction
  MESSAGE_TEXT_EXTRACT: /NSString.*?"((?:[^"\\]|\\.)*)"/g,
  MESSAGE_TEXT_READABLE: /[\x20-\x7E\u00A0-\uFFFF]{2,}/,
  MESSAGE_TEXT_ALPHANUMERIC: /[a-zA-Z0-9]/,

  // Control characters to remove
  NULL_BYTES: /\x00/g,
  CONTROL_CHARS: /[\x01-\x08\x0B-\x1F\x7F]/g,

  // Leading/trailing symbols
  LEADING_SYMBOLS: /^[^\w\s]+/,
  TRAILING_SYMBOLS: /[^\w\s]+$/,
};

// Fallback Messages
export const FALLBACK_MESSAGES: Record<string, string> = {
  UNABLE_TO_EXTRACT: "[Message text - unable to extract from rich format]",
  PARSING_ERROR: "[Message text - parsing error]",
  ATTACHMENT: "[Attachment - Photo/Video/File]",
  REACTION_OR_SYSTEM: "[Reaction or system message]",
  UNABLE_TO_PARSE: "[Unable to parse message]", // TASK-1049: Deterministic fallback for unknown formats
};

// Window Configuration Interface
export interface WindowConfig {
  DEFAULT_WIDTH: number;
  DEFAULT_HEIGHT: number;
  TITLE_BAR_STYLE: string;
  BACKGROUND_COLOR: string;
}

// Application Window Configuration
export const WINDOW_CONFIG: WindowConfig = {
  DEFAULT_WIDTH: 1200,
  DEFAULT_HEIGHT: 800,
  TITLE_BAR_STYLE: "hiddenInset",
  BACKGROUND_COLOR: "#ffffff",
};

// Lookback Settings (2 canonical settings remain after TASK-2069 consolidation):
//   1. scan.lookbackMonths (default 9) — how far back the transaction scanner looks
//   2. messageImport.filters.lookbackMonths (default 3) — how far back iMessage import looks
// Previously removed:
//   - DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS (TASK-2069) — first-time sync now uses scan.lookbackMonths
//   - DEFAULT_LOOKBACK_MONTHS in autoLinkService (TASK-2068) — replaced with computeTransactionDateRange()

// Development
export const DEV_SERVER_URL: string = "http://localhost:5173";
export const UPDATE_CHECK_DELAY: number = 5000; // 5 seconds after window loads
export const UPDATE_CHECK_INTERVAL: number = 4 * 60 * 60 * 1000; // 4 hours in ms (TASK-1970)
