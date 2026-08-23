# Mesh Field Simulator

An interactive simulator for the Disaster SOS Mesh protocol. Place phones,
responders, an authority console, a radio station and a coordination centre on a
field; drag them in and out of range; send real packets and watch what the
protocol actually does with them.

It lives at `tools/mesh-simulator/`. It is not an npm workspace, it has no
runtime dependencies, and nothing in `packages/` or `apps/` imports it — the
arrow points one way, from this tool into the built packages.

## The important part: it is not a mock

`engine.js` is the **real** `@dsm` packages, bundled for the browser by esbuild
from the same compiled `dist/` output the Node tests and the backend run:

`contracts` · `codec` · `validator` · `policy` · `routing` · `store` ·
`incident` · `mapkit` · `transport-core` · `tier2` · `gateway-client` ·
`node-runtime`

…plus two modules straight from the Expo app source, so the page renders the
app's own words rather than a paraphrase of them:

- `apps/mobile/src/screens/screen-registry.ts` — the 13 required screens and
  their real `status`
- `apps/mobile/src/services/app-runtime.ts` — `describeCapabilities()`, the
  readiness-screen copy

So in the simulator:

- packets are built by the real builders and encoded by the real codec
- every arrival runs the real 15-gate `validate()` — over Bluetooth, over
  ggwave and over the gateway alike, because there is only one ingress
- the six store/display/alert/relay/upload/act decisions come from the real
  policy engine, with its real reason codes
- forwarding is scored by the real `forwardingUtility()`
- sessions run the real `RelayLoop` over the real `RadioMedium` and
  `SimulatedTransportAdapter`, through all eight phases
- Tier 2 uses the real `planCampaign()`, `toTier2Frames()` and `Tier2Receiver`
- the internet path runs the real `GatewaySynchronizer`, and internet state is
  tracked by the real `GatewayStateTracker`

`sim.js` is UI only. It never decides anything the protocol should decide.

## What it says about the phone app

The page is deliberately aligned with `apps/mobile`, because that is the part
people most easily overclaim:

- **Readiness tab** renders `describeCapabilities()` verbatim. Every phone in
  the simulator reports **Transport: SIMULATED (not real Bluetooth)**, because
  that is what `SimulatedTransportAdapter` actually returns (DEC-004, working
  rule 11).
- **Internet state** uses the frozen four-state vocabulary — `untested` /
  `unavailable` / `probing` / `proven` — and never the word "connected"
  (GTW-001).
- **Active SOS tab** uses `DELIVERY_STATE_COPY` from `@dsm/contracts` word for
  word, so a relay copy reads "Copied to nearby phones" and never "help is
  coming" (SOS-008, DEC-022).
- **Source labels** use `SOURCE_LABEL_COPY` from `@dsm/validator`. Nothing
  anywhere says "verified" (INT-004).
- **Roles** follow ROL-001/ROL-004: the app has exactly two local roles,
  `general-public` and `responder`. The authority console, radio station and
  coordination centre are labelled as **web roles**, so the page never implies
  the phone app can publish an official alert.
- **The Expo app pane** reads the screen registry live and reports the honest
  count — currently **0 of 13 screens built**, every one a `scaffold`. The
  engine underneath them is built, and is what this page runs.
- Inspector tabs are named after the real screens: Readiness, Diagnostics,
  Active SOS, Tier 2.

## Scenarios

Thirteen, in four groups. Each states what to watch for in the field header.

| Group | Scenario | The point |
|---|---|---|
| Relay shapes | Three-hop chain | A chain, not a clique — the responder has no direct link |
| | Store and carry | Custody travels with a phone, not over a link |
| | Dense cluster | Eight phones in range, and still barely any copies |
| | Ring | Two routes to the far side; the second arrival is a duplicate |
| Roles and policy | Two responders | `show-full` for responders, `show-minimal` for the public relay |
| | Flat battery in the middle | The SOS crosses; the shelter update does not |
| | Who said so | Same hazard, `Community reported` vs `Authority (demo-provisioned)` |
| The internet path | Two regions | Walk a phone into coverage and back with the acknowledgement |
| | Centre unreachable | Probes fail, nothing pretends the centre has seen it |
| | Bridge at the boundary | A chain long enough to span both regions unaided |
| The radio path | Radio into the mesh | One phone listens, everybody ends up with the alert |
| | Noisy broadcast | Frames fail CRC-16; interleaved repeats still finish the campaign |
| | Radio over the dark region | Tier 2 in, Tier 1 across the boundary |

