# Disaster SOS Mesh — Complete Product Requirements and Decision Register

**Specification version:** 2.0  
**Audience:** product, mobile, native Android, protocol, backend, dashboard, audio, QA, and demo agents  
**Requirement language:** “must” is mandatory; “should” is the intended implementation unless a documented blocker is proven; “may” is optional.

## Status and authority

This document is the binding product definition for the Smart India Hackathon build. Agents must treat it as the source of truth. If an older pitch, blueprint, comment, mock-up, or implementation conflicts with this file, this file wins.

The project is a hackathon prototype, not a production emergency service. It must demonstrate a credible offline-first architecture without claiming universal device support, guaranteed delivery, guaranteed range, or production-grade security.

This specification is complete enough to make product decisions without returning to the original commented draft. Agents must not invent a different interpretation of “offline,” “mesh,” “gateway,” “radio,” “verified,” “delivered,” or “live.” Those terms are defined below.

## Product vocabulary

| Term | Binding meaning |
|---|---|
| Offline | The phone currently has no proven usable internet. Bluetooth and GPS may still function. |
| Tier 1 | Bidirectional packet exchange and store-carry-forward between participating Android phones using Bluetooth. |
| Tier 2 | One-way authority data received from prepared radio-program audio using ggwave. |
| Mesh | A delay-tolerant sequence of opportunistic phone-to-phone contacts; not an assumption that every phone is continuously connected. |
| Node | A participating phone running relay mode. It can create, store, receive, display, carry, relay, and sometimes upload packets. |
| Peer | Another recently observed participating node. |
| Gateway | A node that has passed a live internet probe and can synchronize packets with the backend. |
| Custody | The local responsibility to retain and consider forwarding a packet. It is not ownership of the incident. |
| Link receipt | Evidence that one neighboring phone received and structurally accepted a packet. |
| Backend acknowledgement | Evidence returned by the coordination backend after ingestion. |
| Responder acknowledgement | An explicit responder action on an incident. |
| Authority record | A demo-provisioned record created through the authority workflow. It is not cryptographically proven in this hackathon build. |
| Live location | A recent location update inside the configured freshness window. |
| Stale location | A location that may still be useful but must not be presented as current. |
| Offline content pack | The predownloaded map, object registry, translations, guides, forms, and resource baseline for one region. |
| Map delta | A small typed change to an object already known by compact ID, or a small temporary object. |
| Campaign | A scheduled Tier 2 collection of compact packets with a manifest, region, priority, repetition plan, and expected decode list. |

## Decision register

Every architecture decision is recorded with its consequence so agents cannot silently reopen it.

| ID | Decision | Consequence |
|---|---|---|
| DEC-001 | The cellular tower is assumed down in the primary scenario. | Local creation, storage, map access, relay, responder action, and resolution cannot require a server. |
| DEC-002 | Android is the only hackathon mobile platform. | iOS compatibility is not an acceptance criterion. |
| DEC-003 | The app uses React Native and Expo tooling. | Shared product logic stays in the React Native application. |
| DEC-004 | Stock Expo Go is not the real-radio runtime. | UI work may use Expo Go, but Bluetooth and ggwave native integrations use an Expo development/native Android build. |
| DEC-005 | BLE is the preferred Tier 1 transport. | The native adapter must support Android advertising, scanning, GATT server/client behavior, and bounded sessions. |
| DEC-006 | A Bluetooth Classic adapter is an emergency engineering fallback only. | It may replace BLE on the controlled device set without changing packet, store, policy, map, or UI contracts. |
| DEC-007 | ggwave is Tier 2 only. | No phone-to-phone acoustic fallback and no Tier 1 microphone transport may be introduced. |
| DEC-008 | Tier 2 is one way. | Citizen responses to radio requests become Tier 1 packets. |
| DEC-009 | Internet is opportunistic. | Gateway features activate only after a live probe and disappear safely when connectivity is lost. |
| DEC-010 | A gateway synchronizes both directions. | It uploads mesh packets and injects downloaded acknowledgements/authority updates back into Tier 1. |
| DEC-011 | One city/region is sufficient. | All demo map data and compact IDs are prepared for one bounded region. |
| DEC-012 | The map is predownloaded. | The base map and baseline resources render without internet. |
| DEC-013 | Tier 1 and Tier 2 update the same local projection. | Users do not see separate incompatible “Bluetooth data” and “radio data” products. |
| DEC-014 | All requested packet families are in scope. | Each has schema, ownership, priority, state behavior, map behavior, and tests. |
| DEC-015 | Citizens do not publish authoritative infrastructure data. | Citizen-originated hazard/help reports, if enabled, remain clearly community-reported. |
| DEC-016 | Severity is not authority. | A Level 3 citizen SOS is urgent but not labeled official or verified. |
| DEC-017 | Packet size is a design budget. | Agents must report encoded size and remove repeated human-readable data where compact IDs work. |
| DEC-018 | Files/images exist but are subordinate. | They are bounded, requested, fragmented, resumable, and preempted by emergency traffic. |
| DEC-019 | Production cryptography is out of hackathon scope. | The demo uses checksums, digests, strict parsing, demo role provisioning, and honest labels—not verified-security claims. |
| DEC-020 | Every displayed person/node location has freshness. | The app cannot show an undated “live” peer dot. |
| DEC-022 | Link receipt is not rescue progress. | Delivery copy counts and responder/backend states are shown separately. |
| DEC-023 | Local success is a complete outcome. | A nearby responder can accept, arrive, and resolve an SOS even if no gateway ever appears. |
| DEC-024 | Authority and broadcaster use web dashboards. | They do not require the Android app for campaign work. |
| DEC-025 | The broadcaster workflow includes approval protection. | Altering approved content invalidates approval and requires review again. |

