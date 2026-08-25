# Disaster SOS Mesh — Project Workflow & Structure Report

> **Generated:** 2026-08-25  
> **Project:** Disaster SOS Mesh (SIH Hackathon Prototype)  
> **Location:** Root of `Disaster_management/`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Current Workflow — How Everything Connects](#2-current-workflow--how-everything-connects)
3. [The App — Mobile Implementation](#3-the-app--mobile-implementation)
4. [APK Build & Runtime Pipeline](#4-apk-build--runtime-pipeline)
5. [BLE (Bluetooth Low Energy) Implementation](#5-ble-bluetooth-low-energy-implementation)
6. [ggwave / Tier 2 — Current Status](#6-ggwave--tier-2--current-status)
7. [Redundancy & Overlap Analysis](#7-redundancy--overlap-analysis)
8. [Project Structure](#8-project-structure)
   - [Packages](#81-packages-packagesx)
   - [Apps](#82-apps-appsx)
   - [Tools — Tests & Results](#83-tools--tests--results)
9. [Test Summary — All Tests & Results](#9-test-summary--all-tests--results)
10. [What's Remaining](#10-whats-remaining)

---

## 1. Project Overview

Disaster SOS Mesh is an **Android emergency communication system** that lets phones exchange and relay compact disaster packets over **Bluetooth (BLE + Classic)** when towers, Wi-Fi, and internet service are unavailable. It optionally bridges through any phone that later finds usable internet, and can receive authority information from prepared radio audio over a separate **ggwave Tier 2 path**.

**Key constraints:**
- Offline-first — SOS creation, local storage, map viewing, Bluetooth relay, and responder actions all work **without internet**
- Internet is needed only for the one-time offline map download and optional gateway sync
- This is a **Smart India Hackathon prototype** — not a production emergency service
- The operational region is **Assam (IN-AS)**

---

## 2. Current Workflow — How Everything Connects

```
┌──────────────────────────────────────────────────────────────────────┐
│                     CITIZEN'S PHONE (Android)                        │
│                                                                      │
│  [User creates SOS]                                                  │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────┐   ┌───────────┐   ┌──────────────┐                │
│  │ SOS Composer │──▶│   Codec   │──▶│  Validator    │                │
│  │ (screens)    │   │ (64-byte  │   │ (15 gates)   │                │
│  └─────────────┘   │  envelope)│   └──────┬───────┘                │
│                     └───────────┘          │                         │
│                                            ▼                         │
│                     ┌──────────────────────────────┐                │
│                     │       NodeEngine.ingest()     │ ◀── SINGLE    │
│                     │    (composition root)         │     INGRESS   │
│                     └──────────┬───────────────────┘                │
│                                │                                     │
│              ┌─────────────────┼─────────────────┐                  │
│              ▼                 ▼                  ▼                  │
│       ┌──────────┐    ┌────────────┐     ┌─────────────┐            │
│       │  Policy  │    │   Store    │     │  MapProject  │            │
│       │ (6 indep │    │ (SQLite /  │     │  (Assam      │            │
│       │  decide) │    │  memory)   │     │   content    │            │
│       └────┬─────┘    └────────────┘     │   pack)      │            │
│            │                              └─────────────┘            │
│            ▼                                                         │
│    ┌───────────────┐                                                 │
│    │  Relay Loop   │ ◀── Foreground service with Stop control        │
│    └───────┬───────┘                                                 │
│            │                                                         │
│     ┌──────┴──────┐                                                  │
│     ▼             ▼                                                  │
│  ┌──────┐    ┌─────────┐                                            │
│  │ BLE  │    │Classic  │ ◀── Automatic fallback when BLE             │
│  │ GATT │    │ RFCOMM  │     roles unavailable                       │
│  └──┬───┘    └────┬────┘                                            │
│     └──────┬──────┘                                                  │
│            ▼                                                         │
└───────── OVER THE AIR (Bluetooth) ──────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│         NEARBY PHONE (Tier 1 relay)      │
│  Same NodeEngine.ingest() → store/relay  │
└──────────────┬───────────────────────────┘
               │ (if internet found)
               ▼
┌──────────────────────────────────────────┐
│    COORDINATION BACKEND (SQLite)         │
│  ┌─────────────┐   ┌─────────────────┐  │
│  │ Gateway Loop │   │ Incident Dedup  │  │
│  │ (bidirect.)  │   │ Responder Ops   │  │
│  └─────────────┘   └─────────────────┘  │
│  ┌─────────────────────────────────────┐ │
│  │   Web Authority Console (React)     │ │
│  │   - Map + incident queue            │ │
│  │   - Responder roster                │ │
│  │   - Regional editor                 │ │
│  │   - Campaign approval → ggwave      │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
               │
               ▼ (Tier 2: one-way radio downlink)
┌──────────────────────────────────────────┐
│    GGWAVE / WavePX (Authority → Phone)   │
│  Website encodes canonical packet bytes  │
│  → audio → radio → microphone/WAV on     │
│    phone → Tier2Receiver → NodeEngine    │
└──────────────────────────────────────────┘
```

### Data Flow Summary

| Path | Direction | Transport | What Travels |
|------|-----------|-----------|-------------|
| **Tier 1** | Bidirectional (phone ↔ phone) | BLE preferred, Classic fallback | 64-byte canonical disaster packets |
| **Gateway** | Bidirectional (phone ↔ backend) | HTTP over internet | Same canonical packets, uploaded/downloaded |
| **Tier 2** | One-way (authority → phones) | ggwave audio over radio | Same canonical packet bytes as Tier 1 fragments |

**Critical invariant:** All three transport paths enter through `NodeEngine.ingest()`. The same 15-gate validation pipeline, the same policy engine, and the same map projection apply regardless of source.

---

## 3. The App — Mobile Implementation

### Technology Stack
- **Framework:** React Native + Expo (DEC-003)
- **Navigation:** Expo Router (file-based routing)
- **Persistence:** `expo-sqlite` for durable packet log, custody records, incident state
- **Map:** MapLibre GL with persistent offline basemap (Assam zooms 5–12)
- **State management:** Zustand with persistence migration
- **Styling:** NativeWind (TailwindCSS for React Native)

### Two Runtimes (DEC-004)

| Runtime | Transport | What Works |
|---------|-----------|------------|
| **Stock Expo Go** | Simulated | Every route, SOS creation, durable local state, Assam map/list, incident timelines, diagnostics. **No native offline-pack download.** |
| **Expo Development Build** | Native BLE preferred, Classic fallback | The judged Tier 1 runtime: native Assam basemap download + advertise/scan/GATT or RFCOMM + foreground relay service |

The demo **must never claim** stock Expo Go runs the real Bluetooth mesh. The capability report carries `simulated: true` and the readiness screen shows it verbatim.

### App Architecture

```
apps/mobile/
├── App.tsx                           # Root Expo Router entry
├── app/                              # Expo Router file-based routes
│   └── (tabs)/                       # Tab-based navigation
├── src/
│   ├── screens/
│   │   └── screen-registry.ts        # 12 required screen specs + status
│   ├── services/
│   │   ├── app-runtime.ts            # THE single entry point to the engine
│   │   ├── mobile-controller.ts      # Startup, SOS, relay, gateway orchestration
│   │   ├── notifications.ts          # Android notification channels (MAX/HIGH/LOW)
│   │   ├── offline-map.ts            # MapLibre OfflineManager integration
│   │   └── sqlite-repositories.ts    # expo-sqlite packet/peer/map persistence
│   ├── components/                   # Reusable UI components
│   └── theme/                        # Visual theming
├── store/                            # Zustand app state
├── constants/                        # App constants
└── data/                             # Local data files
```

### 12 Mobile Screens — Status

| # | Screen | Route | Status |
|---|--------|-------|--------|
| 1 | Readiness and role | `Readiness` | ✅ Complete |
| 2 | Citizen home | `Home` | ⚠️ Partial |
| 3 | SOS composer | `SosComposer` | ✅ Complete |
| 4 | Active SOS timeline | `ActiveSos` | ⚠️ Partial |
| 5 | Offline operational map | `Map` | ⚠️ Partial |
| 6 | Nearby incidents | `NearbyIncidents` | ✅ Complete |
| 7 | Responder incident detail | `ResponderIncident` | ✅ Complete |
| 8 | Resource detail | `ResourceDetail` | ✅ Complete |
| 9 | Relay & gateway status | `RelayStatus` | ⚠️ Partial |
| 10 | Tier 2 listening | `Tier2Listen` | ⚠️ Partial |
| 11 | Diagnostics | `Diagnostics` | ✅ Complete |
| 12 | Profile & offline data | `Profile` | ✅ Complete |

**"Partial" means:** the route/contract exists and core features work, but some evidence that cannot be invented (e.g., responder acknowledgement not observed locally, physical radio measurements) remains incomplete.

### Key Design Decisions in the App

1. **Screens NEVER import a transport, a codec, or a repository directly** — they go through `AppRuntime` only
2. **Truthful delivery semantics:** a link receipt means "another phone stored a copy" — it does NOT mean rescue is coming
3. **Restart-safe:** startup replays all durable packets to rebuild map projection, incident state, and active SOS identity
4. **Bounded storage:** SQLite enforces max packet count; lowest-priority, oldest eligible packets are evicted first; locally created SOS packets and critical traffic are protected from eviction

---

## 4. APK Build & Runtime Pipeline

### How the APK Is Built

```
                    ┌─────────────────────────┐
                    │  Expo Development Build  │
                    │  (npx expo run:android)  │
                    └────────────┬────────────┘
                                 │
                    Autolinks native modules:
                    ├── dsm-android-radio-bridge (BLE/Classic/WavePX)
                    ├── MapLibre GL Native
                    └── expo-sqlite
                                 │
                    ┌────────────▼────────────┐
                    │  Gradle Build System     │
                    │  :app:compileDebugKotlin │
                    │  + CMake native builds   │
                    │    (4 ABIs: arm64, arm,  │
                    │     x86, x86_64)         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  app-debug.apk           │
                    │  ~6.54 MB Hermes bundle  │
                    └─────────────────────────┘
```

### What the Native Bridge (`dsm-android-radio-bridge`) Contains

The native Expo module at `native/android-radio-bridge/` contains three Kotlin files:

| File | Purpose |
|------|---------|
| `AndroidRadioBridgeModule.kt` | BLE advertise/scan, GATT server/client, Bluetooth Classic RFCOMM, session management, MTU negotiation, serialized write queues |
| `RelayForegroundService.kt` | Android foreground service notification with Stop action, `START_NOT_STICKY` (won't falsely restart) |
| `WavePxAudioReceiver.kt` | 48 kHz `AudioRecord` PCM capture → native ggwave decoder → raw WavePX frames |

Plus a C++/JNI layer:
| File | Purpose |
|------|---------|
| `wavepx-jni.cpp` | JNI bridge from Kotlin to the vendored ggwave C library |
| `vendor/` | Vendored ggwave native library (compiled for 4 ABIs) |

### Runtime Selection Flow

```
App launches
    │
    ├─ Expo Go? ──▶ SimulatedTransportAdapter (no real Bluetooth)
    │               CapabilityReport.simulated = true
    │
    └─ Dev build? ──▶ NativeTransportAdapter
                      │
                      ├─ BLE roles available? ──▶ BLE mode (preferred)
                      │   • BluetoothLeAdvertiser
                      │   • BluetoothLeScanner
                      │   • BluetoothGattServer / BluetoothGatt client
                      │
                      └─ BLE roles unavailable? ──▶ Bluetooth Classic fallback
                          • RFCOMM sockets
                          • Length-prefixed records
                          • Rotating discovery tokens
```

---

## 5. BLE (Bluetooth Low Energy) Implementation

### Architecture

BLE is the **preferred** Tier 1 transport. The implementation sits entirely within `native/android-radio-bridge/` and is accessed through the `TransportAdapter` seam.

### Advertisement (Discovery)

| Property | Value |
|----------|-------|
| PDU type | Legacy advertising (31 bytes max) |
| Channels | 37, 38, 39 (automatic, no API control) |
| Data format | Manufacturer-specific under company ID `0xffff` (SIG testing reserved) |
| Payload size | **12 bytes** encoded; complete PDU is **19 of 31 bytes** |
| Magic byte | `0xd5` (to distinguish from other `0xffff` advertisers) |
| Content | "I exist, my queue changed, my highest priority is N" — **NOT** the SOS itself |
| Forbidden in advert | Name, phone number, SOS text, exact coordinates, exact incident ID, permanent account ID, full inventory |

**An advertisement is NOT the packet.** The smallest SOS is 115 bytes; an advertisement only holds 31. The advertisement announces; the GATT connection carries the actual packet.

### GATT Session (Data Transfer)

```
Phone A ──advertise──▶ Phone B sees it
Phone A ◀──connect──── Phone B opens GATT
         MTU negotiation (requires 247)
         Service discovery
         CCCD subscription
         ──── Session established ────
Phone A ──▶ INVENTORY ──▶ Phone B
Phone A ◀── INVENTORY ◀── Phone B
Phone A ──▶ push missing packets ──▶ Phone B
Phone A ◀── push missing packets ◀── Phone B
         ──── Initiator closes session ────
```

| GATT Detail | Implementation |
|-------------|---------------|
| MTU | 247 required; usable per write = 244 bytes; packet payload ≤ 180 bytes |
| Writes | Serialized — one active GATT operation at a time (Android requirement) |
| Confirmation | `sendRecord` resolves only after Android's `onCharacteristicWrite` callback |
| Server receives | Validates offset, characteristic, size before accepting |
| Fallback | Bluetooth Classic RFCOMM when BLE roles unavailable |

### Relay Service

- Runs as an Android **foreground service** with ongoing notification
- Notification includes a **Stop action** that tears down Bluetooth relay resources
- Uses `START_NOT_STICKY` — won't falsely restart and imply relay was restored
- Relay mode is explicit, visible, and stoppable (REL-001)

### Session Optimization (HD-013)

Remembers `(their epoch, our epoch)` at last completed reconciliation. Skips the session entirely when neither side has changed — measured 47–54% reduction in session overhead for converged meshes.

### Current BLE Status

| Aspect | Status |
|--------|--------|
| Code implementation | ✅ Complete |
| Compile check (Kotlin + 4 ABIs) | ✅ Passing |
| Physical device testing | ❌ **Not yet done** |
| Screen-off/background behavior | ❌ **Unmeasured** |
| Device capability matrix | ❌ **Not yet filled** |

---

## 6. ggwave / Tier 2 — Current Status

### What ggwave/WavePX Is

ggwave is a **one-way authority downlink** — Tier 2. It is NOT a phone-to-phone channel. The flow is:

```
Authority console (website)
    │
    ▼
Campaign composer → approve → generate WavePX audio
    │                          (canonical packet bytes → audio frames)
    ▼
Radio broadcast (speaker/transmitter)
    │
    ▼
Phone microphone / WAV file
    │
    ▼
WavePX decoder → raw frames → CRC + reassembly
    │
    ▼
Canonical packet bytes → NodeEngine.ingest()
    │
    ▼
Same validation/policy/map as Tier 1
```

### Key Design Points

1. **Self-contained frames:** Tier 2 fragments carry **complete canonical Tier 1 bytes**. The receiver decodes without needing the campaign manifest
2. **ggwave is kept inside WavePX** as the physical modem — it is not exposed directly
3. **Campaign lifecycle:** Draft → Budget checked → Authority approved → Broadcast desk → Audio ready → Software decode passed → Scheduled → Playback recorded → Archived
4. **Post-approval edits reset approval** — editing approved content returns it to draft
5. **Over-budget campaigns are reported honestly** — never silently truncated

### Current Implementation Status

| Component | Status | Evidence |
|-----------|--------|----------|
| Frame codec (encode/decode) | ✅ Done | 🟦 Integration tested |
| Independent receiver (no manifest needed) | ✅ Done | 🟦 Automated tests |
| Campaign planner (`planCampaign()`) | ✅ Done | 🟩 Source checked |
| Browser WavePX transmitter | ✅ Done | 🟩 Source checked |
| Browser microphone receiver | ✅ Done, **acoustically unmeasured** | 🟩 Source checked |
| WAV file input/decode | ✅ Done | 🟩 Source checked |
| WAV export + playback | ✅ Done | 🟩 Source checked |
| Exact byte comparison (recovered vs expected) | ✅ Done | 🟩 Source checked |
| Android native `AudioRecord` 48 kHz PCM receiver | ✅ Implemented, **acoustically unmeasured** | 🟩 Compile checked (4 ABIs) |
| Packet → WavePX → decode → map operation | ✅ Done | 🟦 Integration tested (create, close, move, reopen) |
| Physical speaker-to-phone acoustic test | ❌ **Not yet done** | No physical setup available |

### What ggwave Does NOT Do

- ❌ Phone-to-phone communication (that's Tier 1 / Bluetooth)
- ❌ Carry maps, large media, or normal conversation
- ❌ Prove physical acoustic reception (software comparison only)
- ❌ Licensed radio-chain transmission verification

---

## 7. Redundancy & Overlap Analysis

### ✅ No Redundant Features Found in Core Logic

The architecture is deliberately designed with **strict module boundaries** enforced by `npm run boundaries`. Key separation:

| Concern | Single Owner | No Duplication |
|---------|-------------|---------------|
| Message type codes | `@dsm/contracts` only | Build fails if re-declared elsewhere |
| Packet validation | `@dsm/validator` (15 gates) | All transports share the same pipeline |
| Policy decisions | `@dsm/policy` (6 independent decisions) | One engine, not per-transport policies |
| Map projection | `@dsm/mapkit` → `toMapOperations()` → `MapProjection` | No "BLE map" vs "gateway map" vs "ggwave map" |
| Ingress | `NodeEngine.ingest()` | No privileged path — backend's own packets are validated same as strangers' |

### ⚠️ Potential Overlaps / Items Worth Noting

| Area | Observation | Verdict |
|------|-------------|---------|
| `PACKET_REQUEST` (0xf2) | Defined, has a builder and field map, but is **never sent** (HD-001). Filtered inventory push provides the same missing-only behavior. | **Not redundant** — deliberately reserved, documented deviation |
| Check-in campaigns | `CHECKIN_CAMPAIGN` / `CHECKIN_RESPONSE` types, field maps, and validator rules exist in contracts, but the console **does not compose them** (HD-010). | **Dead code by design** — frozen types preserved for future use, not silently removed |
| `RECORD_UPSERT` | Defined in contracts but the codec **throws** when you try to encode it — dynamic string-keyed maps are unsupported (HD-009). | **Unusable by design** — better than the previous silent data loss |
| `SimulatedTransportAdapter` vs `NativeTransportAdapter` | Two transport implementations behind the same `TransportAdapter` seam. | **Not redundant** — this is the intentional architecture seam (Gate II) enabling parallel development |
| Simulated vs native WavePX receiver | Browser-side WavePX uses JS, Android uses C++/JNI. Both feed the same `Tier2Receiver`. | **Not redundant** — platform-specific implementations of the same contract |
| `DiscoverySummary` encoding | Was previously a JS-only object with no byte encoding. Now has a proper `encodeAdvertisement()` producing 12 bytes. | **Fixed** — the old unencoded version was a latent bug |

### Three Bugs the Fuzzer Found (All Fixed)

These were **fail-open** bugs, not redundancies, but worth noting:

1. **GEO header extension silently discarded** — nested objects with no registered field map emitted `{}` instead of data. Fixed.
2. **`validateSchema` failed open** — 12 of 33 message types accepted empty payloads (including map-mutating types). Fixed by failing closed.
3. **Type confusion** — field keys overlap between message types; flipping the type byte and repairing CRC reinterpreted the payload under a different schema. Fixed by binding message type into payload digest.

---

## 8. Project Structure

### 8.1 Packages (`packages/*`)

These are the shared, reusable TypeScript packages forming the protocol core. **Arrows only point down** — enforced by `npm run boundaries`.

```
                          ┌──────────────┐
                          │  contracts   │  zero dependencies, ever
                          └──────┬───────┘
        ┌──────────┬─────────┬───┴────┬─────────┬──────────┬────────────┐
        │          │         │        │         │          │            │
     codec       store   incident  mapkit  transport-  gateway-      (all)
        │          │                        core        client
   ┌────┴────┬─────┴───┐
validator  policy   routing
        └──────┬──────┘
               │
        ┌──────┴───────┐
        │ node-runtime │  the composition root
        └──────┬───────┘
               │
      ┌────────┴─────────┬──────────────┐
   simulator        apps/mobile     apps/backend
```

| Package | Files | Purpose |
|---------|-------|---------|
| **contracts** | 16 source files | FROZEN shared surface — types, numeric registries, limits, enums, payload definitions. Zero deps. The ONE thing everyone shares. |
| **codec** | 11 source files (incl. 1 test) | Typed packets ↔ canonical bytes. 64-byte envelope encoding/decoding, varint encoding, CRC integrity, field maps, coordinate encoding, size limits. |
| **validator** | 3 source files (incl. 1 test) | The single 15-gate validation pipeline. Every packet from every transport goes through this. Schema validation rules for all 33 message types. |
| **store** | 3 source files | Persistence ports + in-memory implementation. Event log, memory store for packets/peers/files/map-objects. |
| **policy** | 1 source file | Six independent decisions per packet: store, show, alert, relay, upload, act. Each decision has its own reason code. |
| **incident** | 1 source file | Incident timeline and delivery facts. Tracks incident lifecycle from creation through resolution. |
| **mapkit** | 6 source files (incl. 1 test) | Content pack system, deterministic `MapProjection`, `toMapOperations()` translation, Assam demo pack with 23 objects + 4 corridors. |
| **routing** | 2 source files | Relay scheduler, copy budgets, session state machine (8 phases), backoff, `shouldInitiate()` tie-break. |
| **transport-core** | 4 source files (incl. 1 test) | `TransportAdapter` seam contract + `SimulatedTransportAdapter` + advertisement encoding (12-byte PDU). The seam that lets UI and native work in parallel. |
| **tier2** | 5 source files | ggwave Tier 2: frame codec (encode/decode), independent receiver (no manifest needed), campaign builder/planner, handle resolver. |
| **gateway-client** | 1 source file | Live probe + bidirectional sync. Connectivity proof, upload/download, cursor-based retry. |
| **node-runtime** | 6 source files (incl. 1 test) | Composition root: `NodeEngine` (packet ingestion, map projection, incident management), `RelayLoop` (drives transport adapter), `GatewaySynchronizer`, file assembler. |
| **simulator** | 3 source files (incl. 1 test) | Deterministic multi-node mesh scenarios. Acceptance tests for store-carry-forward, dedup, multi-hop. |

---

### 8.2 Apps (`apps/*`)

| App | Tech | Purpose |
|-----|------|---------|
| **mobile** (`apps/mobile/`) | React Native + Expo + MapLibre + expo-sqlite | The Android citizen/responder app. 12 screens, offline-first, SOS creation, Bluetooth relay, Assam map. |
| **backend** (`apps/backend/`) | Node.js `node:http`, zero external deps, SQLite | Coordination backend. Incident dedup, responder lifecycle, regional publishing, campaign approval, gateway sync. Serves at `http://localhost:8787`. |
| **web-authority** (`apps/web-authority/`) | React + Vite + MapLibre GL JS | Authority & coordinator dashboard. Incident map/queue, responder roster, regional editor, campaign lifecycle, WavePX station. |
| **web-broadcaster** (`apps/web-broadcaster/`) | React + Vite | Radio broadcaster dashboard. Approved campaigns only, packet inventory/schedule, decode-before-broadcast verification, broadcast log. |

---

### 8.3 Tools — Tests & Results

| Tool | Location | Purpose | Test Results |
|------|----------|---------|-------------|
| **boundaries** | `tools/boundaries/check-boundaries.mjs` | Architecture enforcement — validates dependency graph, contracts purity, domain isolation, single-source registries, truthful copy | ✅ **Passing** — all 5 rules enforced |
| **fuzz** | `tools/fuzz/fuzz.mjs` | Mutates valid packets with 14 strategies targeting CRC bypass, varint overflow, nesting bombs, type confusion, bad UTF-8, etc. | ✅ **4,005 mutations, 0 findings.** Found and fixed 3 bugs in earlier runs (GEO discard, schema fail-open, type confusion). |
| **seed** | `tools/seed/` | Synthetic demo pack and actor generation for Assam region | ✅ Builds and runs |
| **ggwave-artifact** | `tools/ggwave-artifact/` | Radio program generation (WavePX audio artifact creation). Contains `engine.js` (245 KB) and `artifact.html` (372 KB). | ✅ Builds |
| **mesh-simulator** | `tools/mesh-simulator/` | Browser-based multi-node mesh visualization. `engine.js` (245 KB) + `artifact.html` (372 KB). | ✅ Builds |

---

## 9. Test Summary — All Tests & Results

### Automated Test Suite: 68/68 Passing

| Test File | Location | What It Tests |
|-----------|----------|---------------|
| `packet-codec.test.ts` | `packages/codec/src/` | Encode/decode round trips, determinism, structured noise rejection, regression tests for fuzzer-found bugs |
| `schemas.test.ts` | `packages/validator/src/` | Schema validation rules for all 33 message types, fail-closed behavior |
| `advertisement-codec.test.ts` | `packages/transport-core/src/` | BLE advertisement encoding, PDU size fits within 31-byte budget, magic byte filtering |
| `assam-pack.test.ts` | `packages/mapkit/src/` | Assam content pack produces populated base-pack projection with correct Assam labels and routes |
| `file-assembler.test.ts` | `packages/node-runtime/src/` | File assembly, manifest handling, digest mismatch rejection, orphan fragment handling, size/count bounds |
| `acceptance.test.ts` | `packages/simulator/src/` | Multi-node mesh scenarios: store-carry-forward, dedup, inventory exchange, multi-hop propagation (8 acceptance tests using simulated adapter) |
| `broadcast-program.test.ts` | `apps/backend/src/` | Campaign lifecycle, WavePX generation, decode-before-broadcast, canonical packet recovery |
| `gateway-loop.test.ts` | `apps/backend/src/` | Gateway upload/download, dedup (2 gateways → 1 incident, 2 observations), cursor-based retry |
| `keyed-reconciler.test.ts` | `apps/web-authority/src/` | UI reconciler for live-updating data |
| `wavepx-selection.test.ts` | `apps/web-authority/src/` | WavePX artifact selection logic |

### Full Verification Suite (Last Run: 2026-08-23)

| Check | Command | Result |
|-------|---------|--------|
| Unit + integration tests | `npm test` | **68/68 passing** |
| TypeScript strict build | `npm run build` | **Passing** |
| Mobile typecheck | `npm run typecheck --workspace @dsm/mobile` | **Passing** |
| Web authority build | `npm run web:build` | **Passing** |
| Architecture boundaries | `npm run boundaries` | **Passing** (dependency graph, contracts purity, domain isolation, single-source registries, truthful copy) |
| Fuzzer | `npm run fuzz` | **4,005 runs, 0 findings** |
| Android Kotlin compile | `./gradlew :app:compileDebugKotlin` | **Passing** |
| Native C++ build (4 ABIs) | `./gradlew :dsm-android-radio-bridge:externalNativeBuildDebug` | **Passing** |
| Expo Android export | `npx expo export --platform android` | **Passing** (6.54 MB Hermes bundle) |

### Fuzz Testing — 14 Mutation Strategies

| Strategy | Target | Result |
|----------|--------|--------|
| `bitflip-header` | Header integrity gate | ✅ Rejected |
| `bitflip-header-crc-repaired` | Everything downstream of CRC | ✅ Rejected |
| `bitflip-payload` | Payload digest gate | ✅ Rejected |
| `truncate` / `extend` | Length consistency | ✅ Rejected |
| `lie-payload-length` | Pre-allocation bound (INT-001) | ✅ Rejected |
| `fragment-bomb` | Fragment index/count sanity | ✅ Rejected |
| `time-and-hop-abuse` | Clock + hop gates | ✅ Rejected |
| `type-confusion` | Schema validation per type | ✅ Rejected |
| `garbage-payload-valid-envelope` | Payload digest under valid header | ✅ Rejected |
| `nesting-bomb` | Nesting depth limit | ✅ Rejected |
| `inner-length-bomb` | Declared array/text lengths near 2^32 | ✅ Rejected |
| `varint-overflow` | Unterminated varints | ✅ Rejected |
| `field-count-lie` | Field count vs bytes remaining | ✅ Rejected |
| `bad-utf8` | Strict UTF-8 decoding | ✅ Rejected |

---

## 10. What's Remaining

### Physical Evidence Still Required

| Item | Owner | Why It Can't Be Faked |
|------|-------|----------------------|
| Two-phone BLE transfer | WS-B | Proves real Bluetooth actually works on hardware |
| Two-phone Bluetooth Classic transfer | WS-B | Proves the fallback path works |
| Screen-off / background relay survival | WS-B | Manufacturer-specific behavior |
| Device capability matrix | WS-B | Runtime checks per demo phone |
| Assam offline map download on physical phone | WS-D | Proves airplane-mode map rendering |
| Speaker-to-phone WavePX acoustic trial | WS-F | Proves ggwave works over physical audio |
| Battery and thermal measurements | WS-F | Real power consumption data |

### Production Readiness Items

| Item | Status |
|------|--------|
| Authority-approved / self-hosted map tiles | Hackathon default (`openfreemap.org`); needs replacement for production |
| Official Assam facility registry | Currently synthetic demo data; needs authority-issued register |
| Cryptographic identity / authentication | Not implemented — prototype uses org-provisioned demo records |
| End-to-end encryption | Not implemented |
| Literal `PACKET_REQUEST` round trip (HD-001) | Deferred — filtered inventory push already provides missing-only exchange |
| Check-in campaign composer (HD-010) | Deliberately removed from console; types preserved in contracts |
| `RECORD_UPSERT` encoding (HD-009) | Codec throws — needs dynamic string-keyed map support |
| Golden vector files for codec | Round-trip + determinism tests exist; committed golden files remain (WS-C) |

---

> **Evidence labels used in this document:**  
> 🟩 static/build check · 🟦 automated integration or simulator test · 🟥 measured physical-device run  
> No item in this project claims 🟥 — no physical Android handset or acoustic setup was attached during the implementation passes.
