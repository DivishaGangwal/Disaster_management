// Metro alias target for `node:crypto` / `crypto` (see metro.config.js).
//
// React Native/Hermes has no Node crypto module. @dsm/codec's compiled
// output imports it directly (createHash, randomBytes) for header/payload
// digests and rotating IDs. This reimplements only the narrow chainable
// subset it actually calls, using a pure-JS hash (no native module needed)
// and Expo's synchronous secure random-byte generator.

import { sha256 } from '@noble/hashes/sha2.js';
import { getRandomBytes } from 'expo-crypto';

class Sha256Hash {
  constructor() {
    this._chunks = [];
  }

  update(data) {
    this._chunks.push(typeof data === 'string' ? new TextEncoder().encode(data) : data);
    return this;
  }

  digest(encoding) {
    const total = this._chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this._chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    const hash = sha256(merged);
    if (encoding === 'hex') {
      let out = '';
      for (const byte of hash) out += byte.toString(16).padStart(2, '0');
      return out;
    }
    return hash;
  }
}

export function createHash(algorithm) {
  if (algorithm !== 'sha256') {
    throw new Error(`node:crypto shim only supports sha256, got "${algorithm}"`);
  }
  return new Sha256Hash();
}

export function randomBytes(size) {
  return getRandomBytes(size);
}
