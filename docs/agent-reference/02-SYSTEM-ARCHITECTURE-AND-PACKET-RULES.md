# Disaster SOS Mesh — Complete System Architecture, Protocol, and Data Specification

**Specification version:** 2.0  
**Scope:** Android mobile, native radio adapters, local persistence, routing, gateway synchronization, backend, dashboards, offline map, and Tier 2 audio.

## Purpose

This document defines how the mobile app, Bluetooth mesh, local database, offline map, opportunistic gateway, backend dashboards, and Tier 2 radio path fit together. It is implementation guidance without application code.

## Architectural invariants

Agents must preserve these invariants:

1. An offline phone can create, store, show, and relay an SOS without any server call.
2. Bluetooth is the only Tier 1 phone-to-phone transport.
3. ggwave is only the Tier 2 authority radio transport.
4. All transports feed one packet validator, local store, policy engine, and map projection.
5. A packet's identity remains stable across hops and transports.
6. Receiving a packet does not automatically mean showing it, notifying the user, forwarding it, or uploading it. Those are separate decisions.
7. Map state is derived from the predownloaded base pack plus accepted update packets.
8. Internet is detected and used opportunistically; it is never assumed.
9. Critical control traffic always has capacity ahead of files and images.
10. Every location displayed to a user includes age and accuracy when available.

## Chosen technical architecture

The hackathon architecture is intentionally layered so radio failures do not corrupt product logic.

| Layer | Decision | Responsibility |
|---|---|---|
| Presentation | React Native Android application | Screens, interaction, accessibility, map/list rendering, role-specific actions |
| Application/domain | TypeScript business logic | Incidents, packets, policy, projections, custody, campaign/check-in behavior |
| Persistence | Durable on-device structured store plus bounded file storage | Packets, incidents, map deltas, seen IDs, fragments, events, regional content metadata |
| Native bridge | Expo Module or equivalent Android-native bridge in an Expo development build | BLE advertise/scan, GATT server/client, foreground relay service, audio PCM bridge, runtime capabilities |
| Tier 1 primary adapter | Android BLE | Nearby discovery and compact bidirectional packet sessions |
| Tier 1 contingency adapter | Android Bluetooth Classic only if BLE cannot satisfy the selected device demo | Same session contract; no product logic changes |
| Tier 2 adapter | ggwave audio decoder/encoder integration | One-way prepared radio-program frame recovery |
| Connectivity adapter | Android network state plus live application probe | Proven gateway state, not assumed connectivity |
| Online backend | Region-scoped ingest, incident, resource, campaign, responder, and outbound queue services | Optional coordination and internet-to-mesh |
| Web application | Authority/coordinator and broadcaster role surfaces | Incident operations and Tier 2 campaign workflow |

### Why an Expo development build is mandatory

The standard Expo Go client contains a fixed native runtime. The required Bluetooth behavior includes Android scan, advertise, connect, and phone-side GATT server/client work, plus long-running foreground operation. Those capabilities must exist in the installed native binary. Therefore:

- Expo Go is acceptable for presentation and simulated-domain development.
- The integrated hackathon app uses an Expo development build containing the native radio module.
- The React Native application remains the product shell; this is not a change to a different mobile framework.
- Native events must be normalized before entering the TypeScript/domain layer.
- Direct use of platform radio APIs from arbitrary screens is prohibited.

### Primary BLE role model

Every phone must be able to alternate or combine these roles within device limits:

- Advertiser/peripheral: publishes the service presence and accepts a session as a GATT server.
- Scanner/central: discovers protocol advertisements and initiates a connection as a GATT client.
- Relay: stores accepted packets and later takes either role with another peer.

The system must not depend on one permanently central coordinator phone. Role arbitration is local and temporary.

## Logical component contracts

This section defines what each component consumes and emits. It does not prescribe code syntax.

### Packet codec

Consumes a typed packet draft and returns a deterministic bounded binary envelope plus size information. It also parses bytes into either a typed candidate or a precise rejection reason. It owns canonical field ordering, numeric representations, maximums, and payload checksums.

It does not decide whether the user should see, relay, or act on a packet.

### Packet validator

Consumes a parsed candidate plus transport observation and local time/capabilities. Returns structural validity, integrity outcome, duplicate/conflict state, expiry/hop outcome, source role label, and reason codes.

It does not update UI or perform network calls.

### Policy engine

Consumes a valid packet, local role, profile preferences, current/coarse location, map pack state, battery/storage state, queue state, and transport context. Produces independent store, display, notify, relay, upload, retention, and action decisions.

Every decision must include reason codes suitable for diagnostics.

### Packet repository

Performs idempotent insertion by packet identity and digest. Maintains current/superseded state, observations, custody, expiry, fragments, and seen-cache records. Writes complete valid state transactionally before announcing it to projections or relays.

### Incident reducer

Builds one incident timeline from SOS create/update/cancel and responder/backend lifecycle packets. Selects active state by incident ID and valid source sequence/state rules. Never destructively merges separate possible incidents merely because their coordinates are close.

### Map projection engine

Projects accepted typed records onto the regional object registry. All updates are deterministic and idempotent. It emits a new visible state and records which packet caused it.

### Relay scheduler

Reads eligible custody records, per-neighbor knowledge, copy budgets, priority queues, battery state, and cooldowns. Produces a transfer offer/order. It cannot bypass validation or invent packet content.

### Bluetooth adapter

Publishes normalized events: capability state, permission state, advertising state, peer observed, connection state, negotiated properties, bytes received, bytes sent, session closed, and error. It accepts bounded commands: start/stop relay mode, advertise summary, scan policy, open/close session, transmit session record, and cancel transfer.

### Gateway synchronizer

Consumes proven-connectivity state and eligible upload queue. Produces upload observations, backend acknowledgement packets, downloaded outbound packets, and gateway status events. It must use the same local validator for downloaded packet bytes.

### Tier 2 adapter