## Product goals

### Primary goals

- Let a person create an emergency packet in seconds while fully offline.
- Preserve that packet durably on the source phone.
- Move it automatically across participating Android phones without manual sharing.
- Create immediate local value by showing relevant emergencies and help on an offline map.
- Let responders act locally, return status, and close the incident through the same mesh.
- Carry packets until a useful peer, responder, or proven gateway is encountered.
- Allow authority information to enter the offline area through either an internet gateway or Tier 2 radio audio.
- Make every delivery state understandable and truthful.

### Secondary goals

- Demonstrate compact map changes rather than retransmitting large assets.
- Demonstrate a constrained image/file channel without compromising emergencies.
- Produce reproducible metrics, logs, and demo reset behavior.

### Explicit non-goals

- Replacing police, ambulance, NDMA, cellular broadcast, or licensed radio systems.
- Guaranteed delivery when no participating path ever exists.
- Voice calls, chat rooms, or normal conversational audio over ggwave.
- General-purpose file sharing.
- A nationwide live map.
- Continuous exact tracking of every participant.
- Automatic machine-learning rescue decisions.
- Production identity verification, cryptographic authorization, or medical-grade decisions.
- Universal operation across every Android manufacturer.
- Running the real complete radio stack inside stock Expo Go.

## Requirement catalogue

Requirements use stable IDs. Tests, implementation notes, and issue references should cite them.

### Offline foundation

- **OFF-001:** The app must open its home, SOS, map, local-help, incident, and relay-status surfaces without internet.
- **OFF-002:** Creating, updating, or cancelling an SOS must not call the backend before local success is shown.
- **OFF-003:** The phone must persist outbound packets across process restart and device reboot where the selected storage permits.
- **OFF-004:** A missing gateway must be represented as normal offline state, not an error that blocks the app.
- **OFF-005:** GPS failure must not prevent SOS creation; the location state becomes unknown, cached, user-pinned, or stale.
- **OFF-006:** The predownloaded region and baseline resource registry must remain readable in airplane-mode-style tests.
- **OFF-007:** Local responder acceptance and resolution must remain possible without a server.
- **OFF-008:** All timestamps shown offline must tolerate device clock uncertainty and clearly expose age where meaningful.

### Profile and role

- **ROL-001:** The hackathon app must offer General Public and Responder modes.
- **ROL-002:** A lightweight local profile must be usable before any online registration succeeds.
- **ROL-003:** Demo responder status must be provisioned explicitly and labeled as demo/organization-provisioned rather than cryptographically verified.
- **ROL-004:** Authority Publisher, Coordinator, and Radio Broadcaster are web roles.
- **ROL-005:** Role changes must not alter the underlying packet transport rules.
- **ROL-006:** General Public users must not create official alerts or authoritative infrastructure updates.
- **ROL-007:** A responder can see additional incident details/actions only when the packet policy permits them.

### SOS lifecycle

- **SOS-001:** The first SOS action must be reachable from the home screen with one primary action.
- **SOS-002:** The app must support a rapid default SOS plus an expanded form.
- **SOS-003:** The SOS payload must support category, severity, people count, mobility, injury indicators, short note, language, location source, location accuracy, and location age within strict limits.
- **SOS-004:** The source must receive a stable incident identifier and packet identifier.
- **SOS-005:** An SOS update must reference the incident and increase its source sequence.
- **SOS-006:** An SOS cancel must create a terminal update; it must not erase audit history immediately.
- **SOS-007:** The owner must see separate local save, peer copy, responder, gateway, backend, arrival, and resolution states.
- **SOS-008:** A relay copy must never be described as “help is coming.”
- **SOS-009:** A resolved/cancelled incident must stop normal active replication while leaving a compact terminal record long enough to suppress stale copies.
- **SOS-010:** A user must be able to update missing/stale location later.

