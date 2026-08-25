# Feature matrix — current implementation and remaining work

Updated 2026-08-23 after the packet, mobile, native-radio, ggwave and centre-operation integration pass.

Evidence labels: 🟩 source/build check · 🟦 automated integration or simulator · 🟥 measured physical-device run.
No row claims 🟥: no compatible Android handset or two-device acoustic setup was attached during this pass.

## Offline mobile and SOS

| Feature | Status | Evidence | Current truth |
|---|---:|---:|---|
| Create rapid or detailed SOS without internet | ✅ | 🟦 | The packet is validated and committed locally before the UI reports success. Relay starts immediately after a successful SOS save. |
| Durable mobile state across restart | ✅ | 🟩 | `expo-sqlite` persists the packet log and custody; startup rebuilds incident timelines, locally owned active SOS identity, source sequence and map state before accepting a new action. |
| Update and cancel SOS | ✅ | 🟦 | Updates raise the source sequence; cancel is terminal and retained for audit. |
| Truthful delivery evidence | ✅ | 🟩 | The app separates local save, direct peer receipt, responder acknowledgement and backend acknowledgement. It explicitly says it cannot monitor a packet after it leaves the phone. |
| Native notification priority | ✅ | 🟩 | Android channels are MAX for emergency/authority-critical, HIGH for operational updates and LOW for the relay service. Validated inbound packets select the channel from protocol priority. |
| Home battery, temperature, thermal and link state | ✅ | 🟩 | Home shows battery percent, battery-sensor temperature when Android exposes it, thermal-throttling state, selected BLE/Classic/simulated radio, peer count, relay and proven-gateway state. Missing sensor temperature renders unavailable rather than being invented. |

## Tier 1 relay and gateway

| Feature | Status | Evidence | Current truth |
|---|---:|---:|---|
| BLE advertise/scan and GATT server/client | ✅ implemented, unmeasured | 🟩 | The native module compiles, subscribes to notifications, negotiates MTU, serializes GATT operations and resolves each send only after Android's completion callback. |
| Bluetooth Classic contingency | ✅ implemented, unmeasured | 🟩 | Selection prefers BLE when all required roles exist and falls back to Classic RFCOMM when they do not. Classic uses bounded length-prefixed records and rotating discovery tokens. |
| Foreground relay service | ✅ implemented, unmeasured | 🟩 | Ongoing Android notification includes a stop action. Manufacturer-specific screen-off behaviour still needs device evidence. |
| Inventory, dedup and bidirectional sessions | ✅ | 🟦 | Repeat contacts suppress already-held packets; forwarding remains bounded by hop, expiry, copy and cooldown rules. |
| Store-carry-forward | ✅ | 🟦 | Multi-node movement/loss scenarios pass. |
| Mesh → network → mesh | ✅ | 🟦 | The phone attaches `GatewaySynchronizer` when `EXPO_PUBLIC_DSM_BACKEND_URL` is configured. A live identity probe gates upload; foreground startup/resume and 30-second cycles download website packets into the same validator, SQLite/map projection and relay path. |
| Literal `PACKET_REQUEST` exchange | deferred deviation | 🟦 | Filtered inventory push provides the required missing-only behaviour. The literal request packet remains the documented HD-001 deviation. |

## Canonical packets and WavePX

| Feature | Status | Evidence | Current truth |
|---|---:|---:|---|
| One canonical packet across website, receiver, gateway and mesh | ✅ | 🟦 | Tier 2 fragments carry the complete canonical Tier 1 bytes. The receiver reconstructs and decodes those bytes independently; a manifest verifies expected bytes but never invents a header. |
| WavePX encode/decode | ✅ browser + Android native build | 🟩 | The console vendors WavePX `SonicPixel`/audio components; Android implements the same raw-frame receive seam with ggwave kept inside WavePX as the physical modem. |
| Microphone input | ✅ browser, unmeasured acoustically | 🟩 | The receiving station captures microphone PCM and submits recovered raw frames through CRC, reassembly, canonical decode and exact expected-byte comparison. |
| Audio-file input | ✅ | 🟩 | WAV files use the same decoder and comparison path as microphone input. |
| File export and playback | ✅ | 🟩 | The approved immutable schedule exports 48 kHz mono WAV and playback is decode-gated. |
| Independent receiver without campaign manifest | ✅ | 🟦 | Automated tests recover and decode the packet with no preloaded manifest. |
| Android WavePX microphone receiver | ✅ implemented, unmeasured acoustically | 🟩 | Explicit start/stop drives bounded 48 kHz `AudioRecord`; native decoding emits raw WavePX frames into `Tier2Receiver`, `NodeEngine.ingest()` and the live/persisted mobile map. |
| Shared campaign packet and impact inspection | ✅ | 🟩 | The campaign desk and Android receiver show the decoded message, canonical packet evidence and the exact typed map operations before/after reception. |
| Streamlined campaign-to-WavePX workflow | ✅ | 🟩 | Compose, approve, generate/decode and transmit are one guided campaign workflow, with the full WavePX station still available for direct operation. |

