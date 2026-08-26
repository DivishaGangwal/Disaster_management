// crypto-polyfill.js
// Must be imported FIRST before any library that uses crypto.getRandomValues.
// React Native / Hermes does not expose the Web Crypto API, so we shim it
// using expo-crypto's synchronous getRandomBytes.
import { getRandomBytes } from 'expo-crypto';

if (typeof global.crypto === 'undefined' || global.crypto === null) {
  global.crypto = {};
}

if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = function getRandomValues(array) {
    const bytes = getRandomBytes(array.byteLength);
    const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < bytes.length; i++) {
      view[i] = bytes[i];
    }
    return array;
  };
}
