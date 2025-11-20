/**
 * Development loader for TypeScript preload script
 * This file loads preload.ts using ts-node in development
 * For production, use the compiled version in dist-electron/
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
  }
});

require('./preload.ts');
