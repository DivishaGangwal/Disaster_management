# Workstreams — who owns what, and how to not block each other

Six workstreams from `agent-reference/03-HACKATHON-BUILD-PLAN-AND-ACCEPTANCE.md`.
One person may own more than one, but **every artifact has one primary owner and
one integration reviewer**.

Ownership is enforced by `.github/CODEOWNERS`. Replace the `@ws-*` placeholders
with real GitHub usernames before the first PR.

## The table

| WS | Owns | Directories | Can start now? |
|---|---|---|---|
| **A** | Product/domain + mobile app | `apps/mobile/`, `packages/incident/`, `packages/policy/` | ✅ Yes — simulated adapter, no Android needed |
| **B** | Native Android Bluetooth + lifecycle | `native/`, `packages/transport-core/` | ✅ Implemented and compile-checked; handset evidence remains |
| **C** | Protocol, persistence, routing, simulator | `packages/codec/`, `validator/`, `store/`, `routing/`, `simulator/`, `node-runtime/` | ✅ Core, mobile SQLite and fuzzing are built |
| **D** | Offline map + regional data | `packages/mapkit/`, `content-packs/` | ✅ Yes — projection works; real city pack remains |
| **E** | Backend + authority/broadcaster web | `apps/backend/`, `apps/web-*/`, `packages/gateway-client/` | ✅ Integrated console and two-way gateway built |
| **F** | ggwave, QA, evidence, demo | `packages/tier2/`, `tools/ggwave-artifact/`, `evidence/` | ✅ Browser microphone/WAV paths built; physical evidence remains |

**Nobody is blocked on anybody.** That was the point of this pass.

## How parallel work stays safe

1. **Work inside your CODEOWNERS paths.** Editing someone else's path needs
   their review.
2. **Never edit `packages/contracts` casually.** It is frozen behind gates —
   see `CONTRACT-FREEZE.md`. That one directory is what six people share.
3. **Run the checks before you push:**
   ```bash
   npm run build && npm test && npm run boundaries
   ```
4. **Update the registries you touch.** `apps/mobile/src/screens/screen-registry.ts`
   and `apps/web-authority/src/surface-registry.ts` carry a `status` field. Move
   it from `scaffold` in the same PR that builds the thing.
5. **Label your evidence.** Working rule 10 is binding: static check, simulator
   run, and real-device result are three different claims. Say which one you have.

## Per-workstream starting point

### A — mobile
`apps/mobile/src/screens/screen-registry.ts` lists all 12 required routes and
their current complete/partial status. The existing layouts are wired through
`AppRuntime`; the graphical map and Android acoustic receiver remain explicit
partials rather than simulated success.

Use `DELIVERY_STATE_COPY` and `SOURCE_LABEL_COPY` for status text. Do not write
your own wording for delivery state — that is how truthfulness regressions
happen.

### B — native Android
The BLE/Classic `TransportAdapter` and foreground service are implemented in
`native/android-radio-bridge/` and compile in the generated Expo Android app.
The remaining native task is an Android PCM/ggwave receiver if on-phone Tier 2
reception is required, followed by real-device evidence.

First deliverable is the **device capability matrix** — it decides whether DEC-006
(Bluetooth Classic contingency) gets triggered, and that call has a deadline.

### C — protocol/persistence/routing
The codec, validator, policy engine, routing, simulator, mobile SQLite adapters
and malformed-input fuzz runner are built and green. Golden vector artifacts
and a full measured packet-size sheet remain release evidence work.

### D — offline map + regional data
`MapProjection`, `toMapOperations`, and create/open/close/move/reopen centre
flows are done and integration-tested through ggwave recovery. The graphical
mobile renderer, licensed base map, provenance note and sourced registry remain.

### E — backend + web
Backend services, the gateway loop, dedup, observations, outbound queue,
integrated React console, campaign approval, centre editor and responder roster
are built and tested.

### F — ggwave + QA
The Tier 2 frame codec, independent receiver, campaign planner, browser ggwave
generation, microphone/WAV recovery and decode-before-broadcast comparison are
done. Physical acoustic measurements and the optional Android PCM decoder remain.

## The five gates

Nothing crosses a gate without the owners in `CODEOWNERS` agreeing. See
`CONTRACT-FREEZE.md` for the current state of each.

| Gate | Blocks | Status |
|---|---|---|
| I — packet contract | real transport integration | **frozen** |
| II — native bridge contract | UI depending on native events | **frozen** |
| III — map operation contract | authority/Tier 2 updates | **frozen** |
| IV — gateway contract | dashboard integration | **frozen** |
| V — campaign contract | generating final audio | **frozen** |

All five are frozen in code as of this first pass. That is deliberate: it is what
lets six workstreams start simultaneously. Unfreezing one is a decision, not an
accident.
