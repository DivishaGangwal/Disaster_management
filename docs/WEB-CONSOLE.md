# Assam Operations Console

Workstream E is delivered as one integrated web application. There is no role
switch and no separate broadcaster application. Authority, coordination,
acoustic transmission and reception form one traceable workflow while backend
state transitions preserve the documented approval boundary.

## Run locally

Requirements: Node.js 22.5 or later.

```bash
npm install
npm run demo
```

Open `http://localhost:8787`.

The console requires an operator name and operations key before it exposes any
authority, coordinator, or broadcaster controls. In demo mode the default key is
`assam-operations-demo`. Override it for any shared deployment:

```bash
DSM_OPERATIONS_KEY='replace-with-a-long-random-value' npm run demo
```

When `DSM_DEMO_MODE=false`, there is no default key and
`DSM_OPERATIONS_KEY` is required. The shared key authorises an integrated
operations session and the supplied operator name is written to audit records;
it is not cryptographic proof of a person's identity.

The command builds the TypeScript packages and Vite application, starts the
backend, seeds the database when it is empty, and serves the console and API
from the same process.

## Persistence

The default database is `data/assam-operations.sqlite`. Override it with:

```bash
DSM_DATABASE_PATH=/absolute/path/operations.sqlite npm run demo
```

SQLite persists canonical packet bytes, packet observations, gateway state,
outbound queues, responder assignments, regional updates, campaign versions,
approval digests and audit history. The backend replays canonical packet bytes
through the existing incident reducer after restart.

Android uses its own `expo-sqlite` repositories behind the same packet, peer and
file ports; backend and mobile databases remain deliberately separate.

## Workspaces and surfaces

The console implements the five authority/coordinator and four broadcaster
contract entries from `surface-registry.ts`, but presents them as four coherent
workspaces instead of nine disconnected pages: Coordinate merges incident and
responder work; Publish merges the interactive map, regional register, state
change, mesh publication, and delivery evidence; Campaigns contains the entire
approval-to-audio-to-reception path; Packet Network exposes only evidence
stored by this backend.

Those workspaces cover the original nine registered surfaces:

1. Incident map and queue
2. Responder roster and assignment
3. Regional resource, hazard and route editor
4. Official alert and campaign composer
5. Gateway synchronization and audit
6. Approved campaigns
7. Packet inventory and burst schedule
8. Two-device broadcast studio and decode-before-broadcast comparison
9. Audio-program and broadcast register

The Broadcast Studio has two station functions in the same product:

- **Broadcast station (device 01):** converts the immutable Tier 2 frame list
  into ggwave audio, plays the complete repetition schedule, or exports it as a
  48 kHz mono WAV.
- **Receiving station (device 02):** captures microphone PCM, runs the ggwave
  decoder, collects raw Tier 2 frames, and submits them for CRC and exact-frame
  comparison against the approved artifact.
- **Audio-file recovery:** accepts a recorded or exported WAV, decodes its PCM
  entirely in the browser through the same ggwave decoder, and exposes the same
  expected-versus-recovered comparison. This is useful for deterministic
  decode-before-broadcast validation before the physical microphone trial.

The browser adapter vendors the relevant MIT-licensed WavePX low-level transport
and audio lifecycle, pinned to commit `81c7c30…`. Raw Tier 2 bytes are not
wrapped as WavePX text, so the frozen frame contract remains consumable by the
future Android receiver. Attribution is in
`apps/web-authority/src/vendor/wavepx/`.

## Centre publication and map-operation pipeline

Coordinate and Publish use MapLibre GL JS with live GeoJSON. The map clusters
dense points and provides incident/centre/route/hazard filters, navigation,
fullscreen, scale, fit-to-Assam, state-coloured markers, enlarged selectable
objects, cursor coordinates, zoom level, visible-object totals, selection
fly-to, and safe DOM popups. Publish is a single map-first workspace: selecting
an object on the map or regional register opens the same state control and its
packet delivery trail. A regional object can be created, moved/edited, closed,
blocked, cleared, or reopened; every action uses the versioned publication
endpoint and emits a canonical packet. Recovered packets use the shared
`toMapOperations()` translation. The mobile graphical map remains the requested
placeholder while its projected-object list uses live engine state.

## Evidence inspection

Packet evidence is available in Publish and Packet Network through the same
inspector. It is not a global packet tracker: after a packet leaves an observed
phone, the system knows nothing more until a direct receipt or gateway
observation arrives. The three views expose only stored protocol facts:

- **Decoded:** message and source headers, fragment position, flags, priority,
  severity, and the complete decoded payload.
- **Route:** direction, hop budget, creation/expiry/store times, outbound
  regions, optional geospatial envelope, and every gateway observation.
- **Raw bytes:** total and payload sizes, full digest, exact hexadecimal bytes,
  and exact base64 bytes, with copy controls for exchange and debugging.

Campaigns also exposes an acoustic evidence drawer containing the artifact
digest, every expected base64 Tier 2 frame, the playback schedule count, frames
recovered by the current browser, and the stored exact-comparison result. The
human-readable decoded public message remains visible after a successful
microphone or WAV reception.

The campaign composer creates two canonical packet categories: public alerts and
current regional map records. Each is encoded with its existing frozen message
type and passes through the same approval, WavePX/ggwave preparation,
speaker/WAV transmission, frame comparison, and decode evidence flow. The
console no longer composes check-in campaigns (HD-010).

A public alert carries an operator-selected broadcast point. The point is chosen
on the composer map — click the basemap, drag the pin, click an existing
incident or record marker, or type the degrees directly — and is encoded as the
`latE7`, `lonE7` and `radiusM` fields of the same OFFICIAL_ALERT packet the
radio carries.

Reception verification does not compare frame tallies alone. `Tier2Receiver`
reassembles the complete canonical Tier 1 bytes without needing a campaign
manifest. When an approved campaign is selected, the manifest additionally
compares those recovered bytes with the approved packet byte-for-byte. Only
then is the payload decoded, so the
message and coordinates shown as "decoded from the recovered audio" came off the
air rather than from the stored draft. A campaign reaches `decode-tested` only
when every expected frame arrived and the recovered packet is byte-identical.

The current web basemap is online. The mobile graphical/offline renderer remains
deferred and requires a licensed packaged tile artifact.

Program preparation advances `broadcaster-ready → audio-generated`. Only a
complete recovered frame set advances `audio-generated → decode-tested`.
Playback remains disabled until the tested program is explicitly scheduled.
WAV export records the exact program ID, campaign version, artifact digest,
operator and time and advances a decode-tested campaign to `scheduled`;
successful speaker playback records the same immutable evidence and advances
`scheduled → played`. Operators can then archive the played campaign.
Preparation, reception, export and playback results are stored in SQLite and
written to the append-only broadcast register.

## Assam data boundary

`IN-AS` currently contains prepared development operations data owned by this build. It is
not a sourced facility register or offline base map and must not be presented as
one. Workstream D still owns the licensed regional content pack.

## Two-device setup

Both browsers must open the same running operations service and select the same
campaign. The receiving browser requires a secure context for microphone
permission:

- `http://localhost:8787` works when the receiver runs on the same machine.
- A phone or second laptop opening a LAN IP must use trusted HTTPS (for example,
  a trusted local reverse proxy or an HTTPS deployment). Plain
  `http://192.168.x.x:8787` can display the site but browsers will block its
  microphone.
- Keep both devices at 48 kHz audio, disable voice enhancement where the OS
  exposes it, and place the receiver near the sending speaker.

The application code supports the two clients now. Creating/trusting the HTTPS
certificate and conducting the physical acoustic trial are operator steps; no
physical success rate is claimed by this implementation pass.

## Reset

`POST /api/demo/reset` clears local operational state and restores the versioned
Assam seed. Set `DSM_DEMO_MODE=false` wherever reset must be unavailable.

## Verification

```bash
npm run build
npm run web:build
npm test
npm run boundaries
```

Browser verification covers responder assignment, regional updates, campaign
creation, validation, approval, broadcaster hand-off, real browser-side ggwave
initialization, WAV generation, exact-frame comparison, and persistence across
backend restart. Physical microphone, battery and radio-chain measurement is
separate and is not claimed here.

## WavePX dependency decision

The official WavePX repository documents the desired `SonicPixel` lifecycle,
but its current npm package is not available from the registry and its GitHub
install omits the built `dist/lib` files. To keep this build reproducible, the
web app depends on `ggwave@0.4.0` and vendors a small typed adapter based on the
MIT-licensed WavePX transport/audio approach. The pinned source reference,
adapted modules, notice, and licence are in
`apps/web-authority/src/vendor/wavepx/`.
