# Disaster SOS Mesh — Complete Construction, Integration, QA, and Demonstration Handbook

**Handbook version:** 2.0  
**Purpose:** convert the product and architecture specifications into independently verifiable work packages without losing end-to-end integration.

## Purpose

This file tells implementation agents what to build, in what order, and how to prove that the result matches the product decisions. It is deliberately outcome-based. Agents may choose libraries and internal organization that fit the repository, but they may not weaken the offline-first architecture or silently remove packet families.

## Definition of done

The hackathon product is done when a controlled Android demonstration proves all of the following:

- A phone with airplane-mode-style internet loss creates and durably stores an SOS.
- The SOS automatically crosses at least three participating phones using Bluetooth only.
- A nearby responder can see, accept, and update the case without internet.
- SOS, responder, peer, resource, hazard, and route information appears on a predownloaded one-region map.
- A phone that later proves usable internet uploads queued packets and downloads acknowledgements/updates.
- Downloaded updates are rebroadcast into the offline Bluetooth mesh.
- Prepared ggwave radio-program audio is decoded through microphone and direct-audio paths.
- Both Tier 2 paths produce the same packet and map behavior.
- A Tier 2 packet can be relayed onward through Tier 1 Bluetooth.
- A Tier 2 check-in campaign creates a Tier 1 response.
- All required packet families exist in the schema and have defined product behavior.
- Critical traffic remains responsive while a file/image transfer is queued.
- The demonstration makes no unsupported security, range, background-operation, FM-hardware, or Expo Go claims.

## Working rules for every agent

1. Read all three files in `docs/agent-reference` before changing product behavior.
2. Treat the product decisions file as binding.
3. Preserve the user's existing work and repository structure.
4. Keep business logic independent of Bluetooth, internet, and ggwave adapters.
5. Do not introduce an internet dependency into offline workflows.
6. Do not use ggwave as a Tier 1 fallback.
7. Do not remove a required packet family merely because it is not central to the main demo.
8. Keep packets compact and measure actual encoded sizes.
9. Use synthetic test identities and locations.
10. Distinguish static checks, simulations, and real-device evidence in all reports.
11. Do not claim stock Expo Go supports real BLE unless that exact path is proven on the judged devices.
12. Prefer a reliable controlled demo over unmeasured production claims.

## Specification precedence and change control

Agents use this precedence:

1. `01-PRODUCT-DECISIONS-AND-SCOPE.md` for user intent, roles, scope, requirements, screen behavior, and forbidden claims.
2. `02-SYSTEM-ARCHITECTURE-AND-PACKET-RULES.md` for boundaries, protocol, state, persistence, routing, synchronization, and failures.
3. This handbook for sequencing, ownership, tests, integration gates, and demo evidence.
4. The synchronized `finalsih` blueprint for judge-facing narrative and consolidated architecture.
5. Older pitch decks, mock-ups, and comments only when they do not conflict with the sources above.

A decision affecting packet identity, transport meaning, offline behavior, role permissions, map object semantics, gateway truth, or Tier 2 direction must update all affected specifications before implementation diverges. Agents must not hide a decision inside one implementation file.

## Delivery strategy

The product is broad, so the build must proceed through vertical slices rather than isolated unfinished layers. Each slice should show a user-visible outcome across storage, transport, policy, and diagnostics before the next slice expands it.

The critical path is:

1. Domain model and local durability.
2. Offline map and deterministic packet projection.
3. Real one-hop Bluetooth on selected Android phones.
4. Automatic multi-hop and responder return path.
5. Conditional gateway and dashboard loop.
6. Tier 2 campaign and radio-to-mesh bridge.
7. Full packet-family coverage, bounded file/image, hardening, and rehearsal.

UI polish, additional packet families, and web depth can proceed alongside that path only when they do not delay the first real-radio vertical slice.

## Workstream ownership

Six workstreams are recommended. One person may own more than one, but every artifact has one primary owner and one integration reviewer.

### Workstream A — Product/domain and mobile application

Owns:

- navigation and screen shell;
- General Public and Responder modes;
- SOS composer and active timeline;
- packet/incident domain models;
- packet policy presentation;
- local-help and alert UX;
- accessibility and disaster-state copy;
- integration with radio, store, map, and gateway services through defined contracts.

Must deliver:

- screen inventory and interaction state table;
- complete offline flows;
- precise delivery-state language;
- empty/loading/error/offline/stale states;
- instrumentation hooks visible in diagnostics.

### Workstream B — Native Android Bluetooth and lifecycle

Owns:

- Expo development-build/native module boundary;
- runtime capability and permission reporting;
- BLE advertise/scan;
- phone-side GATT server/client roles;
- session lifecycle and flow-control transport;
- foreground relay service;
- battery/thermal and process-lifecycle behavior;
- Bluetooth Classic contingency experiment if BLE fails the selected device matrix.

Must deliver:

- capability matrix on every demo phone;
- native event contract;
- one-hop transfer evidence;
- reconnection/backoff behavior;
- screen-off/foreground-service evidence;
- a clear go/no-go date for the contingency adapter.

### Workstream C — Protocol, persistence, routing, and simulator

Owns:

- canonical packet registry and compact encoding;
- validation reason codes and integrity checks;
- packet/observation/custody/fragment persistence;
- incident reducer and latest-wins rules;
- inventory, deduplication, copy budgets, queueing, and routing;
- deterministic simulation of contacts, loss, movement, expiry, and gateway appearance;
- golden vectors and malformed corpus.

Must deliver:

- versioned registry;
- field limits and size report for every packet type;
- deterministic golden packet set;
- restart/replay behavior;
- routing decision traces;
- queue-preemption proof.

### Workstream D — Offline map and regional data

Owns:

- selected one-city region pack;
- offline base map/data readiness;
- stable object registries;
- resources, hazards, route edges, guides, translations, and forms;
- map projection and tombstones;
- marker freshness/accuracy;
- topology and packet-journey projection;
- list equivalents and filters.

Must deliver:

- content-pack manifest;
- seed-data provenance/license note;
- compact ID registry;
- packet-to-map operation matrix;
- missing/stale/conflict behavior;
- full offline demonstration.

### Workstream E — Backend, authority, coordinator, and broadcaster web

Owns:

- gateway probe and synchronization protocol;
- packet ingestion and observations;
- incident aggregation;
- responder roster/assignment;
- regional update and outbound queues;
- authority campaign composer/approval;
- broadcaster preview/test/schedule/export/log workflow;
- controlled demo reset/seed.

Must deliver:

- idempotent batch behavior;
- incident and observation truth language;
- outbound-to-mesh proof;
- campaign state machine;
- byte/duration preview;
- audit trail for the prepared artifact.

### Workstream F — ggwave, QA, evidence, and demo integration

Owns:

- compact Tier 2 representation;
- audio generation and reproducible artifact package;
- microphone and direct-input receiver integration;
- repetition, manifest comparison, and decode metrics;
- radio-to-mesh bridge tests;
- end-to-end test matrix, performance/battery evidence, and demo rehearsal;
- failure-injection and fallback playbook.

Must deliver:

- clean master and expected manifest;
- direct-path equivalence report;
- declared microphone setup and success rate;
- recovered/missing/duplicate metrics;
- complete rehearsal evidence bundle.

## Cross-workstream interface gates

### Gate I — Packet contract frozen

Before real transport integration:

- registry codes are unique;
- field maximums are fixed;
- canonical identities and update sequences are agreed;
- golden packets are available;
- mobile, backend, map, and Tier 2 teams agree on logical meanings;
- encoded sizes are recorded.

### Gate II — Native bridge contract frozen

Before UI depends on native events:

- capability/permission schema is agreed;
- relay lifecycle states are agreed;
- peer/session/bytes/error events are agreed;
- start/stop/session commands are agreed;
- simulated adapter implements the same contract for Expo Go/UI work;
- real development build produces the same event semantics.

### Gate III — Map operation contract frozen

Before authority/Tier 2 updates:

- regional pack ID/version is fixed;
- object IDs and types are stable;
- allowed operations and precedence are documented;
- missing/stale/tombstone behavior is tested;
- all inputs use one projection path.

### Gate IV — Gateway contract frozen

Before dashboard integration:

- connectivity proof rule is fixed;
- upload item outcomes are fixed;
- duplicate/conflict behavior is fixed;
- outbound cursor and retry semantics are fixed;
- acknowledgement packet semantics are fixed.

### Gate V — Campaign contract frozen

Before generating final audio:

- campaign manifest, operation mapping, profile, repetition, and duration budget are fixed;
- expected packets and map actions are fixed;
- both receiver paths use the same shared packet/policy inputs;
- post-approval edits reset approval.

## Repository deliverable map

Agents should converge on clear ownership even if the current repository structure differs. The final implementation must have identifiable locations for:

- product/domain types and reducers;
- canonical protocol registry and limits;
- codec and golden vectors;
- policy rules and reason codes;
- local persistence and migrations;
- native Bluetooth/audio bridge;
- transport adapters;
- routing/queue/custody;
- offline content-pack manifest and seed registry;
- map projection;
- gateway client;
- mobile screens/components;
- backend ingest/domain/outbound services;
- authority/coordinator/broadcaster surfaces;
- ggwave artifact generator/fixtures;
- unit, integration, simulator, device, and end-to-end tests;
- demo seed/reset and evidence outputs.

No exact directory is mandated before repository inspection, but agents must avoid duplicating the same packet registry or policy in mobile and backend without a controlled shared source/generation strategy.

## Feature traceability backlog

The following epics collectively implement the complete product.

### Epic P1 — Readiness and offline bootstrap

Stories:

- user selects local role;
- app reports content-pack readiness;
- app explains and requests Nearby Devices, location, notification, and microphone permissions only when needed;
- user can open offline map without granting internet;
- relay mode can be started/stopped visibly;
- app distinguishes internet untested/unavailable/proven.

Acceptance:

- cold start works with all network access unavailable;
- denied permissions produce usable reduced behavior and clear recovery actions;
- no screen loops waiting for a backend.

### Epic P2 — SOS creation and local custody

Stories:

- rapid SOS;
- expanded SOS;
- location unavailable/stale/user-pinned;
- update/cancel;
- restart recovery;
- delivery timeline.

