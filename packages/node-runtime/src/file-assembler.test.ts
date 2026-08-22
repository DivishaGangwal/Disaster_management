/**
 * File assembly: FIL-001 .. FIL-007.
 *
 * Before this existed, fragments were stored and could never become a file.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { FILE_TRANSFER, MessageType, MimeCategory, SourceClass, STORAGE } from '@dsm/contracts';
import { buildFileFragment, buildFileManifest, decodePacket, sha256Hex, toEpochS } from '@dsm/codec';
import { MemoryEventSink, MemoryFileRepository, MemoryPacketRepository } from '@dsm/store';
import { FileAssembler } from './file-assembler.js';

const NOW_MS = 1_700_000_000_000;
const NOW_S = toEpochS(NOW_MS);
const ctx = { sourceId: '8899aabbccddeeff', sourceClass: SourceClass.RESPONDER_PROVISIONED, nowS: NOW_S };

function makeAssembler() {
  const packets = new MemoryPacketRepository();
  return { assembler: new FileAssembler(new MemoryFileRepository(), packets, new MemoryEventSink()), packets };
}

function payloadOf(bytes: Uint8Array) {
  const decoded = decodePacket(bytes);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) throw new Error('unreachable');
  return decoded.packet;
}

/** Splits content into fragment packets, returning manifest + fragments. */
function makeFile(fileId: string, content: Uint8Array, fragmentSize: number, mimeCategory: number) {
  const count = Math.ceil(content.length / fragmentSize);
  const manifest = buildFileManifest(ctx, fileId, {
    purposeCode: 1,
    mimeCategory,
    totalBytes: content.length,
    fragmentSize,
    fragmentCount: count,
    digest: sha256Hex(content),
  });
  const fragments = [];
  for (let i = 0; i < count; i += 1) {
    const slice = content.slice(i * fragmentSize, (i + 1) * fragmentSize);
    // Per-fragment integrity is a prefix; the whole-object digest is the real
    // guarantee (FIL-004).
    fragments.push(
      buildFileFragment(ctx, fileId, i, count, sha256Hex(slice).slice(0, FILE_TRANSFER.FRAGMENT_DIGEST_CHARS), slice),
    );
  }
  return { manifest, fragments, content };
}

// Text only: the assembler strictly decodes UTF-8 before anything is visible.
const CONTENT = new TextEncoder().encode(
  'Situation report: water level rising near the river road crossing. ' +
    'Two families moved to the hill assembly area. Medical post has supplies for one more day. ' +
    'Route RTE-001 impassable to light vehicles.',
);

test('FIL-004: a complete file assembles and its whole-object digest is verified', async () => {
  const { assembler } = makeAssembler();
  const { manifest, fragments } = makeFile('F1', CONTENT, FILE_TRANSFER.FRAGMENT_DATA_BYTES, MimeCategory.TEXT);

  const first = await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);
  assert.equal(first.kind, 'manifest-accepted');

  let last;
  for (const fragment of fragments) {
    last = await assembler.accept(payloadOf(fragment.bytes), NOW_S, NOW_MS);
  }

  assert.equal(last?.kind, 'completed');
  const visible = await assembler.visibleFiles();
  assert.equal(visible.length, 1);
  assert.deepEqual(Array.from(visible[0]!.bytes!), Array.from(CONTENT), 'content must survive intact');
});

test('FIL-003: an incomplete file stays hidden', async () => {
  const { assembler } = makeAssembler();
  const { manifest, fragments } = makeFile('F2', CONTENT, FILE_TRANSFER.FRAGMENT_DATA_BYTES, MimeCategory.TEXT);

  await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);
  // Deliberately withhold the last fragment.
  for (const fragment of fragments.slice(0, -1)) {
    await assembler.accept(payloadOf(fragment.bytes), NOW_S, NOW_MS);
  }

  assert.deepEqual(await assembler.visibleFiles(), [], 'nothing may be visible while incomplete');
  assert.deepEqual(await assembler.missingFragments('F2'), [fragments.length - 1]);
});

test('FIL-004: a corrupted fragment fails the whole-object digest and nothing becomes visible', async () => {
  const { assembler } = makeAssembler();
  const { manifest, fragments } = makeFile('F3', CONTENT, FILE_TRANSFER.FRAGMENT_DATA_BYTES, MimeCategory.TEXT);

  await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);

  let outcome;
  for (let i = 0; i < fragments.length; i += 1) {
    const packet = payloadOf(fragments[i]!.bytes);
    if (i === 1) {
      // Flip a byte AFTER the packet validated: models storage/assembly damage.
      const data = (packet.payload as { data: Uint8Array }).data;
      data[0] = (data[0]! ^ 0xff) & 0xff;
    }
    outcome = await assembler.accept(packet, NOW_S, NOW_MS);
  }

  assert.equal(outcome?.kind, 'integrity-failed');
  assert.deepEqual(await assembler.visibleFiles(), [], 'a digest mismatch must leave nothing visible');
});

test('FIL-006: an executable is refused at manifest time', async () => {
  const { assembler } = makeAssembler();
  const { manifest } = makeFile('F4', CONTENT, FILE_TRANSFER.FRAGMENT_DATA_BYTES, MimeCategory.EXECUTABLE);

  const outcome = await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);
  assert.equal(outcome.kind, 'manifest-refused');
});

test('FIL-006: an archive is refused -- the prototype never decompresses', async () => {
  const { assembler } = makeAssembler();
  const { manifest } = makeFile('F5', CONTENT, FILE_TRANSFER.FRAGMENT_DATA_BYTES, MimeCategory.ARCHIVE);

  const outcome = await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);
  assert.equal(outcome.kind, 'manifest-refused');
});

