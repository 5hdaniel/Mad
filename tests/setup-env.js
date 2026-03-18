// Pre-environment setup: polyfill TextEncoder/TextDecoder for jsdom + JSDOM compatibility
// Required because pdfExportService imports JSDOM (via DOMPurify), which depends on
// whatwg-url, which requires TextEncoder at module load time.
// See: PR #1255 (TASK-2230), CI failure on Windows + macOS Node 20.
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}