Consumes PCM/audio frames and campaign decoder settings. Produces raw frame candidates and transport metrics. The resulting unified packet enters the shared validator and repository. The adapter cannot directly modify the map.

## Native radio bridge specification

### Capability report

At startup and whenever Bluetooth state changes, the native bridge reports:

- Android version/API level;
- Bluetooth available and enabled;
- BLE scan supported;
- BLE advertising supported;
- multiple-advertisement capability;
- GATT client supported;
- GATT server available;
- extended advertising availability;
- LE Coded PHY availability;
- maximum advertising data length where known;
- current permissions for scan, advertise, connect, location, notification, microphone, and foreground-service operation;
- current battery/thermal restrictions visible to the app;
- audio input availability.

Capability absence changes the UI and selected adapter; it must not crash app startup.

### Relay service lifecycle

Relay service states are:

1. Stopped.
2. Permission required.
3. Starting.
4. Advertising/scanning.
5. Session active.
6. Backing off.
7. Battery-limited.
8. Error requiring user action.

The foreground notification must state that disaster relay is active and provide a route to stop it. A process restart should reconstruct durable queue state before advertising availability.

### BLE discovery advertisement

The discovery payload is deliberately not the unified packet header. It should fit the smallest practical advertisement and contain only:

| Discovery field | Purpose |
|---|---|
| Protocol service identifier | Ignore unrelated Bluetooth traffic |
| Protocol major/minor compatibility | Avoid unusable sessions |
| Rotating node token | Session correlation without a permanent public identifier |
| Capability bits | Server/client, fragment, gateway, responder-mode, and optional PHY capabilities |
| Queue epoch | Signals that available inventory changed |
| Highest waiting priority | Helps peers decide whether to connect |
| Compact inventory hint | Low-cost probability that useful packets differ |
| Proven-gateway bit with freshness class | Advertises opportunity without claiming permanent connectivity |
| Connection invitation/busy bit | Avoids waste while device slots are occupied |

Forbidden in advertisements:

- victim name;
- phone number;
- full SOS text;
- exact coordinates;
- exact incident ID;
- permanent account ID;
- full packet inventory.

### Connection arbitration

When two phones both scan and advertise, deterministic local rules reduce duplicate simultaneous connections:

- Prefer an existing healthy session over a new one.
- Do not connect when compact inventory and epochs indicate no useful difference unless critical reconciliation is due.
- Use rotating-token ordering or another deterministic tie-breaker so only one side normally initiates.
- Apply random jitter before reconnecting after failure.
- Limit concurrent sessions based on measured device behavior.
- Reserve the ability to interrupt low-priority work for critical traffic.

### Session phases

| Phase | Required exchange | Failure result |
|---|---|---|
| Establish | Connection and service discovery | Close and apply bounded backoff |
| Hello | Node token, protocol range, capabilities, maximum record/fragment, queue/battery bands | Close if incompatible |
| Inventory | Recent critical IDs plus compact normal summary and pending terminal/control IDs | Continue only when useful differences exist |
| Request | Explicit desired packet IDs/fragments in priority order | Ignore unsupported/invalid requests |
| Transfer | Bounded records/fragments with flow control | Retry missing items within session budget |
| Receipt | Per-record valid-receipt or rejection reason | Sender updates neighbor knowledge, not backend state |
| Reconciliation | Pending acknowledgements, tombstones, critical explicit ID check | Retain unresolved work for next contact |
| Close | Summary of accepted records and clean session end | Idle timeout forces close |

### Session flow control

- Only a bounded number of unacknowledged records/fragments may be in flight.
- The receiver's advertised buffer and storage limits are authoritative for the session.
- A session has maximum duration, byte budget, and idle timeout.
- Control records may interrupt fragment batches.
- The sender must not treat transport write success as packet acceptance.
- A record receipt is issued only after complete parsing, integrity validation, and durable acceptance.

## Canonical protocol registry

The registry must assign stable numeric codes. Exact numeric values are finalized once and placed in one registry; agents must not create transport-specific aliases with different meanings.

### Emergency family

#### SOS_CREATE

Required fields:

- incident ID;
- emergency category;
- severity Level 0–3;
- people total;
- mobility state;
- creation time;
- expiry;
- source sequence starting at the initial value;
- location status and, when known, coordinates/accuracy/age;
- source role label;
- reply capabilities.

Optional bounded fields:

- injured count;
- children/dependent count;
- prepared phrase or short note;
- language;
- compact user/profile reference;
- requested help categories.

Actions:

- create or attach to one incident by explicit ID;
- display urgently according to severity, range, and role;
- relay with highest copy budget;
- upload when a gateway appears.

#### SOS_UPDATE

Carries incident ID, higher source sequence, changed fields only, update time, and optional new location. It supersedes earlier active values but retains history.

#### SOS_CANCEL

Carries incident ID, source sequence, cancel reason category, time, and terminal expiry. It stops active display/forwarding when source/role rules permit.

### Response family

#### RESPONDER_ASSIGNED

Carries incident ID, assignment ID, responder reference/team, assignment time, dispatcher/coordinator label, and expiry.

#### RESPONDER_ACCEPTED and RESPONDER_DECLINED

Carry assignment ID, incident ID, responder reference, response time, and optional compact decline reason. Acceptance does not mean travel has begun unless the workflow combines those actions explicitly.

#### RESPONDER_EN_ROUTE

Carries assignment/incident, responder reference, status time, optional shareable responder location and accuracy, and optional ETA band. ETA must not be shown as guaranteed.

#### RESPONDER_ARRIVED

Carries assignment/incident, time, and declared/proximity-assisted evidence category. It does not automatically close the incident.

#### RESOLVED

Carries incident, terminal state time, resolver role/reference, bounded reason/outcome category, and terminal retention period. The prototype rule must explicitly configure which demo roles may issue it.

### Receipt family

#### LINK_RECEIPT

Session-local or compact packet observation containing packet ID, digest prefix, receiving node token, acceptance/rejection result, and time. It is never presented as backend or responder delivery.

