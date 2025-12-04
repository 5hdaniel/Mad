/**
 * Development loader that redirects to compiled version
 * The TypeScript source is compiled to dist-electron/ by tsc
 */

// Load the compiled version
require('../dist-electron/main.js');