Acceptance:

- durable write precedes success UI;
- restart preserves incident identity and active state;
- update sequence wins deterministically;
- cancel creates terminal behavior rather than erasing evidence.

### Epic P3 — Packet engine

Stories:

- encode/decode every registry type;
- reject malformed/oversized/unknown safely;
- identify duplicate/conflict;
- independent policy decisions;
- expiry/hop/sequence handling;
- reason-coded diagnostics.

Acceptance:

- every golden vector is deterministic;
- malformed corpus never crashes;
- each type reports measured bytes;
- duplicate receipt creates no duplicate action.

### Epic P4 — Regional map intelligence

Stories:

- load offline city pack;
- display resources/routes;
- apply SOS/responder/peer markers;
- apply resource/hazard/route deltas;
- show source/freshness/accuracy;
- show list alternative;
- show topology and journey.

Acceptance:

- all operations work offline;
- missing objects fall back safely;
- stale markers age correctly;
- Tier 1, gateway, and Tier 2 produce equivalent object changes.

### Epic P5 — Bluetooth Tier 1

Stories:

- native capabilities and permissions;
- relay foreground service;
- advertise/scan;
- connect and negotiate;
- inventory/request/transfer/receipt;
- failure backoff;
- screen-off continuation on selected devices.

Acceptance:

- real two-phone transfer;
- no sensitive discovery payload;
- receiver receipt only after durable acceptance;
- no uncontrolled reconnection loop.

### Epic P6 — Multi-hop routing and custody

Stories:

- priority queue;
- copy budgets;
- per-neighbor knowledge;
- store-carry-forward;
- topology observations;
- responder state return;
- terminal suppression.

Acceptance:

- controlled three-hop success target met;
- carrier forwards after movement;
- resolution stops active replicas;
- file traffic yields to SOS.

### Epic P7 — Responder operations

Stories:

- prioritized queue;
- accept/decline;
- en route/arrived/resolved;
- share location with freshness;
- update hazard/resource/route under role policy;
- local-only completion.

Acceptance:

- complete lifecycle works without internet;
- General Public cannot perform responder/authority-only actions;
- arrival does not automatically claim resolution unless configured.

### Epic P8 — Gateway and backend

Stories:

- live probe;
- batch upload;
- packet/observation dedup;
- incident aggregation;
- backend acknowledgement;
- outbound sync;
- loss/retry.

Acceptance:

- identical packet uploads make one packet/incident;
- acknowledgement returns to source through mesh;
- connectivity loss never loses local custody.

### Epic P9 — Web operations

Stories:

- incident map/queue/timeline;
- responder assignment;
- resources/hazards/routes;
- official alerts/check-ins;
- compact delta preview;
- gateway audit;
- role-specific broadcaster workflow.

Acceptance:

- dashboard language distinguishes observations from victims;
- every web mutation emits/updates a traceable logical record;
- approved campaign cannot be altered without reapproval.

### Epic P10 — Tier 2

Stories:

- campaign budget and manifest;
- audio artifact;
- decode test;
- microphone/direct receive;
- repetition/dedup;
- cached object activation/delta;
- radio bridge;
- check-in response.

Acceptance:

- direct clean path recovers expected set;
- microphone target met in declared setup;
- both paths cause same logical actions;
- non-listener receives bridged record;
- no radio-uplink claim.

### Epic P11 — Bounded file/image

Stories:

- manifest and user/role policy;
- explicit fragment request;
- resume and integrity;
- expiry/cleanup;
- priority preemption.

Acceptance:

- oversized/unrequested content rejected;
- incomplete file hidden;
- SOS interrupts transfer;
- resume transfers only missing fragments.

### Epic P12 — Hardening and evidence

Stories:

- fuzz/malformed cases;
- process restarts;
- storage/battery pressure;
- stale/conflict behavior;
- measured radio/network behavior;
- reproducible demo reset;
- limitation language.

Acceptance:

- all critical acceptance scenarios repeatedly pass;
- evidence bundle distinguishes simulated and real-device results;
- final claims match measurements.

## Test architecture

### Unit tests

Cover:

- canonical encoding/decoding;
- each field boundary;
- packet identity/digest;
- source sequence and latest-wins;
- expiry/hop logic;
- policy outputs by role/location/battery/queue;
- incident transitions;
- map operation resolution and precedence;
- routing eligibility/utility/reason codes;
- campaign duration/budget calculations;
- file fragment completion.

### Property and malformed-input tests

Cover:

- random/truncated headers;
- oversized declared lengths;
- impossible fragment counts/indexes;
- same ID/different content;
- invalid type/flag combinations;
- clock extremes;
- decompression/output-size attacks where compression exists;
- repeated duplicate storms;
- corrupted Tier 2 frames;
- unknown map IDs/actions.

### Simulator tests

Model:

- line topology A–B–C–D;
- separated clusters joined by a moving carrier;
- many peers with duplicate inventories;
- gateway appears/disappears;
- responder reachable locally only;
- critical packet arrives during file transfer;
- stale SOS then cancellation/resolution;
- out-of-order updates;
- battery-limited relay;
- campaign packet bridged into mesh.