### Relay behavior

- **REL-001:** Relay mode must be explicit, visible, and stoppable.
- **REL-002:** Every eligible node must be capable of advertising, scanning, receiving, storing, and forwarding during relay mode.
- **REL-003:** Phones must exchange compact inventory information before transferring full packets where practical.
- **REL-004:** The receiver must request only missing eligible packets/fragments.
- **REL-005:** Critical packets must preempt or precede file fragments.
- **REL-006:** Deduplication must prevent repeated display/action while still recording useful new observations.
- **REL-007:** Hop limit, expiry, copy budget, retry cooldown, and recent-neighbor knowledge must bound replication.
- **REL-008:** Store-carry-forward must work across loss of contact.
- **REL-009:** Relay decisions must consider packet class, target, novelty, gateway availability, battery, congestion, and copy overlap.
- **REL-010:** Loss of Bluetooth or process restart must not discard durable custody records.

### Gateway behavior

- **GTW-001:** A gateway flag requires a recent successful live probe.
- **GTW-002:** Upload must be priority-aware and resumable after connectivity loss.
- **GTW-003:** Multiple gateways uploading one packet must create multiple observations of one packet/incident.
- **GTW-004:** Backend acknowledgement must return as its own packet.
- **GTW-005:** Downloaded authority, assignment, acknowledgement, and map-delta packets must enter the normal local store/policy path.
- **GTW-006:** Downloaded eligible packets must be advertised back into Tier 1.
- **GTW-007:** Gateway loss must degrade to normal relay behavior without data loss.
- **GTW-008:** The source UI must not show backend success until a backend acknowledgement reaches the source phone.

### Map and local information

- **MAP-001:** The base map must render without internet.
- **MAP-002:** Baseline hospitals, shelters, food/water sites, safe zones, and important routes must use stable compact IDs.
- **MAP-003:** The map must show accepted SOS, responder, permitted peer, gateway, resource, hazard, and route states.
- **MAP-004:** Every dynamic marker must expose update age; location accuracy must be shown when supplied.
- **MAP-005:** A location older than its configured freshness threshold must become visually stale.
- **MAP-006:** Typed map updates must be idempotent.
- **MAP-007:** A newer source sequence wins while history remains available for diagnostics.
- **MAP-008:** Missing referenced objects must produce safe fallback text/coordinates, not silent substitution.
- **MAP-009:** Tier 1, gateway, and Tier 2 inputs must update the same projection.
- **MAP-010:** Filters must allow users to focus on incidents, responders, resources, hazards, or routes.
- **MAP-011:** General users must not see sensitive incident details outside the selected disclosure policy.

### Tier 2

- **T2-001:** Tier 2 must use ggwave only for authority-to-phone compact data.
- **T2-002:** The microphone path must be explicit, permissioned, visible, and time-bounded.
- **T2-003:** The direct clean-audio path must be labeled as a controlled demonstration.
- **T2-004:** Both receive paths must produce equivalent canonical packet identities and payload meanings.
- **T2-005:** Campaigns must include a compact manifest/inventory.
- **T2-006:** Critical items must repeat more frequently than normal updates.
- **T2-007:** Frame failure must not create partial application state.
- **T2-008:** Tier 2 duplicates must be suppressed.
- **T2-009:** Tier 2 may activate/update predownloaded map objects, guides, translations, and forms by compact ID.
- **T2-010:** Tier 2 must carry short fallback text for critical meaning when an object is missing.
- **T2-011:** A valid received authority packet may bridge into Tier 1 without changing its logical identity.
- **T2-013:** Tier 2 must not send normal image/file content during the main demo.

### Dashboard and campaign workflow

- **WEB-001:** The coordinator dashboard must show one deduplicated incident with multiple observations.
- **WEB-002:** It must support assignment, acknowledgement, en-route, arrived, and resolved state.
- **WEB-003:** It must show last-known location age and accuracy.
- **WEB-004:** Authority users must manage resources, hazards, route changes, official alerts, and check-in campaigns.
- **WEB-005:** The authority composer must preview the compact outbound content and estimated/actual byte size.
- **WEB-006:** A campaign must move through draft, validation, approval, broadcaster-ready, tested, scheduled/exported, played, and archived/failed states.
- **WEB-007:** Editing approved content must return it to draft/review.
- **WEB-008:** The broadcaster view must show packet inventory, repetition schedule, audio preview, decode-test result, and logs.
- **WEB-009:** Decode testing must compare recovered packet IDs with the expected manifest.
- **WEB-010:** Gateway downloads must be region/relevance bounded.