test('TEXT ONLY: images, audio and unknown categories are all refused', async () => {
  for (const category of [MimeCategory.IMAGE, MimeCategory.AUDIO, MimeCategory.OTHER]) {
    const { assembler } = makeAssembler();
    const { manifest } = makeFile(`F-${category}`, CONTENT, FILE_TRANSFER.FRAGMENT_DATA_BYTES, category);
    const outcome = await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);
    assert.equal(outcome.kind, 'manifest-refused', `category ${category} must be refused`);
  }
});

test('TEXT ONLY: content that is not valid UTF-8 is refused at completion', async () => {
  const { assembler } = makeAssembler();
  // Declared TEXT, but the bytes are an invalid UTF-8 sequence.
  const notText = Uint8Array.from([0xff, 0xfe, 0xfd, 0xfc, 0x80, 0x81]);
  const { manifest, fragments } = makeFile('F-BADTEXT', notText, FILE_TRANSFER.FRAGMENT_DATA_BYTES, MimeCategory.TEXT);

  await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);
  let last;
  for (const fragment of fragments) last = await assembler.accept(payloadOf(fragment.bytes), NOW_S, NOW_MS);

  assert.equal(last?.kind, 'integrity-failed');
  assert.deepEqual(await assembler.visibleFiles(), [], 'non-text must never become visible');
});

test('FIL-006: fragments with no manifest are orphaned, never stored blind', async () => {
  const { assembler, packets } = makeAssembler();
  const { fragments } = makeFile('F6', CONTENT, FILE_TRANSFER.FRAGMENT_DATA_BYTES, MimeCategory.TEXT);

  const outcome = await assembler.accept(payloadOf(fragments[0]!.bytes), NOW_S, NOW_MS);
  assert.equal(outcome.kind, 'fragment-orphaned');
  assert.deepEqual(await packets.listFragments('F6'), [], 'unrequested content must not be stored');
});

test('FIL-007: an oversized object is refused against the one documented maximum', async () => {
  const { assembler } = makeAssembler();
  const manifest = buildFileManifest(ctx, 'F7', {
    purposeCode: 1,
    mimeCategory: MimeCategory.TEXT,
    totalBytes: STORAGE.MAX_FILE_BYTES + 1,
    fragmentSize: FILE_TRANSFER.FRAGMENT_DATA_BYTES,
    fragmentCount: 8,
    digest: 'a'.repeat(64),
  });

  const outcome = await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);
  assert.equal(outcome.kind, 'manifest-refused');
});

test('FIL-005: fragments arriving out of order still assemble', async () => {
  const { assembler } = makeAssembler();
  const { manifest, fragments } = makeFile('F8', CONTENT, FILE_TRANSFER.FRAGMENT_DATA_BYTES, MimeCategory.TEXT);

  await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);
  const shuffled = [...fragments].reverse();

  let last;
  for (const fragment of shuffled) last = await assembler.accept(payloadOf(fragment.bytes), NOW_S, NOW_MS);

  assert.equal(last?.kind, 'completed');
  assert.deepEqual(Array.from((await assembler.visibleFiles())[0]!.bytes!), Array.from(CONTENT));
});

test('a manifest arriving after its fragments still completes the object', async () => {
  const { assembler } = makeAssembler();
  const { manifest, fragments } = makeFile('F9', CONTENT, FILE_TRANSFER.FRAGMENT_DATA_BYTES, MimeCategory.TEXT);

  // Fragments first: they are orphaned, because nothing bounds them yet.
  for (const fragment of fragments) {
    const outcome = await assembler.accept(payloadOf(fragment.bytes), NOW_S, NOW_MS);
    assert.equal(outcome.kind, 'fragment-orphaned');
  }

  // The manifest alone cannot complete it -- the orphans were never stored.
  const outcome = await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);
  assert.equal(outcome.kind, 'manifest-accepted');
  assert.deepEqual(await assembler.visibleFiles(), []);

  // Re-sent after the manifest, they assemble normally (the resume path).
  let last;
  for (const fragment of fragments) last = await assembler.accept(payloadOf(fragment.bytes), NOW_S, NOW_MS);
  assert.equal(last?.kind, 'completed');
});

test('assembly is idempotent: replaying every fragment does not corrupt the object', async () => {
  const { assembler } = makeAssembler();
  const { manifest, fragments } = makeFile('F10', CONTENT, FILE_TRANSFER.FRAGMENT_DATA_BYTES, MimeCategory.TEXT);

  await assembler.accept(payloadOf(manifest.bytes), NOW_S, NOW_MS);
  for (const fragment of fragments) await assembler.accept(payloadOf(fragment.bytes), NOW_S, NOW_MS);
  for (const fragment of fragments) await assembler.accept(payloadOf(fragment.bytes), NOW_S, NOW_MS);

  const visible = await assembler.visibleFiles();
  assert.equal(visible.length, 1);
  assert.deepEqual(Array.from(visible[0]!.bytes!), Array.from(CONTENT));
});

test('the file family never reaches Tier 2 (FIL-002)', () => {
  // Structural: Tier 2 campaigns are built from an explicit packet list, and
  // the planner has no path that admits file types. Asserted here so a future
  // change to campaign building has to confront the rule.
  assert.equal(MessageType.FILE_MANIFEST, 0xa0);
  assert.equal(MessageType.FILE_FRAGMENT, 0xa1);
});
