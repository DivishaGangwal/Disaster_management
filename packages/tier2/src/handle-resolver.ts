/**
 * Resolves compact Tier 2 handles back to canonical Tier 1 packets.
 *
 * T2-004: "Both receive paths must produce equivalent canonical packet
 * identities and payload meanings."
 *
 * The manifest carries the full Tier 1 header for each packet, so the receiver
 * can rebuild byte-identical canonical packets from a compact radio payload.
 * That is what makes the cross-tier bridge (T2-011) safe: the packet relayed
 * onward over Bluetooth IS the original packet, not a re-derived lookalike.
 */

import { ENVELOPE, type CampaignManifest, type PacketId } from '@dsm/contracts';
import type { CampaignHandleResolver } from './receiver.js';

export class ManifestHandleResolver implements CampaignHandleResolver {
  readonly campaignId: string;
  readonly campaignVersion: number;

  private readonly byHandle = new Map<number, { packetId: PacketId; canonical: Uint8Array }>();

  constructor(
    manifest: CampaignManifest,
    readonly campaignHandle: number,
  ) {
    this.campaignId = manifest.campaignId;
    this.campaignVersion = manifest.campaignVersion;
    manifest.items.forEach((item, index) => {
      this.byHandle.set(index + 1, { packetId: item.packetId, canonical: item.bytes });
    });
  }

  resolvePacketId(handle: number): PacketId | undefined {
    return this.byHandle.get(handle)?.packetId;
  }

  expectedPacketIds(): readonly PacketId[] {
    return [...this.byHandle.values()].map((entry) => entry.packetId);
  }

  /**
   * Rebuilds canonical Tier 1 bytes: the manifest's 64-byte header plus the
   * payload recovered from the air. If the recovered payload does not match
   * the manifest's payload length, we refuse rather than fabricate.
   */
  rebuildPacketBytes(handle: number, payload: Uint8Array): Uint8Array | undefined {
    const entry = this.byHandle.get(handle);
    if (!entry) return undefined;

    const header = entry.canonical.subarray(0, ENVELOPE.HEADER_BYTES);
    const expectedPayloadLength = entry.canonical.length - ENVELOPE.HEADER_BYTES;
    if (payload.length !== expectedPayloadLength) return undefined;

    const out = new Uint8Array(ENVELOPE.HEADER_BYTES + payload.length);
    out.set(header, 0);
    out.set(payload, ENVELOPE.HEADER_BYTES);
    return out;
  }
}
