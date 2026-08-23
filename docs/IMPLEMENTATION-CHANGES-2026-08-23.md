# Implementation Changes — 2026-08-23

This document records the implementation work completed in the
`Disaster_management` checkout on 2026-08-23. It distinguishes delivered code,
verification evidence, remaining external work, and pre-existing workspace
changes that were preserved.

## Scope and product decisions

- The mobile product remains a national disaster application with the current
  operational focus on Assam (`IN-AS`).
- Tier 1 remains bidirectional Bluetooth phone-to-phone communication. The
  existing `TransportAdapter`, `AppRuntime`, packet, policy, repository, and UI
  contracts were preserved.
- Internet is required only for the initial offline-map download or an optional
  proven gateway. SOS creation, local storage, map viewing after download,
  Bluetooth relay, and responder actions do not require internet.
- ggwave remains Tier 2. It was not introduced as a phone-to-phone fallback.
- Accessibility, privacy, and broader production-security work were explicitly
  outside this implementation pass.

## 1. Assam mobile map and offline basemap

### Persistent offline-map service

Added `apps/mobile/src/services/offline-map.ts`.

- Uses MapLibre's native `OfflineManager` rather than a UI placeholder.
- Defines a persistent pack named `assam-operational-basemap-v1`.
- Covers Assam bounds from approximately 89.65°E–96.15°E and
  24.09°N–28.20°N.
- Downloads zoom levels 5–12.
- Uses one style URL for online rendering and offline-pack creation so the map
  does not switch visual/data sources when connectivity disappears.
- Defaults to `https://tiles.openfreemap.org/styles/liberty` for the hackathon.
- Supports replacement through `EXPO_PUBLIC_DSM_MAP_STYLE_URL` for an approved
  or self-hosted production map service.
- Reports actual percentage, completed bytes, and completed resource count.
- Detects an existing native pack after application restart.
- Clearly rejects native pack download in stock Expo Go, where the required
  native MapLibre module is unavailable.

### Map screen integration

Updated `apps/mobile/app/(tabs)/map.tsx`.

- Replaced direct online OpenStreetMap raster tiles with the shared MapLibre
  style URL used by the offline pack.
- Retained the existing GPS tracking, location permission handling, layer
  filters, marker selection, list view, camera framing, and resource navigation.
- Kept attribution enabled.
- Preserved the existing map-screen work already present in the working tree;
  this pass changed its basemap source rather than replacing the screen.

### Profile/offline-data screen

Updated `apps/mobile/app/(tabs)/profile.tsx`.

- Replaced generic north/south/east/west district choices with Assam-focused
  regions: Assam Statewide, Brahmaputra Valley, Barak Valley, Upper Assam,
  Lower Assam, and Dima Hasao & Karbi Anglong.
- Replaced the former placeholder alert with a real download/update action.
- Shows download progress, stored size, resource count, ready state, and errors.
- Explains that the pack is downloaded once with internet and then remains in
  persistent phone storage for offline use.
- Marks the Profile screen complete in
  `apps/mobile/src/screens/screen-registry.ts`.

### Persisted UI state and migration

Updated `apps/mobile/store/useAppStore.ts`.

- Default region changed from Mumbai Metropolitan Region to Assam Statewide.
- Added a Zustand persistence migration that replaces old Mumbai or generic
  district values on existing installs.
- Added truthful pack states: checking, downloading, ready, not downloaded,
  and error.
- Added pack progress, byte count, resource count, and atomic snapshot updates.
- Persisted active SOS identity and active status as a fast UI mirror; the
  durable packet log remains authoritative.

## 2. Assam operational content pack

Added `packages/mapkit/src/assam-pack.ts` and exported it from
`packages/mapkit/src/index.ts`.

- Defines a typed `IN-AS` content pack.
- Adds 23 Assam-focused baseline objects and four regional corridors.
- Includes demo shelters, medical posts, food/water points, safe zones, help
  desks, state/regional references, guides, and an offline check-in form.
- Covers Guwahati, Silchar, Dibrugarh, Jorhat, Tezpur, Nagaon, Dhubri,
  Kaziranga, Haflong, Diphu, Barpeta, North Lakhimpur, and Karimganj references.
- Adds English, Assamese, Bengali, and Hindi prepared phrases.
- Labels every operational facility as demo data and records that coordinates
  are approximate city/district anchors, not an authority-issued register.