Simulation proves domain behavior, not Android radio reliability.

### Native integration tests

Prove on selected phones:

- permission and Bluetooth-off recovery;
- simultaneous advertise/scan behavior;
- central/peripheral and GATT client/server roles;
- negotiation and MTU/record behavior;
- screen-off/foreground operation;
- connection loss and reconnection;
- device restart/process kill recovery;
- multiple nearby phones and connection limits;
- battery/thermal adaptation at least through controlled state injection if real thresholds are impractical.

### Backend integration tests

Prove:

- idempotent upload retry;
- packet ID conflict quarantine;
- multiple observations/one incident;
- outbound cursor retry;
- acknowledgement generation;
- assignment/state packet generation;
- resource delta propagation;
- campaign approval invalidation after edit;
- demo reset isolation.

### Tier 2 tests

Use:

- clean direct master;
- speaker-to-microphone at declared distance/volume;
- lower volume;
- controlled crowd/noise mix;
- different phone orientation;
- one corrupted/missing burst;
- repeated campaign;
- missing/older regional content pack;
- non-listening peer bridge.

### End-to-end tests

Run the complete scenarios A–K already defined in this handbook with synchronized event evidence and visible user outcomes.

## Requirement-to-test traceability

Every mandatory requirement in the product specification must have:

- owning epic/workstream;
- implementation location;
- unit/integration/device/end-to-end test reference;
- current status;
- evidence link or artifact;
- known limitation.

No feature is “done” based only on a screen existing. Radio, persistence, policy, and state claims require the corresponding proof layer.

## Device and environment matrix

At minimum record:

| Dimension | Required variation |
|---|---|
| Android device | At least three physical phones used in multi-hop |
| Manufacturer/chipset | More than one family if available |
| Android version | Record all; include permission/lifecycle differences encountered |
| BLE capability | Advertising, GATT server/client, optional extended/Coded support |
| App state | Foreground, screen off, process restart |
| Radio environment | Close indoor controlled, increased separation, human/body obstruction where safe |
| Internet | None, false/limited if reproducible, proven gateway, lost gateway |
| Tier 2 | Direct clean, speaker/microphone, controlled noise |

Unsupported phones remain valid evidence of compatibility limits. They must not be excluded silently from the report.

## Packet size and timing evidence sheet

For every main demo packet record:

- logical type and purpose;
- encoded Tier 1 bytes;
- Tier 2 bytes if applicable;
- fragment count if any;
- ggwave profile;
- expected raw audio duration;
- repetitions and total campaign cost;
- Bluetooth transfer time after connection;
- observed end-to-end time including discovery/queue;
- devices and conditions.

The team should optimize the largest high-priority packets first. Debug JSON size is not over-the-air size.

## Defect severity

### Blocker

- SOS lost after local success.
- Real Bluetooth path unavailable on the demo device set.
- Critical packet cannot preempt bulk traffic.
- Duplicate loop overwhelms the demo.
- Map requires internet.
- Tier 2 direct clean master does not decode deterministically.
- Demo claims state not supported by evidence.

### Critical

- Wrong incident updated/resolved.
- Corrupt/partial packet changes application state.
- General user can create official authority data.
- Gateway icon claims internet without live proof.
- Link receipt shown as backend/responder success.
- Sensitive exact data appears in advertisements/logs.

### Major

- Stale location appears live.
- Out-of-order update becomes active.
- Gateway retry creates duplicate incident/action.
- Campaign edit does not revoke approval.
- File transfer cannot resume or clean up.

### Minor

- Nonblocking visual/copy inconsistency.
- Diagnostic event missing optional context.
- Secondary filter/layout defect that does not obscure truth or action.

## Daily integration discipline

- Integrate to one shared end-to-end branch frequently; avoid week-long disconnected forks.
- Run golden protocol tests before transport changes merge.
- Run offline map tests before content-pack changes merge.
- Run at least one real two-phone smoke test after native/radio changes.
- Preserve failing packet/audio fixtures.
- Update requirement traceability when behavior changes.
- Record actual device evidence; do not rely on emulator success for Bluetooth/microphone claims.
- Rehearse the vertical demo before adding optional polish.

## Hackathon time-box plan

The exact event duration may differ, so treat these as relative phases.

### First 15% — foundations and risk kill

- freeze demo region/devices;
- prove Expo development build installs;
- prove each phone can scan/advertise and host/connect GATT as required;
- freeze packet registry v1 and golden SOS;
- load offline map;
- prove clean ggwave encode/decode independently.

If any primary radio risk fails here, make the Bluetooth contingency decision immediately rather than at final integration.

### 15–40% — first vertical slice

- create/store/show SOS;
- one-hop real Bluetooth;
- receiving phone projects SOS to offline map;
- link receipt/delivery timeline;
- diagnostics with packet bytes/timestamps.

### 40–60% — multi-hop and local rescue

- inventory/dedup/routing;
- three-hop and store-carry-forward;
- responder accept/en-route/arrived/resolved;
- topology/journey;
- priority preemption.

### 60–75% — optional online loop and web operations

