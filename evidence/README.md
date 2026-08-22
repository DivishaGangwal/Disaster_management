# Evidence bundle — Workstream F

`03-…` "Final evidence package structure" and "Packet size and timing evidence
sheet" land here.

**Working rule 10 is binding.** Every artifact must state which kind of evidence
it is:

- 🟩 **static check** — a type check, a lint, an assertion about code
- 🟦 **simulator run** — deterministic multi-node scenario, no radio involved
- 🟥 **real Android device** — measured on named hardware, under stated conditions

Never present a simulator result as device evidence.

## Expected contents

| File | Owner | Contents |
|---|---|---|
| `packet-size-sheet.md` | WS-C | Per packet type: encoded Tier 1 bytes, Tier 2 bytes, fragment count, audio duration/repetition cost. Debug JSON size is NOT the transmitted size. |
| `device-matrix.md` | WS-B | Per demo phone: Android version, BLE advertise/scan/GATT support, extended advertising, Coded PHY, max advertising data length, observed background behaviour. |
| `timing-sheet.md` | WS-B/F | Discovery time, request-to-stored time, end-to-end multi-hop time, with devices and conditions named. |
| `tier2-decode-report.md` | WS-F | Expected vs recovered packet IDs, frames detected/valid/corrupt/duplicate, microphone setup, measured success rate. |
| `battery-report.md` | WS-F | Duty cycle per mode and measured drain. |
| `scenario-runs/` | WS-F | One record per acceptance scenario A–K with its evidence label. |
| `demo-rehearsal.md` | WS-F | Rehearsal log and the failure-injection playbook. |

Generated outputs go in `evidence/out/`, which is gitignored.