#### BACKEND_ACKNOWLEDGEMENT

Carries original packet/incident ID, backend receipt ID, accepted time, deduplication outcome, and optional coordination status. It returns as a normal high-priority packet.

### Resource family

#### SHELTER, HOSPITAL_OR_MEDICAL_POST, FOOD_WATER, SAFE_ZONE

Common fields:

- stable object ID or temporary object ID;
- record version/source sequence;
- coordinates or known regional object reference;
- operational state;
- valid-from and expiry/last-confirmed time;
- source role/category;
- compact capability/category bits.

Optional fields:

- capacity band or bounded number;
- availability band;
- opening-hours code;
- short fallback label;
- accessibility/medical capability bits;
- contact reference only if disclosure policy permits.

These records update existing offline map objects whenever possible.

### Hazard and navigation family

#### HAZARD

Fields include hazard ID, type, severity, geometry type, compact coordinates/object references, start/update time, expiry, affected radius or route IDs, and source category. Complex polygons are not sent as ordinary emergency packets; the hackathon uses points, circles, small route-segment sets, or cached geometry references.

#### ROUTE_BLOCKAGE_OR_CHANGE

Fields include route/edge ID, state (blocked, restricted, reopened, advised), reason category, direction if relevant, valid time, and optional short fallback instruction.

### Authority family

#### OFFICIAL_ALERT

Fields include alert ID/version, category, severity, region/geofence, valid window, language/fallback text, instruction code, related map object IDs, and campaign/source label. In this prototype, “official” means created through the provisioned authority dashboard workflow, not cryptographic verification.

### Request family

#### RESOURCE_REQUEST

Fields include request ID, category, urgency, quantity band, people count, location state, time, expiry, and optional incident link. A request is not an authoritative resource location.

#### MESH_CHAT

Fields include a deterministic conversation ID, sender and recipient node tokens, an optional bounded sender label, and at most 120 UTF-8 bytes of text. Chat packets are stored durably, never uploaded by the gateway, and relayed opportunistically through Tier 1 only. The prototype does not encrypt chat content, so relay phones can retain plaintext until normal packet expiry. UI copy must say saved/received, never imply end-to-end delivery from local creation alone.

### File/data family

#### FILE_MANIFEST

Fields include file ID, purpose/category, MIME category, total byte length, fragment size/count, whole-file digest, optional thumbnail reference, priority, expiry, and creator/source category.

#### FILE_FRAGMENT

Fields include file ID, fragment index, fragment byte length, fragment integrity, and data. It is transferred only after an explicit request and budget check.

### Network family

#### HELLO_CAPABILITY

Session-scoped capabilities, limits, protocol range, node token, role category, battery/storage bands, gateway freshness, and queue summary.

#### INVENTORY

Critical explicit IDs plus bounded compact summaries for other queued content, terminal records, and fragment availability.

#### PACKET_REQUEST

Explicit packet IDs and requested fragment ranges in priority order.

#### NETWORK_STATUS_OBSERVATION

Optional diagnostic information describing a recent contact or gateway observation. It must be bounded, short-lived, and excluded from uncontrolled flooding.

## Header and payload design

### Fixed envelope fields

The chosen binary design should keep a fixed routing/validation prefix and typed payload. The fixed prefix must support fast rejection and include:

- magic/protocol marker;
- protocol version;
- message type;
- flags;
- priority and severity;
- header/payload lengths;
- packet ID;
- compact source ID;
- created and expiry times;
- hop count/limit;
- fragment metadata when fragmented;
- payload integrity prefix;
- header integrity value.

The previous 64-byte fixed-header proposal is a maximum-oriented design, not an obligation to waste 64 bytes on every ggwave message. The implementation should define:

- a complete Tier 1 canonical envelope suitable for Bluetooth and backend storage;
- an ultra-compact Tier 2 frame carrying either a complete small packet or a compact campaign operation;
- a deterministic mapping from Tier 2 operation to the same logical packet model.

The two representations must not create different business meanings.

### Priority and severity

Priority is the network scheduling class. Severity is the human emergency level. Message type and source category also influence behavior. A resource packet does not become a life-critical SOS merely by setting severity high; validation clamps illegal combinations.

### Time and clock uncertainty

- Use compact timestamps appropriate to the demo epoch/format.
- Store local receive time separately.
- Accept bounded clock skew.
- Use TTL/hop limits when absolute time is clearly unreliable.
- Display both event time and age based on the best available estimate.
- Do not allow a far-future timestamp to create permanent retention.

### Source identity

Use a compact rotating or incident-scoped source identifier in ordinary mesh packets. A stable local account/profile reference may be included only when operationally required and disclosed. Discovery advertisements never contain it.

### Integrity

- Header/frame integrity detects accidental corruption before parsing expensive fields.
- Payload digest detects corrupt content and packet-ID conflicts.
- Bluetooth link acknowledgements do not replace application integrity.
- ggwave Reed–Solomon decoding and repetition improve recovery but do not prove authority.

## Detailed policy matrix

| Packet class | Store | Display to General Public | Display to Responder | Relay | Upload | Typical retention |
|---|---|---|---|---|---|---|
| Own SOS | Always | Always | If role owner | Urgent/high copy | Yes | Through terminal state plus audit period |
| Nearby SOS | Yes if valid/resources permit | Minimal and radius/severity controlled | Prioritized incident view | Urgent/high copy | Yes | Until expiry/resolution plus tombstone |
| Responder lifecycle | Yes | If related/relevant | Yes | Urgent control | Yes | Incident lifecycle |
| Link receipt | Compact | Delivery detail only for related packet | Diagnostics | Limited return path | Usually observation only | Short |
| Backend acknowledgement | Yes | Related owner timeline | Incident timeline | Urgent control | Already backend-origin | Incident lifecycle |
| Official alert | Yes | Region/relevance controlled | Yes | High | Reception observation optional | Valid window plus short history |
| Hospital/shelter/safe zone | Yes if region relevant | Map/list | Map/list | Normal/high when changed | Yes if mesh-origin permitted | Through supersession/expiry |
| Food/water | Yes if relevant | Map/list | Map/list | Normal | Yes if permitted | Through supersession/expiry |
| Hazard/route | Yes | Aggressive if intersecting area | Aggressive | High | Yes | Valid window/tombstone |
| Resource request | Yes | Own/nearby minimal view | Action queue | High | Yes | Until fulfilled/expired |
| File manifest | Yes | Prompt/metadata only | Prompt/metadata | Low | Optional | Short/bounded |
| File fragment | Until assembly/expiry | Hidden | Hidden | Lowest/requested only | Optional | Short |

