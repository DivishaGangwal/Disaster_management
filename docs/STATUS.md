# Status — what the first pass built, and what remains

**As of the first pass.** Evidence types are labelled per working rule 10:
🟩 **static check** · 🟦 **simulator run** · 🟥 **real Android device**.

Nothing below claims real-device evidence, because no real device has been run
yet. That row is honest and stays honest until Workstream B measures it.

> Per-feature detail, including the **likely cause** for everything not working,
> is in [`FEATURE-MATRIX.md`](FEATURE-MATRIX.md). Backend endpoints are in
> [`API-SCHEMA.md`](API-SCHEMA.md).

## Verification the first pass actually has

```
npm run build      # all 15 TypeScript projects compile, strict mode
npm test           # 30 tests, 30 passing
npm run boundaries # dependency graph + domain isolation + truthful copy
```

| Suite | Tests | Evidence |
|---|---|---|
| Codec round-trip, determinism, malformed input | 16 | 🟩 |
| Acceptance scenarios A, B, C, G, H, J, K | 8 | 🟦 |
| Gateway loop, dedup, observations, retries | 6 | 🟦 |

## Built and working

### Protocol and engine — Workstream C
- **64-byte envelope** at the exact blueprint offsets, big-endian, CRC-32 header.
- **Deterministic payload codec** — canonical field ordering means the same
  logical packet always produces identical bytes on every device. Proven by test.
- **A compact SOS encodes to ≤160 bytes**, inside the engineering target.
- **All 33 message types** from the packet catalogue registered, with field maps.
  Nothing was dropped for being off the main demo path (working rule 7).
- **15-gate validation pipeline** with precise reason codes for every rejection.
- **Policy engine** producing six independent decisions per packet, each with a
  reason code.
- **Incident reducer** with latest-wins by source sequence, and separately tracked
  delivery facts (link receipts ≠ responder ≠ backend).
- **Routing**: bounded forwarding utility, copy budgets, queue fairness, reserved
  control capacity so files cannot starve an SOS.
- **In-memory store** implementing the persistence ports with real idempotency,
  conflict quarantine, and the documented eviction order.

### Offline map — Workstream D
- Deterministic, idempotent projection; 12 typed operations; tombstones;
  freshness classes; missing-object fallback; list equivalents.
- One translation point (`toMapOperations`) shared by Tier 1, gateway, and Tier 2.

### Tier 2 — Workstream F
- 12-byte compact frame (vs 64 for Tier 1) with CRC, fragmentation, reassembly.
- Receiver state machine with duplicate suppression and honest completeness.
- Campaign planner with interleaved repetition and byte/duration preview.
- **Mic and direct paths proven to recover byte-identical packets.**

### Gateway and backend — Workstream E
- Live probe with backend identity check (a captive portal cannot pass as proven).
- Priority-aware bounded upload; cursor advances only after confirmed response.
- Backend dedup: 2 gateways → 1 incident, 2 observations. Tested.
- Acknowledgement returned as its own packet through the mesh.

### Transport seam — Workstreams B + C
- `TransportAdapter` contract frozen; simulated adapter drives the full 8-phase
  bidirectional session; deterministic multi-node simulator with movement,
  loss, and latency.

## What remains, by workstream

### A — mobile app
- [ ] Build the 13 screens. `apps/mobile/src/screens/screen-registry.ts` lists
      every required element and its requirement ID.
- [ ] Navigation shell and role switching.
- [ ] Accessibility pass: large targets, no colour-only state, screen-reader
      labels, vibration alternatives, one-handed layout.
- [ ] Notification policy wiring (the table in `01-…`).
- [ ] Empty / loading / error / offline / stale states for every surface.

