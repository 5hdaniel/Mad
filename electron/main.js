/**
 * Development loader for TypeScript main process
 * This file loads main.ts using ts-node in development
 * For production, use the compiled version in dist-electron/
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
  }
});

require('./main.ts');
