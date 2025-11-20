"use strict";
/**
 * Application Constants
 * Centralized location for all magic numbers and strings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPDATE_CHECK_DELAY = exports.DEV_SERVER_URL = exports.WINDOW_CONFIG = exports.FALLBACK_MESSAGES = exports.REGEX_PATTERNS = exports.STREAMTYPED_OFFSET = exports.STREAMTYPED_MARKER = exports.MIN_CLEANED_TEXT_LENGTH = exports.MIN_MESSAGE_TEXT_LENGTH = exports.MAX_MESSAGE_TEXT_LENGTH = exports.MESSAGES_DB_PATH = exports.DEFAULT_CONTACTS_DB = exports.CONTACTS_BASE_DIR = exports.MIN_CONTACT_RECORD_COUNT = exports.FIVE_YEARS_IN_MS = exports.MAC_EPOCH = void 0;
// Date/Time Constants
exports.MAC_EPOCH = new Date('2001-01-01T00:00:00Z').getTime();
exports.FIVE_YEARS_IN_MS = 5 * 365 * 24 * 60 * 60 * 1000;
// Database Constants
exports.MIN_CONTACT_RECORD_COUNT = 10;
exports.CONTACTS_BASE_DIR = 'Library/Application Support/AddressBook';
exports.DEFAULT_CONTACTS_DB = 'Library/Application Support/AddressBook/AddressBook-v22.abcddb';
exports.MESSAGES_DB_PATH = 'Library/Messages/chat.db';
// Message Text Parsing Constants
exports.MAX_MESSAGE_TEXT_LENGTH = 10000;
exports.MIN_MESSAGE_TEXT_LENGTH = 1;
exports.MIN_CLEANED_TEXT_LENGTH = 2;
exports.STREAMTYPED_MARKER = 'streamtyped';
exports.STREAMTYPED_OFFSET = 11; // Length of 'streamtyped'
// Regular Expressions
exports.REGEX_PATTERNS = {
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
exports.FALLBACK_MESSAGES = {
    UNABLE_TO_EXTRACT: '[Message text - unable to extract from rich format]',
    PARSING_ERROR: '[Message text - parsing error]',
    ATTACHMENT: '[Attachment - Photo/Video/File]',
    REACTION_OR_SYSTEM: '[Reaction or system message]'
};
// Application Window Configuration
exports.WINDOW_CONFIG = {
    DEFAULT_WIDTH: 1200,
    DEFAULT_HEIGHT: 800,
    TITLE_BAR_STYLE: 'hiddenInset',
    BACKGROUND_COLOR: '#ffffff'
};
// Development
exports.DEV_SERVER_URL = 'http://localhost:5173';
exports.UPDATE_CHECK_DELAY = 5000; // 5 seconds after window loads
