/**
 * Crypto polyfill for React Native / Hermes
 *
 * Only needed for crypto.getRandomValues (used by some libraries).
 * Our encryption/HMAC uses node-forge which is pure JS.
 */

import * as ExpoCrypto from 'expo-crypto';

if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error - polyfilling
  globalThis.crypto = {};
}

if (typeof globalThis.crypto.getRandomValues === 'undefined') {
  globalThis.crypto.getRandomValues = function <T extends ArrayBufferView>(array: T): T {
    const bytes = ExpoCrypto.getRandomBytes(array.byteLength);
    const target = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    target.set(bytes);
    return array;
  };
}