Updated the content-pack contract and projection:

- `packages/contracts/src/content-pack.ts` now exposes baseline objects and
  routes through `ObjectResolver`.
- `packages/mapkit/src/content-pack.ts` implements those baseline accessors.
- `packages/mapkit/src/projection.ts` paints base-pack resources, content, and
  routes before any mesh delta arrives.
- Packet deltas still use the same deterministic projection and can update or
  supersede baseline records without creating a second map model.

Added `packages/mapkit/src/assam-pack.test.ts` to verify that the Assam pack
produces a populated base-pack projection with Assam labels and routes.

## 3. Restart-safe SOS and incident recovery

Updated `packages/node-runtime/src/node-engine.ts`.

- Startup replay now rebuilds both the map projection and incident reducer from
  every durable packet.
- Reclaims incident ownership for locally created SOS streams.
- Calculates the maximum local source sequence found in storage.
- Selects the latest locally owned, non-terminal incident as the active SOS.
- Returns the recovered sequence and incident identity to the mobile runtime.

Updated `apps/mobile/src/services/mobile-controller.ts`.

- Passes the Assam `PackResolver` into `AppRuntime`.
- Restores the active SOS and sequence before accepting a new SOS update or
  cancel action.
- Runs storage/peer/incident maintenance at startup.
- Refreshes native offline-map status during initialization.
- Exposes controller methods for refreshing and downloading the offline map.
- Preserves the existing improved best-effort location flow: recent cached GPS
  first, then an eight-second high-accuracy location attempt.

Result: restarting the process no longer loses the active incident identity or
reuses an old source sequence.

## 4. SQLite correctness and storage bounds

Updated `apps/mobile/src/services/sqlite-repositories.ts`.

- Fixed recent-peer listing: a peer must now be newer than the retention cutoff
  and not dated in the future.
- Enforces the configured maximum packet count after expired-packet eviction.
- When full, evicts the lowest-priority, oldest eligible packet.
- Protects locally created custody records and response-control/critical
  traffic from pressure eviction.
- Keeps the seen-packet record after payload eviction so duplicates remain
  suppressed.
- Throws rather than silently exceeding capacity when non-critical incoming
  data has no safe eviction candidate.
- Relay and upload selection now examine the complete bounded packet table,
  preventing eligible newer records from being hidden behind an arbitrary
  `limit * 4` prefix.

## 5. Android Bluetooth/GATT reliability

Updated
`native/android-radio-bridge/android/src/main/java/com/dsm/radio/AndroidRadioBridgeModule.kt`.

### Session establishment

- Added a 15-second BLE setup timeout.
- Requests MTU before service discovery, with a discovery fallback when the MTU
  request cannot start.
- Records the actual negotiated MTU per session.
- Requires the peer DSM service, TX characteristic, and CCCD descriptor.
- Enables local characteristic notifications and writes the CCCD subscription.
- Resolves `openSession` only after Android confirms descriptor subscription.
- Rejects pending sessions cleanly on timeout, disconnect, missing service, or
  notification-subscription failure.

### Record transmission

- Changed native `sendRecord` to return a Promise that represents the native
  operation rather than optimistic queueing.
- Enforces the negotiated GATT payload budget (`MTU - 3`).
- Adds one serialized write queue per session because Android GATT permits only
  one active operation at a time.
- Client writes complete through `onCharacteristicWrite`.
- Server notifications complete through `onNotificationSent`.
- Emits `record-sent` and resolves the Promise only after Android reports
  success.
- Rejects active and queued writes when a session disconnects or the relay is
  stopped.
- Retains bounded, length-prefixed Bluetooth Classic writes and resolves them
  after stream flush.

### Server receive path

- Tracks server-side connections and negotiated MTU.
- Rejects prepared writes, non-zero offsets, wrong characteristics, and values
  larger than the current payload budget.
- Returns an appropriate GATT status instead of acknowledging invalid writes.

### Cleanup

- Session close is idempotent.
- Clears MTU, timeout, pending-session, write-queue, GATT, socket, peer, and
  device state.
- Prevents duplicate session-closed events after native callbacks race with an
  explicit close.

## 6. Foreground relay Stop behavior

Updated
`native/android-radio-bridge/android/src/main/java/com/dsm/radio/RelayForegroundService.kt`.

