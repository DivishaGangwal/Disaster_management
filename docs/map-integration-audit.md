# Map + geolocation integration audit

Read-only inspection of the current codebase, done to establish what already exists before building a map + geolocation feature. No code was changed to produce this report. All file paths are repo-relative from `/Users/divishagangwal/Documents/Disaster_management`.

---

## 1. Repo structure

### Top level

```
apps/
  backend/            Node HTTP backend (zero-dependency node:http server + SQLite)
  mobile/              Expo Router / React Native app (the citizen + responder app)
  web-authority/       Vite + React operator console (MapLibre GL already lives here)
  web-broadcaster/     package.json only — no src/ directory, no code at all
native/
  android-radio-bridge/  Expo native module: real Android BLE + Bluetooth Classic
packages/
  codec/               Packet byte encode/decode, field maps, builders
  contracts/           Shared types, enums, numeric registries, limits (zero runtime deps)
  gateway-client/       HTTP client implementing the GatewayClient contract
  incident/            IncidentReducer — folds packets into one incident timeline
  mapkit/              Content-pack resolver + MapProjection + packet→map-operation matrix
  node-runtime/        NodeEngine, RelayLoop, GatewaySynchronizer, FileAssembler
  policy/              DefaultPolicyEngine — six independent per-packet decisions
  routing/             Relay scoring, session state machine, backoff
  simulator/            Multi-node scenario runner for acceptance tests
  store/               In-memory reference implementations of the persistence ports
  tier2/               ggwave framing, campaign builder/planner, Tier2Receiver
  transport-core/      SimulatedTransportAdapter + BLE advertisement codec
  validator/           Packet structural/integrity validation
tools/
  boundaries/          Import-boundary checker
  fuzz/                Fuzzer for the codec/validator
  seed/                Demo data seeding CLI
docs/                  Product/architecture/spec documents
content-packs/         (README only — no offline content-pack JSON committed yet)
evidence/              (README only)
```

### apps/mobile detail

```
app/
  (tabs)/_layout.tsx, index.tsx (Home), map.tsx, nearby.tsx, profile.tsx
  _layout.tsx
  readiness.tsx
  relay.tsx
  tier2.tsx
  diagnostics.tsx
  sos/composer.tsx, sos/active.tsx
  resource/detail.tsx
  responder/detail.tsx
src/
  components/            ActionButton, InfoRow, SectionCard, StatusBadge, TimelineDot
  screens/screen-registry.ts   the canonical "13 screens" checklist with a `status` field
  services/app-runtime.ts, mobile-controller.ts, notifications.ts, sqlite-repositories.ts
  theme/tokens.ts
store/useAppStore.ts     the one Zustand store
data/                    categories.ts, mobilityOptions.ts, preparedPhrases.ts, severities.ts
```

### apps/web-authority detail

```
src/
  App.tsx                 all four operator sections (Coordinate, Publish, Campaigns, Network)
  OperationsMap.tsx        the working MapLibre GL map component
  PublishWorkspace.tsx     shelter/hospital/hazard/route publishing UI, embeds OperationsMap
  api.ts                   fetch wrapper for every backend endpoint
  types.ts                 mirror of backend response shapes
  DataInspector.tsx         packet byte inspector
  audio-link.ts, ggwave.d.ts, vendor/wavepx/  Tier 2 (ggwave) audio send/receive
  operational-status.ts, surface-registry.ts
```

### Shared/internal packages and what they export

