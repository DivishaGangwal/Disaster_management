# Tier 1 bring-up report

**Date:** 2026-08-26 · **Branch:** `saksham-the-great`
**Devices:** Samsung SM-M536B (Android 16) · vivo V2427 (Android 16) · both `arm64-v8a`

This document records the first successful Tier 1 packet exchange over real
Bluetooth hardware, the defects fixed to get there, what is implemented, what
remains, and the wire formats currently in use.

Evidence labels follow `evidence/README.md`:
🟩 static/source check · 🟦 automated test or simulator · 🟥 **measured on real hardware**

---

## 1. Headline

**One-hop bidirectional Tier 1 packet exchange over BLE now works on two
physical Android handsets.** 🟥

Full chain observed: advertise → discover → GATT connect → ATT MTU 517 →
service discovery → CCCD subscribe → inventory exchange → packet transfer →
validate → store, in **both directions**.

This is the first 🟥 claim in the repository. Every prior claim was 🟩 or 🟦.

**Not yet proven:** three-hop relay (`03`'s definition of done), store-carry-
forward on hardware, screen-off survival, battery cost, and reliability — the
target is ≥95% over 20–50 trials and the current sample is n≈1.

> **Before relying on the hardware claim above, read §10 — Readiness
> assessment.** The run recorded in this document measured code that has since
> changed (`HD-014`), so §3.2 is stale until the two-phone test is re-run. §10
> states plainly what is implemented, what is merely presented, and what has
> never been measured.

### Evidence

Two independent confirmations:

1. **`record-received` notifications on both phones with different packet IDs.**
   At the time of observation `notifyPacketReceived` fired only from
   `event.kind === 'record-received'` — a record off the radio. Locally created
   packets went through `engine.ingest(bytes, 'local')` and never reached it.
   Different IDs on each phone ⇒ each received the other's packet.

   *(That notification path has since been rewritten — see §2.9 — so this exact
   signal will not reproduce. The reasoning held for the run that produced it.)*

2. **`inventory: session-skipped … "no useful difference"`** on the vivo. That
   branch requires `lastReconciled` to hold an entry for the peer, and
   `lastReconciled.set()` executes at exactly one place — the end of
   `absorbInventory()`, *after* `announceInventory()` and `pushOffers()` have
   both completed. There is no other path that populates it, so a full
   bidirectional reconciliation demonstrably ran.

`HD-013`'s queue-epoch session skip was also observed working on hardware.

---

## 2. Defects found and fixed in this session

Listed in the order they blocked progress. Each was found by evidence, not
inspection — the two *diagnostic* fixes (#2, #5) are what made the rest
solvable.

### 2.1 BLE advertising overflowed the legacy PDU — blocked everything

`AndroidRadioBridgeModule.startAdvertising()` built the advertisement as
Flags (3) + **128-bit service UUID (18)** + manufacturer data (16) = **37 bytes**
against a 31-byte legacy PDU limit. `startAdvertising()` failed with
`ADVERTISE_FAILED_DATA_TOO_LARGE` on every device, so no phone was ever
discoverable.

`HD-010` already documented the correct design ("a 128-bit service UUID in the
advertisement would consume 18 of the 31 bytes"), and `advertisement-codec.test.ts`
asserted a 19-byte PDU — but it modelled only two AD elements. The TS test
passed, the Kotlin compiled, and the two disagreed.

**Fix:** dropped `addServiceUuid()`. `SERVICE_UUID` remains in use at all seven
data-path sites (GATT server registration, client service discovery,
characteristic lookup, RFCOMM). Added a pre-flight size check that fails as
`BLE_ADVERTISE_PDU_OVERFLOW` with the actual byte count.

### 2.2 Advertising failure was invisible, and reported as success

`startRelay()` emitted `relayState("advertising-scanning", …)` unconditionally,
before the asynchronous failure arrived. The UI claimed a healthy radio while
the controller was rejecting the advertisement.

**Fix:** added `onStartSuccess`; `advertising-scanning` is now emitted only from
there. Added a decoder mapping all five `ADVERTISE_FAILED_*` codes to readable
text, and a one-shot Bluetooth Classic fallback (`DEC-006`) when advertising
cannot start. `openSession()` now treats `selectedMode` as authoritative so a
runtime fallback is honoured end to end.

### 2.3 Release APK contained zero routes — app crashed at launch

`Error: No routes found` in `useInitializeExpoRouter`. `apps/mobile/android/app/build.gradle`
set `root = file("../../../..")` (workspace root). Because `root` is the working
directory Expo CLI runs in, Expo treated the **workspace** as the project root,
so (a) `apps/mobile/metro.config.js` was never found — default Metro config was
used — and (b) `babel-preset-expo` looked for the router directory at
`<workspace>/app`, which does not exist. `require.context` matched nothing.

Measured: broken bundle 1,425,240 B with no screens; correct bundle
4,049,184 B / 3,321 modules with every route.

**Fix:** `root = file("../..")` (apps/mobile) plus
`extraPackagerArgs = ["--entry-file", resolvedAppEntry.absolutePath]`.
`BundleHermesCTask` appends `extraPackagerArgs` *after* its own `--entry-file`
(add at :152, addAll at :166), and the last flag wins — so Metro receives an
absolute path that survives the plugin's relativisation against `root`.

Also fixed: `metro.config.js` passed `input: './global.css'` to nativewind,
which resolves against `process.cwd()`; now `path.resolve(projectRoot, …)`.

Also: **`nativewind` was declared in `package.json` and in the lockfile but not
installed.** Restored with `npm install`.

### 2.4 `startRelay` / `RelayLoop.start()` were not idempotent

Creating an SOS starts relay (`REL-001`), and so does the Relay toggle — so any
SOS raised while relaying re-entered `startRelay`. Symptoms:
`ADVERTISE_FAILED_ALREADY_STARTED` / `SCAN_FAILED_ALREADY_STARTED`, and a
**listener leak**: `RelayLoop.start()` overwrote `this.unsubscribe`, orphaning
the previous listener, so each native event was delivered 7–8×.

The duplication was selective and diagnostic: `custody` / `validation` /
`policy` rows (emitted by `NodeEngine`) appeared **once**, while
`relay-lifecycle` / `peer-discovery` / `session` rows (driven by transport
events) appeared 7–8×.

**Fix:** `RelayLoop.start()` returns early when already running, refreshing only
the advertisement; `stop()` clears the handle. Native `startRelay()` given a
`relayRunning` guard as a backstop. A second leak in
`mobile-controller.create()` (adapter listener never detached, re-registered by
`reconfigureRole`) was captured in `removeAdapterListener`.

### 2.5 Session failures carried no reason

`openSession` rejection paths (`E_PEER_GONE`, `E_GATT_SERVICE`, `E_GATT_NOTIFY`,
`E_GATT_TIMEOUT`, `E_GATT_DISCONNECTED`) rejected the promise but emitted no
event. `relay-loop` catches per peer and records only `contact-failed`, so every
failure looked identical.

**Fix:** new `rejectPendingSession()` raises a named `transportError` alongside
the rejection. This is what surfaced `E_GATT_TIMEOUT` and made the remaining
two defects findable.

### 2.6 Concurrent `connectGatt` stacked GATT clients — blocked MTU

`this.sessions.set(...)` runs only **after** `openSession` resolves, which takes
until the GATT handshake completes (up to the 15 s timeout). Advertisements
arrive every 1–8 s, so `hasSessionWith()` returned false throughout and each new
advertisement started **another** `connectGatt`.

Observed in the Bluetooth stack: three client interfaces (134/135/136) holding
one link, and `configureMTU() mtu: 247` never returning. **ATT MTU is negotiated
per ACL link, not per GATT client** — the first interface negotiated it, so every
later `configureMTU` was swallowed with no `onMtuChanged`, and all stacked
attempts timed out.

**Fix:** a `connecting` set marks a peer from *before* `openSession` until it
fully settles. After the fix the stack showed a single interface (156) and
`onConfigureMTU() mtu=517 status=0`.

### 2.7 GATT server never answered the CCCD write — the final blocker

`BluetoothGattServerCallback` implemented `onConnectionStateChange`,
`onMtuChanged`, `onCharacteristicWriteRequest` and `onNotificationSent` — but
**not `onDescriptorWriteRequest`**. Android's default does nothing and never
calls `sendResponse()`. The CCCD subscribe is the last step of `openSession`, so
the initiator waited for an ATT response that never came.

Observed: connect ✓, `onConfigureMTU status=0` ✓, `onSearchComplete status=0` ✓,
then silence until `E_GATT_TIMEOUT`.

**Fix:** implemented `onDescriptorWriteRequest` (validates CCCD UUID, sends
response) and `onDescriptorReadRequest` (some stacks read the CCCD first; an
unanswered read stalls identically).

### 2.8 Advertised queue summary was fabricated

`highestWaitingPriority` was hardcoded to `0` — `Priority.EMERGENCY` — so every
node permanently advertised life-critical traffic waiting, including with an
empty queue. `inventoryHint` was set to `currentQueueEpoch`, duplicating the
field beside it and carrying no information.

**Fix:** `NodeEngine` now tracks both. `waitingPriority` is a running minimum on
insert with an exact recompute in `maintain()` (a minimum cannot rise on its
own when the packet that set it expires). `inventoryDigest` is an
order-independent XOR fold of `fold16(packetId)` over the relayable set — a
fingerprint two peers can actually compare, unlike the self-referential epoch.
Verified behaviourally against the simulator: empty queue → 7; alert → 2; SOS →
0; same set in reverse order → identical digest; divergent set → different
digest; incremental == exact recompute.

### 2.9 Notification storm on the emergency channel

`mobile-controller` raised a notification from the raw `record-received`
transport event. `INVENTORY` records are `record-received` too, and carry
priority `RESPONSE_CONTROL` (1) — which passed the `> GENERAL_UPDATE (5)` gate
and then satisfied `<= AUTHORITY_CRITICAL (2)`. So **every inventory exchange
raised a MAX-priority notification on the `emergency` channel**, roughly once a
minute, with nothing actually sent.

Three faults: it notified for session-control types (which the policy engine
already marks `alert: 'none'`), it bypassed the policy engine and re-derived
urgency from raw priority, and it never deduplicated — against `01`'s
*"Duplicate packet | No repeat notification"*. Crying wolf on the emergency
channel is what makes a real Level 3 alert get ignored.

**Fix:** `NodeEngine` gained an `onIngested(result, transport)` hook so a
platform layer can react to the **policy engine's** decision instead of
inventing one. The engine stays platform-agnostic — it hands over a result and
does not know what a notification is. The mobile layer now:

- skips unless `result.accepted` and `storeOutcome !== 'duplicate'`
- skips `transport === 'local'` (your own SOS is confirmed by its own screen)
- drives channel and priority from `PolicyOutcome.alert`, returning early on
  `'none'` (session control) and `'silent'` (background map updates)
- names the real source: *"Packet 3f53… received from a nearby phone over
  Bluetooth"*, replacing *"was received locally"*, which read as "created here"
  — the opposite of the truth (`DEC-022`)

The duplicate notify on the Tier 2 recovery path was removed; the hook covers it.

### 2.10 Hop count never incremented — the hop limit was inert

`incrementHopInPlace()` existed in the codec and was exercised only by a unit
test. `pushOffers()` sent `stored.encoded` — the original bytes verbatim — so
**every packet travelled at `hopCount = 0` forever** and validation gate 8
(`hopCount >= hopLimit`) could never fire.

`02` requires *"hop count increments at each application-level relay"*, and
`REL-007` lists the hop limit among the bounds on replication. Propagation was
still bounded by copy budgets, TTL, `knownHolders`, previous-hop suppression and
per-neighbour cooldown — so this was never a flooding risk — but one of five
loop controls was dead, and `observation.hopCountOnArrival` was always 0, so
nothing could display hop depth.

**Fix:** `pushOffers()` now sends `incrementHopInPlace(stored.encoded.bytes)`.

Safe because the payload digest is taken over `[type byte || payload]`, **not**
the header, so bumping hop and repairing the header CRC changes neither packet
identity nor conflict detection. `incrementHopInPlace` copies rather than
mutating, so the relay's own stored copy keeps its own hop count — a relay adds
bounded observations, it does not rewrite source meaning (`04 §7.4`).

Verified on a simulated A→B→C chain with no direct A–C link: 🟦

```
A (origin) hopCount = 0
B (relay)  hopCount = 1
C (2 hops) hopCount = 2
holders: A, B, C   — same packetId throughout (02 invariant 5)
```

---

## 3. What is implemented

### 3.1 Protocol and domain — complete, simulator-proven 🟦

| Area | State |
|---|---|
| Canonical packet registry | 33 message types, frozen numeric codes, single source in `@dsm/contracts` |
| Codec | 64-byte envelope, deterministic, big-endian; type byte bound into payload digest (`HD-008`) |
| Validator | 15 ordered gates, reason-coded; `gatesDeferred` reported honestly (`HD-005`) |
| Policy engine | six independent decisions (store/display/alert/relay/upload/act), each reason-coded |
| Routing | hard eligibility gates + bounded utility score; 25% record reserve so files cannot starve SOS |
| Custody | copy budgets, hop limits, TTL, per-neighbour cooldown, known-holder tracking |
| Incident reducer | latest-wins by source sequence, history retained |
| Map projection | 12 typed operations, idempotent, single `toMapOperations()` path |
| Persistence | `expo-sqlite` on device, memory store for tests, same `PacketRepository` port |
| Tier 2 | WavePX/ggwave frame codec, independent receiver, campaign planner |

**80 automated tests passing**, `npm run boundaries` clean, fuzz 4,005 cases 0 findings.

### 3.2 Transport — working on hardware 🟥

| Step | State |
|---|---|
| BLE advertise (12-byte manufacturer payload) | 🟥 working |
| BLE scan + filter (company `0xffff`, magic `0xd5`) | 🟥 working |
| Peer discovery + advertisement decode | 🟥 working |
| GATT connect | 🟥 working |
| ATT MTU negotiation | 🟥 517 granted |
| Service discovery | 🟥 working |
| CCCD subscribe | 🟥 working |
| Inventory exchange | 🟥 working, both directions |
| Packet transfer + validate + store | 🟥 working, both directions |
| Bluetooth Classic fallback | 🟩 implemented, never exercised |

### 3.3 Backend and web console — 🟦

Backend services, gateway loop, dedup, observations, outbound queue, integrated
React console, campaign approval, centre editor, responder roster. 26 documented
API routes. Not exercised in this session (no backend configured on the phones).

---

## 4. Wire formats in use

### 4.1 BLE advertisement — 19 of 31 bytes

```
AD 1  Flags                 [0x02][0x01][0x06]                     3 B
AD 2  Manufacturer data     [len][0xFF][ff][ff][12-byte payload]  16 B
                                                          total   19 B
```

12-byte payload:

| Offset | Size | Field |
|---:|---:|---|
| 0 | 1 | magic `0xd5` |
| 1 | 1 | protocol major (hi nibble) \| minor (lo) |
| 2–5 | 4 | rotating node token |
| 6 | 1 | capability bits |
| 7–8 | 2 | `queueEpoch` |
| 9–10 | 2 | `inventoryHint` (XOR fingerprint of relayable set) |
| 11 | 1 | `highestWaitingPriority` (b0–2) \| gateway proven (b3) \| gateway freshness (b4–5) \| accepting (b6) |

Service UUID is **deliberately not advertised** — exchanged after connection.

### 4.2 Tier 1 canonical envelope — 64 bytes

| Off | Size | Field |
|---:|---:|---|
| 0 | 2 | Magic `0x444d` |
| 2 | 1 | Protocol version |
| 3 | 1 | Message type |
| 4 | 2 | Flags |
| 6 | 1 | Priority (hi nibble) + severity (lo nibble) — `HD-007`, unratified |
| 7 | 1 | Header length |
| 8 | 16 | Packet ID |
| 24 | 8 | Ephemeral source ID |
| 32 | 4 | Created (s since demo epoch) |
| 36 | 4 | Expiry |
| 40 | 1 | Hop limit |
| 41 | 1 | Hop count |
| 42 | 4 | Payload length |
| 46 | 2 | Fragment index |
| 48 | 2 | Fragment count |
| 50 | 8 | Payload digest prefix |
| 58 | 1 | Source/campaign class — `HD-007`, blueprint says 2 B |
| 59 | 1 | Reserved |
| 60 | 4 | Header CRC-32 |

Link budget: ATT MTU 247 → 244 usable → 64 header + **180 max payload**, so every
record fits **one GATT write** and no chunking layer exists (`HD-011`).

**Transport directions:** initiator → acceptor is a GATT **write** to `RX`
(`7d4f0001-…`); acceptor → initiator is a **notification** on `TX` (`7d4f0002-…`).

### 4.3 Tier 2 frame — 12-byte overhead

```
[0] magic 0xD2 · [1] version|fragCount · [2] fragIndex · [3-4] campaign handle
[5] campaign version · [6-7] packet handle · [8] type · [9] priority|severity
[10..n] canonical Tier 1 bytes · [n+1..2] CRC
```

Frames carry **complete canonical Tier 1 bytes**, so a receiver decodes
independently of any manifest.

---

### 4.4 Session-control payloads — changed in this session (`HD-014`)

**`INVENTORY` (0xf1)** — the compact summary is now a byte blob, not hex strings.

| Key | Field | Encoding | Cost |
|---:|---|---|---:|
| 6 | `idPrefixes` | `TAG.BYTES` \| len \| 8-byte prefix × N | 2 + 8N B |
| 4 | `queueEpoch` | `TAG.UINT` | 3–5 B |
| 5 | `truncated` | `TAG.TRUE` / `TAG.FALSE` | 2 B |

**21 prefixes = 242 B total**, inside the 244 B write budget. The previous
encoding sent `criticalIds` as 32-CHARACTER hex strings at 34 B each, which fit
exactly four.

Keys 1–3 (`criticalIds`, `entries`, `terminalIds`) are **still decoded** so a
peer on an older build is understood, and are **no longer sent**. A receiver
folds every form into one prefix-keyed set — both sides must derive membership
through `packetIdPrefixKey()`, because announcing a prefix while testing a full
ID matches nothing and fails silently rather than throwing.

**`HELLO_CAPABILITY` (0xf0)** — 102 B, sent at the `hello` phase in both
directions. Carries what the 12-byte advertisement has no room for:

```
nodeToken · protocolMin · protocolMax · batteryBand · storageBand
maxRecordBytes · maxFragmentBytes · queueEpoch · highestWaitingPriority
```

`maxRecordBytes` is negotiated as `min(local, peer)`. Both ends report 244
today, so the negotiated value is the 244 the build already assumed — the point
is that the phase now exists, so plumbing the natively negotiated ATT MTU (517
was granted on both handsets, §2.6) through later changes one number rather
than adding a protocol step.

**`PACKET_REQUEST` (0xf2)** — defined, builder and field map and validator
schema all present, **zero callers**. Reserved, not removed (`HD-001`).


## 5. Testing

### 5.1 Done

| Test | Evidence |
|---|---|
| 80 unit/integration/simulator tests | 🟦 |
| Compact inventory: 4 → 21 IDs per record, measured | 🟦 |
| `HELLO_CAPABILITY` on the wire both ways; peer battery band persisted | 🟦 |
| Three-hop delivery with a 15-packet relay queue | 🟦 |
| Acceptance scenarios A, B, C, D, E, G, H, J, K | 🟦 |
| Malformed-input fuzz, 4,005 cases | 🟦 |
| Module boundary check | 🟩 |
| Strict TypeScript build, mobile typecheck | 🟩 |
| Kotlin compile (`compileDebugKotlin`) | 🟩 |
| **One-hop bidirectional BLE transfer** | **🟥** |
| **MTU negotiation (517), service discovery, CCCD** | **🟥** |
| **`HD-013` session-skip on hardware** | **🟥** |

### 5.2 Remaining

| Test | Why it matters |
|---|---|
| **Three-hop relay (A→B→C)** | `03`'s definition of done; B must relay a packet it did not create |
| Store-carry-forward on hardware | scenario C on devices |
| Reliability: 20–50 trials | target ≥95%; current n≈1 |
| Screen-off / background survival | vivo Funtouch is aggressive; per-OEM |
| Battery and thermal measurement | no duty cycling exists (see §6) |
| Bluetooth Classic fallback | implemented, never triggered |
| Tier 2 acoustic (scenario F) | speaker-to-microphone |
| Gateway loop on device | needs `EXPO_PUBLIC_DSM_BACKEND_URL` at build time |

**For a valid three-hop test:** A and C must be out of direct range, or the result
is "three-phone propagation with overlapping ranges", not multi-hop. Check three
things: the **same packet ID** on all three phones (`02` invariant 5),
`transport: tier1-ble` on B and C (`local` only on A), and — since §2.10 —
**hop count 0 / 1 / 2** across the chain, which is the clearest single proof
that C received it *through* B rather than directly from A.

---

## 6. Known defects and gaps

### 6.1 ~~Notification storm~~ — FIXED (see §2.9)

Resolved in this session. Notifications now follow `PolicyOutcome.alert`,
ignore session control, skip duplicates and locally created packets, and name
the transport they arrived on.

### 6.2 ~~SQLite and memory stores disagree on queue fairness~~ — FIXED

`sqlite-repositories.listRelayable()` ordered by `stored_at_ms` only while
`memory-store` ordered by priority then oldest, so the simulator was not
modelling the device. It now sorts identically to `memory-store`.

This stopped being merely cosmetic once the inventory started cutting at 21
entries: under age-only ordering a fresh SOS could be dropped from the
announcement by older, lower-priority records. **Age weighting is unchanged** —
priority is the primary key, oldest-first is the tiebreak (`02` queue
fairness), and the routing score's `age` term is untouched.

### 6.3 Other open items

| Item | Status |
|---|---|
| ~~Inventory truncates to ~4 IDs~~ | **FIXED** — 8-byte prefixes, measured 4 → **21** IDs (`HD-014`) |
| ~~`HELLO_CAPABILITY` never sent~~ | **FIXED** — 102 B record at the hello phase; `negotiate()` has a caller (`HD-014`) |
| `PACKET_REQUEST` never sent | documented `HD-001`; still the deliberate deviation. Fragment-level resume is what it gives up |
| No duty cycling | `BATTERY.DUTY_CYCLE` declared, read by nothing; advertising runs 100% while relay is on |
| Directed forwarding excluded | documented `HD-004`; three of nine routing-score terms unimplemented |
| Peer count has no freshness | 30-min retention shown as a current count |
| `apps/mobile/android/` is gitignored | the Gradle fix is **not version controlled**; `expo prebuild` wipes it |
| Gradle misses `packages/` changes | JS-only edits leave `createBundleReleaseJsAndAssets` UP-TO-DATE — silently ships stale JS |
| `upsert-peer-marker` unreachable | peer layer on the map has no data source |
| 4 dead files in `apps/mobile/data/` | contradict the frozen enums; zero imports |

A fuller list is in [AGENT-REFERENCE-AUDIT.md](AGENT-REFERENCE-AUDIT.md).

---

## 7. UI/UX recommendations

Grounded in what actually caused confusion during bring-up.

**§7.1 is the direction set for the demo build and governs the rest.** The
numbered items from §7.2 onward predate it; where they conflict, §7.1 wins, and
the ones it absorbs are marked.

### 7.1 Demo build direction — four decisions

The organising principle: **an evaluator will not cross-check packet IDs.**
Every surface has to be legible in one glance, and anything that cannot be
demonstrated should not be on screen claiming it can.

#### 7.1.1 Strip the SOS composer to urgency + message

Keep **severity**, an optional **short note**, and **category**. Drop
`mobility` and `language` from the compose flow.

`peopleTotal` and `injured` were also proposed for removal. **They are not
being removed on this document's authority** — see the flag immediately below.

> ### ⚠️ OPEN DECISION — needs the team lead's sign-off before anyone implements it
>
> **Proposal:** drop `peopleTotal` and `injured` from the SOS composer.
> **Status:** NOT DECIDED. Do not implement unilaterally in either direction.
>
> This is flagged rather than actioned because it is the only item in §7.1 that
> removes working, end-to-end functionality, and the measurements below argue
> against it.
>
> **What it actually costs on the wire — measured, not estimated:**
>
> | | |
> |---|---:|
> | Full SOS **with** both fields (incl. a 37-char note) | 179 B |
> | Same SOS **without** them | 176 B |
> | **Cost of both fields** | **3 B** |
> | Headroom remaining with them | 65 B of 244 |
>
> **3 bytes out of a 244-byte write — 1.2%.** There is no airtime, MTU or
> fragmentation argument for removing them. The entire case is compose-time
> taps.
>
> **The case for KEEPING them (currently stronger):**
>
> - They are **wired end to end and working**: composer → `buildSosCreate` →
>   validator (`0..999`) → incident reducer → responder detail. Nothing is
>   broken; this would be deleting a feature that works.
> - **They are 2 of only 3 fields the receiver displays.** `responder/detail.tsx`
>   renders exactly three things from an incident: the category label
>   (`:66`), `peopleTotal` (`:72`) and `injured` (`:76`). Remove both and a
>   responder tapping an SOS sees **one word and nothing else** — because
>   `shortNote` is decoded and stored but never rendered anywhere (see §7.4).
> - **"3 people, 1 injured" is the triage signal**, and triage is what a
>   responder demo is meant to show. It is also the most demo-legible content
>   on any receiving screen.
>
> **The case for DROPPING them:**
>
> - Two more steppers between a person in danger and the send button. The
>   argument that carried §7.1 — fewer taps under stress — applies here too.
> - Someone trapped alone plausibly does not know an injured count, and a
>   required-feeling field invites a wrong answer or hesitation.
>
> **Recommendation: keep them, but make them optional and default-free.**
> Show them as a single collapsed "Add details (optional)" row rather than two
> steppers pre-filled with `2` and `1` (`composer.tsx:35-36` — today's defaults
> are invented values that get sent verbatim if untouched, which is its own
> small defect). That preserves the responder's triage signal and the demo's
> most legible receiving surface while costing an unhurried user one tap and a
> hurried one zero.
>
> **If they are dropped anyway,** §7.4's item 14 stops being a nice-to-have and
> becomes required: `shortNote` must be rendered, or the responder detail
> screen shows a single category word.
>
> **Decision:** ______________  **By:** ______________  **Date:** ____________

Location needs no control at all: it is attached automatically when a fix is
available (`bestEffortLocation()`), so an SOS with no note and no fields still
carries urgency, category, position and time.

**Category must stay, but only because it reaches the receiver — and today it
half does not.** The composer offers ten categories and maps them onto the
eight frozen wire values through `categoryWire = [0, 2, 3, 7, 7, 7, 5, 7, 4, 7]`
(`composer.tsx:49`). Cross-referencing that against the receiver's own table
(`nearby.tsx:18`):

| Composer offers | Wire | Receiver displays | |
|---|---:|---|---|
| Medical Emergency | 0 | Medical Emergency | ✅ |
| Fire | 2 | Structure Fire | ✅ |
| Flood | 3 | Flood | ✅ |
| Building Collapse | 5 | Building Collapse | ✅ |
| Violence | 4 | Violence | ✅ |
| Other | 7 | Other Emergency | ✅ |
| **Earthquake** | 7 | **Other Emergency** | ❌ |
| **Landslide** | 7 | **Other Emergency** | ❌ |
| **Cyclone** | 7 | **Other Emergency** | ❌ |
| **Chemical/Gas** | 7 | **Other Emergency** | ❌ |

**Four of ten categories arrive as "Other Emergency", silently.** Pick
"Landslide" on A and B displays "Other Emergency" — the sender has no way to
know. And two wire values, `TRAPPED` (1) and `MISSING_PERSON` (6), cannot be
produced from the composer at all, in a demo whose headline scenario is a
trapped person. (`TRAPPED` does appear in the composer — as a *mobility*
option, which is a different field.)

**Fix:** offer exactly the eight categories that exist on the wire, mapped
1:1, so what the sender picks is what the relay shows. This supersedes §7.2's
item 9.

#### 7.1.2 Show received packets and peers as first-class surfaces

Two gaps, both verified:

- **There is no received-packets view.** The only per-packet surface is
  Diagnostics, which renders `engine.events` — protocol chatter, not deliveries
  — capped at 100 entries.
- **There is no peers view.** `peersRecentlySeen` is a bare integer rendered in
  two places (`index.tsx:74`, `relay.tsx:93`). No identity, no age, no signal.

What to build: a list of **received** SOS packets — category, severity, note,
time, and how it arrived (`local` / `tier1-ble` / `tier2-mic`, with hop count
now that §2.10 populates it). Received only; a node's own packets belong on the
Active SOS screen.

**Nearby is already correctly scoped, and should stay that way.** Verified:
it renders `engine.incidents.list()`, and the reducer only accepts SOS and
responder-lifecycle types (`incident/src:127`). Session control is discarded by
the policy engine before it could ever reach the reducer, and advertisements
are not packets at all. **No inventory or session traffic can appear on
Nearby.** That chatter belongs in Diagnostics, where it should be kept — it is
what made this bring-up debuggable.

#### 7.1.3 Return to Home after an SOS is sent

Current flow, traced:

```
Home ──SOS──▶ /sos/composer ──CONFIRM──▶ alert ──"VIEW TIMELINE"──▶ /sos/active
                     ▲                                                    │
                     └──────── "UPDATE SOS" (primary button) ─────────────┘
```

`/sos/active`'s bottom primary button and its mid-screen "Create an SOS update"
link both `router.push('/sos/composer')` (`active.tsx:85`, `:94`) — so the most
prominent action after sending an SOS is *compose another one*, on a blank
form. Every lap also grows the back stack.

**Fix:** on success, return to Home. Home already carries the active-SOS entry
point, so the timeline stays one tap away without being the thing the flow
pushes you into.

#### 7.1.4 Remove UI for anything not implemented

If it is not in the docs it is not getting built, and a control that does
nothing costs more than the feature's absence. Verified dead surfaces:

| Surface | State |
|---|---|
| Relay screen **QUEUED** and **FWD** | hardcoded `—` (`relay.tsx:126`, `:131`) |
| Composer **language** picker | four languages, no i18n layer exists; supersedes §7.3 item 10 |
| Diagnostics **filter tabs** | `EXPORT LOG` ignores them and shares the whole array (§7.5 item 15) |
| Composer fields dropped by §7.1.1 | `mobility` (unused by any receiving surface) |

`peopleTotal` and `injured` are **deliberately not in this table.** They are
wired end to end and working, and their removal is an open decision awaiting
sign-off — see the flag in §7.1.1. Everything listed above is dead code or a
control that does nothing; those two are neither.

### 7.2 Fix first — these actively mislead

1. **Notification copy.** *"Validated packet 3f53… was received locally"* means
   "this phone now holds it", but reads as "created here" — the exact opposite.
   Use **"Received over Bluetooth from a nearby phone"**. Distinguishing local
   from relayed is what `DEC-022` exists for.

2. **Surface errors where the user is.** `runtimeError` renders **only on the
   Tier 2 tab** (`tier2.tsx:55`). Every BLE error — `BLE_ADVERTISE_*`,
   `E_GATT_MTU_*`, `E_GATT_TIMEOUT` — lands there and nowhere else. Put it on
   **Relay** and **Readiness**.

3. **Show the relay detail string.** `relay-state-changed` carries text like
   *"Bluetooth Classic relay active: BLE advertising unavailable (…)"* and it is
   never displayed. A silent fallback to Classic is invisible today.

4. **Radio label goes stale after fallback.** `NativeTransportAdapter.kind` is
   fixed at construction, so the UI still reads BLE after switching to Classic.
   (Fixing properly is a Gate II change.)

5. **Peer count needs freshness.** Shows a 30-minute-old observation as a
   current count. Either expire on a timer or label it "last seen N m ago" —
   `DEC-020` requires age on everything person-shaped.

6. **Battery reading is stale** — observed 35% displayed while the device was at
   32%. `capability-changed` only arrives on Bluetooth state changes; poll it.

### 7.3 Missing surfaces

7. **No app reset.** `03` requires a scripted demo reset restoring profiles,
   pack baseline, packet/incident/custody state. There is no way to clear state
   from the device — during testing, stale incidents accumulated with no way to
   clear them.

8. **SOS composer is missing two required elements** (`01` screen 3): **location
   source, accuracy and age**, and **confirmation of what will be shared
   locally**. The latter is a privacy requirement (`04 §15.4`). `screen-registry.ts`
   marks the screen `complete` regardless.

   **Still open under §7.1.1, and partly sharpened by it.** Stripping fields
   removes things the user chose to disclose; it does not remove the obligation
   to say what leaves the phone. It arguably raises it: once location is
   attached silently with no field representing it, the disclosure line is the
   *only* place the user learns their position is being broadcast. The smaller
   composer makes this cheaper, not optional — one line above the send button
   covering severity, note, category, location and time.

9. ~~**`EmergencyCategory.TRAPPED` is unreachable**~~ — **superseded by §7.1.1**,
   which found the same defect is wider than this: `MISSING_PERSON` is also
   unreachable, and four of the ten offered categories silently arrive as
   "Other Emergency". The fix is a 1:1 map, not one added entry.

10. **Language selection does nothing.** No i18n layer exists; the Assamese,
    Bengali and Hindi strings in `assam-pack.ts` are unreachable, and the
    composer offers `'mr'` (Marathi, not in the pack) while omitting `'bn'`.
    **Resolved by §7.1.4 as removal** — the picker goes, rather than an i18n
    layer being built to justify it.

### 7.4 Delivery-truth surface

11. **Make the delivery ladder visible on Active SOS.** The domain already
    distinguishes saved / copied-to-peer / responder-seen / uploaded /
    backend-accepted / assigned / en-route / arrived / resolved. Rendering that
    as a stepper is the single most demo-legible thing available, and it is what
    `01` SOS-007 and `04 §17.3` require.

12. **Show transport provenance per packet.** `local` vs `tier1-ble` vs
    `tier2-mic` is already carried on every observation. A one-line badge
    ("received over Bluetooth, 2 hops") turns the invisible mesh into something
    a judge can see.

13. **Nearby bypasses the policy engine.** It renders `runtimeIncidents`
    directly; the `display` decision (`show-minimal` / `hide` for General Public)
    is computed and discarded, against `MAP-011` / `ROL-007`.

14. **The SOS message text is decoded, stored, and never shown.** A relay fully
    parses what it carries — validator, policy, incident reducer — and
    `IncidentView.shortNote` is populated (`incident/src:141`, carried at
    `:272`). But `mobile-controller.ts:398` builds `runtimeIncidents` as
    `{ id, category, severity, peopleTotal, injured, updatedAtS }` and simply
    omits it. Across the whole mobile app `shortNote` appears at three sites,
    **all on the send side** (`composer.tsx:59`, `mobile-controller.ts:271`,
    `:280`) — **zero read sites**.

    So the text typed on A crosses the mesh intact, passes validation, lands in
    B's SQLite and is attached to B's incident record, and the UI never asks
    for it. The notification names a packet ID instead:
    *"Packet 3f53a1b2… received from a nearby phone over Bluetooth."*

    **Fix:** carry `shortNote` through the projection and render it — but gate
    it on `role === 'responder'`, which `nearby.tsx:34` already has in scope.
    Showing it unconditionally would contradict item 13: the policy engine's
    `show-minimal` / `hide` for General Public (`MAP-011` / `ROL-007`) exists
    precisely so a bystander's phone does not display a stranger's free text.

### 7.5 Diagnostics

15. **Export respects no filter.** The screen has filter tabs but `EXPORT LOG`
    shares the whole unfiltered array — confusing when a tab looks empty.

16. **Raise the event cap or make it a ring per category.** 100 events is a few
    minutes of transport chatter; the `inventory: announced` rows proving the
    first successful session had already aged out before they could be exported.

---

## 8. Build and test runbook

```bash
# 1. Kotlin compile check (fast, catches native errors early)
cd apps/mobile/android && ./gradlew :dsm-android-radio-bridge:compileDebugKotlin
```

```bash
# 2. If ONLY packages/ changed, Gradle will not re-bundle. Force it:
rm -rf apps/mobile/android/app/build/generated/assets/createBundleReleaseJsAndAssets
```

```bash
# 3. Build
cd apps/mobile/android && ./gradlew :app:assembleRelease
```

```bash
# 4. Verify the bundle actually contains the app before installing
unzip -l apps/mobile/android/app/build/outputs/apk/release/app-release.apk | grep index.android.bundle
# ~4,049,184 = routes bundled · ~1,425,240 = broken
```

```bash
# 5. Install (transport ids change on reconnect — check first)
adb devices -l
adb -t <ID> install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Per-phone setup: grant Bluetooth/Location/Notifications, **turn Bluetooth on
before first launch** (the adapter is chosen at startup — with Bluetooth off it
latches onto Classic), set one phone to Responder.

---

## 9. Honest scorecard

Three hypotheses were wrong and worth recording, because the pattern matters:

| Hypothesis | Outcome |
|---|---|
| GATT server corrupted by non-idempotent `startRelay` | **Wrong** — stack log disproved it |
| MTU threshold of 247 too strict for these handsets | **Wrong** — 517 granted throughout |
| Concurrent `connectGatt` stacking blocked MTU | **Right** |
| Missing `onDescriptorWriteRequest` | **Right** — found by reading the callback list after the stack log localised the stall |

The fixes that actually made this tractable were the **diagnostic** ones —
making advertising failures loud (§2.2) and giving session rejections a named
reason (§2.5). Before those, every failure looked like `contact-failed` and
progress was guesswork.

The general lesson for the remaining work: **when three layers disagree
(TS test green, Kotlin compiles, hardware fails), trust the hardware and add
instrumentation at the seam.** The advertising bug survived a passing unit test
and a clean compile because neither modelled what the device actually does.

---

## 10. Readiness assessment — is Tier 1 implemented?

Written to answer one question directly: **for a two-phone demo, is Tier 1 built
or not?** The distinction that matters throughout is between *implemented* (the
code exists and does the thing), *proven* (it was measured doing the thing on
hardware), and *visible* (a person watching the screen can tell).

### 10.1 The verdict

**At the protocol and transport layer, Tier 1 is implemented, and it was proven
on two handsets.** That claim is defensible.

It is not scaffolding. Behind the ten-step chain in §3.2 sit 33 frozen message
types, a deterministic codec, 15 ordered validator gates, a six-decision policy
engine, bounded routing with copy budgets and custody, an incident reducer, a
map projection and SQLite persistence — 80 automated tests, a clean boundary
check, 4,005 fuzz cases.

The strongest evidence is not the test count. It is §2: **ten real defects found
by evidence rather than inspection** — a PDU overflow that made every device
undiscoverable, stacked GATT clients that silently killed MTU negotiation, a
missing `onDescriptorWriteRequest` that stalled every session at the last step.
That is the signature of a system someone drove until it actually worked, not
one that merely compiles.

**The demo, however, is not ready — and the gap is presentation, not protocol.**
That is the good kind of gap: cheap, low-risk, and no threat to the three-hop
work. §10.3 is the detail.

**If three phones fail, that will not mean Tier 1 was never built.** Every
component on the relay path has already run on real hardware. It would mean a
relay path needs debugging, which is a different and much smaller problem.

### 10.2 The caveat that outranks every other statement in this document

**The 🟥 evidence in §3.2 predates the current code.**

That run measured a build that no longer exists. Since it was taken, the
following changed (`HD-014`, §6.2, §6.3):

| Change | Risk |
|---|---|
| `INVENTORY` wire format — `idPrefixes` replaces hex strings | new encoding on the wire |
| `HELLO_CAPABILITY` added — **two new records per session** | new record type on the wire |
| Forwarding gate — prefix membership, peer battery band | a mismatch here fails *silently* |
| `listRelayable()` — priority ordering on device | changes which packets are offered |
| Peer record persistence | new fields, new write path |

**All of it is 🟦. None of it has touched a radio.**

Honest risk read: **low, but not zero.** The session shape is unchanged, the
simulator covers the path including three-node chains with loaded queues, and
the new record is small and well-formed. The one genuinely new failure
opportunity is `announceHello()` throwing inside `runSession()`, which would
kill the session exactly the way `announceInventory()` already could — the same
class of failure with one more chance to hit it.

But §9's own lesson governs here: **when the layers disagree, trust the
hardware.** The advertising bug survived a passing unit test and a clean
compile.

> **Action, blocking: re-run the two-phone test immediately after flashing.**
> Until it passes, treat §3.2 as *stale*, not as evidence. Everything else in
> this section assumes that re-run succeeded.

Both phones must be flashed together — `idPrefixes` is a wire change. It
degrades safely if they are not (an older peer reads an empty inventory and
over-sends) but you would be testing the wrong thing. And per §8 step 2, a
`packages/`-only change leaves Gradle's bundle task `UP-TO-DATE`, so the APK
will silently ship the old JavaScript unless the generated-assets directory is
deleted first.

### 10.3 Caveats: what works but cannot be seen

These are the "thin" items. Every one is a **presentation** gap — the packet
crosses the mesh correctly in all of them. They are recorded in detail because
each one, on demo day, looks exactly like a protocol failure to someone who does
not know the code.

#### 10.3.1 The SOS message text is decoded, validated, stored — and rendered nowhere

**What happens:** you type "Trapped on second floor, water rising" on phone A.
It is encoded into `SOS_CREATE.shortNote`, crosses BLE, passes all 15 validator
gates on B, is written to B's SQLite, and is attached to B's incident record —
`IncidentView.shortNote` is populated at `incident/src:141` and carried at
`:272`.

**What you see on B:** nothing. `mobile-controller.ts:398` projects incidents
into UI state as `{ id, category, severity, peopleTotal, injured, updatedAtS }`
and simply omits the field. Across the entire mobile app `shortNote` appears at
three sites — `composer.tsx:59`, `mobile-controller.ts:271` and `:280` — **all
on the send side. There are zero read sites.**

**Why this misleads:** the relay looks like it is forwarding opaque bytes. It is
not — it fully parses, validates and applies policy to every packet, and it
could not decide to relay at all without decoding the header. The message is
*there*, in the database on the receiving phone. The UI never asks for it.

**Also affected:** `packetMessage()` (`mobile-controller.ts:442`), which builds
the human-readable line for the received-packet card, reads `fallbackText`,
`fallbackLabel` and `name` — **not `shortNote`**. So even the one good receipt
surface would show *"SOS_CREATE received and validated."* for a real SOS.

See §7.4 item 14 for the fix, including why it must be gated on responder role.

#### 10.3.2 Four of ten emergency categories arrive as the wrong category

**What happens:** the composer offers ten categories and maps them onto the
eight frozen wire values through `categoryWire = [0, 2, 3, 7, 7, 7, 5, 7, 4, 7]`
(`composer.tsx:49`). Earthquake, Landslide, Cyclone and Chemical/Gas all map to
`7` = `OTHER`.

**What you see:** pick "Landslide" on A; B displays "Other Emergency". Silently —
nothing on either phone indicates the category was lost. Two wire values,
`TRAPPED` (1) and `MISSING_PERSON` (6), cannot be produced from the composer at
all, in a demo whose headline scenario is a trapped person.

**Why this misleads:** it reads as the mesh dropping or corrupting data. It is a
lookup table in one file on the sending phone. The category that *is* sent
arrives perfectly. Full table and fix in §7.1.1.

#### 10.3.3 The notification names a packet ID, not an emergency

A Tier 1 packet arriving over BLE raises:

> **Urgent mesh update**
> Packet `3f53a1b2`… received from a nearby phone over Bluetooth.

That is a substantial improvement on what it replaced (§2.9), and it correctly
names the transport. But a person watching a demo learns only that *something*
arrived. Combined with §10.3.1, the receiving phone never states what the
emergency was.

#### 10.3.4 A good received-packets UI exists — wired only to Tier 2

This is the one worth acting on first, because the work is largely already done.

`tier2.tsx` renders expandable per-packet cards showing the decoded message,
type name, severity, outcome (`applied` / `stored` / `duplicate` / `rejected`)
and every map object the packet changed. It is genuinely good, and it is the
surface an evaluator would want for Tier 1.

It is **structurally Tier 2 only**: `ReceivedPacketSummary.transport` is typed
`'tier2-mic' | 'tier2-direct'` (`useAppStore.ts:23`), `addReceivedPacket` is
called from exactly one site — the WavePX recovery path
(`mobile-controller.ts:225`) — and it renders on one screen.

**The consequence is awkward: the acoustic fallback has a better receipt surface
than the primary radio.** Tier 1 receives reach `onIngested`, raise the
packet-ID notification of §10.3.3, and produce nothing else.

**Fix:** widen the `transport` union, call `addReceivedPacket` from the
`onIngested` hook, and teach `packetMessage()` about `shortNote`. Mostly
existing code, and the single highest-value change available.

#### 10.3.5 Every BLE error renders only on the Tier 2 tab

`runtimeError` is read in exactly one place: `tier2.tsx:55`. Every
`BLE_ADVERTISE_*`, `E_GATT_MTU_*` and `E_GATT_TIMEOUT` lands on a screen nobody
is looking at during a Tier 1 demo.

This is worse than cosmetic, and worse during **bring-up** than during the demo:
the three-phone session is exactly when a named failure reason is needed, and §9
records that making failures loud is what turned this project's guesswork into
progress. Put it on Relay and Readiness before the three-phone run, not after.
(§7.2 item 2.)

#### 10.3.6 There is no way to clear state on the device

`03` requires a scripted demo reset restoring profiles, pack baseline, and
packet/incident/custody state. **No reset path exists** — the only `reset()` in
the mobile service is `wavePxReceiver.reset()`, which is Tier 2 metrics only.

Stale incidents accumulated across testing with no way to clear them. On demo
day this compounds: every rehearsal leaves residue, so the tenth run shows nine
runs' worth of incidents and the SOS being demonstrated is one card among many.
Treated here as a **demo-day hazard**, not a nice-to-have. (§7.3 item 7.)

#### 10.3.7 The SOS flow sends you back to compose another SOS

After saving, the flow lands on `/sos/active`, whose primary bottom button and
mid-screen link both `router.push('/sos/composer')` (`active.tsx:85`, `:94`) —
so the most prominent action after sending an SOS is composing a second one on a
blank form, and each lap grows the back stack. (§7.1.3.)

### 10.4 Caveats: what has never been measured

Distinct from §10.3 — these are not presentation gaps. Nobody knows the answer.

| Unmeasured | Why it matters |
|---|---|
| **Reliability: n≈1** | One successful run is not a demo you can stake anything on. Target is ≥95% over 20–50 trials. This is the largest single gap at two phones. |
| **Battery and thermal cost** | No duty cycling exists — `BATTERY.DUTY_CYCLE` is declared and read by nothing, so advertising runs 100% while relay is on. Cost over a demo-length session is unknown. |
| **Screen-off / background survival** | Untested. vivo's Funtouch is aggressive about backgrounded apps; behaviour is per-OEM and the two handsets differ. |
| **Bluetooth Classic fallback** | 🟩 implemented, never once exercised. The `DEC-006` path is code nobody has run. |
| **Three-hop relay** | `03`'s definition of done. Simulator-proven (🟦) including with a loaded relay queue; never on hardware. |

### 10.5 What to do, in order

1. **Re-run the two-phone test after flashing.** Blocking — §10.2. Everything
   below assumes it passed.
2. **Widen the received-packets card to Tier 1** and teach `packetMessage()`
   about `shortNote` (§10.3.4, §10.3.1). Largest visible gain per unit of work.
3. **Fix the category map 1:1** (§10.3.2).
4. **Move `runtimeError` onto Relay and Readiness** (§10.3.5) — needed *during*
   the three-phone bring-up, not after it.
5. **Add a state reset** (§10.3.6).
6. **Reliability trials toward n=20** (§10.4).

Items 2–4 are small and would move the demo from *"trust our logs"* to *"watch
the screen."*