### Files and images

- **FIL-001:** Files/images must use a manifest plus bounded requested fragments.
- **FIL-002:** They must never be sent through Tier 2 as ordinary payloads.
- **FIL-003:** Incomplete content must remain hidden.
- **FIL-004:** Whole-object integrity must pass before display.
- **FIL-005:** Transfers must pause for critical traffic and resume from missing fragments.
- **FIL-006:** Oversized, executable, decompression-dangerous, or unrequested objects must be rejected.
- **FIL-007:** The hackathon must set and document one strict maximum size.

### Integrity, safety, and truthfulness

- **INT-001:** Parsers must reject invalid lengths/counts before allocation.
- **INT-002:** Headers/frames and payloads must have corruption detection.
- **INT-003:** Replay, expiry, hop, and deduplication checks are mandatory.
- **INT-004:** The UI must not use “verified” for demo role provisioning or checksum validity.
- **INT-005:** The app must distinguish source role label from cryptographic proof.
- **INT-006:** Synthetic judging data must be used for personal identities and locations.
- **INT-007:** Logs must avoid unnecessary personal content.
- **INT-008:** Production security must remain an explicit future requirement, not an implied completed feature.

## Screen-by-screen product specification

### 1. Launch and readiness

Purpose: establish whether the device is prepared before a disaster workflow begins.

Must show:

- selected local role;
- offline content pack name/version/region;
- Bluetooth support and permission status;
- relay-mode status;
- current internet state as untested, unavailable, probing, or proven gateway;
- last-known location status;
- Tier 2 listening inactive/active state;
- a prominent route to the home screen even when permissions are incomplete.

Failure behavior:

- Missing internet is normal.
- Missing Bluetooth blocks relay but not viewing the offline map or drafting/storing an SOS.
- Missing location does not block SOS.
- Missing content pack shows a clear reduced-capability state rather than a blank screen.

### 2. Citizen home

Must prioritize:

- large SOS action;
- current operating mode;
- active SOS status if one exists;
- most urgent relevant alert;
- nearest useful resources from offline data;
- relay status and recent peer count;
- last proven gateway/acknowledgement state;
- offline map entry.

The home screen must not use a generic “Connected” label. It must say what is connected: Bluetooth enabled, relay active, peers recently seen, or internet gateway proven.

### 3. SOS composer

Rapid path:

- immediately create a default urgent SOS using available local profile/location data;
- allow details to be added through a later update.

Expanded path:

- emergency category;
- four-level severity;
- people count and injured count;
- mobile, limited, immobile, trapped, or unknown mobility;
- short constrained note or prepared phrase;
- location source, accuracy, and age;
- language preference;
- confirmation of what will be shared locally.

### 4. Active SOS and delivery timeline

Must show:

- incident summary and latest update sequence;
- local-save timestamp;
- number of distinct peer link receipts;
- responder acknowledgement separately;
- gateway/backend acknowledgement separately;
- responder assignment, acceptance, en route, arrived, and resolution states;
- next retry/relay state in user-friendly language;
- update and cancel actions;
- location age and update-location action.

### 5. Offline operational map

Layers:

- self;
- SOS incidents;
- responders;
- recently reported participating peers, where permitted;
- hospitals and medical posts;
- shelters;
- food/water;
- safe zones;
- help centres;
- hazards;
- route blockages/changes;
- temporary gateway observations.

Every item detail sheet must show source category, last update, location quality, current operational state, and relevant action. Map data must remain understandable in list form for accessibility and low-performance devices.

### 6. Nearby incidents

General Public sees only the configured minimal public view. Responder mode additionally sees sorting by severity, age, distance, people/injury indicators, assignment state, and last update. Severity alone cannot hide older unhandled cases indefinitely.

### 7. Responder incident detail

Must support:

- accept or decline;
- mark en route;
- see last-known location and uncertainty;
- see latest incident update and timeline;
- publish responder status/location deliberately;
- mark arrived;
- resolve with a reason or escalate/reopen where the demo workflow allows;
- produce compact state packets at every transition.

### 8. Local help/resource detail

Shows:

- type and name;
- stable object identity for diagnostics;
- coordinates and offline route context;
- open/closed/unknown state;
- capacity/availability if supplied;
- last update and source category;
- whether the value came from base pack, Tier 1, Tier 2, or gateway;
- superseded/stale warning.

### 9. Relay and gateway status

Must show:

- relay active/inactive;
- scan/advertise capability;
- peers recently seen;
- packets stored, queued, forwarded, expired, rejected, and waiting;
- queue by priority, not personal packet contents;
- proven internet state and last probe time;
- last upload/download;
- battery mode;
- stop control.

