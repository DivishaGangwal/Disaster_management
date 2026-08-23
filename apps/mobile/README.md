# @dsm/mobile — Android app (Workstream A)

React Native + Expo. **DEC-003** confirms the stack; **DEC-004** is the part that
trips people up:

| Runtime | Transport | What you can build |
|---|---|---|
| **Stock Expo Go** | `simulated` | All routes, navigation, SOS creation, SQLite state, projected-object list and diagnostics. The graphical map stays a placeholder. |
| **Expo development build** | `native-ble` or `native-classic` | The judged Tier 1 runtime. BLE is preferred; Classic is selected when BLE roles are unavailable. Includes the foreground relay service. |

Both drive the identical `NodeEngine`. The only thing that changes is which
`TransportAdapter` gets injected in `src/services/app-runtime.ts`.

> Never claim stock Expo Go runs the real Bluetooth mesh (working rule 11).
> The readiness screen renders `simulated: true` verbatim for exactly this reason.

## Run in Expo Go (no Android toolchain)

```bash
npm install && npm run build
```

```bash
cd apps/mobile && npm install && npx expo start
```

## Build the dev build (Workstream B)

```bash
cd apps/mobile && npx expo prebuild --platform android && npx expo run:android
```

Set `EXPO_PUBLIC_DSM_BACKEND_URL` to the coordination backend origin to enable
the live-probed mesh-to-network and network-to-mesh gateway cycle.

The admin web console uses WavePX for microphone reception, WAV recovery,
playback and export. The Android development build includes a bounded WavePX
`AudioRecord` receiver whose recovered raw frames enter `Tier2Receiver` and the
same `NodeEngine.ingest()` path as Bluetooth. Accepted packets and their map
objects are stored in SQLite; the receiver screen shows the decoded message and
typed map impact and can open the changed object on the live map. Physical
acoustic reliability is still unmeasured and must not be claimed from build
evidence alone.

## Rules for this app

1. Screens call `AppRuntime`. They never import a transport, codec, or repository.
2. Delivery states use `DELIVERY_STATE_COPY` from `@dsm/contracts`. Do not invent
   softer wording — a link receipt is not "help is coming" (DEC-022, SOS-008).
3. Source labels use `SOURCE_LABEL_COPY` from `@dsm/validator`. Nothing says
   "verified" (INT-004).
4. `src/screens/screen-registry.ts` is the checklist. Update a screen's `status`
   in the same PR that builds it.
