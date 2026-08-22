# Feature matrix — current implementation and remaining work

Updated 2026-08-23 after the packet, mobile, native-radio, ggwave and centre-operation integration pass.

Evidence labels: 🟩 source/build check · 🟦 automated integration or simulator · 🟥 measured physical-device run.
No row claims 🟥: no compatible Android handset or two-device acoustic setup was attached during this pass.

## Offline mobile and SOS

| Feature | Status | Evidence | Current truth |
|---|---:|---:|---|
| Create rapid or detailed SOS without internet | ✅ | 🟦 | The packet is validated and committed locally before the UI reports success. Relay starts immediately after a successful SOS save. |
| Durable mobile state across restart | ✅ | 🟩 | `expo-sqlite` repositories persist packets, seen IDs, observations, custody, fragments, peers and assembled files behind the frozen repository ports. |
| Update and cancel SOS | ✅ | 🟦 | Updates raise the source sequence; cancel is terminal and retained for audit. |
| Truthful delivery evidence | ✅ | 🟩 | The app separates local save, direct peer receipt, responder acknowledgement and backend acknowledgement. It explicitly says it cannot monitor a packet after it leaves the phone. |
| Native notification priority | ✅ | 🟩 | Android channels are MAX for emergency/authority-critical, HIGH for operational updates and LOW for the relay service. Validated inbound packets select the channel from protocol priority. |
| Home battery, temperature, thermal and link state | ✅ | 🟩 | Home shows battery percent, battery-sensor temperature when Android exposes it, thermal-throttling state, selected BLE/Classic/simulated radio, peer count, relay and proven-gateway state. Missing sensor temperature renders unavailable rather than being invented. |

## Tier 1 relay and gateway

| Feature | Status | Evidence | Current truth |
|---|---:|---:|---|
| BLE advertise/scan and GATT server/client | ✅ implemented, unmeasured | 🟩 | The Expo native module compiles in the generated Android development build, negotiates MTU 247 and transports bounded records. |
| Bluetooth Classic contingency | ✅ implemented, unmeasured | 🟩 | Selection prefers BLE when all required roles exist and falls back to Classic RFCOMM when they do not. Classic uses bounded length-prefixed records and rotating discovery tokens. |
| Foreground relay service | ✅ implemented, unmeasured | 🟩 | Ongoing Android notification includes a stop action. Manufacturer-specific screen-off behaviour still needs device evidence. |
| Inventory, dedup and bidirectional sessions | ✅ | 🟦 | Repeat contacts suppress already-held packets; forwarding remains bounded by hop, expiry, copy and cooldown rules. |
| Store-carry-forward | ✅ | 🟦 | Multi-node movement/loss scenarios pass. |
| Mesh → network → mesh | ✅ | 🟦 | The phone attaches `GatewaySynchronizer` when `EXPO_PUBLIC_DSM_BACKEND_URL` is configured. A live identity probe gates upload; downloads re-enter the same validator and become relayable. |
| Literal `PACKET_REQUEST` exchange | deferred deviation | 🟦 | Filtered inventory push provides the required missing-only behaviour. The literal request packet remains the documented HD-001 deviation. |

## Canonical packets and ggwave/WavePX

| Feature | Status | Evidence | Current truth |
|---|---:|---:|---|
| One canonical packet across website, receiver, gateway and mesh | ✅ | 🟦 | Tier 2 fragments carry the complete canonical Tier 1 bytes. The receiver reconstructs and decodes those bytes independently; a manifest verifies expected bytes but never invents a header. |
| ggwave encode/decode | ✅ browser | 🟩 | The admin console uses `ggwave` through the vendored WavePX-style audio lifecycle. |
| Microphone input | ✅ browser, unmeasured acoustically | 🟩 | The receiving station captures microphone PCM and submits recovered raw frames through CRC, reassembly, canonical decode and exact expected-byte comparison. |
| Audio-file input | ✅ | 🟩 | WAV files use the same decoder and comparison path as microphone input. |
| File export and playback | ✅ | 🟩 | The approved immutable schedule exports 48 kHz mono WAV and playback is decode-gated. |
| Independent receiver without campaign manifest | ✅ | 🟦 | Automated tests recover and decode the packet with no preloaded manifest. |
| Android microphone ggwave decoder | not implemented | — | The mobile Tier 2 screen is intentionally honest. A native `AudioRecord`/decoder integration remains if acoustic reception is required on the Android app rather than the admin browser. |

## Centre and map-operation pipeline

| Feature | Status | Evidence | Current truth |
|---|---:|---:|---|
| Create a temporary centre | ✅ | 🟦 | The admin API/UI creates a stable temporary object and emits a canonical resource packet. |
| Open or close a centre | ✅ | 🟦 | State changes emit versioned packets; no UI-only mutation is used. |
| Move or edit a centre | ✅ | 🟦 | Name, district and coordinates are encoded in the same regional packet model. |
| Packet → ggwave → decode → map operation | ✅ | 🟦 | Tests cover create, close, move and reopen. Recovered canonical bytes are translated by the shared `toMapOperations()` path. |
| Tier 1/gateway/Tier 2 projection agreement | ✅ | 🟦 | All paths enter `NodeEngine.ingest()` and the same deterministic `MapProjection`. |
| Mobile graphical/offline map renderer | deferred by request | — | The existing mobile layout/placeholder remains. The adjacent list is fed by real projected objects. No licensed offline basemap bundle is claimed. |

## Web authority and coordination

| Feature | Status | Evidence | Current truth |
|---|---:|---:|---|
| Incident deduplication and responder lifecycle | ✅ | 🟦 | Multiple gateway observations remain one incident; assignment/accept/en-route/arrive/resolve actions emit packets. |
| Regional centre editor | ✅ | 🟩 | Create, edit/move and state controls publish canonical packets. |
| Campaign validation, approval and immutable artifact log | ✅ | 🟩 | Editing approved content returns it to draft; playback/export are tied to the tested digest. |
| Locally observed packet evidence | ✅ | 🟩 | The console shows packets stored by this backend and their recorded gateway/radio facts. It does not claim global mesh tracking after transmission. |
| SQLite backend recovery | ✅ | 🟦 | Packets, observations, queues, regional records, campaigns and logs survive restart. |

## Mobile screens

All 12 required routes exist and the original visual layout is retained. Readiness, SOS composer, nearby incidents, responder detail, resource detail and diagnostics are connected to runtime data. Home, active SOS, relay, Tier 2, profile and map are marked partial where the binding screen contract asks for data that cannot honestly be produced yet, such as a responder acknowledgement not observed locally, physical ggwave metrics, or the deferred map renderer.

## Complete remaining list

1. **Deferred mobile map renderer:** add the graphical offline renderer, a licensed tile/content bundle and sourced stable regional registry without changing the packet-to-map pipeline.
2. **Android acoustic receiver, only if required on-phone:** connect `AudioRecord` PCM to a ggwave decoder and feed recovered frames into the existing Tier 2 receiver. Browser microphone and WAV input already work.
3. **Physical evidence, not code:** run BLE and Classic on the selected phones, screen-off relay, restart recovery, battery/thermal measurements and a two-device acoustic success-rate matrix.
4. **Production data/security:** replace synthetic Assam records with licensed authority data and production identity/key management. The prototype deliberately does not claim verified identities or production cryptography.
5. **Documented protocol deviation:** implement a literal `PACKET_REQUEST` round trip only if HD-001 is reversed; the current missing-only filtered exchange already passes the relay acceptance behaviour.

Everything else requested in this pass is implemented and covered by static, integration or simulator evidence. The items above must not be presented as finished until their stated evidence exists.
