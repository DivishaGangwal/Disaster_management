/**
 * TIER 2 COMPACT FRAME
 *
 * Spec: 02-... "The previous 64-byte fixed-header proposal is a
 * maximum-oriented design, not an obligation to waste 64 bytes on every
 * ggwave message." T2-004: both receive paths must produce EQUIVALENT
 * canonical packet identities and payload meanings.
 *
 * So Tier 2 carries an ultra-compact frame that maps DETERMINISTICALLY back
 * into the same logical packet model:
 *
 *   [0]      magic 0xD2
 *   [1]      version (high nibble) | fragment count (low nibble)
 *   [2]      fragment index
 *   [3..4]   campaign id (16-bit compact handle)
 *   [5]      campaign version
 *   [6..7]   packet handle (16-bit; resolves to the full 16-byte packet ID
 *            through the campaign manifest)
 *   [8]      message type
 *   [9]      priority (high nibble) | severity (low nibble)
 *   [10..n]  payload slice
 *   [n+1..2] CRC-16 over bytes 0..n
 *
 * Overhead: 12 bytes, versus 64 for Tier 1. At ggwave bitrates that matters.
 */

import { TIER2 } from '@dsm/contracts';
import { crc32 } from '@dsm/codec';

export const TIER2_MAGIC = 0xd2;
export const TIER2_VERSION = 1;
export const TIER2_HEADER_BYTES = 10;
export const TIER2_CRC_BYTES = 2;
export const TIER2_OVERHEAD_BYTES = TIER2_HEADER_BYTES + TIER2_CRC_BYTES;

export interface Tier2Frame {
  readonly campaignHandle: number;
  readonly campaignVersion: number;
  readonly packetHandle: number;
  readonly messageType: number;
  readonly priority: number;
  readonly severity: number;
  readonly fragmentIndex: number;
  readonly fragmentCount: number;
  readonly payload: Uint8Array;
}

function crc16(bytes: Uint8Array, end: number): number {
  return crc32(bytes, 0, end) & 0xffff;
}

export function encodeTier2Frame(frame: Tier2Frame): Uint8Array {
  if (frame.fragmentCount > TIER2.MAX_FRAMES_PER_PACKET) {
    throw new RangeError(`fragment count ${frame.fragmentCount} exceeds ${TIER2.MAX_FRAMES_PER_PACKET}`);
  }
  const total = TIER2_OVERHEAD_BYTES + frame.payload.length;
  if (total > TIER2.MAX_FRAME_BYTES) {
    throw new RangeError(`frame of ${total}B exceeds the Tier 2 limit of ${TIER2.MAX_FRAME_BYTES}B`);
  }

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out[0] = TIER2_MAGIC;
  out[1] = ((TIER2_VERSION & 0x0f) << 4) | (frame.fragmentCount & 0x0f);
  out[2] = frame.fragmentIndex & 0xff;
  view.setUint16(3, frame.campaignHandle & 0xffff, false);
  out[5] = frame.campaignVersion & 0xff;
  view.setUint16(6, frame.packetHandle & 0xffff, false);
  out[8] = frame.messageType & 0xff;
  out[9] = ((frame.priority & 0x0f) << 4) | (frame.severity & 0x0f);
  out.set(frame.payload, TIER2_HEADER_BYTES);
  view.setUint16(TIER2_HEADER_BYTES + frame.payload.length, crc16(out, TIER2_HEADER_BYTES + frame.payload.length), false);
  return out;
}

export type Tier2DecodeResult =
  | { readonly ok: true; readonly frame: Tier2Frame }
  | { readonly ok: false; readonly reason: 'too-short' | 'bad-magic' | 'bad-version' | 'crc-failed' | 'over-limit' };

/**
 * T2-007: a frame that fails integrity is treated as ABSENT, not partially
 * usable. Nothing here can create partial application state.
 */
export function decodeTier2Frame(bytes: Uint8Array): Tier2DecodeResult {
  if (bytes.length < TIER2_OVERHEAD_BYTES) return { ok: false, reason: 'too-short' };
  if (bytes.length > TIER2.MAX_FRAME_BYTES) return { ok: false, reason: 'over-limit' };
  if (bytes[0] !== TIER2_MAGIC) return { ok: false, reason: 'bad-magic' };
  if (((bytes[1]! >> 4) & 0x0f) !== TIER2_VERSION) return { ok: false, reason: 'bad-version' };

  const payloadEnd = bytes.length - TIER2_CRC_BYTES;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(payloadEnd, false) !== crc16(bytes, payloadEnd)) {
    return { ok: false, reason: 'crc-failed' };
  }

  return {
    ok: true,
    frame: {
      fragmentCount: bytes[1]! & 0x0f,
      fragmentIndex: bytes[2]!,
      campaignHandle: view.getUint16(3, false),
      campaignVersion: bytes[5]!,
      packetHandle: view.getUint16(6, false),
      messageType: bytes[8]!,
      priority: (bytes[9]! >> 4) & 0x0f,
      severity: bytes[9]! & 0x0f,
      payload: bytes.slice(TIER2_HEADER_BYTES, payloadEnd),
    },
  };
}

/** Splits one canonical Tier 1 packet's payload into bounded Tier 2 frames. */
export function toTier2Frames(input: {
  readonly campaignHandle: number;
  readonly campaignVersion: number;
  readonly packetHandle: number;
  readonly messageType: number;
  readonly priority: number;
  readonly severity: number;
  readonly payload: Uint8Array;
}): readonly Uint8Array[] {
  const capacity = TIER2.MAX_FRAME_BYTES - TIER2_OVERHEAD_BYTES;
  const count = Math.max(1, Math.ceil(input.payload.length / capacity));
  if (count > TIER2.MAX_FRAMES_PER_PACKET) {
    throw new RangeError(`payload needs ${count} frames, over the ${TIER2.MAX_FRAMES_PER_PACKET} limit`);
  }
  const frames: Uint8Array[] = [];
  for (let i = 0; i < count; i += 1) {
    frames.push(
      encodeTier2Frame({
        campaignHandle: input.campaignHandle,
        campaignVersion: input.campaignVersion,
        packetHandle: input.packetHandle,
        messageType: input.messageType,
        priority: input.priority,
        severity: input.severity,
        fragmentIndex: i,
        fragmentCount: count,
        payload: input.payload.slice(i * capacity, (i + 1) * capacity),
      }),
    );
  }
  return frames;
}
