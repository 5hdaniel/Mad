/**
 * Test Fixtures for Message Parser
 *
 * Contains sample buffers representing various iMessage attributedBody formats:
 * - Binary plist (bplist00) - NSKeyedArchiver format
 * - Typedstream - Legacy Apple serialization format
 * - Edge cases and malformed data
 *
 * TASK-1051: Comprehensive test suite for message parsing
 */

/**
 * Preamble bytes for typedstream format
 */
export const NSSTRING_PREAMBLE = {
  /** Regular immutable NSString preamble */
  REGULAR: Buffer.from([0x01, 0x94, 0x84, 0x01, 0x2b]),
  /** Mutable NSMutableString preamble (used in rich messages) */
  MUTABLE: Buffer.from([0x01, 0x95, 0x84, 0x01, 0x2b]),
};

/**
 * Creates a minimal typedstream buffer for testing
 *
 * @param text - The text content to embed
 * @param options - Configuration options
 * @returns Buffer in typedstream format
 */
export function createTypedstreamBuffer(
  text: string,
  options: {
    preamble?: "regular" | "mutable";
    includeStreamMarker?: boolean;
  } = {}
): Buffer {
  const { preamble = "regular", includeStreamMarker = false } = options;

  const parts: Buffer[] = [];

  // Optional streamtyped marker with preamble bytes
  if (includeStreamMarker) {
    parts.push(Buffer.from([0x04, 0x0b])); // Common preamble bytes
    parts.push(Buffer.from("streamtyped"));
    parts.push(Buffer.alloc(10)); // Padding
  }

  // NSString marker
  parts.push(Buffer.from("NSString"));

  // Preamble based on type
  parts.push(
    preamble === "mutable"
      ? NSSTRING_PREAMBLE.MUTABLE
      : NSSTRING_PREAMBLE.REGULAR
  );

  // Text content with length prefix
  const textBuffer = Buffer.from(text, "utf8");

  if (textBuffer.length < 128) {
    // Single byte length
    parts.push(Buffer.from([textBuffer.length]));
  } else {
    // Extended length (0x81 + 2 bytes little-endian)
    parts.push(
      Buffer.from([
        0x81,
        textBuffer.length & 0xff,
        (textBuffer.length >> 8) & 0xff,
      ])
    );
  }

  parts.push(textBuffer);

  return Buffer.concat(parts);
}

/**
 * Creates a buffer with multiple NSString segments
 *
 * @param texts - Array of text strings to embed
 * @returns Buffer with multiple NSString segments
 */
export function createMultiSegmentTypedstream(texts: string[]): Buffer {
  const parts: Buffer[] = [];

  for (const text of texts) {
    parts.push(createTypedstreamBuffer(text));
  }

  return Buffer.concat(parts);
}

/**
 * Sample typedstream buffers for testing
 */
export const TYPEDSTREAM_SAMPLES = {
  /** Simple hello message */
  SIMPLE: createTypedstreamBuffer("Hello, this is a test message!"),

  /** Hello with streamtyped marker */
  WITH_MARKER: createTypedstreamBuffer("Hello from typedstream!", {
    includeStreamMarker: true,
  }),

  /** Rich message using mutable string (link or calendar) */
  MUTABLE_STRING: createTypedstreamBuffer("Check out this link!", {
    preamble: "mutable",
  }),

  /** Long message exceeding 127 bytes (requires extended length) */
  EXTENDED_LENGTH: createTypedstreamBuffer("A".repeat(150)),

  /** Unicode content */
  UNICODE: createTypedstreamBuffer("Hello! Let's meet at cafe for coffee!"),

  /** Emoji content */
  EMOJI: createTypedstreamBuffer("Great job! Thumbs up! Party!"),

  /** CJK characters */
  CJK: createTypedstreamBuffer("Hello in Chinese, Japanese, and Korean"),

  /** Empty string (edge case) */
  EMPTY_STRING: createTypedstreamBuffer(""),

  /** Very short string */
  SHORT_STRING: createTypedstreamBuffer("Hi"),

  /** Only metadata (should filter to null) */
  ONLY_METADATA: createTypedstreamBuffer("__kIMMessagePartAttributeName"),

  /** kIM metadata without underscore */
  KIM_METADATA: createTypedstreamBuffer("kIMFileTransferGUID"),
};

