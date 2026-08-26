/**
 * Deterministic compact value encoding for typed payloads.
 *
 * Spec: 02-... "Packet codec" -- "returns a deterministic bounded binary
 * envelope"; "It owns canonical field ordering, numeric representations,
 * maximums, and payload checksums."
 *
 * Determinism rule: fields are always emitted in ASCENDING numeric key order,
 * and absent/undefined fields are omitted. The same logical payload therefore
 * always produces the same bytes -- which is what makes packet IDs and digests
 * comparable across devices.
 */

import { ByteReader, ByteWriter } from './varint.js';
import { NESTED_FIELD_MAPS, reverseFieldMap, type FieldMap } from './field-maps.js';

const TAG = {
  UINT: 0,
  NINT: 1,
  BYTES: 2,
  TEXT: 3,
  FALSE: 4,
  TRUE: 5,
  ARRAY: 6,
  MAP: 7,
  STRING_MAP: 8,
} as const;

const MAX_DYNAMIC_MAP_ITEMS = 32;
const MAX_DYNAMIC_KEY_BYTES = 64;
const DYNAMIC_MAP_FIELDS = new Set(['fields']);

export interface EncodeLimits {
  readonly maxBytes: number;
  readonly maxTextBytes: number;
  readonly maxArrayItems: number;
  readonly maxDepth: number;
}

export const DEFAULT_LIMITS: EncodeLimits = {
  maxBytes: 4096,
  maxTextBytes: 512,
  maxArrayItems: 64,
  maxDepth: 4,
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

type Encodable = number | string | boolean | Uint8Array | readonly unknown[] | Readonly<Record<string, unknown>>;

function writeValue(w: ByteWriter, value: Encodable, limits: EncodeLimits, depth: number, nestedMap?: FieldMap, dynamicMap = false): void {
  if (depth > limits.maxDepth) throw new RangeError('payload nesting exceeds maxDepth');

  if (typeof value === 'boolean') {
    w.u8(value ? TAG.TRUE : TAG.FALSE);
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new TypeError('only integers may be encoded; scale floats (use E7)');
    if (value >= 0) {
      w.u8(TAG.UINT);
      w.uvarint(value);
    } else {
      w.u8(TAG.NINT);
      w.uvarint(-1 - value);
    }
    return;
  }
  if (typeof value === 'string') {
    const bytes = textEncoder.encode(value);
    if (bytes.length > limits.maxTextBytes) {
      throw new RangeError(`text field of ${bytes.length} bytes exceeds ${limits.maxTextBytes}`);
    }
    w.u8(TAG.TEXT);
    w.uvarint(bytes.length);
    w.bytes(bytes);
    return;
  }
  if (value instanceof Uint8Array) {
    if (value.length > limits.maxBytes) throw new RangeError('byte field exceeds maxBytes');
    w.u8(TAG.BYTES);
    w.uvarint(value.length);
    w.bytes(value);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayItems) throw new RangeError('array exceeds maxArrayItems');
    w.u8(TAG.ARRAY);
    w.uvarint(value.length);
    for (const item of value) writeValue(w, item as Encodable, limits, depth + 1, nestedMap);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    if (dynamicMap) {
      writeDynamicMap(w, value as Record<string, unknown>, limits, depth + 1);
      return;
    }
    if (!nestedMap) {
      // FAIL CLOSED. Previously this wrote an empty map and silently dropped
      // every field -- which is how the entire GEO extension went missing.
      throw new Error(
        'nested object has no registered field map; add it to NESTED_FIELD_MAPS before encoding',
      );
    }
    w.u8(TAG.MAP);
    writeFieldsBody(w, value as Record<string, unknown>, nestedMap, limits, depth + 1);
    return;
  }
  throw new TypeError(`unsupported payload value type: ${typeof value}`);
}

function writeDynamicMap(w: ByteWriter, source: Record<string, unknown>, limits: EncodeLimits, depth: number): void {
  const entries = Object.entries(source).filter((entry) => entry[1] !== undefined && entry[1] !== null);
  if (entries.length > MAX_DYNAMIC_MAP_ITEMS) throw new RangeError('dynamic map exceeds item limit');
  entries.sort(([left], [right]) => left.localeCompare(right, 'en'));
  w.u8(TAG.STRING_MAP);
  w.uvarint(entries.length);
  for (const [key, value] of entries) {
    const keyBytes = textEncoder.encode(key);
    if (keyBytes.length === 0 || keyBytes.length > MAX_DYNAMIC_KEY_BYTES) throw new RangeError('dynamic map key exceeds byte limit');
    w.uvarint(keyBytes.length);
    w.bytes(keyBytes);
    if (typeof value === 'object' && value !== null && !(value instanceof Uint8Array) && !Array.isArray(value)) {
      throw new TypeError('dynamic map values must be bounded scalars, bytes, or scalar arrays');
    }
    writeValue(w, value as Encodable, limits, depth);
  }
}