### 10. Tier 2 listening

Must show:

- history of all messages received from gg waves;
- active campaign ID/version when detected;
- frames detected, valid, corrupt, duplicate, and missing;
- packets recovered versus expected manifest;
- resulting alerts/map actions.

### 11. Profile

Must show:

- selected district/region setting;
- status of downloaded offline map and content pack;
- action to update the offline map.

### 12. Diagnostics

For judges and QA, show transport, packet ID prefix, packet type, size, source category, timestamps, validation outcome, policy outcomes, and resulting action. Diagnostics must be separable from the normal citizen experience.

### 14. Authority/coordinator dashboard

Must contain:

- incident map and queue;
- incident timeline and multiple gateway observations;
- filters for severity, age, state, type, and region;
- responder availability and assignment;
- resource/hazard/route editor for the selected region;
- outbound delta preview;
- official alert/check-in campaign composer;
- gateway synchronization/audit view.

### 15. Broadcaster dashboard

Must contain:

- approved campaigns only;
- packet inventory and byte budgets;
- repetition order and expected duration;
- audio preview;
- decode-before-broadcast comparison;
- scheduled/exported/played state;
- immutable log of the tested artifact identity and result for the demo.

## Notification policy

| Event | General Public | Responder |
|---|---|---|
| Own SOS stored | Immediate confirmation | Immediate confirmation |
| Own SOS copied to peer | Quiet progress update | Quiet progress update |
| Nearby Level 3 SOS | Configured urgent local alert with minimal details | Urgent responder alert |
| Nearby lower-severity SOS | Normal/silent based on distance and preferences | Queue update |
| Official critical alert | Critical unless already acknowledged/suppressed by policy | Critical |
| Shelter/resource update | Silent map update unless directly relevant | Silent/normal |
| Hazard intersects current area/route | Normal or critical based on severity | Normal or critical |
| Responder assigned/accepted | Incident timeline update | Actionable assignment alert |
| Backend acknowledgement for own SOS | Clear delivery update | Clear delivery update |
| Duplicate packet | No repeat notification | No repeat notification |
| Stale marker | No alarm; visual downgrade | No alarm; visual downgrade |

## Data minimization and disclosure

The prototype should collect only data necessary for the demonstration. Suggested local profile fields are display name or alias, local user ID, role, language, optional phone/contact field, optional medical summary, and responder capability tags. The packet policy must prefer compact incident-scoped identifiers over full profile replication.

Public relay data should reveal emergency category, severity, location, location quality, people/injury/mobility indicators, short note, incident identity, and reply capabilities only as required. Full phone numbers, addresses, government IDs, and detailed medical histories are not part of the default mesh payload.

## Product state models

### Incident state

Draft → created locally → active/relaying → responder assigned → responder accepted → en route → arrived → resolved.

Alternate transitions:

- created/active → cancelled by source;
- active → expired;
- assigned → declined/reassignment needed;
- resolved → reopened only by an explicitly supported demo rule.

### Packet custody state

Created locally → stored → advertised → requested → sent → link acknowledged. Separately, a packet may become gateway queued → uploaded → backend acknowledged. Custody can also end as expired, superseded, cancelled/resolved tombstone applied, invalid, or evicted by policy.

### Resource state

Baseline or temporary → active → updated → stale → closed/full/unavailable → reopened/updated → tombstoned/expired.

### Campaign state

Draft → validated → approved → broadcaster ready → audio generated → decode tested → scheduled/exported → played → archived. Any content change after approval returns to draft/validation.

## Product analytics for the demo

The product must emit enough local events to answer:

- How long did discovery take?
- How long from request to valid storage?
- How many distinct peers received a packet?
- How many duplicate transfers were suppressed?
- What was the encoded packet size?
- Which policy decision caused display/relay/upload?
- When did a gateway become proven/unproven?
- How long until backend acknowledgement returned?
- How many Tier 2 frames were detected, valid, corrupt, duplicate, or missing?
- Which map objects changed and from which transport?

Analytics must never be described as available centrally when the data has not reached a gateway.

## Accessibility and disaster usability requirements

- Critical actions must have large touch targets and plain labels.
- State cannot be communicated by color alone.
- SOS creation and cancellation require accessible confirmation behavior.
- Core flows must have screen-reader labels.
- Important alerts require visual and vibration alternatives to audio.
- Prepared phrases and icons support low literacy.
- Maps require list equivalents.
- The user must be able to see whether location is unknown/stale without interpreting a subtle icon.
- Relay and microphone modes require visible, understandable stop controls.
- The interface must tolerate one-handed use and stressful conditions.

## Final product acceptance matrix

