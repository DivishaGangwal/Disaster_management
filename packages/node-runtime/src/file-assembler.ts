/**
 * FILE ASSEMBLER  --  turns fragments into a verified, visible object.
 *
 * Spec: FIL-001..FIL-007; 02-... "File and image rules".
 *
 * Before this existed the store accepted fragments that could never become a
 * file: `listFragments()` returned pieces and nothing assembled them.
 *
 * The rules it enforces, in order:
 *  - FIL-006  refuse executables and archives at MANIFEST time, before a
 *             single fragment is stored
 *  - FIL-007  refuse anything over the one configured maximum (128 KB)
 *  - FIL-003  fragments stay invisible while incomplete
 *  - FIL-004  the whole-object digest must match BEFORE anything is visible
 *  - FIL-005  `missingFragments()` drives resume after an interruption
 *
 * HACKATHON DECISIONS (documented in docs/DECISIONS-HACKATHON.md):
 *  - assembled bytes live in memory, not on the filesystem
 *  - nothing is ever decompressed, which is how "no unbounded decompression"
 *    is satisfied: archives are simply refused
 *  - a refused or failed object is dropped whole; no partial state survives
 */

import {
  EventCategory,
  MessageType,
  ACCEPTED_MIME_CATEGORIES,
  STORAGE,
  type AssembledFile,
  type EventSink,
  type FileRepository,
  type Packet,
  type PacketRepository,
} from '@dsm/contracts';
import { sha256Hex } from '@dsm/codec';

export type AssemblyOutcome =
  | { readonly kind: 'manifest-accepted'; readonly fileId: string; readonly expecting: number }
  | { readonly kind: 'manifest-refused'; readonly fileId: string; readonly reason: string }
  | { readonly kind: 'fragment-stored'; readonly fileId: string; readonly held: number; readonly missing: number }
  | { readonly kind: 'fragment-orphaned'; readonly fileId: string }
  | { readonly kind: 'completed'; readonly fileId: string; readonly bytes: number }
  | { readonly kind: 'integrity-failed'; readonly fileId: string; readonly reason: string }
  | { readonly kind: 'ignored' };

export class FileAssembler {
  constructor(
    private readonly files: FileRepository,
    private readonly packets: PacketRepository,
    private readonly events: EventSink,
  ) {}

  /** Called for every accepted FILE_MANIFEST / FILE_FRAGMENT packet. */
  async accept(packet: Packet, nowS: number, atMs: number): Promise<AssemblyOutcome> {
    if (packet.header.type === MessageType.FILE_MANIFEST) return this.acceptManifest(packet, nowS, atMs);
    if (packet.header.type === MessageType.FILE_FRAGMENT) return this.acceptFragment(packet, atMs);
    return { kind: 'ignored' };
  }

  private async acceptManifest(packet: Packet, nowS: number, atMs: number): Promise<AssemblyOutcome> {
    const p = packet.payload as Record<string, unknown>;
    const fileId = String(p['fileId'] ?? '');
    const mimeCategory = Number(p['mimeCategory'] ?? -1);
    const totalBytes = Number(p['totalBytes'] ?? 0);
    const fragmentCount = Number(p['fragmentCount'] ?? 0);
    const expectedDigest = String(p['digest'] ?? '');

    // FIL-006, checked FIRST so a hostile object never causes fragment work.
    // ALLOW-LIST: text only. Images, audio, executables and archives are all
    // refused, and the prototype has no decoder or decompressor for any of
    // them, so the capability does not exist to be abused.
    if (!ACCEPTED_MIME_CATEGORIES.has(mimeCategory)) {
      return this.refuse(fileId, `content category ${mimeCategory} is not accepted (text only)`, atMs);
    }
    if (totalBytes > STORAGE.MAX_FILE_BYTES) {
      return this.refuse(fileId, `${totalBytes}B over the ${STORAGE.MAX_FILE_BYTES}B demo maximum`, atMs);
    }
    if (!expectedDigest) {
      return this.refuse(fileId, 'manifest carries no whole-object digest', atMs);
    }

    const record: AssembledFile = {
      fileId,
      mimeCategory,
      purposeCode: Number(p['purposeCode'] ?? 0),
      totalBytes,
      fragmentCount,
      expectedDigest,
      visible: false,
      ...(typeof p['linkedIncidentId'] === 'string' ? { linkedIncidentId: p['linkedIncidentId'] } : {}),
      expiresAtS: packet.header.expiresAt,
    };

    if (!(await this.files.putManifest(record))) {
      return this.refuse(fileId, 'store refused the manifest (bounds or object limit)', atMs);
    }

    this.events.emit({
      category: EventCategory.FILE,
      name: 'manifest-accepted',
      severity: 'info',
      atMs,
      packetId: packet.header.packetId,
      metrics: { fragmentCount, totalBytes },
    });

    // Fragments may have arrived before the manifest did.
    const outcome = await this.tryComplete(fileId, atMs);
    return outcome ?? { kind: 'manifest-accepted', fileId, expecting: fragmentCount };
  }

