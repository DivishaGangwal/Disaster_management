// Polyfill globalThis.crypto.getRandomValues for Hermes / older Expo Go.
// Must be the VERY FIRST import so that @dsm/codec's newPacketId() etc. work.
import 'expo-crypto';
if (!globalThis.crypto) {
  const expoCrypto = require('expo-crypto');
  // @ts-ignore
  globalThis.crypto = {
    getRandomValues: (buf) => {
      const bytes = expoCrypto.getRandomBytes(buf.byteLength);
      buf.set(bytes);
      return buf;
    },
  };
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