- **`packages/contracts`** — the one shared surface all workstreams import. Zero runtime dependencies, no behavior. Exports (via `src/index.ts`): `registry.js` (MessageType codes, Priority, Severity, Flags, SourceClass), `limits.js` (byte/time/session/storage budgets), `enums.js` (EmergencyCategory, Mobility, LocationSource, OperationalState, HazardType, GeometryKind, RouteState, AlertCategory, InstructionCode, CheckinStatus, CancelReason, ResolutionOutcome, ArrivalEvidence, LinkReceiptResult, BackendDedupOutcome, MimeCategory), `envelope.js` (PacketHeader, GeoExtension, Packet, PacketObservation, TransportKind), `payloads.js` (one TS interface per MessageType), `reasons.js`, `profile.js` (LocalProfile, LocalRole, WebRole, DeliveryState, CustodyState, IncidentState), `policy-types.js`, `map-ops.js` (MapOperation union, ProjectionResult, FreshnessClass), `native-bridge.js` (TransportAdapter, CapabilityReport, DiscoverySummary, transport events), `gateway-api.js` (UploadBatchRequest/Response, GatewayClient interface), `campaign.js` (CampaignState, CampaignManifest), `ports.js` (PacketRepository/IncidentRepository/PeerRepository/FileRepository interfaces), `events.js`, `content-pack.js` (ContentPack, PackObject, RouteEdge, ObjectResolver).
- **`packages/codec`** — `buildSosCreate/Update/Cancel`, `buildResponderState`, `buildResourceRecord`, `buildHazard`, `buildRouteState`, `buildOfficialAlert`, `buildBackendAck`, `buildInventory`, `buildLinkReceipt`, `decodePacket`, `newSourceId`, `newNodeToken`, `toEpochS`, `budgetClassFor`.
- **`packages/mapkit`** — `PackResolver`/`loadContentPack` (offline pack resolution), `MapProjection` (deterministic, idempotent projection store), `toMapOperations(packet, transport, nowS)` (the *only* packet→map translation).
- **`packages/incident`** — `IncidentReducer`, `IncidentView`, `TimelineEntry`, `DeliveryFacts`, `deliveryStatesFor`.
- **`packages/node-runtime`** — `NodeEngine` (the single ingest entry point), `RelayLoop`, `GatewaySynchronizer`, `FileAssembler`.
- **`packages/transport-core`** — `SimulatedTransportAdapter`, `RadioMedium`, `buildDiscoverySummary`, `encodeAdvertisement`/`decodeAdvertisement`, `CapabilityBit`.
- **`packages/policy`** — `DefaultPolicyEngine`, `distanceM`.
- **`packages/routing`** — session scoring/backoff (`planTransfer`, `afterTransfer`, `shouldInitiate`, `backoffMs`, `SessionStateMachine`).
- **`packages/store`** — `MemoryPacketRepository`, `MemoryPeerRepository`, `MemoryFileRepository`, `MemoryEventSink` (in-memory implementations of the `ports.js` interfaces; the mobile app uses its own SQLite implementations instead, see §6).
- **`packages/tier2`** — `planCampaign`, `toTier2Frames`, `decodeTier2Frame`, `Tier2Receiver`, `transitionCampaign`, `contentEdited`.
- **`packages/gateway-client`** — `HttpGatewayClient` implementing the `GatewayClient` contract.
- **`packages/validator`** — `validate(bytes, context)`.

---

## 2. Backend — data models

The backend (`apps/backend/src`) has **no relational schema**. `SqliteBackendStore` (`sqlite-store.ts`) uses one SQLite table, `app_snapshot(key TEXT PRIMARY KEY, value TEXT, updated_at_ms INTEGER)`, and stores two JSON blobs under it: key `"core"` (raw packets/observations/gateway state) and key `"operations"` (responders/regionalRecords/campaigns/audit). Everything below is a TypeScript interface shape, not a SQL table.

### Shelters / hospitals / hazards / safe zones

One unified type, `RegionalRecord` (`sqlite-store.ts:21-32`):

```ts
interface RegionalRecord {
  objectId: string;
  kind: 'shelter' | 'medical' | 'food-water' | 'safe-zone' | 'hazard' | 'route';
  name: string;
  district: string;
  latE7: number;
  lonE7: number;
  state: string;       // allowed values depend on kind, see below
  version: number;
  updatedAtMs: number;
  synthetic: true;
}
```

- **Coordinates are `latE7`/`lonE7` integers (degrees × 1e7), never plain floats.** Confirmed in this type, in the request body decoder (`server.ts` `regionalRecordInput()`, which does `Math.round(Number(body['latE7']))`), and in the E7 bounds check in `operations.ts` (`LAT_E7_LIMIT = 900000000`, `LON_E7_LIMIT = 1800000000`).
- `kind` values in use: `'shelter' | 'medical' | 'food-water' | 'safe-zone' | 'hazard' | 'route'`. "Hospital" is represented as `kind: 'medical'`, not a separate kind.
- `state` values depend on `kind` (`operations.ts` `updateRegionalRecord()`): centres (`shelter`/`medical`/`food-water`/`safe-zone`) → `'open' | 'full' | 'closed' | 'damaged'`; `hazard` → `'active' | 'watch' | 'cleared'`; `route` → `'open' | 'restricted' | 'blocked'`.
- There is no separate "hospital" or "hazard" table — one `regionalRecords: Map<string, RegionalRecord>` holds all six kinds.

### Responder / assignment model

`ResponderRecord` (`sqlite-store.ts:8-19`):

```ts
interface ResponderRecord {
  responderRef: string;
  name: string;
  district: string;
  capabilities: readonly string[];
  available: boolean;
  provisionedByDemo: true;
  assignmentId?: string;   // e.g. "ASG-<base36 timestamp>"
  incidentId?: string;
  status: 'available' | 'assigned' | 'accepted' | 'en-route' | 'arrived';
  lastUpdatedAtMs: number;
}
```

