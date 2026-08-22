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

## Current state — 4,005 mutations

**Zero crashes. Zero hangs.** Length bombs, varint overflow, nesting bombs and
lying field counts are all rejected before allocation, so INT-001 holds.

**One open finding:** `type-confusion`. Field keys are per-type but overlap —
key 1 is `incidentId` in `SOS_CREATE` and `forPacketId` in `LINK_RECEIPT` — so
flipping the type byte and repairing the CRC reinterprets the payload under a
different schema.

Accidental corruption does **not** reach this: `bitflip-header` is rejected
267/267 by the CRC. Getting here requires deliberately recomputing the checksum,
which is a signature problem, and DEC-019 puts production cryptography outside
hackathon scope. Recorded under the security boundary (INT-008), not as a bug.

**The actionable gap it exposed:** `validateSchema` **fails open** — a message
type with no rules entry is waved through. 12 of 33 types accept a completely
empty payload:

`RESPONDER_ACCEPTED` · `RESPONDER_DECLINED` · `WEATHER_BULLETIN` ·
`CACHE_CATALOG` · `CONTENT_ACTIVATE` · `RECORD_UPSERT` · `RECORD_TOMBSTONE` ·
`CACHE_INVALIDATE` · `HELLO_CAPABILITY` · `INVENTORY` · `PACKET_REQUEST` ·
`NETWORK_STATUS_OBSERVATION`

`RECORD_UPSERT` and `CONTENT_ACTIVATE` matter most — they mutate the map
projection. Fix: make `validateSchema` fail closed and add the missing rules.

## Correction to an earlier reading

An initial run reported fragment and hop-limit acceptances. That was the
fuzzer's own error — it asserted against `decodePacket`, which does not own
those gates (they are gates 8 and 9, in `validate()`). Asserting at the right
layer, those strategies produce **zero** bad acceptances.