Every one of these was run and its claim checked against the engine's own state
before it shipped.

## The three substitutions, stated plainly

1. **`node:crypto`** → `bundler/shim-crypto.mjs`, a synchronous SHA-256 plus
   `getRandomValues`. `build-engine.mjs` refuses to write the bundle unless the
   shim matches Node's own `createHash('sha256')` on seven test vectors.
2. **A mock coordination centre** implements the frozen `GatewayClient`
   interface. It revalidates every upload with the same validator the phones
   run and answers with real `BACKEND_ACKNOWLEDGEMENT` packets — but it is not
   `apps/backend`, and it has no database.
3. **Geography is invented.** Pixel positions, the ~1.1 m-per-unit scale, the
   two region rectangles, and the packet-flight animation are presentation. The
   distance maths that consumes them is the real policy engine's.

A `setImmediate` polyfill backed by `MessageChannel` is installed before the
engine loads. `RadioMedium.advance()` asks for `setImmediate` first and falls
back to `setTimeout(0)`, which browsers clamp to 4 ms — and to a full second in
a background tab. The polyfill gives it the unclamped macrotask it wants;
nothing about the engine changes.

## Known gap in the engine, visible here

Relays never increment the envelope's hop count. `incrementHopInPlace()` is
exported from `@dsm/codec` but its only caller in the repo is a codec unit test,
so `RelayLoop.pushOffers()` forwards stored bytes unchanged and `hopCount` stays
`0` on every node. Gate 8 (`gate.hop-limit`) is therefore unreachable in the
live mesh, and replication is bounded only by copy budgets, cooldowns and
inventory filtering — which do work. Open any relayed packet's envelope in the
Packet tab and read offset 41 to see it. There is no hop-limit scenario in the
list above for exactly this reason.

## Files

| File | What it is |
|---|---|
| `mesh-simulator.html` | **The deliverable.** One self-contained file. Double-click it. |
| `index.html` | Page shell and styles (loads `engine.js` and `sim.js`). |
| `sim.js` | The simulator UI. |
| `engine.js` | Generated. The real packages plus the two mobile modules, bundled. |
| `build-engine.mjs` | Bundles them; verifies the crypto shim; smoke-tests the result. |
| `bundler/shim-crypto.mjs` | Browser `node:crypto` stand-in. |
| `bundler/entry.mjs` | Bundle entry. Re-exports only. |
| `bundle.mjs` | Inlines `engine.js` + `sim.js` into `mesh-simulator.html`. |
| `serve.mjs` | Optional local server on :5188, for editing without re-bundling. |

## Rebuilding after the protocol or the app changes

From the repo root:

```bash
npm run build && node tools/mesh-simulator/build-engine.mjs && node tools/mesh-simulator/bundle.mjs
```

That rebuilds the packages, re-bundles the engine, and rewrites
`mesh-simulator.html`. If you want it as a script, add this to the root
`package.json`:

```json
"simulator": "node tools/mesh-simulator/build-engine.mjs && node tools/mesh-simulator/bundle.mjs"
``` The two `apps/mobile` files are pulled straight from
source, so the screen list and the readiness copy refresh as the app gets built —
no edit is needed here when a `status` changes.

`engine.js` and `artifact.html` are generated and git-ignored.
`mesh-simulator.html` is committed, so the demo works from a fresh clone with no
build step at all.

## Keyboard and console

`space` pause · `Delete` removes the selected device.

The live state is on `window.__sim`:

```js
__sim.world.nodes            // every device
__sim.world.backend          // the mock coordination centre
__sim.runAction(node, 'sos') // fire any action by hand
__sim.pauseLoop()            // stop the automatic clock
__sim.drive(40)              // then run exactly 40 steps
```