| Product promise | Required evidence |
|---|---|
| Works locally without towers | Real Android devices exchange and act on SOS with internet/Wi-Fi unavailable |
| Automatic relay | Three-hop transfer occurs without manual forwarding |
| Store-carry-forward | Carrier retains packet across disconnection and later forwards it |
| Local response | Responder accepts/arrives/resolves without backend |
| Gateway extension | Live-proven gateway uploads and returns acknowledgement |
| Internet-to-mesh | Downloaded authority/resource delta reaches an offline peer |
| Predownloaded map intelligence | Same local map changes from Tier 1, gateway, and Tier 2 packets |
| Tier 2 radio | Microphone and direct paths recover equivalent compact packets |
| Radio-to-mesh | Non-listening peer receives Tier 2-origin record over Bluetooth |
| Complete packet family | Registry, policy, UI outcome, and test exist for every listed family |
| Congestion safety | SOS preempts file/image transfer |
| Truthful status | UI distinguishes link, responder, gateway, backend, arrival, and resolution |
| Honest technical scope | Demo labels development build, controlled radio path, and prototype trust correctly |

## One-sentence product definition

Disaster SOS Mesh is an Android emergency communication system that lets phones exchange and relay compact disaster packets over Bluetooth when towers, Wi-Fi, and internet service are unavailable, optionally bridges those packets through any phone that later finds usable internet, and receives compact authority information from prepared radio audio through a separate ggwave-based Tier 2 path.

## Non-negotiable decisions

### 1. The disaster area is offline

- The main scenario assumes the cellular tower is down.
- The mobile experience must remain useful with no mobile data, no Wi-Fi, and no internet connection.
- Internet must never be required to create an SOS, discover peers, relay packets, view predownloaded maps, receive nearby information, or respond locally.
- “Mesh to internet” is an opportunistic extension. It happens only if a participating phone later proves that it has usable connectivity through any available path.
- A network icon or connected state is not proof of internet. Gateway status requires a live connectivity check.

### 2. Tier 1 is Bluetooth phone-to-phone mesh

- Tier 1 is the bidirectional citizen/responder network.
- Every participating Android phone can become a sender, receiver, relay, store-and-carry node, and—when connectivity actually appears—an internet gateway.
- BLE is the preferred transport because it is suited to nearby discovery and compact transfers.
- If BLE cannot support the controlled demo on the selected Android devices, the transport layer may use another Android Bluetooth mode. That fallback must remain behind the same transport boundary so packet rules and UI behavior do not change.
- There is no ggwave phone-to-phone fallback in Tier 1.
- The architecture must be modular so the team can change the Bluetooth implementation without rewriting packet handling, maps, storage, or dashboards.

### 3. Tier 2 is ggwave radio data only

- ggwave is used exclusively for Tier 2.
- Tier 2 is a one-way authority-to-phone broadcast path.
- The hackathon demonstration uses a prepared radio-program audio file containing compact ggwave packet bursts.
- The app demonstrates microphone decoding from a nearby speaker and direct clean-audio decoding from the prepared asset.
- Tier 2 does not carry citizen responses back to the broadcaster.
- A Tier 2 check-in request may open a form on the phone, but the resulting response becomes a Tier 1 packet.
- Tier 2 sends compact structured data, references, and small changes. It does not attempt to transmit maps, ordinary speech conversations, or large files.

### 4. Four communication directions must be represented

The product must demonstrate or explicitly model all four directions:

1. Mesh to mesh: one offline phone relays packets to another offline phone.
2. Mesh to internet: a phone with proven connectivity uploads queued packets to the backend.
3. Internet to mesh: a connected gateway downloads acknowledgements, assignments, authority updates, and resource changes, then rebroadcasts eligible packets into the Bluetooth mesh.
4. Radio to mesh: a phone decodes a Tier 2 authority packet and may rebroadcast the original compact information into Tier 1.

Internet-to-mesh and mesh-to-internet are optional paths that appear only when a real gateway exists. Their existence must not weaken the offline behavior.

### 5. Android and application stack

- Target platform: Android only for the hackathon.
- Application framework: React Native with Expo tooling.
- Expo Go may be used for UI, navigation, map presentation, packet simulations, and early development.
- Real Bluetooth/BLE support requires native Android capabilities not included in the standard Expo Go client. The judged device-to-device build must therefore use an Expo development build or another compatible native build while keeping the React Native/Expo project structure.
- An agent must not claim that the complete real Bluetooth mesh runs inside the stock Expo Go client.

### 6. One city or region is enough

- The hackathon data pack covers one selected city or region.
- The app contains a predownloaded offline base map and an indexed preparedness data pack.
- The pack includes hospitals, shelters, food/water points, safe zones, important roads, and other demonstration resources.
- Tier 1 and Tier 2 packets apply small changes to the local map: open/closed status, capacity, hazard overlays, route blockages, temporary help points, SOS positions, responder positions, and last-known peer locations.
- The map must never become blank merely because internet is unavailable.