- **Yes, there is an `assignmentId`** linking a responder to a specific incident. It is generated in `OperationsService.assignResponder()` (`operations.ts:198-224`) as `` `ASG-${Date.now().toString(36).toUpperCase()}` ``, and stored on both the `ResponderRecord` (`assignmentId`, `incidentId`) and carried in the wire payload (`ResponderAssignedPayload.assignmentId`, see §4).
- On the incident side, the same linkage is mirrored into `IncidentView.assignmentId` / `IncidentView.responderRef` (`packages/incident/src/index.ts:73-74`), populated when a `RESPONDER_ASSIGNED` packet is reduced.
- Responders are held in one `responders: Map<string, ResponderRecord>` keyed by `responderRef`.

### SOS / incident model

There is **no stored "incident" row at all**. Incidents are derived live, in memory, from the packet log by `IncidentReducer` (`packages/incident/src/index.ts`), and rebuilt by replaying every stored packet on backend startup (`BackendStore.restoreCore()` in `services.ts:127-141`).

`IncidentView` (`packages/incident/src/index.ts:52-77`) — this is the canonical SOS/incident shape:

```ts
interface IncidentView {
  incidentId: StreamId;          // the unique ID referencing one SOS, e.g. "INC-AS-V2-FLOOD-01"
  state: IncidentState;          // 'draft'|'created'|'active'|'assigned'|'accepted'|'en-route'|'arrived'|'resolved'|'cancelled'|'expired'|'reopened'
  severity: number;
  category: number;
  peopleTotal?: number;
  injured?: number;
  mobility?: number;
  shortNote?: string;
  latE7?: number;
  lonE7?: number;
  locationAccuracyM?: number;
  locationAgeS?: number;
  locationReportedAtS?: number;
  locationSource?: number;
  createdAtS: number;
  updatedAtS: number;
  latestSourceSequence: number;
  ownedLocally: boolean;
  assignmentId?: string;
  responderRef?: string;
  delivery: DeliveryFacts;        // savedLocallyAtS, distinctPeerReceipts, responderSeenAtS, uploadedAtS, backendAcceptedAtS, assignedAtS, acceptedAtS, enRouteAtS, arrivedAtS, resolvedAtS, cancelledAtS
  timeline: readonly TimelineEntry[];
}
```

- **`incidentId` is the unique ID used to reference a specific SOS.** It equals the wire `streamId`/`StreamId` on the `SOS_CREATE`/`SOS_UPDATE`/`SOS_CANCEL` payloads (`incidentId: StreamId` on `SosCreatePayload` etc., §4). The mobile app builds it as `` `INC-${Date.now().toString(36).toUpperCase()}-${nodeToken}` `` (`mobile-controller.ts:146`); the backend demo seed uses fixed IDs like `INC-AS-V2-FLOOD-01`.
- One canonical packet per `PacketId` (16-byte hex) is stored in `BackendStore.packets: Map<PacketId, StoredCanonicalPacket>`; many `observations: GatewayObservation[]` can point at the same packet (multiple gateways uploading the same SOS never create duplicate incidents — GTW-003 in the code comments).

---

## 3. Backend — endpoints

All routes are hand-matched in `apps/backend/src/server.ts`. Two request headers, `x-operations-key` and `x-operator-label`, gate every write that the operator console performs; everything else is open. CORS is wide open (`access-control-allow-origin: *`).