  private async acceptFragment(packet: Packet, atMs: number): Promise<AssemblyOutcome> {
    const p = packet.payload as Record<string, unknown>;
    const fileId = String(p['fileId'] ?? '');
    const index = Number(p['fragmentIndex'] ?? -1);
    const data = p['data'];
    if (!(data instanceof Uint8Array) || index < 0) return { kind: 'ignored' };

    const manifest = await this.files.getManifest(fileId);
    if (!manifest) {
      // FIL-006: unrequested content. Without a manifest we have no declared
      // size, count or digest, so there is nothing to bound this against.
      this.events.emit({
        category: EventCategory.FILE,
        name: 'fragment-orphaned',
        severity: 'warn',
        atMs,
        packetId: packet.header.packetId,
        reason: 'no manifest for this object',
      });
      return { kind: 'fragment-orphaned', fileId };
    }
    if (index >= manifest.fragmentCount) return { kind: 'fragment-orphaned', fileId };

    await this.packets.putFragment({
      objectId: fileId,
      index,
      digest: String(p['fragmentDigest'] ?? ''),
      bytes: data,
      receivedAtMs: atMs,
    });

    const completed = await this.tryComplete(fileId, atMs);
    if (completed) return completed;

    const held = (await this.packets.listFragments(fileId)).length;
    return { kind: 'fragment-stored', fileId, held, missing: manifest.fragmentCount - held };
  }

  /** Assembles and verifies once every fragment is present. */
  private async tryComplete(fileId: string, atMs: number): Promise<AssemblyOutcome | undefined> {
    const manifest = await this.files.getManifest(fileId);
    if (!manifest || manifest.visible) return undefined;

    const fragments = await this.packets.listFragments(fileId);
    if (fragments.length < manifest.fragmentCount) return undefined;

    let total = 0;
    for (const fragment of fragments) total += fragment.bytes.length;
    if (total > STORAGE.MAX_REASSEMBLY_BYTES) {
      await this.discard(fileId);
      return this.fail(fileId, 'reassembled size over the bound', atMs);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (let i = 0; i < manifest.fragmentCount; i += 1) {
      const fragment = fragments.find((f) => f.index === i);
      if (!fragment) return undefined; // a gap: still incomplete
      bytes.set(fragment.bytes, offset);
      offset += fragment.bytes.length;
    }

    // FIL-004: integrity BEFORE visibility. A mismatch drops the whole object
    // rather than leaving partial state behind.
    const digest = sha256Hex(bytes);
    if (digest !== manifest.expectedDigest) {
      await this.discard(fileId);
      return this.fail(fileId, 'whole-object digest mismatch', atMs);
    }
    if (bytes.length !== manifest.totalBytes) {
      await this.discard(fileId);
      return this.fail(fileId, `assembled ${bytes.length}B, manifest declared ${manifest.totalBytes}B`, atMs);
    }

    // Text-only: the object must actually BE valid UTF-8, not merely claim to
    // be. A strict decode is the last gate before anything becomes visible.
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      await this.discard(fileId);
      return this.fail(fileId, 'declared text but is not valid UTF-8', atMs);
    }

    await this.files.markComplete(fileId, bytes, atMs);
    await this.packets.dropFragments(fileId);

    this.events.emit({
      category: EventCategory.FILE,
      name: 'completed',
      severity: 'info',
      atMs,
      bytes: bytes.length,
      result: fileId,
    });
    return { kind: 'completed', fileId, bytes: bytes.length };
  }

  /** FIL-005: which fragments to ask for when resuming. */
  async missingFragments(fileId: string): Promise<readonly number[]> {
    const held = (await this.packets.listFragments(fileId)).map((f) => f.index);
    return this.files.missingFragments(fileId, held);
  }

  /** FIL-003: only completed, digest-verified objects may be rendered. */
  async visibleFiles(): Promise<readonly AssembledFile[]> {
    return this.files.listVisible();
  }

  private async discard(fileId: string): Promise<void> {
    await this.packets.dropFragments(fileId);
  }

  private refuse(fileId: string, reason: string, atMs: number): AssemblyOutcome {
    this.events.emit({
      category: EventCategory.FILE,
      name: 'manifest-refused',
      severity: 'warn',
      atMs,
      reason,
      result: fileId,
    });
    return { kind: 'manifest-refused', fileId, reason };
  }

  private fail(fileId: string, reason: string, atMs: number): AssemblyOutcome {
    this.events.emit({
      category: EventCategory.FILE,
      name: 'integrity-failed',
      severity: 'error',
      atMs,
      reason,
      result: fileId,
    });
    return { kind: 'integrity-failed', fileId, reason };
  }
}
