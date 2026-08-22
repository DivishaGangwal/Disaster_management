# Feature matrix — what works, what doesn't, and why

One row per feature. **"Likely cause"** is filled in for everything not working,
so the owning workstream starts from a diagnosis rather than a blank page.

Legend — **status**: ✅ working · 🟡 partial · ❌ not built
Legend — **evidence**: 🟩 static check · 🟦 simulator · 🟥 real Android device

> Nothing in this file claims 🟥. No real device has been run yet.

---

## 1. Offline foundation (OFF-001 … OFF-008)

| Feature | Req | Status | Evidence | Owner | Likely cause if not working |
|---|---|---|---|---|---|
| Create SOS with no internet | OFF-002 | ✅ | 🟦 | C | — |
| Durable across process restart | OFF-003 | ❌ | — | C | **Store is in-memory only.** `MemoryPacketRepository` implements the real semantics but has no disk backing. Needs the expo-sqlite implementation behind the existing `PacketRepository` port. |
| Missing gateway is normal state | OFF-004 | ✅ | 🟩 | E | — |
| GPS failure does not block SOS | OFF-005 | ✅ | 🟩 | C | Location is optional in `SosCreatePayload`; `LocationSource.UNKNOWN` is a valid value. |
| Content pack readable offline | OFF-006 | 🟡 | 🟩 | D | Pack loading works; **the pack itself is synthetic** and there is no base-map artifact yet. |
| Clock-uncertainty tolerance | OFF-008 | ✅ | 🟩 | C | Bounded skew + separate local receive time. |

## 2. SOS lifecycle (SOS-001 … SOS-010)

| Feature | Req | Status | Evidence | Owner | Likely cause if not working |
|---|---|---|---|---|---|
| Rapid + expanded SOS payload | SOS-002/003 | ✅ | 🟩 | C | Builder exists; **the composer screen does not**. |
| Stable incident + packet identity | SOS-004 | ✅ | 🟩 | C | — |
| Update raises source sequence | SOS-005 | ✅ | 🟦 | C | — |
| Cancel is terminal, keeps audit | SOS-006 | ✅ | 🟦 | C | — |
| Six delivery states tracked apart | SOS-007 | ✅ | 🟦 | A/C | `DeliveryFacts` tracks each separately. |
| Relay copy never = "help is coming" | SOS-008 | ✅ | 🟩 | A | `DELIVERY_STATE_COPY` + boundary checker greps for the phrase. |
| Terminal stops replication | SOS-009 | ✅ | 🟦 | C | — |

## 3. Relay / Tier 1 (REL-001 … REL-010)

| Feature | Req | Status | Evidence | Owner | Likely cause if not working |
|---|---|---|---|---|---|
| Real BLE advertise / scan | REL-002 | ❌ | — | **B** | **The native module does not exist.** This is the critical path. `apps/mobile` throws a clear error for any non-simulated adapter rather than pretending. |
| GATT server / client | REL-002 | ❌ | — | **B** | Same — needs the Expo development build. |
| Foreground relay service | REL-001 | ❌ | — | **B** | Android foreground service + ongoing notification not written. |
| Inventory before full transfer | REL-003 | ✅ | 🟦 | C | Both sides announce and filter. Repeat contacts now transfer nothing (`offered: 0, peerAlreadyHolds: 2`). |
| Receiver requests missing items | REL-004 | 🟡 | 🟦 | C | Intent met by filtered push, but the literal `PACKET_REQUEST` round trip is not implemented — see HD-001 in docs/DECISIONS-HACKATHON.md. |
| Bidirectional session | DEC-005 | ✅ | 🟦 | C | Fixed this pass; was one-directional. |
| Dedup suppresses repeat action | REL-006 | ✅ | 🟦 | C | — |
| Hop / expiry / copy budget / cooldown | REL-007 | ✅ | 🟦 | C | — |
| Store-carry-forward | REL-008 | ✅ | 🟦 | C | Scenario C passes. |
| Survives Bluetooth loss / restart | REL-010 | ❌ | — | B/C | Blocked on both the native adapter **and** durable storage. |