| Path | Method | Auth | Returns |
|---|---|---|---|
| `/health` | GET | none | `{ identity: 'dsm-backend-demo-v1', atMs }` |
| `/api/session` | POST | operations key + operator label | `{ operatorLabel, roles: ['authority-publisher','coordinator','radio-broadcaster'], regionCode: 'IN-AS' }` |
| `/gateway/register` | POST | none | `{ gatewayToken }` — **gateway sync** |
| `/gateway/upload` | POST | none | `UploadBatchResponse` (per-item accepted/duplicate/conflicted/invalid) — **gateway sync** |
| `/gateway/outbound` | POST | none | `{ items, nextCursor, hasMore }` — **gateway sync** |
| `/gateway/outbound/ack` | POST | none | `{ ok: true }` — **gateway sync** |
| `/incidents`, `/api/incidents` | GET | none | `{ incidents: IncidentView[] }` — **incidents/SOS** |
| `/incidents/:id`, `/api/incidents/:id` | GET | none | `{ incident, observations }` — **incidents/SOS** |
| `/api/overview` | GET | none | region + counts + latest audit |
| `/api/responders` | GET | none | `{ responders: ResponderRecord[] }` — **responders/assignments** |
| `/api/responders/:responderRef/assign` | POST | operator session | `{ responder }` — **responders/assignments** |
| `/api/responders/:responderRef/state` | POST | operator session | `{ responder }`, action ∈ `accepted\|en-route\|arrived\|resolved` — **responders/assignments** |
| `/api/region/IN-AS/records` (alias `/api/region/IN-AS-DEMO/records`) | GET | none | `{ records: RegionalRecord[] }` — **district/region-scoped** |
| `/api/region/IN-AS/records` | POST | operator session | `{ record }`, creates/moves a centre — **district/region-scoped, records/resources** |
| `/api/region/IN-AS/records/:objectId` | POST | operator session | `{ record }`, either full centre upsert or a bare state change — **district/region-scoped, records/resources** |
| `/api/campaigns` | GET | none | `{ campaigns: CampaignRecord[] }` — **campaigns/broadcasts** |
| `/api/campaigns` | POST | operator session | `{ campaign }`, creates a draft — **campaigns/broadcasts** |
| `/api/campaigns/:id` | PUT | operator session | `{ campaign }`, revises content — **campaigns/broadcasts** |
| `/api/campaigns/:id/preview` | GET | none | `{ preview }` |
| `/api/campaigns/:id/transition` | POST | operator session | `{ campaign }`, moves `CampaignState` |
| `/api/campaigns/:id/broadcast-program` | POST | operator session | `{ campaign }`, generates the ggwave acoustic program |
| `/api/campaigns/:id/broadcast-reception` | POST | operator session | `{ campaign }`, verifies recovered frames byte-for-byte |
| `/api/campaigns/:id/broadcast-events` | POST | operator session | `{ campaign }`, records `exported`/`played` |
| `/api/packets` | GET | none | `{ packets: PacketStreamItem[] }` — full decoded packet stream with direction (`mesh-to-internet`/`internet-to-mesh`/`radio-to-mesh`/`mesh-local`) |
| `/api/gateway-audit` | GET | none | gateways, observations, transfers, outbound queue depth — **gateway sync** |
| `/api/audit` | GET | none | `{ audit: AuditRecord[] }` |
| `/api/demo/reset` | POST | operator session | resets SQLite store and reseeds Assam demo data |
| any other GET | GET | none | serves `apps/web-authority/dist` static build, falling back to `index.html` |

Note there is exactly one region hardcoded everywhere (`REGION_CODE = 'IN-AS'`, Assam) — the "district" concept only exists as a free-text `district` field on `RegionalRecord`/`ResponderRecord`, not as a query-scoping mechanism.

---

## 4. Backend — packet/message schema

Yes — there is a fully defined, frozen wire schema. Source of truth: `packages/contracts/src/registry.ts` (numeric `MessageType` codes) and `packages/contracts/src/payloads.ts` (one TypeScript interface per code).

### Every packet type currently defined

| Family | Type | Code | Payload fields |
|---|---|---|---|
| Emergency | `SOS_CREATE` | 0x10 | `incidentId, category, peopleTotal, mobility, location: LocationState, replyCapabilities, injured?, children?, shortNote?, preparedPhraseId?, language?, helpCategories?, batteryBand?` |
| | `SOS_UPDATE` | 0x11 | `incidentId, category?, peopleTotal?, injured?, mobility?, location?, shortNote?, preparedPhraseId?, batteryBand?` |
| | `SOS_CANCEL` | 0x12 | `incidentId, reason, terminalRetentionS` |
| Response | `RESPONDER_ASSIGNED` | 0x20 | `incidentId, assignmentId, responderRef, teamRef?, dispatcherLabel` |
| | `RESPONDER_ACCEPTED` | 0x21 | `incidentId, assignmentId, responderRef` |
| | `RESPONDER_DECLINED` | 0x22 | `incidentId, assignmentId, responderRef, reasonCode?` |
| | `RESPONDER_EN_ROUTE` | 0x23 | `incidentId, assignmentId, responderRef, location?: LocationState, etaBandMin?` |
| | `RESPONDER_ARRIVED` | 0x24 | `incidentId, assignmentId, responderRef, evidence` |
| | `RESOLVED` | 0x25 | `incidentId, resolverRef, outcome, terminalRetentionS` |
| Receipt | `LINK_RECEIPT` | 0x30 | `forPacketId, digestPrefix, receivingNodeToken, result` |
| | `BACKEND_ACKNOWLEDGEMENT` | 0x31 | `forPacketId, incidentId?, backendReceiptId, dedupOutcome, coordinationStatus?` |
| Resource | `SHELTER` / `MEDICAL_POST` / `FOOD_WATER` / `SAFE_ZONE` | 0x40–0x43 | shared `ResourceRecordPayload`: `objectId, state, location?: LocationState, capacityBand?, capacityExact?, availabilityBand?, openingHoursCode?, fallbackLabel?, capabilityBits?, lastConfirmedS?` |
| Hazard/nav | `HAZARD` | 0x50 | `hazardId, hazardType, geometryKind, latE7?, lonE7?, radiusM?, routeIds?, cachedGeometryRef?, fallbackLabel?` |
| | `ROUTE_STATE` | 0x51 | `routeId, state, reasonCode?, direction?, fallbackInstruction?` |
| Authority | `OFFICIAL_ALERT` | 0x60 | `alertId, category, instruction, regionCode?, latE7?, lonE7?, radiusM?, validFromS?, validUntilS?, fallbackText?, language?, relatedObjectIds?, campaignId?` |
| | `WEATHER_BULLETIN` | 0x61 | `bulletinId, regionCode?, codes[], validUntilS?, fallbackText?` |
| Check-in | `CHECKIN_CAMPAIGN` | 0x70 | `campaignId, campaignVersion, formId, deadlineS, regionCode?, allowedStatuses[], requestPeopleCount?, requestLocation?, fallbackPrompt?` |
| | `CHECKIN_RESPONSE` | 0x71 | `campaignId, status, peopleCount?, location?, sourceRef?` |
| Request | `RESOURCE_REQUEST` | 0x80 | `requestId, category, urgency, quantityBand?, peopleCount?, location?, linkedIncidentId?` |
| Content | `CACHE_CATALOG` / `CONTENT_ACTIVATE` / `RECORD_UPSERT` / `RECORD_TOMBSTONE` / `CACHE_INVALIDATE` | 0x90–0x94 | pack/object/version bookkeeping — no coordinates |
| File | `FILE_MANIFEST` / `FILE_FRAGMENT` | 0xa0–0xa1 | `fileId`, digest, fragment data (UTF-8 text only) |
| Network control | `HELLO_CAPABILITY` / `INVENTORY` / `PACKET_REQUEST` / `NETWORK_STATUS_OBSERVATION` | 0xf0–0xf3 | session-scoped, never stored as custody |