### B — native Android  ← **the critical path**
- [ ] The Expo module: BLE advertise, scan, GATT server + client.
- [ ] Foreground relay service with an ongoing notification and a stop route.
- [ ] Runtime capability and permission reporting.
- [ ] `AudioRecord` PCM bridge for ggwave.
- [ ] **Device capability matrix** on every demo phone.
- [ ] 🟥 One-hop real-device transfer evidence.
- [ ] 🟥 Screen-off / foreground-service evidence.
- [ ] **A dated go/no-go call on the Bluetooth Classic contingency (DEC-006).**

### C — protocol/persistence
- [ ] expo-sqlite repository behind the existing `PacketRepository` port.
- [ ] Migrations and restart/replay recovery.
- [ ] Malformed-input fuzz corpus (the codec has 200 structured-noise cases; a
      real corpus is bigger).
- [ ] Golden vectors committed as files, not only as assertions.
- [ ] Packet-size evidence sheet with measured bytes per type.

### D — offline map + regional data
- [ ] Select the actual city/region.
- [ ] Real base map artifact that renders offline.
- [ ] Real object registry with stable compact IDs.
- [ ] **Provenance and licence note** for the seed data.
- [ ] Replace `tools/seed/src/demo-pack.ts` — keep the structure, swap the data.

### E — backend + web
- [ ] Authority/coordinator dashboard (5 surfaces in `surface-registry.ts`).
- [ ] Broadcaster dashboard (4 surfaces).
- [ ] Campaign approval workflow UI over the existing state machine.
- [ ] Responder roster and assignment UI.
- [ ] Persistent storage (currently in-memory) and demo reset/seed endpoint.

### F — ggwave + QA + evidence
- [ ] Real ggwave encode/decode integration (frame format and receiver are done;
      the modem is not wired).
- [ ] Reproducible radio-program artifact package.
- [ ] Decode-before-broadcast tool comparing recovered vs expected.
- [ ] 🟥 Declared microphone setup and measured success rate.
- [ ] Battery and performance measurement.
- [ ] Failure-injection playbook and demo rehearsal.

## Acceptance scenarios A–K

| # | Scenario | Simulated | Real device |
|---|---|---|---|
| A | Offline three-hop SOS | 🟦 pass | ❌ WS-B |
| B | Local responder completion, no internet | 🟦 pass | ❌ WS-B |
| C | Store-carry-forward | 🟦 pass | ❌ WS-B |
| D | Conditional mesh-to-internet | 🟦 pass | ❌ WS-B/E |
| E | Internet-to-mesh map update | 🟦 partial (ack loop proven; map delta injection needs the dashboard) | ❌ |
| F | Tier 2 microphone decode | ❌ needs the real modem | ❌ WS-F |
| G | Tier 2 direct-audio equivalence | 🟦 pass (frame level) | ❌ WS-F |
| H | Radio-to-mesh bridge | 🟦 pass | ❌ WS-B/F |
| I | Tier 2 check-in → Tier 1 response | ❌ needs the check-in screen | ❌ |
| J | File transfer does not harm emergencies | 🟦 pass | ❌ |
| K | Stale people and topology data | 🟦 pass (freshness); topology view remains | ❌ |

## Known limitations of this pass

Stated plainly rather than buried:

1. **No real Bluetooth has run.** Every Tier 1 result is simulated. The simulated
   adapter is faithful to the contract, but it is not evidence about Android.
2. **ggwave itself is not integrated.** The Tier 2 frame format, receiver, and
   campaign planner are real and tested; the acoustic modem is not wired, so
   scenario F cannot be claimed.
3. **Persistence is in-memory.** It implements the real semantics (idempotency,
   conflict quarantine, eviction order) but does not survive process restart, so
   OFF-003 is not yet satisfied.
4. **No UI exists.** The screen and surface registries encode every requirement,
   but no screen is built.
5. **The content pack is synthetic.** Deliberately (INT-006), and it must be
   replaced with a sourced pack carrying a licence note.
6. **Copy-budget and duty-cycle numbers are unmeasured.** They are documented
   first-pass targets, exactly as `02-…` permits, and must be tuned against
   measurement before anyone quotes them.
