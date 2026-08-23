/**
 * Bundles the real @dsm packages into engine.js for the browser.
 *
 * The simulator does NOT reimplement the protocol: it runs this bundle, which
 * is the same compiled output the Node tests and the backend run. The only
 * substitution is `node:crypto`, replaced by bundler/shim-crypto.mjs.
 *
 * Run:  npm run simulator          (after `npm run build`)
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// tools/mesh-simulator -> repo root
const REPO = join(here, '..', '..');

// esbuild lives in the repo's node_modules, not next to this file.
const { build } = await import(pathToFileURL(join(REPO, 'node_modules/esbuild/lib/main.js')).href);

// --- 1. Prove the crypto shim agrees with Node before shipping it -----------
const shim = await import(pathToFileURL(join(here, 'bundler/shim-crypto.mjs')).href);
const vectors = [
  new Uint8Array(0),
  new TextEncoder().encode('abc'),
  new TextEncoder().encode('a'.repeat(55)),
  new TextEncoder().encode('a'.repeat(56)),
  new TextEncoder().encode('a'.repeat(64)),
  new TextEncoder().encode('the quick brown fox jumps over the lazy dog, twice, at length'.repeat(9)),
  Uint8Array.from({ length: 1000 }, (_, i) => (i * 37) & 0xff),
];
for (const v of vectors) {
  const expected = createHash('sha256').update(v).digest('hex');
  const actual = shim.createHash('sha256').update(v).digest('hex');
  if (expected !== actual) {
    throw new Error(`crypto shim mismatch for ${v.length}B input:\n  node ${expected}\n  shim ${actual}`);
  }
}
console.log('crypto shim matches node:crypto on ' + vectors.length + ' vectors');

// --- 2. Bundle --------------------------------------------------------------
const nodeCryptoShim = {
  name: 'node-crypto-shim',
  setup(b) {
    b.onResolve({ filter: /^node:crypto$/ }, () => ({ path: join(here, 'bundler/shim-crypto.mjs') }));
  },
};

const result = await build({
  entryPoints: [join(here, 'bundler/entry.mjs')],
  bundle: true,
  format: 'iife',
  target: ['es2022'],
  platform: 'browser',
  absWorkingDir: REPO,
  nodePaths: [join(REPO, 'node_modules')],
  plugins: [nodeCryptoShim],
  legalComments: 'none',
  write: false,
  banner: { js: '/* Disaster SOS Mesh engine — the real @dsm packages, bundled for the browser. */' },
});

const js = result.outputFiles[0].text;
writeFileSync(join(here, 'engine.js'), js);
console.log('wrote engine.js', (js.length / 1024).toFixed(0) + ' KB');

// --- 3. Smoke-test the bundle in this process -------------------------------
const globalThisShim = { crypto: (await import('node:crypto')).webcrypto };
const fn = new Function('globalThis', 'window', js + '\nreturn globalThis.DSM;');
const DSM = fn(globalThisShim, globalThisShim);
const { buildSosCreate, decodePacket, toEpochS } = DSM.codec;
const { SourceClass, Severity, EmergencyCategory, Mobility, LocationSource, ReplyCapability } = DSM.contracts;
const p = buildSosCreate(
  { sourceId: '1111111111111111', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(Date.now()) },
  {
    incidentId: 'SMOKE-1', category: EmergencyCategory.TRAPPED, severity: Severity.LIFE_CRITICAL,
    peopleTotal: 2, mobility: Mobility.IMMOBILE,
    location: { source: LocationSource.FRESH_GNSS, latE7: 285355000, lonE7: 771234000, accuracyM: 10, ageS: 5 },
    replyCapabilities: ReplyCapability.TIER1_BLE,
  },
);
const decoded = decodePacket(p.bytes);
if (!decoded.ok) throw new Error('bundled codec failed to round-trip: ' + decoded.reason);
console.log('bundle smoke test ok —', p.totalBytes + 'B packet, decoded as', decoded.packet.streamId);