Every location-carrying payload uses the shared `LocationState` shape: `{ source: LocationSourceValue, latE7?, lonE7?, accuracyM?, ageS }` — always E7 integers, never floats.

### Is there a "responder location" packet type already?

**No standalone packet type exists for it.** The only place a responder's live coordinate can travel is the **optional `location?: LocationState` field on `RESPONDER_EN_ROUTE` (0x23)** — `ResponderEnRoutePayload.location`. No other responder payload (`RESPONDER_ASSIGNED`, `RESPONDER_ACCEPTED`, `RESPONDER_ARRIVED`, `RESOLVED`) carries a location field at all.

In the mobile app today, the "Send My Location" button on `app/responder/detail.tsx` and the packaged `responderTransition('en-route')` handler in `mobile-controller.ts` (lines 200-207) both just **re-send a `RESPONDER_EN_ROUTE` packet** with a fresh `location` — there is no dedicated "ping my location" message. `packages/mapkit/src/packet-to-map.ts` (lines 131-167) turns that same field into a `'upsert-responder-marker'` map operation, but only when `RESPONDER_ASSIGNED`/`RESPONDER_ACCEPTED`/`RESPONDER_EN_ROUTE`/`RESPONDER_ARRIVED` happens to carry a payload `location` — currently only the en-route path actually populates one. A recurring/independent "responder location update" packet, decoupled from a state transition, would need to be added.

---

## 5. Frontend — current state

### Every screen/route (apps/mobile)

Source of truth for intent: `apps/mobile/src/screens/screen-registry.ts` (`status` field is authored by the team itself, `'scaffold' | 'partial' | 'complete'`). Actual routes wired in `app/_layout.tsx` + `app/(tabs)/_layout.tsx`:

| Route | Registry status | What was observed reading the file |
|---|---|---|
| `readiness.tsx` | complete | Role picker, permission toggles, offline-pack/internet-state readout, "Go to Home" |
| `(tabs)/index.tsx` (Home) | partial | Giant SOS button, status chips, quick actions |
| `sos/composer.tsx` | complete | Category/severity/people/injured/mobility/note/language form → `saveSos()` |
| `sos/active.tsx` | partial | Delivery timeline (saved locally → peer receipts → responder ack), Update/Cancel |
| `(tabs)/map.tsx` | partial | **Explicit placeholder**: `"Map renderer deferred · packet projection is active"`; a List View toggle reads `mapObjects` from the store |
| `(tabs)/nearby.tsx` | complete | Incident list sorted by severity, taps to responder detail |
| `responder/detail.tsx` | complete | Accept/Decline/En Route/Arrived/Resolve buttons + "Send My Location" |
| `resource/detail.tsx` | complete | Reads one `mapObjects` entry; coordinate label or "NO COORDINATE IN PACKET"; Navigate button opens an `Alert` saying map rendering is deferred |
| `relay.tsx` (RelayStatus) | partial | Relay on/off switch, peers-nearby count, probe-gateway button, queue counters (queued/forwarded are hardcoded `—`) |
| `tier2.tsx` (Tier2Listen) | partial | Read-only ggwave/WavePX reception log |
| `diagnostics.tsx` | complete | Filterable event/packet table, Share export |
| `(tabs)/profile.tsx` | partial | District picker (local-only, 5 hardcoded districts), "REVIEW OFFLINE MAP STATUS" button opens an `Alert` saying no basemap bundle is installed, links to Relay/Tier2/Readiness/Diagnostics |

