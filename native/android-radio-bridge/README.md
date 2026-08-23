# Native Android radio bridge — Workstream B

The Expo module for the judged Tier 1 runtime. The BLE/Classic transport and
foreground relay service are implemented and compile in the generated Android
development build. Physical-device behaviour remains unmeasured.

## The one rule

Keep `TransportAdapter` and `AudioInputAdapter` aligned with
[`@dsm/contracts`](../../packages/contracts/src/native-bridge.ts). The transport
adapter and Android WavePX PCM receiver both exist behind separate contracts;
ggwave remains WavePX's internal physical modem.

If you find yourself wanting to change a packet, a policy, a map rule, or a
screen to make Bluetooth work — stop. That is a Gate II conversation
(`docs/CONTRACT-FREEZE.md`), not a local edit. The whole point of the seam is
that `DEC-006` (falling back to Bluetooth Classic) costs you this package and
nothing else.

## What already exists, so you are not blocked

| You need | It already exists |
|---|---|
| The session state machine (8 phases, flow control, budgets) | `@dsm/routing` → `SessionStateMachine` |
| The relay loop that drives an adapter | `@dsm/node-runtime` → `RelayLoop` |
| A reference implementation of the same contract | `@dsm/transport-core` → `SimulatedTransportAdapter` |
| Discovery payload construction (with the forbidden fields designed out) | `@dsm/transport-core` → `buildDiscoverySummary` |
| Multi-hop tests you can re-run against your adapter | `packages/simulator` |

You do **not** implement inventory comparison, copy budgets, dedup, validation,
or queueing. Those are done. You move bytes and emit normalized events.

## Evidence still required (03-… Workstream B)

1. **Capability matrix on every demo phone** — fill in `docs/device-matrix.md`.
   Runtime checks only; never infer support from a marketing label.
2. **Native event contract on hardware** — the source contract is identical;
   record actual event traces on the selected phones.
3. **One-hop transfer evidence** on real devices.
4. **Reconnection / backoff behaviour** — use `backoffMs()` from `@dsm/routing`.
5. **Screen-off / foreground-service evidence.**
6. **A dated device decision.** Classic is implemented as the automatic
   contingency; record which mode each demo phone actually selects.

## Implemented Android surface

- `BluetoothLeAdvertiser` — advertise the **exact bytes** from
  `buildAdvertisingPdu()` in `@dsm/transport-core`. Do NOT invent a layout: the
  encoder is written, tested, and shared with the simulated adapter. The
  complete PDU is 19 of the 31 available bytes.
  - Identifiers are frozen in `BLE_IDENTIFIERS` (`@dsm/contracts`): a 128-bit
    GATT service UUID, and manufacturer-specific data under company ID
    `0xffff` (SIG-reserved for testing — we have no assigned ID).
  - **You cannot choose advertising channels.** One advertising event goes out
    on 37/38/39 automatically, in the controller. Android exposes no API for
    it. Do not look for one.
  - The forbidden fields (name, phone number, SOS text, exact coordinates,
    exact incident ID, permanent account ID, full inventory) are not
    representable in `DiscoverySummary` by design — keep it that way.
- `BluetoothLeScanner` — filtered scan, duty-cycled per `BATTERY.DUTY_CYCLE`.
- `BluetoothGattServer` — accept connections, expose the session characteristic.
- `BluetoothGatt` (client) — connect, negotiate MTU, subscribe to peer
  notifications, serialize writes and confirm completion via native callbacks.
- A **foreground service** with an ongoing notification whose Stop action shuts
  down both the notification and module-owned relay resources (`REL-001`).
- **Runtime capability + permission reporting** → `CapabilityReport`.
- **Implemented, not yet physically measured:** bounded `AudioRecord` 48 kHz
  PCM capture → WavePX native modem decode → `Tier2RawFrame`. Recovered frames
  still pass CRC, reassembly, canonical validation, persistence, policy and map
  projection before they can change application state.

## Discovery is probabilistic — design for missed advertisements

BLE advertising has **no carrier sense**. Simultaneous advertisers on one
channel collide and both are lost. The controller adds a 0–10 ms random
advDelay, and channels 37/38/39 sit between Wi-Fi 1/6/11 — but a scanner
listens to one channel at a time, so it can miss an advertisement even with no
collision at all.

Never treat a missed advertisement as a failure. Nothing in the protocol
depends on a single one being heard; `queueEpoch` lets a peer notice it missed
a change. Report observed discovery latency in the evidence sheet rather than
assuming it.

## Honesty requirements (non-negotiable)

- `CapabilityReport.simulated` is `false` here, and `true` in the simulated
  adapter. The readiness screen renders it verbatim. Never blur that line.
- Resolving `sendRecord` means the transport wrote bytes — **not** that the peer
  accepted the packet. Application receipts come only after the peer validates
  and durably stores (`02-…` session flow control).
- Do not claim background operation behaves identically across manufacturers.
  Record what you actually measured, per device.
