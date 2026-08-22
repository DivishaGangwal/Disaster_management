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
| **B** | Native Android Bluetooth + lifecycle | `native/`, `packages/transport-core/` | ✅ Yes — contract is frozen, reference impl exists |
| **C** | Protocol, persistence, routing, simulator | `packages/codec/`, `validator/`, `store/`, `routing/`, `simulator/`, `node-runtime/` | ✅ Yes — core is built; SQLite + fuzzing remain |
| **D** | Offline map + regional data | `packages/mapkit/`, `content-packs/` | ✅ Yes — projection works; real city pack remains |
| **E** | Backend + authority/broadcaster web | `apps/backend/`, `apps/web-*/`, `packages/gateway-client/` | ✅ Yes — services + gateway loop tested; UI remains |
| **F** | ggwave, QA, evidence, demo | `packages/tier2/`, `tools/ggwave-artifact/`, `evidence/` | ✅ Yes — frame codec + receiver done; real audio remains |

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
Start at `apps/mobile/src/screens/screen-registry.ts`. It lists all 13 required
screens with the exact elements each must show and the requirement IDs behind
them. Build against `AppRuntime` with `adapter: 'simulated'` — you get real
packets, real policy decisions, and a real incident timeline in Expo Go.

Use `DELIVERY_STATE_COPY` and `SOURCE_LABEL_COPY` for status text. Do not write
your own wording for delivery state — that is how truthfulness regressions
happen.

### B — native Android
Start at `native/android-radio-bridge/README.md`. The session state machine,
relay loop, backoff, and discovery-payload construction are already written and
tested. You implement `TransportAdapter` and `AudioInputAdapter`, and nothing else.

First deliverable is the **device capability matrix** — it decides whether DEC-006
(Bluetooth Classic contingency) gets triggered, and that call has a deadline.

### C — protocol/persistence/routing
The codec, validator, policy engine, routing, and simulator are built and green
(30 tests). Remaining: the expo-sqlite repository behind the existing
`PacketRepository` port, a malformed-input fuzz corpus, golden vectors committed
as files, and the packet-size evidence sheet.

### D — offline map + regional data
`MapProjection` and `toMapOperations` are done and idempotent. Remaining: the
real one-city pack, the base map artifact, provenance/licence note, and the
compact ID registry. `tools/seed/src/demo-pack.ts` shows the shape — replace the
synthetic data, keep the structure.

### E — backend + web
Backend services, the gateway loop, dedup, observations, and the outbound queue
are built and tested (6 tests, including GTW-003 and idempotent retries).
Remaining: the two React dashboards, the campaign approval workflow UI, and the
responder roster.

### F — ggwave + QA
The Tier 2 frame codec, receiver state machine, campaign planner, and the
mic/direct equivalence proof are done. Remaining: actual ggwave audio
generation, the reproducible artifact package, the decode-before-broadcast tool,
and the evidence bundle.

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