All 12 screens in the registry exist as routes; none are missing, but the two directly relevant to a map feature (`Map`, `ResourceDetail`'s "Navigate" action) are explicitly non-functional placeholders.

### State management

One store: `apps/mobile/store/useAppStore.ts`, Zustand + `persist` middleware backed by AsyncStorage.

- **Persisted** (the `partialize` list, `useAppStore.ts:167-173`): `role`, `selectedRegion`, `language`, `hasCompletedReadiness`, `transportMode`.
- **RAM-only** (everything else — lost on app restart): `bluetoothEnabled`, `locationEnabled`, `microphoneEnabled`, `internetState`, `relayActive`, `peersRecentlySeen`, `batteryPercent`, `batteryTemperatureC`, `thermalState`, `runtimeError`, `storedPackets`, `activeIncidentId`, `distinctPeerReceipts`, `runtimeIncidents: RuntimeIncident[]`, `mapObjects: RuntimeMapObject[]`, `diagnosticEvents`, `selectedIncidentId`, `selectedMapObjectId`, `offlinePackVersion`, `offlinePackStatus`, `tier2Listening`, `hasActiveSos`, `selectedRadio`.
- `RuntimeMapObject` shape (`useAppStore.ts:10`): `{ objectId, kind, label, state?, latE7?, lonE7?, asOfS, provenance }` — E7 integers, matches the backend/contracts convention.

### Map rendering

- **Mobile (`apps/mobile`)**: no map library dependency at all (`package.json` has none of `react-native-maps`, `@maplibre/maplibre-react-native`, etc.). `(tabs)/map.tsx` renders a static icon and the text "Map renderer deferred · packet projection is active"; a List View is the only working view, driven by `mapObjects` from the store.
- **Web (`apps/web-authority`)**: a fully working `maplibre-gl` (`^6.5.0`) integration exists in `OperationsMap.tsx` — OSM raster tiles, custom DOM markers per feature type (incident/resource/hazard/route/gateway), popups with quick-state publish buttons, a click-to-pick / draggable-pin location picker (used by the campaign composer's broadcast-point field), layer toggles, "Fit state" bounds button, live zoom/lat/lon readout. This is wired into three places in `App.tsx`: `CoordinateV2` (incident + responder command view), `PublishWorkspace` (shelter/hospital/hazard/route publishing), and `LocationPicker` inside `CampaignComposer`. This code is desktop React and cannot be reused as-is inside the React Native mobile app.

### Location-reading code

- Library: `expo-location` (`~18.0.0`), used only from `apps/mobile/src/services/mobile-controller.ts`.
- **One-shot only.** `bestEffortLocation()` (lines 246-254) calls `Location.getForegroundPermissionsAsync()` then `Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000, requiredAccuracy: 500 })` — a cached last-known fix, not a fresh GPS read, and not `watchPositionAsync`/any continuous stream. No background location, no geofencing.
- Triggered from exactly two call sites: `saveSos()` (SOS create/update, `mobile-controller.ts:135`) and `responderTransition('en-route')` (the "Send My Location" action, `mobile-controller.ts:201`). Nothing else in the app reads device location.
- Foreground location permission is also requested once at readiness time via `requestPermissions()` (`Location.requestForegroundPermissionsAsync()`).

---

## 6. Frontend — local storage

### apps/mobile

- **AsyncStorage** (`@react-native-async-storage/async-storage@1.23.1`):
  - Zustand `persist` under key `'dsm-app-state'` — only the five fields listed in §5.
  - Three standalone keys written directly by `mobile-controller.ts` `stableValue()`: `'dsm-source-id-v1'`, `'dsm-node-token-v1'`, `'dsm-local-user-id-v1'` (stable per-install identifiers).
- **expo-sqlite** (`~15.0.0`), database file `disaster-sos-mesh.sqlite` (`apps/mobile/src/services/sqlite-repositories.ts`). Tables: `seen_packets(packet_id, digest, seen_at_ms)`, `packets(packet_id, bytes_b64, digest, stored_at_ms, retention_until_s, custody_json)`, `observations(id, packet_id, body_json)`, `fragments(object_id, fragment_index, body_json)`, `peers(peer_token, body_json)`, `assembled_files(file_id, body_json)`. This is the mesh packet/peer/file store — it does **not** hold shelters, hazards, incidents, or map objects as rows.
- **No persisted map/POI store exists.** Shelters/hospitals/hazards/safe-zones/incidents visible on the phone come from `@dsm/mapkit`'s `MapProjection`, which is an **in-memory-only** object constructed fresh in `AppRuntime.create()` (`app-runtime.ts:86`). It is rebuilt purely from whatever packets get re-ingested at runtime — there is no SQLite table backing it, so a killed-and-relaunched app has to re-derive the projection from the packet log rather than reading a saved snapshot.

### apps/web-authority

- Only `window.sessionStorage`, key `'dsm-operator-session'` (operator label, operations key, roles, region code — `api.ts:48-57`). No IndexedDB, no persisted map data; every screen re-fetches from the backend on a 3-second poll (`App.tsx:45`).

---

## 7. Coordinate handling

**E7 integers (`latE7`/`lonE7`, degrees × 1e7) are used consistently everywhere in the domain/wire layer** — `packages/contracts` (`envelope.ts` GeoExtension, `payloads.ts` LocationState/HazardPayload/OfficialAlertPayload, `map-ops.ts` every operation), the backend's `RegionalRecord`/`CampaignRecord`/`IncidentView`, and the mobile store's `RuntimeMapObject`. Nowhere in the shared packages is a plain float lat/lon field used.

Plain floats only ever appear at the very edges, as local UI state, and are converted inline at each site independently:

- `apps/mobile/src/services/mobile-controller.ts:252` — GPS fix → E7: `latE7: Math.round(fix.coords.latitude * 1e7)`.
- `apps/mobile/app/resource/detail.tsx:104` — E7 → display string: `(latE7 / 1e7).toFixed(5)`.
- `apps/web-authority/src/OperationsMap.tsx:151,155` — E7 → GeoJSON `[lon/1e7, lat/1e7]` for MapLibre.
- `apps/web-authority/src/App.tsx` `CampaignComposer`/`LocationPicker` — user-typed degrees → E7 (`Math.round(point.lat * 1e7)`) when building the campaign draft, and E7 → degrees when populating the form from a loaded campaign.
- `apps/backend/src/operations.ts` — receives `latE7`/`lonE7` directly from the wire/JSON body, only ever rounds and clamps (`clamp(Math.round(input.latE7), ...)`), never converts from floats.

**No shared E7 ↔ float conversion utility exists anywhere in the repo.** Every one of the call sites above reimplements the `* 1e7` / `/ 1e7` arithmetic independently; there is no exported helper in `packages/contracts`, `packages/codec`, or `packages/mapkit` for this.

---

## 8. BLE mesh implementation status

### Implemented for real (native/android-radio-bridge/android/.../AndroidRadioBridgeModule.kt)

- **BLE advertise**: `BluetoothLeAdvertiser.startAdvertising()` with manufacturer-specific data (company ID `0xffff`, magic byte `0xd5`), connectable, `ADVERTISE_MODE_LOW_POWER`.
- **BLE scan**: `BluetoothLeScanner.startScan()` with a manufacturer-data filter matching the magic byte.
- **GATT server + client**: one custom service UUID (`7d4f0000-…`) with an RX write characteristic and a TX notify characteristic; MTU negotiated up to 247 bytes (`LINK.REQUIRED_ATT_MTU` in `contracts/limits.ts`).
- **Bluetooth Classic fallback**: RFCOMM server socket (`listenUsingRfcommWithServiceRecord`) plus bonded-device/`ACTION_FOUND` discovery, selected automatically when BLE roles are unavailable (`createNativeTransport()` in `native/android-radio-bridge/src/index.ts`).
- **Foreground relay service**: `RelayForegroundService` started/stopped alongside `startRelay`/`stopRelay`.
- Full `CapabilityReport`/`PermissionSnapshot` reporting matching the `@dsm/contracts` shape exactly (battery %, temperature, thermal throttling, per-permission grant state).

### Implemented, transport-agnostic (packages/node-runtime/src/relay-loop.ts + packages/routing)

- Full session lifecycle driven by `RelayLoop`: peer discovery → deterministic initiator arbitration (`shouldInitiate`) → open session → mutual `INVENTORY` exchange → filtered push of only what the peer is missing → `LINK_RECEIPT` on accepted ingest → close.
- **Deduplication**: global, by `packetId` + payload digest. `NodeEngine.ingest()` checks `packets.hasSeen()`/`getDigest()` before accepting; a same-ID-different-digest arrival is quarantined as a conflict, a same-ID-same-digest arrival is recorded as a duplicate observation without re-triggering display/alert/relay actions.
- Exponential backoff with jitter on repeatedly-failing peers (`backoffMs`), and a "nothing changed since last contact" skip using each side's queue epoch — a converged neighborhood goes quiet rather than re-negotiating every advertisement.
- Per-class copy budgets, hop limits, and TTLs are enforced (`CLASS_BUDGETS` in `contracts/limits.ts`), not a naïve flood.

### Simulated only (no real radio)

- `packages/transport-core/src/simulated-adapter.ts`'s `RadioMedium`/`SimulatedTransportAdapter` — an in-memory bus used by Expo Go, unit tests, and `packages/simulator`. It satisfies the exact same `TransportAdapter` interface as the native module (that equivalence is the explicit "Gate II" design goal), but it is not real Bluetooth. The mobile app always reports which one is active (`transportMode: 'SIMULATED' | 'native'`, rendered verbatim on the readiness screen — the code comments are explicit that this must never be hidden or softened).

### Recipient/visibility filtering — confirmed it does not exist as a "who gets to see this" mechanism

There is **no packet field for a recipient/target, and no filtering primitive that restricts an incoming packet to "only the original SOS sender."** What exists instead, in `packages/policy/src/index.ts` (`DefaultPolicyEngine.decide()`), is a **display-visibility decision** made independently on every device for every accepted packet, based on:
- whether the packet is the viewer's own (`header.sourceId === localSourceId`) or belongs to an incident the viewer created (`ownIncidentIds`, populated by `NodeEngine.claimIncident()` when a phone calls `createLocal()`),
- the viewer's role (`general-public` vs `responder`),
- distance from the viewer's coarse location vs. a configured `displayRadiusM`,
- packet severity.

This produces outcomes like `'show-full' | 'show-minimal' | 'hide' | 'diagnostics-only'`, but it is a per-device *local* policy over packets every device can physically hold — there is no access-control list, no encryption-to-recipient, and no packet-level "this is for phone X only" marker anywhere in `PacketHeader` or any payload. A future "only show this responder-location update to the original SOS sender" requirement would need a new mechanism; recognizing "my own incident" already works (via `ownIncidentIds`) but nothing today keys a *responder's* location update to a specific *other* recipient phone.

---

## 9. Gaps — what does not currently exist anywhere in this codebase

- **No map rendering library in `apps/mobile`.** No `react-native-maps`, no `@maplibre/maplibre-react-native`, nothing in `package.json`. `(tabs)/map.tsx` and the "Navigate" button in `resource/detail.tsx` are explicit, labelled placeholders.
- **No continuous or background location tracking.** `expo-location` is used only as a one-shot cached-position read (`getLastKnownPositionAsync`), triggered only by SOS create/update and the responder "Send My Location" action. No `watchPositionAsync`, no background task, no geofencing.
- **No standalone "responder location" (or "share my live location") packet type.** The closest existing hook is the optional `location` field on `RESPONDER_EN_ROUTE` (0x23) only, which the current UI reuses by re-firing the en-route transition — it is not a repeatable, on-demand, or timer-driven location ping, and no other message type (including SOS_UPDATE's own `location` field, which does already exist for the citizen side) has an equivalent for a responder pushing location outside of that one state transition.
- **No shared E7 ↔ float coordinate conversion utility.** Every screen/service that needs to display or submit a coordinate reimplements `* 1e7` / `/ 1e7` inline, independently, in at least four different files (mobile controller, mobile resource-detail screen, web OperationsMap, web CampaignComposer).
- **No persisted map/POI store on the mobile client.** `MapProjection` (from `@dsm/mapkit`) is constructed fresh, in memory only, each time `AppRuntime.create()` runs; there is no SQLite table for shelters/hazards/resources/incidents as displayable objects (only the raw packet log is persisted in `expo-sqlite`).
- **No per-recipient / access-controlled packet visibility.** Policy filters by role, ownership-of-incident, radius, and severity — not by an explicit "this update is for phone X" marker. Anything resembling "only the SOS sender sees this responder update" would need a new mechanism.
- **The existing MapLibre integration is web-only and not portable.** `apps/web-authority/src/OperationsMap.tsx` is a real, working implementation, but it's plain DOM/React using `maplibre-gl`; none of it can be imported into the React Native mobile app. Building a mobile map is a from-scratch integration on a different rendering stack, not a port of existing code.
- **`apps/web-broadcaster` is an empty stub** (`package.json` only, no `src/` directory at all) — not a source of any reusable code for this feature.
- **No offline base-map artifact is bundled.** `content-packs/` contains only a README; `PackManifest.baseMapArtifact` is a typed field with nothing behind it yet, and the mobile Profile screen's "REVIEW OFFLINE MAP STATUS" action explicitly tells the user no basemap bundle is installed.