function writeFieldsBody(
  w: ByteWriter,
  source: Record<string, unknown>,
  map: FieldMap | undefined,
  limits: EncodeLimits,
  depth: number,
): void {
  const entries: { key: number; name: string; value: Encodable }[] = [];
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue;
    const key = map?.[name];
    if (key === undefined) {
      throw new Error(`field "${name}" has no wire key in its field map`);
    }
    entries.push({ key, name, value: value as Encodable });
  }
  // Canonical ordering: ascending wire key. This is what makes bytes deterministic.
  entries.sort((a, b) => a.key - b.key);
  w.uvarint(entries.length);
  for (const entry of entries) {
    w.uvarint(entry.key);
    writeValue(w, entry.value, limits, depth, NESTED_FIELD_MAPS[entry.name], DYNAMIC_MAP_FIELDS.has(entry.name));
  }
}

/** Encode a payload object using its message-type field map. */
export function encodeFields(
  payload: Readonly<Record<string, unknown>>,
  map: FieldMap,
  limits: EncodeLimits = DEFAULT_LIMITS,
): Uint8Array {
  const w = new ByteWriter(256);
  writeFieldsBody(w, payload as Record<string, unknown>, map, limits, 0);
  const out = w.toUint8Array();
  if (out.length > limits.maxBytes) {
    throw new RangeError(`encoded payload ${out.length}B exceeds limit ${limits.maxBytes}B`);
  }
  return out;
}

function readValue(r: ByteReader, limits: EncodeLimits, depth: number, nestedMap?: FieldMap): unknown {
  if (depth > limits.maxDepth) throw new RangeError('payload nesting exceeds maxDepth');
  const tag = r.u8();
  switch (tag) {
    case TAG.UINT:
      return r.uvarint();
    case TAG.NINT:
      return -1 - r.uvarint();
    case TAG.BYTES: {
      const len = r.uvarint();
      return r.bytes(len, limits.maxBytes);
    }
    case TAG.TEXT: {
      const len = r.uvarint();
      return textDecoder.decode(r.bytes(len, limits.maxTextBytes));
    }
    case TAG.FALSE:
      return false;
    case TAG.TRUE:
      return true;
    case TAG.ARRAY: {
      const count = r.uvarint();
      if (count > limits.maxArrayItems) throw new RangeError('array count exceeds maxArrayItems');
      const out: unknown[] = [];
      for (let i = 0; i < count; i += 1) out.push(readValue(r, limits, depth + 1, nestedMap));
      return out;
    }
    case TAG.MAP:
      return readFieldsBody(r, nestedMap, limits, depth + 1);
    case TAG.STRING_MAP:
      return readDynamicMap(r, limits, depth + 1);
    default:
      throw new RangeError(`unknown value tag ${tag}`);
  }
}

function readDynamicMap(r: ByteReader, limits: EncodeLimits, depth: number): Record<string, unknown> {
  const count = r.uvarint();
  if (count > MAX_DYNAMIC_MAP_ITEMS) throw new RangeError('dynamic map count exceeds item limit');
  const out: Record<string, unknown> = {};
  let previous = '';
  for (let i = 0; i < count; i += 1) {
    const length = r.uvarint();
    if (length === 0 || length > MAX_DYNAMIC_KEY_BYTES) throw new RangeError('dynamic map key exceeds byte limit');
    const key = textDecoder.decode(r.bytes(length, MAX_DYNAMIC_KEY_BYTES));
    if (i > 0 && key.localeCompare(previous, 'en') <= 0) throw new RangeError('dynamic map keys are not canonical');
    previous = key;
    out[key] = readValue(r, limits, depth);
  }
  return out;
}

function readFieldsBody(
  r: ByteReader,
  map: FieldMap | undefined,
  limits: EncodeLimits,
  depth: number,
): Record<string, unknown> {
  const count = r.uvarint();
  if (count > 64) throw new RangeError('field count exceeds hard limit');
  const reverse = map ? reverseFieldMap(map) : undefined;
  const out: Record<string, unknown> = {};
  for (let i = 0; i < count; i += 1) {
    const key = r.uvarint();
    const name = reverse?.get(key);
    // Unknown keys are skipped safely: forward compatibility, not a crash.
    const value = readValue(r, limits, depth, name ? NESTED_FIELD_MAPS[name] : undefined);
    if (name !== undefined) out[name] = value;
  }
  return out;
}

export function decodeFields(
  bytes: Uint8Array,
  map: FieldMap,
  limits: EncodeLimits = DEFAULT_LIMITS,
): Record<string, unknown> {
  if (bytes.length > limits.maxBytes) throw new RangeError('payload exceeds maxBytes before decode');
  const r = new ByteReader(bytes);
  const out = readFieldsBody(r, map, limits, 0);
  return out;
}
