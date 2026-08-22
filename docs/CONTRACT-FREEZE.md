# Contract freeze — the five gates

`agent-reference/03-…` defines five cross-workstream interface gates. All five
are **frozen in code** as of the first pass, which is what allows six
workstreams to start at once.

Freezing does not mean "never change". It means **changes are a decision with a
process**, not a side effect of someone's local edit.

> `03-…`: *"A decision affecting packet identity, transport meaning, offline
> behavior, role permissions, map object semantics, gateway truth, or Tier 2
> direction must update all affected specifications before implementation
> diverges. Agents must not hide a decision inside one implementation file."*

## Gate I — packet contract  ·  FROZEN

**Where:** `packages/contracts/src/{registry,limits,enums,envelope,payloads,reasons}.ts`
**Codec:** `packages/codec/`

| Requirement | Status |
|---|---|
| registry codes are unique | ✅ one `MessageType` map, checked by a test |
| field maximums are fixed | ✅ `limits.ts`, no value is unbounded |
| canonical identities and update sequences agreed | ✅ 16-byte packet ID + per-stream `sourceSequence` |
| golden packets available | ⚠️ round-trip + determinism tests exist; **committed golden vector files remain** (WS-C) |
| mobile/backend/map/Tier 2 agree on meaning | ✅ all import the same registry; enforced by `npm run boundaries` |
| encoded sizes recorded | ⚠️ compact SOS asserted ≤160 B; **full evidence sheet remains** (WS-C) |

**Numeric codes are permanent.** Retire a code, never reuse it.

## Gate II — native bridge contract  ·  FROZEN

**Where:** `packages/contracts/src/native-bridge.ts`

| Requirement | Status |
|---|---|
| capability/permission schema agreed | ✅ `CapabilityReport`, `PermissionSnapshot` |
| relay lifecycle states agreed | ✅ the 8 states from `02-…`, no others |
| peer/session/bytes/error events agreed | ✅ `TransportEvent` union |
| start/stop/session commands agreed | ✅ `TransportAdapter` |
| simulated adapter implements the same contract | ✅ `SimulatedTransportAdapter`, used by 8 acceptance tests |
| real dev build produces the same semantics | ❌ **blocked on WS-B** — this is the one gate not yet proven on both sides |

`CapabilityReport.simulated` must stay honest: `true` in the simulated adapter,
`false` in native. The readiness screen renders it verbatim (working rule 11).

## Gate III — map operation contract  ·  FROZEN

**Where:** `packages/contracts/src/{map-ops,content-pack}.ts`, `packages/mapkit/`

| Requirement | Status |
|---|---|
| regional pack ID/version fixed | ✅ `PackManifest`; demo pack is `PACK-DEMO` v1 |
| object IDs and types stable | ✅ typed `PackObjectType` registry |
| allowed operations and precedence documented | ✅ 12 typed operations, nothing else can touch the map |
| missing/stale/tombstone behaviour tested | ✅ `MISSING_OBJECT_FALLBACK`, freshness classes, tombstones |
| all inputs use one projection path | ✅ `toMapOperations()` is the only translation |

A packet can never supply a path, URL, query, or command — only a typed opcode
resolved through the pack registry.

## Gate IV — gateway contract  ·  FROZEN

**Where:** `packages/contracts/src/gateway-api.ts`, `packages/gateway-client/`, `apps/backend/`

| Requirement | Status |
|---|---|
| connectivity proof rule fixed | ✅ live probe + backend identity string; a captive portal cannot pass |
| upload item outcomes fixed | ✅ `accepted / duplicate / conflicted / expired / invalid` |
| duplicate/conflict behaviour fixed | ✅ tested: 2 gateways → 1 incident, 2 observations |
| outbound cursor and retry semantics fixed | ✅ cursor advances only after a confirmed response; retries tested |
| acknowledgement packet semantics fixed | ✅ `BACKEND_ACKNOWLEDGEMENT` returns as its own packet |

GTW-008 is structural: the source phone shows "coordination centre received it"
only when an acknowledgement packet actually reaches it.

## Gate V — campaign contract  ·  FROZEN

**Where:** `packages/contracts/src/campaign.ts`, `packages/tier2/`

| Requirement | Status |
|---|---|
| manifest, operation mapping, profile, repetition, duration budget fixed | ✅ `planCampaign()` |
| expected packets and map actions fixed | ✅ manifest carries the expected packet list |
| both receiver paths use the same packet/policy inputs | ✅ **tested**: mic and direct recover byte-identical packets |
| post-approval edits reset approval | ✅ `contentEdited()` returns approved-or-later to `draft` |

An over-budget campaign is **reported** as over budget. It is never silently
truncated (`02-…`: *"It must not hide the overrun."*).

## Changing a frozen contract

1. Open an issue naming the gate and what breaks without the change.
2. Get the owners from `.github/CODEOWNERS` for that gate.
3. Update **every** affected file in `docs/agent-reference/` first.
4. Change `packages/contracts`, then every consumer, in one PR.
5. Run `npm run build && npm test && npm run boundaries`.
6. Update this file's status table.

Adding a **new** message type, a **new** payload field, or a **new** reason code
is backward compatible and does not need a gate — the codec skips unknown field
keys safely. Changing an **existing** numeric value does.