/**
 * Metadata strings that should be filtered out during parsing
 */
export const METADATA_STRINGS = {
  /** NSKeyedArchiver internal markers */
  NSKEYED_ARCHIVER: [
    "$null",
    "NSMutableAttributedString",
    "NSAttributedString",
    "NSString",
    "NSObject",
    "NSDictionary",
    "NSArray",
    "NSData",
  ],

  /** iMessage-specific metadata keys */
  IMESSAGE_KEYS: [
    "__kIMMessagePartAttributeName",
    "__kIMBaseWritingDirectionAttributeName",
    "__kIMFilenameAttributeName",
    "kIMMessagePartAttributeName",
    "kIMFileTransferGUID",
    "kIMDataDetectedData",
    "kIMBalloonBundleID",
  ],

  /** Format markers */
  FORMAT_MARKERS: ["streamtyped", "NS.string", "NS.data"],

  /** Property accessors */
  PROPERTY_ACCESSORS: ["NS.bytes", "NS.objects", "NS.keys"],
};

/**
 * Sample bplist structures for testing (to be serialized with simple-plist)
 */
export const BPLIST_STRUCTURES = {
  /** Basic message in NSKeyedArchiver format */
  SIMPLE_MESSAGE: {
    $archiver: "NSKeyedArchiver",
    $version: 100000,
    $objects: [
      "$null",
      "Hello, this is a message from binary plist!",
      { $class: { "CF$UID": 3 } },
      { $classname: "NSMutableAttributedString" },
    ],
    $top: { root: { "CF$UID": 2 } },
  },

  /** Message with NS.string property */
  NS_STRING_PROPERTY: {
    $archiver: "NSKeyedArchiver",
    $objects: [
      "$null",
      { "NS.string": "Message from NS.string property" },
      { $class: { "CF$UID": 3 } },
    ],
  },

  /** Multiple string candidates (should pick longest) */
  MULTIPLE_STRINGS: {
    $archiver: "NSKeyedArchiver",
    $objects: [
      "$null",
      "short",
      "This is a longer message that should be selected",
      "__kIMMessagePartAttributeName",
    ],
  },

  /** Only metadata strings (should return null) */
  ONLY_METADATA: {
    $archiver: "NSKeyedArchiver",
    $objects: [
      "$null",
      "NSMutableAttributedString",
      "NSAttributedString",
      "__kIMMessagePartAttributeName",
    ],
  },

  /** Empty $objects array */
  EMPTY_OBJECTS: {
    $archiver: "NSKeyedArchiver",
    $objects: ["$null"],
  },

  /** Not an NSKeyedArchiver (should return null) */
  NOT_KEYED_ARCHIVER: {
    someKey: "someValue",
    anotherKey: 123,
  },

  /** Unicode content */
  UNICODE_MESSAGE: {
    $archiver: "NSKeyedArchiver",
    $objects: [
      "$null",
      "Hello! Let's meet at cafe - it'll be fun!",
    ],
  },

  /** CJK characters */
  CJK_MESSAGE: {
    $archiver: "NSKeyedArchiver",
    $objects: [
      "$null",
      "Chinese, Japanese, Korean greetings",
    ],
  },

  /** Contains streamtyped as text (not marker) */
  STREAMTYPED_AS_TEXT: {
    $archiver: "NSKeyedArchiver",
    $objects: [
      "$null",
      "streamtyped is just text content here, not a marker",
    ],
  },

  /** kIM metadata without underscore prefix */
  KIM_METADATA: {
    $archiver: "NSKeyedArchiver",
    $objects: [
      "$null",
      "kIMMessagePartAttributeName",
      "kIMFileTransferGUID",
      "This is the actual message",
    ],
  },

  /** Mixed kIM patterns */
  MIXED_KIM: {
    $archiver: "NSKeyedArchiver",
    $objects: [
      "$null",
      "__kIMMessagePartAttributeName",
      "kIMBalloonBundleID",
      "The real message content here",
    ],
  },

  /** kIM in middle of text (should NOT filter) */
  KIM_IN_MIDDLE: {
    $archiver: "NSKeyedArchiver",
    $objects: [
      "$null",
      "I love making kIM chi at home",
    ],
  },
};

