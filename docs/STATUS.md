# Implementation status

Updated 2026-08-27. This is an implementation report, not a real-device certification.

The file-by-file implementation record for this pass is in
[IMPLEMENTATION-CHANGES-2026-08-23.md](IMPLEMENTATION-CHANGES-2026-08-23.md).

## Verified in this pass

```text
npm test                                      93/93 passing
npm run build                                 strict TypeScript build passing
npm run typecheck --workspace @dsm/mobile     passing
npm run web:build                             passing
npm run boundaries                            passing
npm run fuzz                                  4,005 runs, 0 findings
./gradlew :app:assembleDebug                   passing
./gradlew :dsm-android-radio-bridge:externalNativeBuildDebug  passing (4 ABIs)
```

The Android command compiled the Expo application and the autolinked `dsm-android-radio-bridge` module. It is build evidence, not proof that a particular handset advertises, scans, accepts GATT connections or survives screen-off restrictions.

## Delivered

- One canonical, deterministic packet codec and one validation ingress across local creation, BLE/Classic, gateway download and Tier 2 recovery.
- Self-contained Tier 2 frames containing complete canonical packet bytes. The independent receiver decodes without reconstructing data from a campaign draft.
- Vendored WavePX transmitter and receiver with microphone input, WAV input, WAV export, playback, raw disaster frames, CRC/reassembly, exact byte comparison and persisted evidence. ggwave remains WavePX's physical modem only.
- Modular centre operations for create, open, close, move/edit and reopen. The full packet → WavePX → recovered canonical packet → typed map-operation path is integration-tested and feeds the mobile map.
- Android BLE preferred transport with filtered scan, advertise, GATT client/server, notification subscription, negotiated-MTU enforcement, callback-confirmed serialized writes and a stoppable foreground relay; automatic Bluetooth Classic RFCOMM fallback when BLE roles are unavailable.
- Mobile `expo-sqlite` persistence, stable local identities, restart-safe incident/sequence recovery, bounded packet storage, SOS/update/cancel packets, relay start on SOS, responder transitions, priority notifications and runtime-fed incident/resource/diagnostic lists.
- MapLibre mobile map with GPS, filters and a Mumbai operational registry. The Mumbai basemap downloads once while internet is available and remains in MapLibre's persistent native offline database for subsequent no-network use.
- Home status for relay, selected radio, peer count, battery percentage, battery-sensor temperature when available, thermal throttling and proven gateway.
- Conditional two-way gateway wiring. Set `EXPO_PUBLIC_DSM_BACKEND_URL` to the backend origin; only a successful identity probe permits upload. The foreground app synchronizes immediately and every 30 seconds, while downloaded packets re-enter validation, SQLite persistence, map projection and relay.
- Backend and admin console for incident coordination, responder lifecycle, regional publishing, campaign approval, audio transmission/reception and locally stored packet evidence.
- Android WavePX listener with explicit start/stop, a 120-second bound, microphone permission, native 48 kHz PCM capture, four-ABI native decoder build, frame metrics and canonical packet-to-map ingestion.
- Integrated campaign desk showing the decoded message, canonical packet bytes and expected map impact before WavePX generation, local decode testing or transmission.
- Mobile received-packet ledger showing the decoded message, ingest outcome and exact map impact, with direct navigation to the changed map object and SQLite-backed recovery across restarts.
- Safety check-in campaigns composed on the website, decoded by the WavePX phone receiver, and answered through Tier 1 Bluetooth mesh plus an optional gateway; automated acceptance evidence enforces the one-way Tier 2 boundary.
- One national deployment contract shared by backend, web and Android, with Mumbai (`IN-MH`) as the current operational region and matching baseline object IDs, labels, coordinates and states.
- Truthful delivery semantics. A direct receipt means another phone stored a copy; it does not mean rescue is coming. Neither mobile nor web claims to follow a packet globally after it leaves an observed device.
- “People on the mesh” peer list and addressed chat: outgoing messages are validated and saved to SQLite before relay, incoming conversations are rebuilt from the packet log after restart, gateway upload is disabled, and a deterministic three-phone simulation proves store-carry-forward delivery through an intermediate node.
- Minimal direct offline guidance across map, resource detail and responder incident surfaces. Users can select two map points or navigate from live GPS to a selected operational object; distance and bearing update locally, and the UI explicitly says the line is not a verified road route.
- Offline mesh chat carries the sender's bounded display name and supports deliberate GPS location messages. Shared locations open on the map and are rebuilt from the durable packet log after restart.
- Diagnostics provides a confirmed local-history reset for stored packets, prior SOS/chat views, shared-location markers, peers and received files. It only clears this phone and cannot recall packets already relayed elsewhere.
- The responder flow now emits a self-assignment before accept/decline, enforces the active responder runtime role, prevents duplicate button submissions, and projects accept, decline, en-route, arrival and resolution evidence back into the SOS owner's timeline. Nearby person cards show persisted unread-chat counts.

## Explicitly deferred or unmeasured

- A public MapLibre-compatible style is the hackathon default and can be replaced with `EXPO_PUBLIC_DSM_MAP_STYLE_URL`; production/national deployment still needs an authority-approved or self-hosted tile service and licence review.
- No physical Android or website-speaker-to-phone WavePX trial was possible in this environment. Range, success rate, background survival, battery cost and manufacturer behaviour are therefore unmeasured.
- Mumbai seed records are development data, not an official facility registry.
- The prototype has strict parsing and integrity checks, but not production identity verification or end-to-end cryptographic authority.
- Mesh chat is bounded plaintext in this prototype, not end-to-end encrypted; relay phones can retain chat packets until expiry, and physical two-phone chat remains part of the unmeasured Android radio trial.

See [FEATURE-MATRIX.md](FEATURE-MATRIX.md) for the complete remaining list and [WEB-CONSOLE.md](WEB-CONSOLE.md) for the operator flow.