- The notification Stop action now sends an application-scoped relay-stop
  broadcast.
- The Expo module registers a non-exported receiver while relay mode is active.
- Pressing Stop tears down the Bluetooth relay resources as well as the
  notification service.
- The service now returns `START_NOT_STICKY`; it does not restart as a
  notification-only process and falsely imply that the JS/native relay was
  restored after process death.

## 7. Expo Router Android startup fix

Updated the root `package.json` scripts.

- Root `npm run start` now delegates to `@dsm/mobile`.
- Root `npm run android` now delegates to `@dsm/mobile`.
- Root `npm run ios` now delegates to `@dsm/mobile`.

Root cause: running `expo run:android` from the repository root made Metro use
`node_modules/expo/AppEntry.js`, which searched for a nonexistent root `App`.
The actual application is an Expo Router project under `apps/mobile`, whose
entry point is `expo-router/entry`.

Operational cleanup performed:

- Removed the stale Watchman project watch and recreated it with the `fsevents`
  watcher, clearing the recrawl warning.
- Stopped the stale root Metro process that was holding port 8081.
- Rebuilt and installed the correct APK from
  `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
- Opened the corrected development-client scheme
  `com.dsm.disastersosmesh://...` on `test_device`.
- Confirmed Metro bundled `node_modules/expo-router/entry.js` successfully:
  3,460 modules in approximately 3.3 seconds.

## 8. Documentation synchronized with implementation

Updated:

- `README.md`
- `docs/STATUS.md`
- `docs/FEATURE-MATRIX.md`
- `docs/WEB-CONSOLE.md`
- `docs/WORKSTREAMS.md`
- `content-packs/README.md`
- `native/android-radio-bridge/README.md`

The documents now describe the implemented Assam map/download, restart-safe SOS
recovery, callback-confirmed GATT writes, real foreground Stop behavior, current
test count, and production map-data caveats. Stale claims that the mobile map is
a placeholder were removed.

## 9. Verification evidence

The following checks passed after implementation:

```text
npm test                                      68/68 passing
npm run typecheck                             passing
npm --workspace apps/mobile run typecheck     passing
npm run boundaries                            passing
npm run web:build                             passing
npm run fuzz                                  4,005 cases, 0 findings
./gradlew :app:compileDebugKotlin              passing
npx expo export --platform android             passing
npm run android                               build/install/bundle passing
git diff --check                              passing
```

The Android build autolinked the DSM radio bridge and MapLibre module. The Expo
Android export produced a 6.54 MB Hermes bundle. The live development build
installed and executed application code on the emulator.

## 10. Nonfatal warnings observed

- MapLibre logged `Invalid geometry in line layer`. The app continued running;
  this is unrelated to the fixed Expo entry-point failure and should be traced
  to a specific route/line geometry separately.
- Expo recommends adding `userInterfaceStyle` to the mobile app configuration.
- Several Expo/native dependencies and one backward-compatible Bluetooth
  callback use deprecated Android APIs. They compile successfully but should be
  revisited during a future Expo/Android upgrade.

## 11. Remaining work not claimed as complete

1. Perform physical two-phone BLE and Bluetooth Classic transfer tests.
2. Measure screen-off/background survival across the selected Android devices.
3. Download the Assam pack on a physical phone, enable airplane mode, restart
   the app, and record offline-render evidence.
4. Replace synthetic Assam facilities with an authority-issued, sourced
   registry before public deployment.
5. Replace the hackathon map host with an authority-approved or self-hosted
   MapLibre style before national distribution.
6. Implement Android `AudioRecord` to ggwave decoding only if on-phone Tier 2
   acoustic reception is required. Browser microphone and WAV recovery already
   exist.
7. Implement the literal `PACKET_REQUEST` round trip if the documented HD-001
   deviation is reversed. Current filtered inventory transfer already provides
   missing-only exchange behavior.
8. Production authentication, cryptographic authority, accessibility, privacy,
   and security hardening were not part of this pass.

## 12. Pre-existing workspace changes preserved

The worktree was already dirty. Existing user changes were preserved rather
than reverted or overwritten, including:

- the expanded mobile map screen and location behavior;
- root dependency additions and lockfile changes;
- untracked `.agents/`, `.codex/`, `app.json`, and `tsconfig.json` files;
- generated Android build directories.

No commit or push was performed as part of this implementation work.
