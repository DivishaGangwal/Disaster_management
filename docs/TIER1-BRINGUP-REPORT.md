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

**69 automated tests passing**, `npm run boundaries` clean, fuzz 4,005 cases 0 findings.

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

## 5. Testing

### 5.1 Done

| Test | Evidence |
|---|---|
| 69 unit/integration/simulator tests | 🟦 |
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
is "three-phone propagation with overlapping ranges", not multi-hop. Verify the
**same packet ID** appears on all three phones (`02` invariant 5).

---

## 6. Known defects and gaps

### 6.1 ~~Notification storm~~ — FIXED (see §2.9)

Resolved in this session. Notifications now follow `PolicyOutcome.alert`,
ignore session control, skip duplicates and locally created packets, and name
the transport they arrived on.

### 6.2 SQLite and memory stores disagree on queue fairness

| | `listRelayable` ordering |
|---|---|
| `memory-store` (all 69 tests) | priority first, then oldest — correct per `02` |
| `sqlite-repositories` (the phones) | `ORDER BY stored_at_ms` — priority ignored |

The simulator is not faithfully modelling the device. Not currently blocking
(under 64 packets held, so all are candidates), but a green simulator run does
not guarantee device behaviour.

### 6.3 Other open items

| Item | Status |
|---|---|
| Inventory truncates to ~4 IDs | `HD-012`; 8-byte raw prefixes would raise it to ~21. Causes redundant pushes, not lost packets |
| `HELLO_CAPABILITY` never sent | session skips `hello` with no record on the wire — **undocumented deviation** |
| `PACKET_REQUEST` never sent | documented `HD-001` |
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

### 7.1 Fix first — these actively mislead

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

### 7.2 Missing surfaces

7. **No app reset.** `03` requires a scripted demo reset restoring profiles,
   pack baseline, packet/incident/custody state. There is no way to clear state
   from the device — during testing, stale incidents accumulated with no way to
   clear them.

8. **SOS composer is missing two required elements** (`01` screen 3): **location
   source, accuracy and age**, and **confirmation of what will be shared
   locally**. The latter is a privacy requirement (`04 §15.4`). `screen-registry.ts`
   marks the screen `complete` regardless.

9. **`EmergencyCategory.TRAPPED` is unreachable** from the composer's
   `categoryWire` map — in a demo whose headline scenario is a trapped person.

10. **Language selection does nothing.** No i18n layer exists; the Assamese,
    Bengali and Hindi strings in `assam-pack.ts` are unreachable, and the
    composer offers `'mr'` (Marathi, not in the pack) while omitting `'bn'`.

### 7.3 Delivery-truth surface

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

### 7.4 Diagnostics

14. **Export respects no filter.** The screen has filter tabs but `EXPORT LOG`
    shares the whole unfiltered array — confusing when a tab looks empty.

15. **Raise the event cap or make it a ring per category.** 100 events is a few
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
