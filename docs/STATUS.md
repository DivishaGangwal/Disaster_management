# Implementation status

Updated 2026-08-23. This is an implementation report, not a real-device certification.

The file-by-file implementation record for this pass is in
[IMPLEMENTATION-CHANGES-2026-08-23.md](IMPLEMENTATION-CHANGES-2026-08-23.md).

## Verified in this pass

```text
npm test                                      74/74 passing
npm run build                                 strict TypeScript build passing
npm run typecheck --workspace @dsm/mobile     passing
npm run web:build                             passing
npm run boundaries                            passing
npm run fuzz                                  4,005 runs, 0 findings
./gradlew :app:compileDebugKotlin              passing
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
- MapLibre mobile map with GPS, filters and an Assam operational registry. The Assam basemap downloads once while internet is available and remains in MapLibre's persistent native offline database for subsequent no-network use.
- Home status for relay, selected radio, peer count, battery percentage, battery-sensor temperature when available, thermal throttling and proven gateway.
- Conditional two-way gateway wiring. Set `EXPO_PUBLIC_DSM_BACKEND_URL` to the backend origin; only a successful identity probe permits upload. The foreground app synchronizes immediately and every 30 seconds, while downloaded packets re-enter validation, SQLite persistence, map projection and relay.
- Backend and admin console for incident coordination, responder lifecycle, regional publishing, campaign approval, audio transmission/reception and locally stored packet evidence.
- Android WavePX listener with explicit start/stop, a 120-second bound, microphone permission, native 48 kHz PCM capture, four-ABI native decoder build, frame metrics and canonical packet-to-map ingestion.
- Integrated campaign desk showing the decoded message, canonical packet bytes and expected map impact before WavePX generation, local decode testing or transmission.
- Mobile received-packet ledger showing the decoded message, ingest outcome and exact map impact, with direct navigation to the changed map object and SQLite-backed recovery across restarts.
- Truthful delivery semantics. A direct receipt means another phone stored a copy; it does not mean rescue is coming. Neither mobile nor web claims to follow a packet globally after it leaves an observed device.

## Explicitly deferred or unmeasured

- A public MapLibre-compatible style is the hackathon default and can be replaced with `EXPO_PUBLIC_DSM_MAP_STYLE_URL`; production/national deployment still needs an authority-approved or self-hosted tile service and licence review.
- No physical Android or website-speaker-to-phone WavePX trial was possible in this environment. Range, success rate, background survival, battery cost and manufacturer behaviour are therefore unmeasured.
- Assam seed records are synthetic development data, not an official facility registry.
- The prototype has strict parsing and integrity checks, but not production identity verification or end-to-end cryptographic authority.

See [FEATURE-MATRIX.md](FEATURE-MATRIX.md) for the complete remaining list and [WEB-CONSOLE.md](WEB-CONSOLE.md) for the operator flow.
