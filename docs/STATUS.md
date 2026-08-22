# Implementation status

Updated 2026-08-23. This is an implementation report, not a real-device certification.

## Verified in this pass

```text
npm test                                      67/67 passing
npm run build                                 strict TypeScript build passing
npm run typecheck --workspace @dsm/mobile     passing
npm run web:build                             passing
npm run boundaries                            passing
npm run fuzz                                  4,005 runs, 0 findings
./gradlew :app:compileDebugKotlin              passing
```

The Android command compiled the Expo application and the autolinked `dsm-android-radio-bridge` module. It is build evidence, not proof that a particular handset advertises, scans, accepts GATT connections or survives screen-off restrictions.

## Delivered

- One canonical, deterministic packet codec and one validation ingress across local creation, BLE/Classic, gateway download and Tier 2 recovery.
- Self-contained Tier 2 frames containing complete canonical packet bytes. The independent receiver decodes without reconstructing data from a campaign draft.
- Browser ggwave/WavePX-style transmitter and receiver with microphone input, WAV input, WAV export, playback, CRC/reassembly, exact byte comparison and persisted evidence.
- Modular centre operations for create, open, close, move/edit and reopen. The full packet → ggwave → recovered canonical packet → typed map-operation path is integration-tested; the requested mobile map placeholder is unchanged.
- Android BLE preferred transport with filtered scan, advertise, GATT client/server and foreground relay; automatic Bluetooth Classic RFCOMM fallback when BLE roles are unavailable.
- Mobile `expo-sqlite` persistence, stable local identities, SOS/update/cancel packets, relay start on SOS, responder transitions, priority notifications and runtime-fed incident/resource/diagnostic lists.
- Home status for relay, selected radio, peer count, battery percentage, battery-sensor temperature when available, thermal throttling and proven gateway.
- Conditional two-way gateway wiring. Set `EXPO_PUBLIC_DSM_BACKEND_URL` to the backend origin; only a successful identity probe permits upload, and downloaded packets re-enter validation before relay.
- Backend and admin console for incident coordination, responder lifecycle, regional publishing, campaign approval, audio transmission/reception and locally stored packet evidence.
- Truthful delivery semantics. A direct receipt means another phone stored a copy; it does not mean rescue is coming. Neither mobile nor web claims to follow a packet globally after it leaves an observed device.

## Explicitly deferred or unmeasured

- The mobile graphical/offline map renderer and licensed basemap bundle are deferred by request. Projection and list data are working.
- Android on-phone ggwave microphone decoding is not present; browser microphone and WAV recovery are present. Add the native PCM/decoder bridge only if the phone itself must be the acoustic receiver.
- No physical Android or two-device acoustic trial was possible in this environment. Range, success rate, background survival, battery cost and manufacturer behaviour are therefore unmeasured.
- Assam seed records are synthetic development data, not an official facility registry.
- The prototype has strict parsing and integrity checks, but not production identity verification or end-to-end cryptographic authority.

See [FEATURE-MATRIX.md](FEATURE-MATRIX.md) for the complete remaining list and [WEB-CONSOLE.md](WEB-CONSOLE.md) for the operator flow.
