# Disaster SOS Mesh

An Android emergency communication system that lets phones exchange and relay
compact disaster packets over Bluetooth when towers, Wi-Fi, and internet service
are unavailable — optionally bridging through any phone that later finds usable
internet, and receiving compact authority information from prepared radio audio
over a separate ggwave Tier 2 path.

Smart India Hackathon prototype. **Not a production emergency service.**

## Start here

| You are | Read |
|---|---|
| New to the project | `docs/agent-reference/01-PRODUCT-DECISIONS-AND-SCOPE.md` |
| Picking up a workstream | `docs/WORKSTREAMS.md` |
| About to write code | `docs/MODULE-BOUNDARIES.md` |
| Wondering what's left | `docs/FEATURE-MATRIX.md` — per-feature status + why it isn't working |
| Building against the backend | `docs/API-SCHEMA.md` |
| Wanting the summary view | `docs/STATUS.md` |
| Changing a shared type | `docs/CONTRACT-FREEZE.md` |

The four specification documents in `docs/agent-reference/` are **binding**, in
that precedence order. If code and spec disagree, the spec wins.

## Quick start

```bash
npm install
```

```bash
npm run build && npm test && npm run boundaries
```

Run the mobile app in Expo Go — no Android toolchain needed:

```bash
cd apps/mobile && npm install && npx expo start
```

Run the coordination backend:

```bash
cd apps/backend && node dist/main.js
```

## About React Native, Expo, and Expo Go

The stack is **React Native + Expo** (DEC-003). But there are two runtimes, and
the difference matters (DEC-004):

| Runtime | Transport | What works |
|---|---|---|
| **Stock Expo Go** | simulated | Every screen, the offline map, SOS creation, incident timelines, policy and diagnostics output |
| **Expo development build** | native BLE | The judged runtime: real advertise/scan/GATT, foreground relay, ggwave microphone |

Real Bluetooth needs native code that is not in the Expo Go binary. Both runtimes
drive the identical engine; only the injected `TransportAdapter` changes. So UI,
domain, and map work never waits on the Android build.

**The demo must never claim stock Expo Go runs the real Bluetooth mesh.** The
capability report carries `simulated: true` and the readiness screen shows it.

## Repository layout

```
docs/agent-reference/   the four binding specification documents
docs/                   ownership, boundaries, gates, status

packages/
  contracts/            FROZEN shared surface — types, registries, limits. Zero deps.
  codec/                typed packets <-> canonical bytes (64-byte envelope)
  validator/            the one 15-gate validation pipeline
  store/                persistence ports + in-memory implementation
  policy/               six independent decisions per packet
  incident/             incident timeline and delivery facts
  mapkit/               offline content pack + deterministic map projection
  routing/              relay scheduler, copy budgets, session state machine
  transport-core/       TransportAdapter seam + simulated adapter
  tier2/                ggwave Tier 2: frames, receiver, campaign planner
  gateway-client/       live probe + bidirectional sync
  node-runtime/         composition root: one phone's engine
  simulator/            deterministic multi-node scenarios

apps/
  mobile/               React Native + Expo Android app
  backend/              coordination backend (node:http, zero deps)
  web-authority/        authority + coordinator dashboard
  web-broadcaster/      radio broadcaster dashboard

native/
  android-radio-bridge/ the Expo native module (Workstream B)

tools/
  seed/                 synthetic demo pack and actors
  boundaries/           the architecture check that runs in CI
  ggwave-artifact/      radio program generation
```

## The rules that make this work with many people

1. **`packages/contracts` is frozen behind gates.** It is the one thing everyone
   shares. Changing a numeric code or interface shape is a process, not an edit.
2. **Arrows point down.** A package imports only from its allowed list.
   `npm run boundaries` fails the build otherwise.
3. **The domain does not know about the radio.** No Bluetooth, Expo, or ggwave
   reference may appear in `incident`, `mapkit`, `policy`, or `store`.
4. **One ingress for every transport.** Tier 1, gateway, and Tier 2 all enter
   through `NodeEngine.ingest()`. The backend gets no privileged path.
5. **Be truthful in the UI.** A link receipt is not rescue progress (DEC-022).
   Demo-provisioned is not verified (INT-004). The boundary check greps for both.
6. **Label your evidence.** Static check, simulator run, and real-device result
   are three different claims (working rule 10).

## What this prototype does not claim

- That towers or internet are required for the core product.
- That Bluetooth is a continuous, always-connected network.
- Any guaranteed range or guaranteed delivery.
- That stock Expo Go provides full BLE mesh access.
- That every Android device behaves identically in the background.
- That a link receipt is a responder or authority acknowledgement.
- That ggwave carries maps, large media, or normal conversation efficiently.
- Production-grade authentication, encryption, or verified identities.

Current build state, with honest evidence labels, is in `docs/STATUS.md`.