## 4. Gateway (GTW-001 … GTW-008)

| Feature | Req | Status | Evidence | Owner | Likely cause if not working |
|---|---|---|---|---|---|
| Live probe required for gateway | GTW-001 | ✅ | 🟦 | E | Identity check defeats captive portals. |
| Priority-aware resumable upload | GTW-002 | ✅ | 🟦 | E | — |
| Many gateways → one incident | GTW-003 | ✅ | 🟦 | E | Tested: 2 gateways, 1 incident, 2 observations. |
| Backend ack returns as a packet | GTW-004 | ✅ | 🟦 | E | — |
| Downloads use the same validator | GTW-005 | ✅ | 🟩 | E | Structural — `ingest()` is the only ingress. |
| Downloads re-advertised into Tier 1 | GTW-006 | 🟡 | 🟦 | E/B | Logic is in place; **unprovable without real BLE**. |
| Backend success only after ack reaches source | GTW-008 | ✅ | 🟦 | A/C | — |

## 5. Map (MAP-001 … MAP-012)

| Feature | Req | Status | Evidence | Owner | Likely cause if not working |
|---|---|---|---|---|---|
| Base map renders offline | MAP-001 | ❌ | — | **D** | **No base-map artifact exists.** Region not yet selected. |
| Stable compact object IDs | MAP-002 | 🟡 | 🟩 | D | Registry works; IDs are synthetic placeholders. |
| Typed updates are idempotent | MAP-006 | ✅ | 🟩 | D | — |
| Newer sequence wins, history kept | MAP-007 | ✅ | 🟩 | D | — |
| Missing object → fallback, no substitution | MAP-008 | ✅ | 🟩 | D | — |
| Tier 1 / gateway / Tier 2 → one projection | MAP-009 | ✅ | 🟦 | D | Structural — one `toMapOperations()`. |
| Filters and list equivalents | MAP-010 | ✅ | 🟩 | A/D/E | MapLibre exposes incident, centre, route, and hazard layers; the adjacent register is the list equivalent. |
| Map projection | MAP-001 | 🟩 | 🟩 | A | MapProjection logic written; UI is scaffolding. |

## 6. Tier 2 / ggwave (T2-001 … T2-013)

| Feature | Req | Status | Evidence | Owner | Likely cause if not working |
|---|---|---|---|---|---|
| Compact frame format | T2-001 | ✅ | 🟩 | F | 12-byte overhead vs 64 for Tier 1. |
| **Actual ggwave encode/decode** | T2-001 | 🟡 | 🟩 | **F** | Browser encode/decode is wired to raw Tier 2 frames and WAV export is runtime-checked. Android still needs the `AudioRecord` PCM bridge. |
| Microphone path | T2-002 | 🟡 | 🟩 | F/B | Browser microphone capture and decode are implemented; measured two-device acoustic evidence and Android PCM remain outstanding. |
| Mic ≡ direct equivalence | T2-004 | ✅ | 🟦 | F | Proven **at frame level**: both paths recover byte-identical canonical packets. Not yet proven through real audio. |
| Campaign manifest | T2-005 | ✅ | 🟩 | F | — |
| Critical items repeat more | T2-006 | ✅ | 🟩 | F | — |
| Corrupt frame = absent, not partial | T2-007 | ✅ | 🟩 | F | — |
| Duplicate suppression | T2-008 | ✅ | 🟦 | F | — |
| Radio-to-mesh bridge | T2-011 | ✅ | 🟦 | F/C | Scenario H passes: a non-listening peer receives it over Tier 1. |
| Decodes cache references | T2-010 | 🟡 | 🟩 | D | Engine processes them; UI logic for forms pending. |

## 7. Web surfaces (WEB-001 … WEB-010)