### 7. Packet size is a first-class constraint

- Every packet must be as small as its purpose allows.
- Structured fields and numeric identifiers are preferred over verbose text.
- Known map objects are referenced by compact IDs instead of resending their full description.
- Only changed fields should be sent in updates.
- Duplicate packets are suppressed.
- Large files and images are fragmented, requested deliberately, strictly limited, and never allowed to delay SOS or control traffic.
- ggwave payloads must be dramatically smaller than Bluetooth payloads because its practical bitrate is very low.

### 8. Integrity without production cryptographic verification

- The hackathon build does not require production-grade cryptographic identity or signature verification.
- Packets still require structural validation, length limits, checksums, corruption detection, deduplication, expiry, hop limits, and bounded reassembly.
- Tier 2 uses ggwave's error-correction behavior plus packet/frame integrity checks and repetition.
- The UI must label prototype authority and responder status honestly; it must not claim that a packet is cryptographically verified.
- Production authentication, signatures, privacy, and key management are explicitly future hardening work.

## Users and permissions

### General Public mode

General-public users can:

- register or create a lightweight local profile;
- create an SOS;
- update or cancel their own SOS;
- answer an authority check-in;
- create a resource request when enabled;
- receive official alerts and nearby help information;
- see relevant SOS, responder, peer, resource, and hazard locations on the offline map;
- acknowledge that they have seen an alert;
- automatically relay eligible packets while relay mode is active.

General-public users cannot publish authoritative hospitals, shelters, food/water sites, safe zones, route closures, or official alerts. If citizen hazard/help reporting is included, it must be labeled community-reported, given lower trust and routing weight, and must never replace an authority record automatically.

### Responder mode

Responders can:

- do everything allowed in General Public mode;
- view prioritized SOS cases relevant to their area;
- accept or decline an assignment;
- mark en route, arrived, and resolved according to the selected workflow;
- publish responder location/status while actively responding;
- create or update operational hazard, route, hospital, shelter, safe-zone, and resource information if their prototype role permits it;
- send acknowledgements and case updates into the mesh;
- view network and incident context needed to reach the victim.

For the hackathon, responder identity may be provisioned by the demo dataset or dashboard. It must be presented as prototype role provisioning rather than production verification.

### Authority Publisher web role

The Authority Publisher uses an online web dashboard and can:

- create and manage official alerts;
- create and update resource, hazard, route, and safe-zone records;
- create Tier 2 campaigns and check-in requests;
- approve campaign content;
- inspect incidents and map state;
- assign responders and issue acknowledgements;
- publish compact changes for gateway-to-mesh or Tier 2 distribution.

### Radio Broadcaster web role

The Radio Broadcaster uses an online web dashboard and can:

- receive an approved authority campaign;
- review packet inventory and schedule;
- generate or obtain the prepared ggwave radio-program audio;
- preview the audio;
- run a decode-before-broadcast test;
- schedule/export the campaign audio for the demonstration;
- view expected packet timings and broadcast logs;
- record that a campaign was prepared or played.

The broadcaster cannot silently alter approved authority content. Any edited campaign returns to the authority approval state.

### Coordinator web role

For the hackathon, coordinator functions may live in the Authority dashboard. The coordinator can:

- view deduplicated incidents;
- see observations from multiple gateways without treating them as different victims;
- assign responders;
- issue acknowledgement and status packets;
- mark cases resolved;
- view last-known locations with age and accuracy;
- inspect packet and gateway history.

## Complete packet catalogue

All of the following packet families belong to the product. “Included” means represented in the protocol, state model, UI behavior, and tests; it does not mean every family needs identical visual depth.

| Family | Required packet or record | Typical creator | Priority |
|---|---|---|---|
| Emergency | SOS create | General Public, Responder | Critical |
| Emergency | SOS update | SOS owner, Responder | Critical |
| Emergency | SOS cancel | SOS owner, Coordinator | Critical control |
| Response | Responder assigned | Coordinator | Critical control |
| Response | Responder accepted/declined | Responder | Critical control |
| Response | Responder en route | Responder | Critical control |
| Response | Responder arrived | Responder | Critical control |
| Response | Resolved | Authorized demo role | Critical control |
| Receipt | Link acknowledgement | Receiving node | Critical control |
| Receipt | Gateway/backend acknowledgement | Backend through gateway | Critical control |
| Resource | Shelter | Authority, Responder | High |
| Resource | Hospital/medical post | Authority, Responder | High |
| Resource | Food/water | Authority, Responder | High |
| Resource | Safe zone | Authority, Responder | High |
| Hazard | Hazard alert | Authority, Responder; optional community report | High |
| Navigation | Route blockage or route change | Authority, Responder | High |
| Authority | Official alert | Authority | Critical or high |
| Check-in | Check-in campaign | Authority | High |
| Check-in | Check-in response | General Public, Responder | High |
| Request | Resource/help request | General Public, Responder | High |
| Communication | Addressed mesh chat | General Public, Responder | Opportunistic |
| Data | File manifest | Restricted creators | Low |
| Data | File/image fragment | Restricted creators, requested transfer only | Lowest |
| Network | Capability/hello | Every node | Reserved control |
| Network | Inventory/packet request | Every node | Reserved control |

