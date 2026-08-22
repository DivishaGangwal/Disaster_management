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

This persistence is backend-only. Android OFF-003 still requires the separate
`expo-sqlite` repository behind `PacketRepository`.

## Workspaces and surfaces

The console implements the five authority/coordinator and four broadcaster
contract entries from `surface-registry.ts`, but presents them as four coherent
workspaces instead of nine disconnected pages: Coordinate merges incident and
responder work; Publish merges the interactive map, regional register, state
change, mesh publication, and delivery evidence; Campaigns contains the entire
approval-to-audio-to-reception path; Packet Network exposes the live internals.

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

## MapLibre operations map

Coordinate and Publish use MapLibre GL JS with live GeoJSON. The map clusters
dense points and provides incident/centre/route/hazard filters, navigation,
fullscreen, scale, fit-to-Assam, state-coloured markers, selection fly-to, and
safe DOM popups. A regional object can be closed, blocked, cleared, or reopened
from its popup; the action uses the versioned publication endpoint, and both map
and packet stream update on the next three-second poll.

The current basemap is online. It does not satisfy MAP-001 offline-map evidence;
that remains Workstream D and requires a licensed packaged tile artifact.

Program preparation advances `broadcaster-ready → audio-generated`. Only a
complete recovered frame set advances `audio-generated → decode-tested`.
Preparation and reception results are stored in SQLite and written to the
append-only broadcast register.

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