/**
 * Edge case buffers for testing error handling
 */
export const EDGE_CASE_BUFFERS = {
  /** Empty buffer */
  EMPTY: Buffer.from(""),

  /** Very small buffer */
  TINY: Buffer.from("abc"),

  /** Random binary data */
  RANDOM_BINARY: Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02, 0x03]),

  /** Plain text (no markers) */
  PLAIN_TEXT: Buffer.from("Just plain text without any markers"),

  /** Invalid bplist (has magic bytes but malformed) */
  INVALID_BPLIST: Buffer.from("bplist00garbage data that is not valid"),

  /** Buffer with only null bytes */
  ALL_NULLS: Buffer.alloc(50),

  /** Buffer with control characters */
  CONTROL_CHARS: Buffer.from(
    "Hello\x00\x01\x02\x03World\x07\x08\x0b\x0cTest"
  ),

  /** Very large buffer (for performance testing) */
  LARGE: Buffer.from("A".repeat(50000)),
};

/**
 * Garbage pattern indicators (from test-data document)
 * These patterns indicate misinterpreted binary data
 */
export const GARBAGE_PATTERNS = {
  /** Chinese characters appearing in English messages */
  CJK_RANGE: /[\u4e00-\u9fff]/,

  /** Devanagari script (common garbage pattern) */
  DEVANAGARI: /\u0904/,

  /** Raw streamtyped marker in output */
  RAW_MARKER: /streamtyped/,

  /** bplist marker appearing in text */
  BPLIST_MARKER: /bplist00/,

  /** Common garbage prefix from test data */
  ORIYA_PREFIX: /\u0b04/, // Oriya script character (common in garbage)
};

/**
 * Validates that extracted text is not garbage
 *
 * @param text - Text to validate
 * @param expectEnglish - Whether the text should be primarily English
 * @returns True if text appears valid, false if garbage
 */
export function isValidExtractedText(
  text: string,
  expectEnglish: boolean = true
): boolean {
  // Empty or very short text might be valid
  if (!text || text.length < 3) {
    return true;
  }

  // Check for garbage patterns
  if (GARBAGE_PATTERNS.RAW_MARKER.test(text)) return false;
  if (GARBAGE_PATTERNS.BPLIST_MARKER.test(text)) return false;

  // For English messages, check for unexpected CJK
  if (expectEnglish) {
    // Allow some CJK if it's intentional (mixed content)
    // But flag if CJK is the majority or at the start
    const cjkMatch = text.match(GARBAGE_PATTERNS.CJK_RANGE);
    if (cjkMatch) {
      const cjkIndex = text.search(GARBAGE_PATTERNS.CJK_RANGE);
      // If CJK appears at the start, likely garbage
      if (cjkIndex === 0) return false;
    }

    // Check for Devanagari (almost always garbage in English)
    if (GARBAGE_PATTERNS.DEVANAGARI.test(text)) return false;

    // Check for Oriya (almost always garbage)
    if (GARBAGE_PATTERNS.ORIYA_PREFIX.test(text)) return false;
  }

  return true;
}

/**
 * Test message IDs from the test data document
 * These represent real-world messages with known issues
 */
export const TEST_MESSAGE_IDS = {
  /** Messages with garbage text pattern */
  GARBAGE_TEXT: [
    "137fcf4a-493b-4048-a84d-87fba1b22403", // macos-chat-2004
    "df350199-6efd-42ee-9f5a-775bdbf22578", // macos-chat-2742
    "06be30d6-f1c0-4123-ac78-b1e2c83d0954", // macos-chat-2344
  ],

  /** Messages with NULL thread_id (Eric bug) */
  NULL_THREAD_ID: [
    "0deecf46-3988-4829-bff3-c86c3e223eb1",
    "dd348263-1e8e-41a4-95fb-f178f4dc6602",
    "278c364f-2e44-4d74-b994-e0c5dc2dd84b",
  ],
};