- gateway probe/sync;
- backend dedup/incident;
- assignment/acknowledgement return;
- resource/hazard/route delta back to mesh;
- authority/broadcaster campaign workflow.

### 75–88% — Tier 2 and cross-tier

- final compact campaign;
- clean and microphone decode;
- map updates;
- radio-to-mesh bridge;
- check-in Tier 1 response;
- logs and equivalence proof.

### 88–100% — stabilization and presentation

- stop feature expansion;
- run full matrix and fix blockers/critical defects;
- finalize evidence and claims;
- rehearse device placement, permissions, audio, gateway transition, and reset;
- prepare tested fallback artifacts.

## Demo seed scenario

Use one coherent synthetic regional incident so every feature reinforces the same story.

Suggested seed:

- Region: one selected city/ward/campus-scale region with cached map.
- Incident: flood/structural collapse has disabled cellular service.
- Citizen A: trapped with two people, one injured, Level 3.
- Relay B: general participant with no internet.
- Relay/Gateway C: starts offline, later receives controlled usable internet.
- Responder D: locally provisioned medical/volunteer responder.
- Shelter S1: initially open, later full.
- Shelter S2: open with limited capacity.
- Hospital H1: operational medical post.
- Route R1: becomes blocked.
- Route R2: remains advised route.
- Hazard Z1: flood/collapse area.
- Tier 2 campaign: evacuation alert, S1 full, S2 available, R1 blocked, Z1 active, check-in requested.

All IDs, coordinates, names, and profiles are synthetic or safely prepared.

## Judge-visible diagnostics

During the demo, a compact diagnostics surface should expose:

- current device/node alias;
- transport source;
- packet ID prefix/type/size;
- created/received time;
- previous hop;
- hop count/limit;
- validation and duplicate result;
- store/show/relay/upload/action decisions;
- queue priority;
- gateway probe status;
- Tier 2 campaign/frame counts;
- map operation caused;
- delivery/incident state.

Diagnostics must support the story without forcing judges to interpret raw logs.

## Demo reset and fallback plan

### Reset must restore

- synthetic profiles/roles;
- regional content pack baseline;
- packet/incident/custody state;
- topology observations;
- backend incident/outbound state;
- campaign approval/artifact state as intended;
- permission expectations documented for each device.

### Fallback assets

- known-good development-build APK/install path;
- charged devices and cables;
- clean prepared audio master;
- local speaker and direct-input fixture;
- expected packet manifest;
- offline copy of regional content pack;
- synthetic gateway mode/test connection;
- screen recording of a previously successful full run if event rules permit;
- printed/slide architecture and limitations for explanation.

A fallback recording is evidence continuity, not a substitute for claiming a live test succeeded when it did not.

## Go/no-go gates

### Bluetooth go/no-go

Proceed with BLE when all selected devices can perform the required roles reliably enough for the controlled demo. Trigger the Bluetooth Classic contingency investigation if phone-side advertising/GATT server or connection behavior remains a blocker after bounded debugging. Do not add ggwave as fallback.

### Gateway go/no-go

Gateway is included live only when probe, upload, deduplication, download, and rebroadcast all pass. If public internet is unreliable at the venue, use a controlled reachable backend path while labeling it as the internet-connected phase; the core offline demo remains independent.

### Tier 2 go/no-go

The clean direct path is the deterministic baseline. The microphone path is demoed under declared controlled conditions after repeated trials. Do not alter claims to hide acoustic limitations.

### File/image go/no-go

Include the live bounded file demo only after emergency preemption and cleanup pass. The packet family/schema remains documented even if the live visual is shortened.

## Final evidence package structure

The handoff should contain:

- specification versions;
- build/application version;
- device capability matrix;
- regional content-pack manifest;
- packet registry and size table;
- golden vector results;
- simulator results;
- real Bluetooth trial table;
- gateway end-to-end results;
- Tier 2 artifact manifest and decode results;
- acceptance scenario results;
- known limitations and failed devices/conditions;
- demo instructions and reset procedure;
- screenshots/recordings where permitted.

## Final release audit

### Product audit

- Every requirement ID has status/evidence.
- Every required packet family has schema, policy, UI outcome, and test.
- Roles and restricted actions match the product specification.
- Offline maps and local responder flow require no backend.

### Architecture audit

- One packet meaning across Bluetooth, gateway, backend, and Tier 2 mapping.
- One shared validator/policy/projection path.
- No ggwave Tier 1 path.
- No stock Expo Go real-radio claim.
- No unbounded packet, fragment, queue, file, or log behavior.
- Idempotent duplicate/update behavior.

### Truth audit

- “Peer copy,” “responder,” “gateway,” “backend,” “arrived,” and “resolved” are distinct.
- “Official/demo authority” is not called cryptographically verified.
- Stale location/topology is labeled.
- Direct audio is not called universal FM access.
- Targets are not called measured results until measured.

### Demo audit

- Devices charged, installed, reset, and permissioned.
- Network states controlled and visible.
- Audio volume/input tested in the room.
- Expected packet IDs recorded.
- Gateway and backend prepared.
- Full run completed repeatedly inside time limit.

## Recommended product surfaces

### Android mobile application

The mobile build should expose these connected surfaces:

- Role entry: General Public or Responder demo mode.
- Preparedness/offline home.
- SOS creation and active SOS state.
- Nearby incidents and responder queue.
- Predownloaded offline map.
- Topology/packet journey view.
- Local resources and hazards.
- Delivery and custody timeline.
- Relay/gateway status.
- Tier 2 listening/direct-demo screen.
- Check-in response form.
- Packet/event diagnostics for judges.

### Authority/coordinator web dashboard

- Deduplicated incident map and list.
- Incident detail and observation timeline.
- Responder assignment and status.
- Resource, hospital, shelter, safe-zone, hazard, and route management.
- Official alert and check-in campaign composer.
- Compact outbound update preview.
- Gateway observations and acknowledgement generation.
- Campaign approval.

### Radio broadcaster web dashboard

- Approved campaign queue.
- Packet inventory and priority order.
- Prepared audio generation/export state.
- Audio preview.
- Decode-before-broadcast result.
- Expected packet timing/list.
- Schedule/play status.
- Broadcast log.

These dashboards may share one web application and authentication shell for the hackathon, but their permissions and workflows must remain distinct.

## Build sequence

### Milestone 0 — Freeze the demo contract

Deliverables:

- Select the one city/region and synthetic disaster scenario.
- Select at least three Android devices for the real Bluetooth path.
- Record Android versions and Bluetooth capabilities.
- Confirm the Expo development-build strategy for native Bluetooth.
- Define the exact golden demonstration packets and synthetic identities.
- Freeze stable compact IDs for the chosen map objects.
- Establish the packet event vocabulary used by mobile and dashboards.

Exit checks:

- The team can describe the full judged sequence in under two minutes.
- No critical demo step depends on public internet except the optional gateway segment.
- Every device needed for the Bluetooth chain is physically available.

### Milestone 1 — Offline domain core

Deliverables:

- Canonical packet catalogue and bounded schemas for every required family.
- Deterministic packet identity, update sequence, expiry, hop, and priority behavior.
- Structural validator and integrity rules.
- Durable local packet, incident, resource, map-update, and seen-ID storage model.
- Independent store/show/alert/relay/upload/act policy decisions.
- Synthetic golden packets covering valid, invalid, duplicate, stale, and fragmented cases.

Exit checks:

- The same logical packet produces the same canonical identity everywhere.
- A duplicate cannot create two active incidents or two map actions.
- An older update cannot override a newer source sequence.
- Malformed length or fragment values are rejected without unbounded allocation.
- Every required packet family has at least one golden scenario and expected behavior.

### Milestone 2 — Predownloaded regional map

Deliverables:

- Offline base map/data for the chosen region.
- Stable IDs for hospitals, shelters, food/water sites, safe zones, and important routes.
- Map projection for SOS, responders, peers, gateway observations, resources, hazards, and blockages.
- Location age, accuracy, and stale-state presentation.
- Typed update/tombstone behavior.
- Fallback presentation for missing referenced objects.

Exit checks:

- The map loads with all network radios disabled.
- A stored packet changes the map without a server call.
- A stale user/responder marker is visibly different from a recent marker.
- Closing a shelter and blocking a route changes the correct stable objects.
- Missing-object input cannot open an arbitrary path or silently alter another object.

### Milestone 3 — Real Bluetooth one-hop

Deliverables:

- Runtime permission and capability handling on Android.
- User-visible relay mode and foreground behavior for the judged build.
- Small discovery announcement.
- Short-lived peer session.
- Capability and inventory exchange.
- Missing packet request and ordered transfer.
- Link receipt distinct from end-to-end acknowledgement.
- Real packet and event metrics.

Exit checks:

- Two selected Android phones exchange an SOS with internet and Wi-Fi disabled.
- The receiving phone stores, displays, and maps the SOS correctly.
- Discovery announcements expose no full SOS text or exact victim profile.
- Repeating the same encounter does not repeat the user-visible action.
- The team records the exact build type and does not mislabel stock Expo Go.

### Milestone 4 — Automatic multi-hop and topology

Deliverables:

- Inventory-based forwarding.
- Hop limit, expiry, copy budget, cooldown, and recent-sender rules.
- Priority queues with reserved control capacity.
- Store-carry-forward after disconnection/movement.
- Responder assignment/accept/en-route/arrived/resolved state through the mesh.
- Topology view based on time-stamped observations.
- Packet journey and custody timeline.

Exit checks:

- An SOS crosses at least three phones without manual file sharing or message forwarding.
- Removing the middle connection does not erase already stored custody.
- Reconnecting nodes does not cause an uncontrolled loop.
- A responder update returns to the SOS phone through the mesh.
- Resolution stops active SOS propagation on connected demo nodes.
- The topology view labels old relationships as old rather than live.

### Milestone 5 — Gateway, backend, and coordinator loop

Deliverables:

- Live internet-connectivity verifier.
- Priority-aware gateway upload and download.
- Backend strict validation and packet/observation deduplication.
- Incident aggregation and map.
- Responder assignment and acknowledgement workflow.
- Outbound queues for gateway-to-mesh injection.
- Gateway diagnostics proving the direction of each event.

Exit checks:

- A node with no usable internet does not present itself as a gateway.
- When connectivity appears, one offline-origin SOS becomes one backend incident.
- Uploads from multiple gateways become multiple observations of that incident.
- A backend acknowledgement returns through a gateway and the Bluetooth mesh.
- An authority resource or hazard change downloaded by a gateway is rebroadcast to an offline phone and changes its local map.
- Losing connectivity returns the gateway to ordinary relay behavior without losing queued data.

### Milestone 6 — Full responder and packet-family behavior

Deliverables:

- Severity Levels 0–3.
- General Public versus Responder actions.
- All emergency, response, receipt, resource, hazard, navigation, authority, check-in, request, data, and network packet families.
- Community-origin labels where citizen reports are permitted.
- Authority/responder ownership of authoritative records.
- File/image manifest, bounded request, fragments, pause, resume, integrity, expiry, and cleanup.

Exit checks:

- General Public cannot silently publish an authoritative hospital, shelter, safe zone, or official alert.
- A self-declared severe SOS is routed urgently but does not receive an “officially verified” label.
- Every packet family reaches the correct list/map/timeline behavior.
- Starting an SOS during file transfer pauses bulk traffic.
- A partial image remains hidden until complete and valid.
- The selected hard maximum prevents an oversized demo file from entering automatic relay.

### Milestone 7 — Tier 2 authority and broadcaster workflow

Deliverables:

- Authority campaign composer for compact alerts, map changes, and check-in requests.
- Campaign approval state.
- Broadcaster packet inventory and schedule.
- Reproducible prepared radio-program audio.
- Preview, decode-before-broadcast test, direct clean-audio decode, and broadcast log.
- Microphone listening mode with visible permission/state.
- Repetition, integrity, deduplication, and campaign completeness state.
- Radio-to-Bluetooth bridge.
- Tier 2 check-in to Tier 1 response.

Exit checks:

- Microphone and direct-audio paths recover the same canonical expected packet set from the clean controlled program.
- Duplicate Tier 2 repetitions do not repeat map actions or notifications unnecessarily.
- A shelter or route change modifies the predownloaded map using compact IDs.
- A phone that did not listen to the radio receives one authority update through Bluetooth from a listening phone.
- The check-in form creates a Tier 1 packet; the app never claims a radio uplink.
- The dashboard records campaign approval, decode test, and play/export events.
- Tier 2 does not send full maps or ordinary image/file payloads.

### Milestone 8 — Integration, evidence, and rehearsal

Deliverables:

- One-button or scripted demo reset using synthetic data.
- Stable device assignments and prepared fallback artifacts.
- Event logs and screen-visible metrics.
- Test condition sheet.
- Recorded fallback video if rules allow it.
- Clear limitation/claims slide.
- Multiple full rehearsals with radios and internet states controlled intentionally.

Exit checks:

- The entire scenario completes repeatedly in the allotted judging time.
- Every success state is visible to judges, not inferred from developer logs alone.
- The team can explain the difference between link receipt, local responder acknowledgement, gateway upload, backend acceptance, arrival, and resolution.
- The team can explain why Expo development build is used for Bluetooth.
- The team can explain why ggwave sends compact references rather than maps/files.
- All measured claims include device and test conditions.

## Required acceptance scenarios

### A. Offline three-hop SOS

Initial condition: three or more Android phones have no mobile data or Wi-Fi path.

Expected result:

- Phone A creates and stores a Level 3 SOS.
- Phone B receives it, shows a nearby critical incident, and relays it.
- Phone C receives it and displays the same packet/incident identity.
- All screens distinguish local storage and link copies from backend receipt.

### B. Local responder completion without internet

Initial condition: responder phone is reachable through Tier 1; no internet exists.

Expected result:

- Responder sees and accepts the SOS.
- En-route and arrived states return through Bluetooth.
- Resolution or cancellation propagates locally.
- The case can be acted upon without a backend.

### C. Store-carry-forward

Initial condition: no continuous A-to-C path exists.

Expected result:

- B receives from A, disconnects, moves, and later encounters C.
- B retains the packet between encounters.
- C receives it without A being present.

### D. Conditional mesh-to-internet

Initial condition: all nodes start offline; one carrier later gets proven internet.

Expected result:

- The carrier uploads queued packets.
- The dashboard creates one incident.
- A backend acknowledgement is downloaded and rebroadcast.
- The original phone changes from “copied nearby” to “coordination centre received” only when that acknowledgement reaches it.

### E. Internet-to-mesh map update

Initial condition: an authority closes a shelter or blocks a route while one gateway is online and another phone is offline.

Expected result:

- The gateway downloads a compact typed update.
- It applies the update locally and advertises it.
- The offline phone receives it through Bluetooth.
- Both phones change the same stable map object.

### F. Tier 2 microphone decode

Initial condition: a prepared radio-program audio file is played through a speaker.

Expected result:

- The listening phone shows the active microphone mode.
- Critical compact packets decode after the configured repetitions.
- The correct official alert and regional map changes appear.
- Missed/corrupt frames do not create partial map state.

### G. Tier 2 direct-audio equivalence

Initial condition: the clean prepared audio is supplied through the controlled direct test path.

Expected result:

- The expected packet set decodes.
- Packet IDs and payload meaning match the microphone-path results.
- The UI labels this a direct-audio demonstration, not universal FM tuner access.

### H. Radio-to-mesh bridge

Initial condition: Phone A listens to Tier 2; Phone B does not.

Expected result:

- A receives and applies an authority update.
- A advertises the eligible packet over Bluetooth.
- B receives the same packet identity and applies the same map change.
- Re-encounter does not cause duplicate user-visible effects.

### I. Tier 2 check-in, Tier 1 response

Initial condition: a Tier 2 campaign requests a check-in.

Expected result:

- The phone opens the cached local form.
- The user selects a response.
- The app creates a compact Tier 1 response packet.
- The packet relays through Bluetooth and can later reach the dashboard through a gateway.

### J. File/image does not harm emergencies

Initial condition: a permitted bounded image transfer is active.

Expected result:

- A critical SOS appears.
- Bulk transfer pauses or yields immediately.
- SOS/control transfer begins first.
- The image later resumes from missing fragments and becomes visible only after integrity succeeds.

### K. Stale people and topology data

Initial condition: a peer/responder location and topology relationship have not been refreshed.

Expected result:

- The marker/edge visibly ages.
- It eventually becomes stale or disappears under policy.
- The UI does not imply real-time tracking.

## Suggested measurable targets

These are hackathon targets and must be reported with exact conditions:

| Measure | Target |
|---|---|
| Controlled three-hop SOS delivery | At least 95% across 20–50 rehearsed trials |
| Duplicate active backend incidents for identical packet ID | Zero |
| Duplicate visible action for repeated packet | Zero |
| Critical traffic under bulk load | Begins at the next useful connection before bulk resumes |
| Direct clean-audio expected packet recovery | 100% for the prepared master |
| Microphone path recovery | At least 90% in the declared speaker/distance/noise setup after repetition |
| Radio-to-mesh bridge | One non-listening peer applies the canonical update without duplicate display |
| Missing map reference | Safe fallback, no crash, no unrelated substitution |
| Malformed corpus | No crash and no unbounded allocation |
| Offline map availability | 100% for the selected prepared region |

Agents must not convert a target into a claimed result until it has been measured.

## Demo narrative

The recommended judged story is:

1. Show all Android phones offline and the predownloaded city map still available.
2. A citizen creates a trapped-person Level 3 SOS.
3. The SOS crosses two intermediate Bluetooth phones automatically.
4. A responder sees the case, accepts it, and shares en-route status.
5. The topology view shows the observed packet path with timestamps.
6. One carrier later obtains demonstrable internet access and uploads the packet.
7. The dashboard shows one incident and sends an acknowledgement/assignment back.
8. The gateway rebroadcasts that state to the offline phones.
9. The authority prepares and approves a compact evacuation/resource campaign.
10. The broadcaster previews and decode-tests the prepared audio.
11. A phone decodes it through a speaker/microphone and updates its offline shelter, hazard, and route layers.
12. The same clean audio produces equivalent results through direct input.
13. The listening phone relays an authority update to a phone that was not listening.
14. A check-in request creates a Tier 1 response.
15. The responder arrives and resolves the SOS; resolution propagates and stops active replication.

## Evidence to preserve

For each full rehearsal, retain:

- device models and Android versions;
- app build type and version;
- Bluetooth mode actually used;
- internet/Wi-Fi state for each device;
- packet IDs and encoded byte sizes;
- hop/event timestamps;
- duplicates and retries;
- gateway connectivity-probe result;
- Tier 2 audio asset hash/version;
- expected and recovered Tier 2 packet list;
- microphone distance/noise condition;
- direct-audio result;
- screenshots or recordings of key visible states;
- failures and their exact conditions.

## Scope controls for the hackathon

The product includes every required packet family, but effort should concentrate on the end-to-end proof. Apply these controls:

- One Android platform only.
- One city/region pack only.
- Synthetic users, responders, incidents, and locations.
- One controlled Bluetooth device matrix.
- One prepared Tier 2 campaign and a small number of compact records.
- One constrained file/image demonstration.
- Prototype role provisioning rather than production identity.
- Checksums and validation rather than production cryptographic verification.
- No live broadcaster partnership required.
- No universal internal-FM claim.
- No claim of universal Android background reliability.

These controls reduce implementation risk without removing the product's architectural breadth.

## Handoff checklist

Before an agent declares a feature complete, it must answer:

- Does it still work when the phone has no internet and no Wi-Fi?
- Is Bluetooth the only Tier 1 phone-to-phone path?
- Is ggwave confined to Tier 2?
- Is the packet compact, bounded, and measured?
- Does it use the shared validator/store/policy/map path?
- Does it preserve packet identity across hops?
- Are storage, display, alert, relay, upload, and action decisions separated?
- Does the UI use precise delivery language?
- Are location age and accuracy shown?
- Can duplicate, stale, corrupt, or oversized input cause repeated or unsafe behavior?
- Does critical traffic outrank files?
- Is the evidence from a real device, simulation, or static check labeled honestly?
- Does the implementation match the three agent-reference documents?

If any answer is unclear, the feature is not ready for integration.
