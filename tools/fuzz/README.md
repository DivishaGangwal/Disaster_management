# Fuzzer — manual, deliberately outside CI

Run:

```bash
npm run fuzz
```

**Not wired into CI**, and deliberately so:
- lives in `tools/fuzz/`, which the CI test globs (`packages/*/dist/**/*.test.js`,
  `apps/backend/dist/**/*.test.js`) do not match;
- has no `package.json`, so it is not an npm workspace;
- is not referenced by `tsconfig.build.json`, so it is never compiled.

Wire it into CI once the pipeline is stable.

## What it does differently from the test-suite noise case

`packet-codec.test.ts` throws structured noise at the decoder. Every case dies
at the magic-byte gate, so it proves almost nothing.

This mutates **valid** packets and, for several strategies, **repairs the header
CRC afterwards** — deliberately pushing corruption past gate 4 and into the
varint reader, the field decoder, and the nested-group logic, which is where a
crash would actually live.

## Strategies

| Strategy | Targets |
|---|---|
| `bitflip-header` | header integrity gate |
| `bitflip-header-crc-repaired` | everything downstream of the CRC |
| `bitflip-payload` | payload digest gate |
| `truncate` / `extend` | length consistency |
| `lie-payload-length` | pre-allocation bound (INT-001) |
| `fragment-bomb` | fragment index/count sanity (gate 9) |
| `time-and-hop-abuse` | clock + hop gates (7, 8) |
| `type-confusion` | schema validation per type (gate 11) |
| `garbage-payload-valid-envelope` | payload digest under a valid header |
| `nesting-bomb` | nesting depth limit |
| `inner-length-bomb` | declared array/text lengths near 2^32 |
| `varint-overflow` | unterminated varints |
| `field-count-lie` | field count vs bytes remaining |
| `bad-utf8` | strict UTF-8 decoding |

A finding is: an uncaught exception, a hang, or an **accepted** packet that is
structurally impossible. The RNG is seeded, so findings reproduce exactly.

## Current state — 4,005 mutations, 0 findings

**Zero crashes, zero hangs, zero bad acceptances.** Length bombs, varint
overflow, nesting bombs and lying field counts are all rejected before
allocation, so INT-001 holds.

## Three fail-open bugs this fuzzer found (all now fixed)

**1. The GEO header extension was silently discarded.** `writeFieldsBody`
skipped every field of a nested object that had no registered field map, and
wrote an empty map instead. Coordinates went in, `{}` came out, no error.
Fixed by registering every nested shape in `NESTED_FIELD_MAPS` (geo, bundles,
inventory entries, fragment requests) and making the encoder **throw** on an
unregistered one.

**2. `validateSchema` failed open.** A message type with no rules entry was
waved through, so 12 of 33 types accepted a completely empty payload --
including `RECORD_UPSERT` and `CONTENT_ACTIVATE`, which mutate the map
projection. Fixed by failing closed and adding rules for all 12.

**3. Type confusion.** Field keys are per-type but overlap (key 1 is
`incidentId` in `SOS_CREATE` and `forPacketId` in `LINK_RECEIPT`), so flipping
the type byte and repairing the CRC reinterpreted the payload under another
schema. Fixed by binding the message type into the payload digest
(`payloadDigest(payload, type)` hashes the type byte with the payload).
Costs no wire bytes -- the type already travels at offset 3.

Regression tests for all three live in `packages/codec/src/packet-codec.test.ts`
and `packages/validator/src/schemas.test.ts`.

### A note on the digest change

Binding the type into the digest changes the digest VALUE for every packet,
though not the byte layout. It is therefore a Gate I change. It was safe to
make when it was made: no golden vectors existed, and no packets were
persisted (the SQLite demo seed regenerates on an empty database). Anything
encoded before this change will now fail gate 10.

## Correction to an earlier reading

An initial run reported fragment and hop-limit acceptances. That was the
fuzzer's own error -- it asserted against `decodePacket`, which does not own
those gates (they are gates 8 and 9, in `validate()`). Asserting at the right
layer, those strategies produce zero bad acceptances.

A later run reported 8 `type 0x10` acceptances. Also a false positive: the
strategy was picking the seed's own type, so the "relabel" was a no-op. The
strategy now excludes it.