## Routing algorithm specification

### Candidate eligibility

A neighbor is eligible only if:

- protocol versions overlap;
- it does not already advertise/confirm possession;
- the packet is not expired or over hop limit;
- per-neighbor cooldown permits transfer;
- receiver limits can accept it;
- local battery/storage policy permits it;
- the copy budget or critical override permits another copy.

### Forwarding utility inputs

The routing implementation computes a documented bounded utility from:

- verified fresh gateway status;
- progress toward explicit destination/region;
- novelty of neighbor inventory/contact set;
- movement/store-carry potential;
- responder relevance;
- link reliability from recent sessions;
- battery suitability;
- receiver queue/storage suitability;
- recent copy overlap;
- failure/backoff state;
- packet age and urgency.

Weights may be simplified for the hackathon, but behavior and reason codes must be deterministic. “Farthest neighbor” is never the sole rule.

### Copy budgets by class

The configuration registry must define initial copy budget, per-epoch peer cap, retry interval, hop limit, and TTL for every packet class. Recommended relative order:

- Level 3 SOS and terminal control: largest controlled budget.
- Other SOS, responder, critical official alert: high.
- Hazard/route and urgent requests: medium-high.
- Resources/check-ins: medium.
- General updates: low-medium.
- Files/fragments/topology observations: low and explicitly requested/bounded.

Exact numbers are test configuration, not hard-coded across all environments without measurement.

### Queue fairness

Within a priority class:

- older eligible packets gain weight;
- updates that supersede earlier versions should be offered before obsolete versions;
- terminal records are served promptly;
- one incident/source cannot consume the entire queue indefinitely;
- control inventory/receipts always retain a small reserved budget.

## Persistence and data model

### Mobile entities

| Entity | Key fields and relationships |
|---|---|
| LocalProfile | Local user ID, alias, role, language, optional emergency/responder attributes |
| DeviceCapability | Capability snapshot, permission state, build/runtime identity, observed time |
| Packet | Packet ID, type, source, created/expiry, priority/severity, digest, canonical bytes, current validation state |
| PacketObservation | Packet ID, transport, previous peer/gateway/campaign, received time, signal/session metadata |
| PacketCustody | Packet ID, local state, copy budget, retry/cooldown, upload state, retention outcome |
| Fragment | Packet/file ID, index, digest, bytes, completeness/expiry |
| Incident | Incident ID, active state, latest sequences, severity, assignment, terminal state |
| IncidentEvent | Incident ID, causing packet, event type/time/source, active/superseded flag |
| ResourceRecord | Object ID, type, active version, source, state, validity, map data reference |
| HazardRecord | Hazard ID, type/severity, compact geometry/reference, validity, source |
| RouteState | Route/edge ID, state, version, validity, source |
| PeerObservation | Rotating token, session/contact time, shareable location/capability, expiry |
| GatewayState | Probe result/time, upload/download cursors, sync state |
| CampaignState | Campaign ID/version, expected/recovered packet set, source path, completion |
| MapProjectionEvent | Object/incident ID, operation, packet ID, applied version, result/reason |
| EventLog | Structured diagnostic event with severity, timestamps, IDs, sizes, and reason codes |

### Required indexes and uniqueness rules

- Packet ID plus digest is idempotent.
- Packet ID with a different digest is a conflict and quarantined.
- Incident ID plus source/stream plus sequence is unique.
- One active version per resource/hazard/route source stream.
- Fragment index is unique within object/packet.
- Observations may repeat for the same packet but require their own time/source identity.
- Seen-ID lookup must remain efficient after packet payload eviction.
- Expiry/retention indexes support cleanup without scanning all records.

### Transaction boundaries

- Packet acceptance, custody creation, and initial observation commit together.
- File completion and visibility switch atomically after whole-object validation.
- Map projection records the causing packet and new active version together.
- Incident current state changes only when the causing event is durably recorded.
- Gateway upload cursor advances only after a confirmed backend response.

## Backend model and service boundaries

### Ingestion

Accepts bounded batches of canonical packets plus gateway observations. Revalidates structure and integrity. Produces per-packet accepted, duplicate, conflicted, expired, or invalid outcomes.

### Packet/observation store

Stores one canonical packet and multiple gateway/reception observations. Raw diagnostic bytes are retained only as needed for the hackathon evidence policy.

### Incident service

Projects emergency and response packets into a timeline. Supports assignment and terminal actions by emitting new packets rather than mutating history invisibly.

### Regional information service

Owns stable map object IDs, baseline/import version, current authority changes, hazards, and routes for the selected region. Generates compact deltas.

### Responder service

Maintains demo responder roster, capability/availability, assignments, and status. It must not claim production identity verification.

### Gateway outbound service

Selects relevant high-priority packets for a gateway based on region, campaign, acknowledgement responsibility, and cursor. Download results are idempotent.

### Campaign service

Owns campaign draft, validation, approval, expected packet inventory, repetition schedule, audio artifact identity, decode test, broadcaster state, and logs.

## Conceptual online API obligations

The exact URL design is implementation-owned, but the backend must support these operations:

- live health/connectivity probe suitable for declaring a gateway;
- gateway registration/session with prototype identity;
- batch packet upload with per-item outcomes;
- outbound packet poll/sync using a cursor;
- gateway acknowledgement of downloaded items;
- incident list/detail/timeline;
- responder list, assignment, and state actions;
- regional resource/hazard/route list and update;
- campaign create, validate, approve, inspect, and archive;
- broadcaster audio artifact/test/log updates;
- demo reset or seed in a controlled non-production environment.

All request and response sizes must be bounded. Gateway sync must tolerate retry without creating duplicates.

## Offline map/content-pack architecture

### Content-pack manifest

The selected regional pack must record:

- pack ID and version;
- region name/bounds;
- creation/import time;
- compatible application schema version;
- base map/data artifact identity;
- stable object registries by type;
- language variants;
- cached guides and check-in forms;
- integrity values;
- size and readiness state.

### Object resolution

Incoming compact object IDs resolve only through the typed registry. The resolver checks object type, pack compatibility, version, and expected constraints. It never treats packet text as a filesystem path, URL, query, or executable command.

### Projection precedence

The visible state is chosen from:

1. valid terminal/tombstone state;
2. latest allowed authority/responder update for the same stream;
3. latest community report shown with its distinct source label;
4. baseline pack state when no active update overrides it.

Different sources are not silently collapsed into a false consensus. Conflicts remain visible in diagnostics and may be shown as “reports differ.”

### Dynamic-person markers

SOS, responder, and peer markers use separate freshness policies. Each stores location time, receive time, accuracy, source, and transport. Interpolation or animation must not create false precision.

## Tier 2 detailed architecture

### Authority campaign planning

Before approval, the system calculates:

- encoded unified/Tier 2 size for every operation;
- estimated ggwave duration at selected profile;
- repetition count and interval;
- total campaign duration;
- priority capacity consumption;
- required regional pack/object versions;
- fallback text availability;
- expected packet/frame inventory.

A campaign that exceeds the configured judging duration must be reduced by removing verbosity, using compact IDs/deltas, or lowering noncritical repetition. It must not hide the overrun.

### Prepared radio-program artifact

The artifact package includes:

- uncompressed master audio;
- campaign ID/version;
- selected ggwave profile;
- sample rate, channel count, and bit depth;
- ordered burst schedule;
- expected packet IDs/operations;
- clean direct decode result;
- artifact integrity value;
- optional controlled noisy variants;
- human-readable spoken context that is not required for machine decode.

### Receiver states

Stopped → permission required → listening/reading direct input → preamble detected → frame collecting → frame valid/invalid → packet reassembling → packet accepted/duplicate/rejected → campaign complete/incomplete → timed out/stopped.

Each state must be observable in diagnostics. Application state changes only after a complete valid packet/operation reaches the shared validator.

### Repetition and deduplication

Campaign manifest and critical alert repeats use the same logical packet ID/version. Reception observations may increase, but user notification and map action remain idempotent. A changed alert uses a new version/sequence, not an accidental new unrelated identity.

### Cross-tier bridge

The bridge creates no new authority meaning. It retains logical packet/campaign/object identity, adds Bluetooth receipt observations separately, applies Tier 1 hop/expiry/copy budgets, and prevents a packet received back from Bluetooth from being re-announced endlessly as new radio content.

## Failure recovery specifications

### Process death or restart

- Reopen durable store.
- Reconcile incomplete transactions/fragments.
- Rebuild active incident/map projection or validate cached projection version.
- Expire stale records.
- Restore queue/custody state.
- Require appropriate user-visible relay/microphone mode restoration under Android rules.
- Never recreate an SOS with a new identity merely because the process restarted.

### Bluetooth disabled or permission revoked

- Stop scan/advertise/session activity.
- Preserve queues.
- Show actionable readiness state.
- Continue local map/SOS access.
- Resume only after capability/permission returns.

### Storage pressure

Evict in this order:

1. expired fragments and failed temporary audio buffers;
2. completed low-priority file fragments after policy permits;
3. stale topology/peer observations;
4. superseded low-priority payloads while preserving seen IDs;
5. old normal records outside retention.

Never evict the user's active SOS, active critical incident control, or necessary terminal suppression record before optional data.

### Clock anomalies

Use local receive time and bounded TTL/hop behavior. Flag implausible timestamps. Do not make permanent records from future time or immediately discard critical packets solely because one offline clock differs within configured tolerance.

### Conflicting updates

- Same packet ID/different digest: quarantine conflict.
- Same source stream/same sequence/different content: conflict.
- Different sources disagreeing about a resource: preserve separate observations/source labels and apply configured precedence.
- Older sequence after newer: retain only for audit; do not reactivate.

### Gateway partial synchronization

Uploads and downloads are cursor/idempotency based. Retry only unconfirmed items. A lost response may cause a duplicate observation but not a duplicate packet/incident/action.

### Tier 2 incomplete campaign

Show recovered critical content individually after validation. Mark campaign completeness accurately. Use manifest to list missing content for diagnostics. Never fabricate missing map changes.

## Observability vocabulary

Every component uses common structured event names/categories:

- capability and permission;
- relay lifecycle;
- peer discovery;
- session start/negotiation/close;
- inventory and request;
- bytes/record transfer;
- validation accepted/rejected/conflict/duplicate;
- policy store/show/alert/relay/upload/act;
- custody and queue transition;
- incident transition;
- map projection applied/ignored/failed;
- connectivity probe and gateway transition;
- gateway upload/download/acknowledgement;
- Tier 2 preamble/frame/packet/campaign;
- file manifest/fragment/completion;
- battery/storage/thermal adaptation.

Every event should include timestamp, device/session/campaign/packet references as appropriate, transport, byte count where relevant, result, and reason code. Sensitive human-readable payloads are excluded from general logs.

## Performance and resource budgets

The implementation team must freeze measurable budgets for:

- maximum packet length by transport/type;
- maximum fragments per packet/file;
- maximum reassembly bytes;
- maximum active/incomplete objects;
- maximum session duration and byte budget;
- maximum concurrent connections;
- scan/advertise duty cycles by mode;
- per-priority queue limits;
- copy budgets and retry cooldowns;
- seen-ID retention;
- peer/topology observation retention;
- gateway batch size and sync interval;
- Tier 2 campaign duration and repetitions;
- microphone listen timeout;
- local event-log retention.

No budget may remain “unlimited.” Values can be tuned after measurement, but the configuration and evidence must remain visible.

## Architecture traceability matrix

| Requirement area | Owning components | Primary proof |
|---|---|---|
| Offline SOS | SOS composer, repository, incident reducer | Create/restart/view with radios and internet unavailable |
| Automatic relay | Native bridge, Bluetooth adapter, session engine, scheduler | Real three-phone transfer |
| Store-carry-forward | Repository, custody, scheduler | Disconnect/move/reconnect scenario |
| Local response | Responder UX, incident reducer, Tier 1 | Accept/arrive/resolve with no backend |
| Gateway both directions | Probe, synchronizer, backend outbound | Upload plus returning acknowledgement/update |
| Offline map | Content registry, projection, map/list UX | Base pack and typed deltas offline |
| Topology | Peer/transfer observations, expiry, topology projection | Timestamped graph with stale behavior |
| Tier 2 | Campaign, audio adapter, shared validator/projection | Microphone/direct equivalence |
| Radio bridge | Campaign identity, repository, Tier 1 scheduler | Non-listening peer applies same update |
| File safety | Manifest/fragments, queue preemption | SOS interrupts resumable bounded transfer |
| Truthful status | Custody/incident state and UI copy | State-by-state scripted review |

## System boundaries

### Android mobile application

The Android application contains these logical modules:

- Citizen and responder user experience.
- Local profile and role state.
- SOS and packet composer.
- Canonical compact packet codec.
- Structural validation and integrity checks.
- Packet-policy engine.
- Durable local packet and incident store.
- Bluetooth neighbor discovery.
- Bluetooth session, inventory, and transfer manager.
- Forwarding, copy-budget, congestion, and custody controller.
- Connectivity verifier and gateway synchronizer.
- Offline content registry and map projection engine.
- ggwave microphone/direct-audio Tier 2 decoder.
- Notification, battery, permission, and foreground-mode controller.
- Event log and demo diagnostics.

Modules communicate through stable packet and event interfaces. Bluetooth details must not leak into the map, incident, or UI models.

### Bluetooth Tier 1 plane

Tier 1 has two distinct jobs:

- Discovery: determine which nearby nodes speak the protocol and whether useful work may exist.
- Data transfer: exchange inventories and only the missing eligible packets or fragments.

Discovery announcements remain small. They advertise protocol/capability information and queue summaries, not full SOS content or precise victim coordinates.

The preferred controlled-demo design is BLE discovery plus short-lived data sessions. The exact Android Bluetooth library is a replaceable adapter. If the chosen BLE library or device behavior blocks the demo, the team may use an alternative Android Bluetooth data path while preserving every higher-level rule.

### Local durable store

Each phone is authoritative for its local offline state. The store must retain:

- canonical packet bytes or deterministic representation;
- packet ID and payload digest;
- packet type, priority, severity, timestamps, expiry, and hop limits;
- source role and trust label;
- fragment and reassembly state;
- received transport and previous-hop observation;
- display, relay, gateway, and retention decisions;
- custody/delivery state;
- incident/update relationship;
- map projection state;
- compact seen-packet records after payload removal.

A newly created SOS must be written durably before the UI claims it was created.

### Offline content and map projection

The app ships with or is provisioned with one regional content pack containing a base map and stable compact object identifiers. The map projection combines:

- base map and preparedness objects;
- active SOS records;
- responder state and last-known locations;
- permitted peer observations;
- authority/resource updates;
- hazard and route overlays;
- closures, tombstones, and expiry;
- check-in and help-request state.

Incoming packets modify the projection through bounded typed operations. Packets never supply arbitrary file paths, URLs, database commands, or executable actions.

### Opportunistic gateway

A phone becomes a gateway only after a live connectivity probe succeeds. Gateway duties are:

- upload accepted queued packets in bounded priority-aware batches;
- include only necessary observation metadata;
- receive backend deduplication results and acknowledgements;
- download assignments, status updates, authority records, map deltas, and revocations relevant to the region;
- store downloaded items as normal packets;
- advertise and relay them to nearby Bluetooth peers.

If connectivity disappears, the node stops gateway synchronization but continues operating as an ordinary offline mesh node.

### Backend and online dashboards

The online side includes:

- packet ingestion and strict server-side parsing;
- packet and observation deduplication;
- incident aggregation and timeline;
- one-city geospatial resource and hazard data;
- responder roster, assignment, and status workflow;
- authority campaign and update composer;
- gateway acknowledgement and outbound packet queues;
- campaign approval state;
- broadcaster preview, decode test, scheduling/export, and broadcast logs;
- audit/demo event history.

The backend is a coordination enhancement. It is not in the critical path for local SOS creation, relay, display, or local responder action.

### Tier 2 publisher and decoder

The authority creates a compact campaign containing a manifest plus prioritized packets. The broadcaster converts the approved campaign into a reproducible prepared audio program, verifies that it decodes, and logs the test/play event.

The phone receives the same campaign through either:

- microphone capture from a nearby speaker playing the prepared program; or
- a direct clean-audio test input.

Both paths must yield the same packet IDs, payload values, and client decisions. The transport metadata may differ.

## End-to-end information flows

### Mesh-to-mesh flow

1. Node A advertises that its queue state changed.
2. Node B detects A and establishes a bounded session.
3. The nodes exchange capabilities and compact inventories.
4. Each node requests only missing, eligible items.
5. Packets transfer in priority order.
6. The receiver validates and stores each complete packet.
7. It records a link receipt, then independently decides display, notification, relay, retention, and future upload behavior.
8. Both nodes close the session when useful work is complete.

