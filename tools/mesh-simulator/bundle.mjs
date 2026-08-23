/**
 * Inlines engine.js and sim.js into index.html and writes mesh-simulator.html:
 * one self-contained file you can email, host, or open from a USB stick.
 *
 * Run:  node build-engine.mjs && node bundle.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let html = readFileSync(join(here, 'index.html'), 'utf8');

for (const name of ['engine.js', 'sim.js']) {
  const tag = `<script src="${name}"></script>`;
  if (!html.includes(tag)) throw new Error(`${tag} not found in index.html`);
  html = html.replace(tag, '<script>\n' + readFileSync(join(here, name), 'utf8') + '\n</script>');
}

writeFileSync(join(here, 'mesh-simulator.html'), html);
console.log('wrote mesh-simulator.html', (html.length / 1024).toFixed(0) + ' KB');