| Feature | Req | Status | Evidence | Owner | Likely cause if not working |
|---|---|---|---|---|---|
| Deduplicated incident + observations | WEB-001 | ✅ | 🟦 | E | Merged console shows one incident with separate gateway observations. |
| Assignment / lifecycle actions | WEB-002 | 🟡 | 🟩 | E | Roster and assignment packet emission work; responder-side accept/en-route/arrive remains mobile work. |
| Authority composer + byte preview | WEB-005 | ✅ | 🟩 | E/F | Composer renders the real `planCampaign()` byte, frame, repetition, and duration preview, and carries an operator-selected broadcast point in the alert packet. |
| Check-in campaign composer | WEB-004 | ❌ | 🟩 | E | **Removed from the console (HD-010).** The frozen check-in packet types are untouched; nothing composes them. |
| Campaign state machine | WEB-006 | ✅ | 🟩 | F | — |
| Edit after approval resets it | WEB-007 | ✅ | 🟩 | F | `contentEdited()`. |
| Decode-before-broadcast | WEB-009 | ✅ | 🟩 | F | Two browser station modes, raw frame recovery, CRC validation, exact expected/recovered comparison, and persisted pass/fail results are implemented. Recovered frames are replayed through `Tier2Receiver`, rebuilt into the canonical packet and compared byte-for-byte before anything is reported as decoded. Physical acoustic evidence remains separate. |
| Region-bounded outbound | WEB-010 | ✅ | 🟦 | E | — |
| **Merged operations console** | — | ✅ | 🟩 | **E** | Five authority and four broadcaster surfaces live in one responsive Vite/React application with no role switch. |
| Interactive operations map | WEB-001/004 | ✅ | 🟩 | E | MapLibre clusters and filters live GeoJSON; centre popup actions publish versioned packets rather than changing local-only marker state. |
| Packet network inspector | WEB-010 | ✅ | 🟩 | E | Three-second refresh shows direction, hop facts, gateway evidence, decoded payload and exact canonical bytes. |

## 8. Mobile app

| Feature | Status | Owner | Likely cause |
|---|---|---|---|
| All 12 screens | ❌ | **A** | **Not built.** `screen-registry.ts` lists every required element and requirement ID per screen. `AppRuntime` gives working packets/policy/incidents in Expo Go today. |
| Navigation shell | ❌ | A | React Navigation is declared in `package.json` but not wired. |
| Accessibility pass | ❌ | A | Depends on screens existing first. |
| Notification policy | ❌ | A | Policy engine already returns the alert decision; nothing consumes it. |

## 9. Files and images (FIL-001 … FIL-007)

| Feature | Req | Status | Owner | Likely cause |
|---|---|---|---|---|
| Manifest + bounded fragments | FIL-001 | ✅ | C | — |
| SOS preempts file transfer | FIL-005 | ✅ | C | Scenario J passes. |
| Reassembly + whole-object integrity | FIL-004 | ✅ | C | `FileAssembler` verifies the whole-object digest before visibility; a mismatch discards the object. |
| Reject executables / zip bombs | FIL-006 | ✅ | C | `MimeCategory` defined; EXECUTABLE and ARCHIVE refused at manifest time; orphan fragments never stored. The prototype has no decompressor at all (HD-003). |

---

## The three things blocking the most

1. **Native Android module (WS-B)** — blocks 8 features and every 🟥 row in the
   repo. Nothing else on the critical path can start without it.
2. **Android ggwave PCM integration (WS-B/F)** — the browser modem is wired; Android and measured physical reception still block device evidence.
3. **Durable storage (WS-C)** — blocks OFF-003 and REL-010; a one-package change
   behind an interface that already exists.

## What is genuinely finished

The protocol, validation, policy, incident model, map projection, routing, and
the backend coordination loop. 31 tests, all passing. Those layers are unlikely
to need rework as the remaining pieces land, because each remaining piece plugs
into an interface that is already frozen and already has a working reference
implementation.