### Mesh-to-internet flow

1. A relay proves usable connectivity.
2. It uploads critical packets first, followed by bounded normal batches.
3. The backend validates and deduplicates packets.
4. Multiple uploads of one packet become observations of one incident, not duplicate incidents.
5. The backend returns a distinct acknowledgement packet.
6. The gateway stores and relays that acknowledgement through Bluetooth.

### Internet-to-mesh flow

1. The backend prepares relevant compact outbound packets.
2. A connected gateway downloads them.
3. The gateway applies the same local validator and policy used for any received packet.
4. It updates its offline map if relevant.
5. It advertises newly available packet IDs.
6. Neighboring offline phones request and relay them normally.

### Radio-to-mesh flow

1. A phone decodes a Tier 2 ggwave frame.
2. It verifies frame integrity, reassembles fragments when required, and parses the compact packet.
3. It suppresses repeated copies using packet ID and campaign information.
4. It updates alerts or the offline map.
5. When cross-tier policy permits, it stores a Tier 1-compatible representation with the original packet identity.
6. It advertises that packet over Bluetooth.
7. Phones that never listened to the radio can receive and apply the information.

## Compact packet envelope

The exact byte layout is an implementation decision owned by the protocol agent, but the canonical envelope must contain only bounded fields needed for parsing, routing, deduplication, expiry, reassembly, and policy.

Required logical fields:

| Field | Purpose |
|---|---|
| Protocol version | Reject incompatible representations safely |
| Message type | Select schema and policy |
| Flags | Indicate fragmentation, location, acknowledgement request, and other bounded options |
| Priority | Schedule critical traffic first |
| Severity | Express incident urgency without implying authority |
| Packet ID | Stable deduplication identity across all hops |
| Source ID | Compact rotating or incident-scoped identifier |
| Incident or stream ID | Connect updates and status to the correct case |
| Source sequence | Select the newest state update |
| Creation time | Present age and order updates |
| Expiry/TTL | Stop stale propagation |
| Hop count and limit | Bound mesh travel |
| Payload length | Bound allocation and parsing |
| Fragment index/count | Support bounded reassembly when needed |
| Payload checksum/digest | Detect corruption and conflicting reuse |
| Geographic scope | Guide display and forwarding when applicable |
| Payload | Type-specific compact data |

Mutable relay observations—previous hop, received time, signal observation, and custody state—must be stored separately from the source-created content. A relay does not rewrite the meaning of the original packet.

## Packet sizing rules

### Universal rules

- Use enumerations and numeric IDs for known values.
- Send object IDs and changed fields, not full repeated records.
- Keep notes short and optional.
- Omit unused fields.
- Apply hard maximum lengths before memory allocation.
- Prefer one small complete record over many optional decorations.
- Never include map tiles or full map objects in ordinary control packets.
- Deduplicate by packet ID before expensive work.

### Bluetooth targets

The engineering goal is to keep critical control and emergency records in the low hundreds of bytes. Resource and hazard updates should also remain compact. An image or file uses a manifest plus requested fragments and remains subject to a strict demo size limit selected during implementation.

### ggwave targets

Tier 2 payloads are smaller still. A campaign should use compact IDs that resolve against the predownloaded regional pack. Human-readable fallback text should be short. Critical items repeat more often than resource updates. A campaign manifest lets the receiver understand what it may have missed.

## Error detection and correction

### Bluetooth Tier 1

- Rely on Bluetooth link behavior for link-level transmission reliability.
- Add application-level packet length checks and payload integrity checks.
- Request a missing/corrupt packet or fragment again within bounded retry limits.
- Never process a partial or corrupt record as valid map or incident state.

### Tier 2 ggwave

- Use the modem's supported error correction.
- Add a frame checksum/integrity field.
- Repeat critical packets.
- Interleave campaign content so a short noise burst does not destroy every copy of one critical item.
- Treat a frame that fails integrity as absent, not partially usable.

This is corruption resilience, not proof of sender identity.

## Validation pipeline

Every received packet, regardless of transport, passes through the same ordered gates:

1. Minimum envelope length and protocol marker.
2. Supported protocol version.
3. Declared sizes and counts within hard limits.
4. Header/frame integrity.
5. Known packet type or safe ignore behavior.
6. Packet ID and duplicate lookup.
7. Creation, expiry, and clock-skew sanity.
8. Hop count below hop limit.
9. Fragment/reassembly limits.
10. Payload integrity.
11. Type-specific schema validation.
12. Source role/trust-label policy.
13. Geographic relevance.
14. Local user role and preferences.
15. Battery, storage, queue, and congestion policy.

No field controlled by an incoming packet may cause unlimited allocation, arbitrary file access, arbitrary navigation, or execution.

## Independent packet-policy decisions

For every accepted packet, the policy engine separately decides:

- Store: whether to retain it and for how long.
- Show: whether it belongs in the user's map, list, or incident timeline.
- Alert: whether to notify silently, normally, or critically.
- Relay: whether to forward it urgently, normally, opportunistically, or never.
- Upload: whether a future gateway should send it to the backend.
- Act: whether it updates a map record, opens a check-in, changes an incident state, or creates another bounded product action.

Example: a shelter update outside the current user's display radius may be stored and relayed toward its region without notifying that user.

## Routing and congestion policy

### Routing inputs

Forwarding decisions depend on packet class and can consider:

- confirmed usable internet on the neighbor;
- progress toward the packet's target region or known destination;
- whether the neighbor is likely to reach new nodes;
- movement/carry value;
- recent connection reliability;
- responder or authority role label;
- battery suitability;
- queue congestion;
- whether that neighbor already has the packet;
- packet copy budget and forwarding cooldown.

No single “farthest phone” rule is sufficient.

### Modes

