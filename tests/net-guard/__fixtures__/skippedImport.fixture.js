/** BACKLOG-3284 RED-BY-DESIGN fixture: module-scope call, every test skipped.
 *  No hook runs at all — only the globalTeardown backstop. */
const axios = require('axios');
axios.get('https://example.invalid/skipped').catch(() => {});
test.skip('RED-BY-DESIGN: skipped', () => { expect(1).toBe(1); });