Mesh chat is bounded, addressed to an observed node token, saved before the UI reports success, and carried by Tier 1 store-carry-forward. In the hackathon prototype it is plaintext with integrity checking, not end-to-end encryption; intermediate relays may retain the packet until expiry, and “saved to mesh” is not a delivery guarantee.

## Severity and importance

The system separates severity, authority, and delivery priority. They are related but not identical.

Recommended emergency severity levels:

- Level 0 — informational or safe check-in.
- Level 1 — assistance needed but not immediately life-threatening.
- Level 2 — urgent danger or medical need.
- Level 3 — life-critical, trapped, severe injury, active fire/flood/violence, or immediate rescue need.

An ordinary citizen-created packet must not receive absolute authority merely because it declares Level 3. It is delivered urgently and shown as unverified/community-originated until acknowledged or corroborated. Official alerts and responder states use their role labels, not inflated severity, to communicate source context.

## Core user journeys

### Offline SOS journey

1. A citizen creates an SOS while the phone has no internet.
2. The app stores it locally before reporting success.
3. Nearby phones discover it, request the compact packet, store it, and relay it.
4. Relevant nearby users/responders see the SOS on their offline map with severity, location age, and accuracy.
5. A responder accepts the case and sends status updates through the same mesh.
6. If no internet ever appears, local response can still proceed and resolution can still propagate locally.

### Opportunistic gateway journey

1. A relay carrying queued packets later proves usable internet access.
2. It becomes a temporary gateway and uploads a compact batch.
3. The backend deduplicates packets and updates the incident dashboard.
4. The gateway downloads acknowledgements, assignments, authority changes, and relevant compact records.
5. It injects those packets into the Bluetooth mesh.
6. The original source sees “coordination centre received” only after a backend acknowledgement returns to that phone.

### Tier 2 radio journey

1. The Authority Publisher builds and approves a compact campaign.
2. The Radio Broadcaster previews, tests, schedules, and logs the prepared radio-program audio.
3. An Android phone listens through its microphone or uses the direct demo audio path.
4. The phone reconstructs valid packets, suppresses repeats, and applies relevant changes to its local offline map and alert views.
5. The receiving phone may rebroadcast eligible Tier 2 information into the Bluetooth mesh.
6. A check-in request opens a local form; the response travels through Tier 1, not back over radio.

## Map behavior

The offline map is a core product surface, not a decorative screen. It shows:

- the current user's last-known position;
- SOS locations the user is permitted to see;
- active responder locations/statuses when shared;
- recently observed participating nodes when their packets include shareable locations;
- hospitals, shelters, food/water points, safe zones, and help centres;
- hazards and blocked routes;
- resource capacity or open/closed state;
- age and accuracy of location-based information;
- whether an item came from the base pack, Tier 1, Tier 2, or an internet gateway.

Peer and responder dots must not imply real-time tracking. Every location marker needs a timestamp or age; stale markers must visibly become stale and eventually disappear according to policy.

## What the hackathon prototype must not claim

- It must not claim that towers or internet are required for the core product.
- It must not call Bluetooth a continuous, always-connected network.
- It must not promise a guaranteed kilometre range.
- It must not claim that stock Expo Go provides full BLE mesh access.
- It must not claim every Android device behaves identically in the background.
- It must not call link receipt an authority or responder acknowledgement.
- It must not claim that ggwave carries maps, large media, or normal conversations efficiently.
- It must not claim production-grade authentication, encryption, or verified identities.
- It must not present a stale peer location as live.
- It must not present the direct audio demo as universal access to an internal FM tuner.

## Product completion test

The product definition is satisfied when the controlled demonstration proves that compact information remains useful without infrastructure: an SOS travels across multiple Android phones over Bluetooth, users and responders see meaningful offline map changes, local responder state returns through the mesh, an optional gateway synchronizes in both directions when connectivity genuinely appears, and prepared Tier 2 audio changes the same offline data model without pretending to provide a radio uplink.
