/**
 * Application Constants
 * Centralized location for all magic numbers and strings
 */

// Date/Time Constants
const MAC_EPOCH = new Date('2001-01-01T00:00:00Z').getTime();
const FIVE_YEARS_IN_MS = 5 * 365 * 24 * 60 * 60 * 1000;

// Database Constants
const MIN_CONTACT_RECORD_COUNT = 10;
const CONTACTS_BASE_DIR = 'Library/Application Support/AddressBook';
const DEFAULT_CONTACTS_DB = 'Library/Application Support/AddressBook/AddressBook-v22.abcddb';
const MESSAGES_DB_PATH = 'Library/Messages/chat.db';

// Message Text Parsing Constants
const MAX_MESSAGE_TEXT_LENGTH = 10000;
const MIN_MESSAGE_TEXT_LENGTH = 1;
const MIN_CLEANED_TEXT_LENGTH = 2;
const STREAMTYPED_MARKER = 'streamtyped';
const STREAMTYPED_OFFSET = 11; // Length of 'streamtyped'

// Regular Expressions
const REGEX_PATTERNS = {
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
  TRAILING_SYMBOLS: /[^\w\s]+$/
};

// Fallback Messages
const FALLBACK_MESSAGES = {
  UNABLE_TO_EXTRACT: '[Message text - unable to extract from rich format]',
  PARSING_ERROR: '[Message text - parsing error]',
  ATTACHMENT: '[Attachment - Photo/Video/File]',
  REACTION_OR_SYSTEM: '[Reaction or system message]'
};

// Application Window Configuration
const WINDOW_CONFIG = {
  DEFAULT_WIDTH: 1200,
  DEFAULT_HEIGHT: 800,
  TITLE_BAR_STYLE: 'hiddenInset',
  BACKGROUND_COLOR: '#ffffff'
};

// Development
const DEV_SERVER_URL = 'http://localhost:5173';
const UPDATE_CHECK_DELAY = 5000; // 5 seconds after window loads

module.exports = {
  MAC_EPOCH,
  FIVE_YEARS_IN_MS,
  MIN_CONTACT_RECORD_COUNT,
  CONTACTS_BASE_DIR,
  DEFAULT_CONTACTS_DB,
  MESSAGES_DB_PATH,
  MAX_MESSAGE_TEXT_LENGTH,
  MIN_MESSAGE_TEXT_LENGTH,
  MIN_CLEANED_TEXT_LENGTH,
  STREAMTYPED_MARKER,
  STREAMTYPED_OFFSET,
  REGEX_PATTERNS,
  FALLBACK_MESSAGES,
  WINDOW_CONFIG,
  DEV_SERVER_URL,
  UPDATE_CHECK_DELAY
};
