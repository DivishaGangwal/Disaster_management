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
} as const;

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

function writeValue(w: ByteWriter, value: Encodable, limits: EncodeLimits, depth: number, nestedMap?: FieldMap): void {
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
    w.u8(TAG.MAP);
    writeFieldsBody(w, value as Record<string, unknown>, nestedMap, limits, depth + 1);
    return;
  }
  throw new TypeError(`unsupported payload value type: ${typeof value}`);
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
      if (map) throw new Error(`field "${name}" has no wire key in its field map`);
      continue;
    }
    entries.push({ key, name, value: value as Encodable });
  }
  // Canonical ordering: ascending wire key. This is what makes bytes deterministic.
  entries.sort((a, b) => a.key - b.key);
  w.uvarint(entries.length);
  for (const entry of entries) {
    w.uvarint(entry.key);
    writeValue(w, entry.value, limits, depth, NESTED_FIELD_MAPS[entry.name]);
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
    default:
      throw new RangeError(`unknown value tag ${tag}`);
  }
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
