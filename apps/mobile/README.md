# @dsm/mobile — Android app (Workstream A)

React Native + Expo. **DEC-003** confirms the stack; **DEC-004** is the part that
trips people up:

| Runtime | Transport | What you can build |
|---|---|---|
| **Stock Expo Go** | `simulated` | Every screen, all navigation, the offline map, SOS creation, incident timelines, policy/diagnostics output. No Android build needed. |
| **Expo development build** | `native-ble` | The judged runtime. Real BLE advertise/scan/GATT, foreground relay service, ggwave microphone. |

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

## Rules for this app

1. Screens call `AppRuntime`. They never import a transport, codec, or repository.
2. Delivery states use `DELIVERY_STATE_COPY` from `@dsm/contracts`. Do not invent
   softer wording — a link receipt is not "help is coming" (DEC-022, SOS-008).
3. Source labels use `SOURCE_LABEL_COPY` from `@dsm/validator`. Nothing says
   "verified" (INT-004).
4. `src/screens/screen-registry.ts` is the checklist. Update a screen's `status`
   in the same PR that builds it.
