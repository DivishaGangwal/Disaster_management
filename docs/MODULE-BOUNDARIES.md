# Module boundaries

Why the repository is shaped the way it is, and what you may and may not import.

The binding statement is in `agent-reference/02-SYSTEM-ARCHITECTURE-AND-PACKET-RULES.md`,
**"Definition of architectural correctness"**:

> The architecture is correct when an agent can replace the Bluetooth adapter,
> add or remove an online gateway, decode the same authority record from Tier 2,
> and replay stored packets **without changing the packet meaning, local policy,
> incident model, or map-update behavior**.

Everything below exists to make that literally true, and `npm run boundaries`
enforces it mechanically rather than by review discipline.

## The dependency graph

```
                          ┌──────────────┐
                          │  contracts   │  no dependencies, ever
                          └──────┬───────┘
        ┌──────────┬─────────┬───┴────┬─────────┬──────────┬────────────┐
        │          │         │        │         │          │            │
     codec       store   incident  mapkit  transport-  gateway-      (all)
        │          │                        core        client
   ┌────┴────┬─────┴───┐
validator  policy   routing
        └──────┬──────┘
               │
        ┌──────┴───────┐
        │ node-runtime │  the composition root
        └──────┬───────┘
               │
      ┌────────┴─────────┬──────────────┐
   simulator        apps/mobile     apps/backend
```

Arrows only ever point **down**. A package may import from its allowed list and
nothing else. The list lives in `tools/boundaries/check-boundaries.mjs` and is
the single authority.

## The five enforced rules

### 1. `@dsm/contracts` has zero dependencies

It contains types, numeric registries, and bounded limits — **no behaviour**.
That is what lets the mobile app, the backend, the Tier 2 tooling, and the
simulator all agree on one protocol without depending on each other.

### 2. One source of truth per registry

Message codes, limits, copy budgets, and reason strings are declared **once**, in
`contracts`. The checker fails the build if any other file re-declares them.

`03-…` says it directly: *"agents must avoid duplicating the same packet registry
or policy in mobile and backend."*

### 3. The domain does not know about the radio

`incident`, `mapkit`, `policy`, and `store` may not mention React Native, Expo,
`BluetoothGatt`, `ggwave`, `AudioRecord`, or any other platform API.

`02-…`: *"Bluetooth details must not leak into the map, incident, or UI models."*

This is what makes **DEC-006** cheap: if BLE fails the device matrix, swapping in
a Bluetooth Classic adapter touches exactly one package.

### 4. One ingress for every transport

Tier 1 BLE, gateway downloads, and Tier 2 radio all enter through
`NodeEngine.ingest()`. There is no privileged path — the backend's own packets
are validated with the same rules as a stranger's.

This is architectural invariant 4, and invariant 6 follows from it: receiving a
packet is not the same as showing, notifying, forwarding, or uploading it. The
policy engine returns those as **six independent decisions**, each with its own
reason code.

### 5. Truthful copy is a build error

The checker greps user-facing copy for `verified` (INT-004 forbids it for demo
role provisioning), `guaranteed`, and `help is coming` (DEC-022 — a link receipt
is not rescue progress).

## The two seams that let people work in parallel

### Seam 1 — the transport (Gate II)

```
        ┌─────────────────── TransportAdapter ───────────────────┐
        │                                                        │
SimulatedTransportAdapter                        NativeTransportAdapter
 (transport-core)                                (native/android-radio-bridge)
 runs in Expo Go, Node, CI                       runs in the Expo dev build
 Workstream C owns it                            Workstream B owns it
```

Workstream A can build **every screen** against the simulated adapter with no
Android toolchain. Workstream B can bring up real BLE without touching a screen.

> **DEC-004**: stock Expo Go is not the judged runtime for real Bluetooth. The
> capability report carries `simulated: true` and the readiness screen renders it
> verbatim. Never soften that.

### Seam 2 — the map operation (Gate III)

Every transport reaches the map through `toMapOperations()` → `MapProjection`.
There is no second "radio map" and no second "gateway map" (MAP-009 / DEC-013).
Workstream D can rebuild the projection or swap the content pack without any
other workstream noticing.

## If you need to cross a boundary

You probably need a **gate**, not an import. See `CONTRACT-FREEZE.md`.

Changing a shared contract is normal and expected — doing it silently inside one
implementation file is what breaks six people at once. `03-…` is explicit:
*"Agents must not hide a decision inside one implementation file."*