- Direct gateway: prefer a neighbor with proven internet for upload-eligible packets.
- Directed forwarding: prefer progress toward a responder, relief point, or target region when known.
- Controlled replication: give an urgent packet to a limited number of novel useful peers when no route is known.
- Store-carry-forward: retain the packet until the phone moves or discovers a useful peer.
- Local display: create nearby value even if the packet cannot make outward progress.

### Queue order

1. SOS, SOS updates, cancellation, resolution, and critical acknowledgements.
2. Responder assignment and lifecycle control.
3. Official critical alerts.
4. Hazards, route blockages, hospitals, shelters, safe zones, and resource/help requests.
5. Check-in campaigns and responses.
6. General resource updates.
7. File manifests.
8. Requested file/image fragments.

Reserved control capacity prevents a file from blocking an SOS.

### Duplicate and loop control

- Packet IDs remain unchanged across hops.
- Seen-ID records suppress repeated processing.
- Inventories reduce unnecessary retransmission.
- Hop limit and expiry bound propagation.
- Previous-hop observation prevents immediate bounce-back.
- Per-neighbor knowledge suppresses copies to peers that already have the packet.
- Latest-wins state uses source/incident identity plus source sequence while retaining history for the demo log.
- Resolution or cancellation creates a compact terminal update that stops active display and unnecessary relay.

## Custody and truth language

Delivery states are distinct:

- Saved locally.
- Copied to a nearby node.
- Seen/acknowledged by a responder.
- Uploaded through a gateway.
- Accepted by the backend.
- Responder assigned.
- Responder accepted.
- Responder en route.
- Responder arrived.
- Resolved.
- Cancelled or expired.

A Bluetooth link acknowledgement means only that a neighboring phone received and validated the packet. The UI must never translate it into “help is coming.”

## Location and topology model

### Location markers

A packet may carry a bounded location observation with coordinates, accuracy, source, and timestamp. The map may show:

- SOS owner;
- assigned responder;
- participating peer whose location-sharing policy allows it;
- gateway observation;
- resource or hazard object.

Every moving-person marker becomes stale over time. The UI must show age or a stale state and must not imply continuous GPS tracking.

## Predownloaded map update operations

The regional data pack assigns stable IDs to map objects. Accepted packets can perform only typed operations such as:

- add or update a temporary resource;
- change open/closed state;
- change capacity or availability;
- add, update, or clear a hazard;
- block or reopen a route segment;
- place or update an SOS marker;
- place or update a responder marker;
- mark an incident assigned, arrived, resolved, or cancelled;
- activate a cached guide, map layer, or check-in form;
- withdraw a stale object through a tombstone.

If a referenced object is missing, the app shows compact fallback text/coordinates and logs the missing object. It must not silently select an unrelated map object.

## Tier 2 campaign structure

A campaign contains:

- campaign identity and version;
- compact inventory/manifest;
- region and validity window;
- critical official alert packets;
- shelter/hospital/resource changes;
- hazards and route changes;
- optional cached-content activation;
- optional check-in campaign;
- repetition and priority schedule;
- expected packet list for decode testing.

Critical alerts repeat most often. Resource updates use remaining capacity. Images and general files are excluded from the Tier 2 demo unless represented only by a compact local content reference.

## File and image rules

File/image capability exists but is deliberately constrained:

- transfer is Bluetooth or later internet, never ordinary Tier 2 payload;
- a manifest describes identity, type, total size, fragment count, and integrity value;
- receivers explicitly request missing fragments;
- partial transfer can resume;
- maximum size is hard-coded/configured for the demo and must be tested;
- incomplete data remains hidden;
- files expire and can be evicted before emergency records;
- no executables or automatic installation;
- no unbounded decompression;
- file transfer pauses immediately when critical traffic appears.

## Battery and Android lifecycle

- Relay mode is explicit and user-visible.
- Active SOS/responder mode may use more aggressive discovery for bounded periods.
- Ordinary preparedness mode uses a more conservative duty cycle.
- Background relay requires Android foreground-service behavior and an ongoing notification in the judged build.
- Microphone listening is explicit, visible, and time-bounded.
- Low battery disables files and low-priority relay before critical SOS/control traffic.
- The user's own active SOS remains prioritized.
- Capability checks occur at runtime; the app does not infer support from marketing labels.

## Security and privacy boundary for the hackathon

The prototype implements defensive parsing, checksums, expiry, role labels, rate/size limits, and local data minimization. It does not claim cryptographically verified authority, responder identity, or encrypted end-to-end victim data.

The demo should minimize sensitive information:

- do not place personal details in Bluetooth discovery advertisements;
- use compact incident/user references;
- send rescue-relevant fields only;
- make personal profile fields optional;
- keep exact peer locations time-bounded;
- use synthetic demo identities and locations during judging.

Production cryptographic authentication and privacy design are required before field deployment but are outside the hackathon implementation claim.

## Architecture-level failure behavior

| Failure | Required behavior |
|---|---|
| No peers nearby | Store the packet, show waiting/carrying state, retry with bounded duty cycle |
| Bluetooth session fails | Back off and retry or try the approved alternate Bluetooth adapter; never switch to ggwave |
| No internet anywhere | Continue local mesh, local response, maps, and local resolution |
| Gateway loses internet | Stop online sync and remain an offline relay |
| Duplicate packet | Suppress duplicate action/display while recording useful observation |
| Corrupt packet | Reject, log a reason, and retry only within bounded policy |
| Missing map object | Show compact fallback and coordinates; do not substitute silently |
| Stale location | Mark stale and reduce confidence; do not present as live |
| Tier 2 burst is missed | Recover from scheduled repetition or show campaign incomplete |
| File transfer conflicts with SOS | Pause file and serve critical traffic |
| Stock Expo Go lacks Bluetooth module | Use UI simulation there and run real transport in an Expo development/native build |

## Definition of architectural correctness

The architecture is correct when an agent can replace the Bluetooth adapter, add or remove an online gateway, decode the same authority record from Tier 2, and replay stored packets without changing the packet meaning, local policy, incident model, or map-update behavior.
