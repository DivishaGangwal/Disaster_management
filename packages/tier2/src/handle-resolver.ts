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

import { type CampaignManifest, type PacketId } from '@dsm/contracts';
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

  /** Acoustic input already contains canonical bytes; the manifest verifies it. */
  verifyPacketBytes(handle: number, canonicalBytes: Uint8Array): boolean {
    const entry = this.byHandle.get(handle);
    if (!entry || canonicalBytes.length !== entry.canonical.length) return false;
    return canonicalBytes.every((byte, index) => byte === entry.canonical[index]);
  }
}
