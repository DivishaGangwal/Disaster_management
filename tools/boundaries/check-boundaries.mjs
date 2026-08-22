#!/usr/bin/env node
/**
 * MODULE BOUNDARY CHECK
 *
 * Run: npm run boundaries
 *
 * Modularity that is only written down in a README decays in a week. This
 * script makes the architecture invariants mechanical, so six people and
 * several agents can work in parallel without silently coupling things.
 *
 * It enforces:
 *  1. The dependency graph (a package may only import from its allowed list).
 *  2. @dsm/contracts stays dependency-free.
 *  3. No transport/platform detail leaks into domain, map, incident, or policy.
 *  4. Nobody re-declares a message code, limit, or reason string locally.
 *  5. No forbidden claim words ("verified", "guaranteed") in user-facing copy.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** Allowed @dsm/* imports per package. Anything else is an error. */
const ALLOWED = {
  contracts: [],
  codec: ['contracts'],
  validator: ['contracts', 'codec'],
  store: ['contracts'],
  policy: ['contracts', 'codec'],
  incident: ['contracts'],
  mapkit: ['contracts'],
  routing: ['contracts', 'codec', 'store'],
  'transport-core': ['contracts'],
  tier2: ['contracts', 'codec'],
  'gateway-client': ['contracts', 'codec'],
  'node-runtime': [
    'contracts',
    'codec',
    'validator',
    'store',
    'policy',
    'incident',
    'mapkit',
    'routing',
    'transport-core',
    'tier2',
    'gateway-client',
  ],
  simulator: [
    'contracts',
    'codec',
    'validator',
    'store',
    'policy',
    'incident',
    'mapkit',
    'routing',
    'transport-core',
    'tier2',
    'gateway-client',
    'node-runtime',
  ],
  seed: ['contracts', 'codec', 'mapkit'],
};

/**
 * Packages that model the PRODUCT must not know about the RADIO.
 * 02-...: "Bluetooth details must not leak into the map, incident, or UI models."
 */
const DOMAIN_PACKAGES = ['incident', 'mapkit', 'policy', 'store'];
const PLATFORM_TERMS = [
  'react-native',
  'expo-',
  'BluetoothAdapter',
  'BluetoothGatt',
  'BluetoothLeScanner',
  'navigator.bluetooth',
  'ggwave',
  'AudioRecord',
];

/** Only @dsm/contracts may declare these. Everyone else imports them. */
const SINGLE_SOURCE_PATTERNS = [
  { name: 'message type registry', re: /\bSOS_CREATE\s*:\s*0x/ },
  { name: 'protocol magic', re: /PROTOCOL_MAGIC\s*=\s*0x/ },
  { name: 'copy budget table', re: /\bCLASS_BUDGETS\s*=\s*\{/ },
];

const errors = [];
const warnings = [];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function packageNameFor(file) {
  const rel = relative(ROOT, file).split(sep);
  if (rel[0] === 'packages') return rel[1];
  if (rel[0] === 'tools') return rel[1];
  return null;
}

// --- 1 + 2: dependency graph and contracts purity ---------------------------
for (const dir of ['packages', 'tools']) {
  for (const file of walk(join(ROOT, dir))) {
    const pkg = packageNameFor(file);
    if (!pkg || !(pkg in ALLOWED)) continue;
    const source = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);

    for (const match of source.matchAll(/from\s+'@dsm\/([a-z-]+)'/g)) {
      const target = match[1];
      if (target === pkg) continue;
      if (!ALLOWED[pkg].includes(target)) {
        errors.push(
          `${rel}: @dsm/${pkg} may not import @dsm/${target}. ` +
            `Allowed: ${ALLOWED[pkg].join(', ') || '(nothing)'}.`,
        );
      }
    }

    if (pkg === 'contracts' && /from\s+'(?!\.)/.test(source)) {
      const external = [...source.matchAll(/from\s+'([^.'][^']*)'/g)].map((m) => m[1]);
      const nonType = external.filter((m) => !m.startsWith('node:'));
      if (nonType.length > 0) {
        errors.push(`${rel}: @dsm/contracts must stay dependency-free, found: ${nonType.join(', ')}`);
      }
    }
  }
}

// --- 3: no platform detail in domain packages -------------------------------
for (const pkg of DOMAIN_PACKAGES) {
  for (const file of walk(join(ROOT, 'packages', pkg))) {
    const source = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);
    for (const term of PLATFORM_TERMS) {
      // Ignore comments: the specs are quoted there deliberately.
      const codeOnly = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      if (codeOnly.includes(term)) {
        errors.push(`${rel}: platform detail "${term}" leaked into the domain package @dsm/${pkg}.`);
      }
    }
  }
}

// --- 4: single source of truth ----------------------------------------------
for (const dir of ['packages', 'tools', 'apps']) {
  for (const file of walk(join(ROOT, dir))) {
    const pkg = packageNameFor(file);
    if (pkg === 'contracts') continue;
    const source = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);
    for (const { name, re } of SINGLE_SOURCE_PATTERNS) {
      if (re.test(source)) {
        errors.push(`${rel}: re-declares the ${name}. Import it from @dsm/contracts instead.`);
      }
    }
  }
}

// --- 5: forbidden claims in user-facing copy --------------------------------
// 01-...: the UI must not use "verified" for demo role provisioning, and must
// not promise guaranteed delivery or range.
const CLAIM_FILES = [
  join(ROOT, 'packages', 'contracts', 'src', 'profile.ts'),
  join(ROOT, 'packages', 'validator', 'src', 'index.ts'),
];
for (const file of CLAIM_FILES) {
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const rel = relative(ROOT, file);
  for (const match of source.matchAll(/^\s*(?:'[^']*'|\w[\w-]*):\s*'([^']+)',/gm)) {
    const copy = match[1].toLowerCase();
    if (/\bverified\b/.test(copy)) {
      errors.push(`${rel}: user-facing copy "${match[1]}" says "verified" (INT-004 forbids it).`);
    }
    if (/\bguaranteed\b/.test(copy)) {
      errors.push(`${rel}: user-facing copy "${match[1]}" claims a guarantee.`);
    }
    if (/help is coming/.test(copy)) {
      errors.push(`${rel}: user-facing copy "${match[1]}" reads a relay copy as rescue progress (DEC-022).`);
    }
  }
}

// --- report ------------------------------------------------------------------
for (const warning of warnings) process.stdout.write(`warn  ${warning}\n`);

if (errors.length > 0) {
  process.stderr.write(`\nModule boundary check FAILED with ${errors.length} problem(s):\n\n`);
  for (const error of errors) process.stderr.write(`  x ${error}\n`);
  process.stderr.write('\nSee docs/MODULE-BOUNDARIES.md for why each rule exists.\n');
  process.exit(1);
}

process.stdout.write('Module boundary check passed: dependency graph, contracts purity,\n');
process.stdout.write('domain isolation, single-source registries, and truthful copy all hold.\n');