## Centre and map-operation pipeline

| Feature | Status | Evidence | Current truth |
|---|---:|---:|---|
| Create a temporary centre | ✅ | 🟦 | The admin API/UI creates a stable temporary object and emits a canonical resource packet. |
| Open or close a centre | ✅ | 🟦 | State changes emit versioned packets; no UI-only mutation is used. |
| Move or edit a centre | ✅ | 🟦 | Name, district and coordinates are encoded in the same regional packet model. |
| Packet → WavePX → decode → map operation | ✅ | 🟦 | Tests cover create, close, move and reopen. Recovered canonical bytes are translated by the shared `toMapOperations()` path. |
| Tier 1/gateway/Tier 2 projection agreement | ✅ | 🟦 | All paths enter `NodeEngine.ingest()` and the same deterministic `MapProjection`. |
| Website regional update → WavePX → mobile SQLite/map | ✅ implemented, physical acoustics unmeasured | 🟩 | Website resource packets use the canonical codec; recovered mobile packets are stored in SQLite, projected through typed map operations and shown in the received-packet ledger and map. |
| Mobile graphical/offline map renderer | ✅ implemented, device download unmeasured | 🟩 | MapLibre renders GPS and projected layers. A one-tap Assam pack downloads zooms 5–12 to persistent native storage and reports real progress, bytes and resources. |
| Assam baseline operational registry | ✅ synthetic | 🟦 | A typed pack paints 23 Assam-focused demo objects and four corridors before packet deltas arrive. Facility labels are explicitly demo data, not an authority register. |

## Web authority and coordination

| Feature | Status | Evidence | Current truth |
|---|---:|---:|---|
| Incident deduplication and responder lifecycle | ✅ | 🟦 | Multiple gateway observations remain one incident; assignment/accept/en-route/arrive/resolve actions emit packets. |
| Regional centre editor | ✅ | 🟩 | Create, edit/move and state controls publish canonical packets. |
| Campaign validation, approval and immutable artifact log | ✅ | 🟩 | Editing approved content returns it to draft; playback/export are tied to the tested digest. |
| Locally observed packet evidence | ✅ | 🟩 | The console shows packets stored by this backend and their recorded gateway/radio facts. It does not claim global mesh tracking after transmission. |
| SQLite backend recovery | ✅ | 🟦 | Packets, observations, queues, regional records, campaigns and logs survive restart. |

## Mobile screens

All 12 required routes exist. Readiness, SOS composer, nearby incidents, responder detail, resource detail, profile, diagnostics and the Assam map are connected to runtime data. Remaining partials concern evidence that cannot be invented, such as a responder acknowledgement not observed locally or physical radio measurements.

## Complete remaining list

1. **Physical evidence, not code:** run website-speaker-to-phone WavePX trials plus BLE and Classic on selected phones; complete an Assam pack download, test airplane-mode restart/map rendering, screen-off relay, battery/thermal measurements and acoustic success rate.
2. **Production map/data:** replace the hackathon style host and synthetic Assam facilities with authority-approved/self-hosted tiles and a sourced registry.
3. **Documented protocol deviation:** implement a literal `PACKET_REQUEST` round trip only if HD-001 is reversed; the current missing-only filtered exchange already passes the relay acceptance behaviour.

Everything else requested in this pass is implemented and covered by static, integration or simulator evidence. The items above must not be presented as finished until their stated evidence exists.
