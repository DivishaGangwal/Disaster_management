# Implementation decisions and deviations

Where the implementation makes a choice the specs left open, or **departs from
them**, it is recorded here. `03-…` is explicit: *"Agents must not hide a
decision inside one implementation file."*

Everything below is scoped to the hackathon prototype. None of it is a
production position.

---

## HD-001 — Tier 1 uses a two-way announce, not a pull request/response

**Spec:** REL-003 *"Phones must exchange compact inventory information before
transferring full packets where practical"*; REL-004 *"The receiver must
request only missing eligible packets/fragments."*

**Deviation.** REL-004 describes a **pull**: the receiver sends `PACKET_REQUEST`
and the sender responds. The implementation is a filtered **push**:

```
A opens session → A announces INVENTORY
B receives it   → B announces INVENTORY → B pushes what A lacks
A receives it   → A pushes what B lacks → A closes
```

Both sides filter against the peer's inventory, so REL-003 is satisfied and
REL-004's *intent* (never send what the peer already holds) is satisfied. What
is missing is the literal `PACKET_REQUEST` round trip.

**Why:** the pull version needs a third round trip and a blocking wait inside
the session. The push version is purely event-driven, needs no blocking
primitive, and gets the same airtime saving.

**Consequences:**
- `PACKET_REQUEST` (0xf2) is defined, has a builder and a field map, and is
  **never sent**. It is reserved, not removed.
- If a peer never answers with its inventory, the session closes on its idle
  budget having transferred nothing. Contact is retried later under backoff.
- The receiver cannot express *"send me only fragment 3"*, so the resume path
  for files is manifest-driven rather than request-driven.

**Measured effect:** after the first exchange between two nodes, subsequent
sessions report `offered: 0, skipped: 3, peerAlreadyHolds: 2` — repeat contacts
now transfer nothing. Multi-hop propagation also got faster (three-node chain
completes in 1 gossip round instead of 2).

**To revisit:** implementing the true pull is a contained change in
`relay-loop.ts` plus wiring the existing `buildPacketRequest`.

---

## HD-002 — Only the session initiator closes

Not a spec deviation; the specs do not say who closes. Recorded because it is
load-bearing.

The accepting side must **not** close after it pushes: doing so tears the
session down before the initiator has seen the peer's inventory and pushed its
own packets. That silently broke multi-hop relay when first written. A
half-finished session is retired by its own duration/idle budget instead.

---

## HD-003 — File assembly is in memory, and archives are refused outright

**Spec:** FIL-001…FIL-007; 02-… *"File and image rules."*

Decisions taken:

| Decision | Rationale |
|---|---|
| Assembled bytes are held **in memory**, not written to a filesystem | Demo maximum is 128 KB (FIL-007) with at most 8 incomplete objects, so the ceiling is about 1 MB. A filesystem implementation lands behind the same `FileRepository` interface if needed. |
| **Nothing is ever decompressed.** `ARCHIVE` is refused at manifest time | This is how *"no unbounded decompression"* is satisfied — by never having a decompressor, rather than by bounding one. |
| `EXECUTABLE` is refused at manifest time | *"no executables or automatic installation."* Refusal happens **before** any fragment is requested or stored. |
| A fragment with no manifest is **orphaned, not stored** | FIL-006 *"unrequested objects must be rejected."* Without a manifest there is no declared size, count, or digest to bound it against. |
| A digest mismatch **discards the whole object** | FIL-004. No partial state survives a failed assembly. |

**New vocabulary:** `mimeCategory` was previously a bare `number` with no
defined meaning, which made *"reject executables"* unimplementable. `MimeCategory`
now defines IMAGE / DOCUMENT / AUDIO / EXECUTABLE / ARCHIVE / OTHER. This is an
**additive** contracts change, not a Gate I break.

**Known limit:** fragments arriving *before* their manifest are dropped and
must be re-sent. Buffering them would mean storing unbounded unrequested
content, which FIL-006 forbids.

---

## HD-004 — Directed forwarding is NOT implemented, and cannot be as specified

**Spec:** 02-… lists *"Directed forwarding: prefer progress toward a responder,
relief point, or target region when known"* as a routing mode.

**Not implemented. This is a deliberate exclusion, not an oversight.**

Two blockers, the second of which is structural:

1. **Packets carry no destination.** The blueprint lists a `DESTINATION` header
   extension (destination type, coordinates, region, ID). It was never
   implemented. Adding it is a Gate I change.

2. **We cannot know whether a peer is closer to anywhere.** `DiscoverySummary`
   carries no location — *deliberately*. 02-… forbids exact coordinates in
   discovery advertisements, and the structure has no field that could hold one.
   So the routing layer has no basis on which to evaluate "does handing this
   packet to this peer make progress toward the destination?"

This is a genuine tension between the **privacy rule** and the **routing mode**,
both of which are in the same document. The privacy rule wins: it protects
victims, and the routing mode is one of five, the other four of which are
implemented (direct gateway, controlled replication, store-carry-forward, local
display).

**Options if this is ever revisited**, in increasing cost:
- (a) Leave it out and record why — **chosen**.
- (b) Put a **coarse region code** (not coordinates) in the advertisement. Needs
  a privacy review: a region code plus a rotating token is still a weak
  location disclosure.
- (c) Infer peer locality from packets they have relayed rather than from
  advertisements. No advertisement change, but slow, indirect, and easily wrong.

---

## HD-005 — Validation gates 13 and 14 are reported as *deferred*, not passed

Geographic relevance and user preference are listed as validation gates, but
they decide **display and relay**, which is the policy engine's job. A packet
outside the pack region is still stored so it can be carried onward
(store-carry-forward).

Previously the validator pushed both onto `gatesPassed`, so the diagnostics
screen claimed a check had run when it never had. `ValidationSuccess` now
carries a separate `gatesDeferred` list. The behaviour is unchanged; the
**reporting** is now honest.

---

## HD-006 — Backend ingest queue bound

02-… : *"No budget may remain 'unlimited'."* The backend ingest path used
`Number.MAX_SAFE_INTEGER`, which is literally unbounded. Now **50,000** packets.

Chosen as a number comfortably above any demo volume while still being a real
limit. Tune with measurement; do not remove.

---

## HD-007 — Envelope deviations still awaiting ratification

Two places where the implementation had to resolve a conflict **between** the
specs. Both need a decision; neither has one yet.

**Offset 58 width.** Blueprint 7.2 says `58 | 2 | Source/campaign class`. The
implementation uses **1 byte** at 58 plus 1 reserved byte at 59. Seven source
classes fit comfortably in one byte, and the reserved byte gives room for a
header extension. **Off-spec until ratified.**

**Severity placement.** Blueprint 7.2 lists only `Priority` at byte 6. 02-…
"Fixed envelope fields" requires *"priority and severity"*. The two documents
conflict. The implementation packs both into byte 6 — priority in the high
nibble (0–7 needs 3 bits), severity in the low nibble (0–3 needs 2 bits). Both
keep their independent meaning. **Unratified resolution of a spec conflict.**

---

## HD-008 — The message type is bound into the payload digest

Field keys are per-type and overlap: key 1 is `incidentId` in `SOS_CREATE` and
`forPacketId` in `LINK_RECEIPT`. Flipping the type byte and recomputing the
header CRC therefore reinterpreted an unchanged payload under a different
schema.

The digest is now computed over `[type byte] || payload`, so relabelling breaks
it. Costs no wire bytes — the type already travels at offset 3.

**This is a Gate I change.** It alters the digest value of every packet, though
not the byte layout. Anything encoded before it fails gate 10. It was safe when
made: no golden vectors existed and no packets were persisted.

---

## HD-009 — `RECORD_UPSERT` cannot currently be encoded

Its `fields` member holds caller-defined keys, so it has no fixed field map.
The encoder now **throws** rather than silently emitting an empty map — which
is what it did before, quietly discarding the entire record body.

Supporting it needs a dynamic string-keyed map in the codec. Until then the
family is defined and unusable, which is recorded honestly rather than hidden.

---

## HD-010 — The console composes alerts and map records, not check-ins

WEB-004 lists check-in campaigns among the authority surfaces. The operations
console no longer offers that packet type: the composer creates public alerts
and regional map records only, and `POST /api/campaigns` rejects
`dataType: "check-in"`.

The frozen `CHECKIN_CAMPAIGN` / `CHECKIN_RESPONSE` types, their field maps and
validator rules are untouched, so nothing about the packet surface changed —
only which packets this console composes. **Deliberate scope reduction, not a
spec resolution.** WEB-004 is unmet until a check-in composer returns.

What replaced it in the same panel: an operator-selected broadcast point
(`latE7`, `lonE7`, `radiusM`) on the OFFICIAL_ALERT packet, and reception
verification that rebuilds the canonical packet from recovered frames instead
of reporting the stored draft back to the operator.

---

## HD-010 — Advertising channels, collisions, and the corrected byte budget

### Channels are not ours to choose, and never were

A single BLE advertising event is transmitted on **all three** primary
advertising channels — 37 (2402 MHz), 38 (2426 MHz), 39 (2480 MHz) — by the
Bluetooth **controller**. Android's `BluetoothLeAdvertiser` exposes advertising
mode, TX power, connectable flag, timeout, and data. **There is no
channel-selection API.**

So "send one message on three advertising channels" is not something this
project implements or could implement. It happens automatically, for free, and
cannot be disabled. Nothing in the codebase references channels, correctly.

### An advertisement is not a message

Worth stating plainly because it is easy to assume otherwise:

| | Carries | Size | Radio |
|---|---|---|---|
| **Advertisement** | "I exist, my queue changed, my highest priority is N" | 19 B of 31 | broadcast on channels 37/38/39 |
| **Session record** | the actual SOS / resource / alert packet | 96–148 B | GATT connection on the 37 **data** channels, with adaptive frequency hopping |

The smallest SOS is 115 bytes. A legacy advertising PDU holds 31. A packet
**cannot** travel in an advertisement, so the advertisement announces and the
connection carries. A test asserts this relationship so it cannot be forgotten.

### Collisions are real and only partly mitigable

- BLE advertising has **no carrier sense**. Two devices advertising at the same
  instant on the same channel collide and both are lost.
- The controller adds a pseudo-random **0–10 ms advDelay** to each advertising
  interval. Automatic, not ours.
- Channels 37/38/39 sit in the gaps between Wi-Fi channels 1/6/11, so in
  practice **Wi-Fi is usually the larger interferer** than other BLE devices.
- A scanner listens to **one channel at a time**, so it can miss an
  advertisement even with zero collision.

**Therefore discovery is probabilistic**, and the protocol is built to tolerate
it: nothing depends on a single advertisement being heard, and `queueEpoch`
lets a peer notice it missed a change. What we *do* control is
connection-level contention — `shouldInitiate()` gives a deterministic
tie-break so two phones do not open duplicate sessions, and `backoffMs()`
applies bounded jittered retry so failures do not become a retry storm.

### The budget was wrong, and had never been tested

`DiscoverySummary` existed only as a JavaScript object — **nothing ever encoded
it to bytes**. So the 26-byte budget was never checked against a real PDU, and
Workstream B would have had to invent a layout, guaranteeing the native and
simulated adapters diverged.

The real arithmetic:

```
31  legacy advertising PDU AD data
-3  mandatory Flags element
-4  manufacturer-specific data header (len, type, 2-byte company id)
--
24  actually usable        <- MAX_BYTES was 26, which does not fit
```

`encodeAdvertisement` now produces a **12-byte** payload; the complete PDU is
**19 of 31 bytes, leaving 12 spare**. Measured, not estimated.

### Identifiers, now frozen (Gate II)

Workstream B was blocked without these:

- **GATT service** uses a full 128-bit custom UUID, exchanged after connection
  where there is no size pressure.
- **The advertisement** uses manufacturer-specific data with company ID
  `0xffff`, which the Bluetooth SIG reserves for testing and development. We
  have no assigned company ID, and squatting on another vendor's would be
  wrong. A 128-bit service UUID in the advertisement would consume 18 of the
  31 bytes and leave only 10.
- A magic byte `0xd5` leads our payload so other developers' `0xffff`
  advertisements are ignored rather than mis-parsed.

---

## HD-011 — Files are TEXT ONLY, and every record fits one BLE write

**Decision:** the file channel accepts **UTF-8 text and nothing else**.
`MimeCategory` became an allow-list: `TEXT` is accepted, `IMAGE` / `AUDIO` /
`EXECUTABLE` / `ARCHIVE` / `OTHER` are all refused at manifest time, before a
single fragment is requested. A strict UTF-8 decode runs before an object
becomes visible, so declaring `TEXT` and sending binary is caught too.

This makes FIL-006 true **by construction**: the prototype contains no image
decoder, no audio decoder, and no decompressor, so "no executables" and "no
unbounded decompression" hold because the capability does not exist.

**It also removed a latent transport bug.** BLE carries `ATT_MTU - 3` bytes per
write. Android's default MTU is 23; 247 is widely supported and is what this
build requires:

```
247   required ATT MTU
 -3   ATT header
---
244   usable per write
-64   our envelope
---
180   maximum payload      <- every packet class is now capped here
```

Every record therefore fits **one write**, and no link-layer chunking layer is
needed — application-level fragmentation already exists, so a file is split
into packets that each fit the radio. Fragment data is 120 bytes, and the
per-fragment digest was cut from a full 64-char SHA-256 to a 16-char prefix
(the whole-object digest is the real FIL-004 guarantee; the prefix is an
early-reject hint). Maximum file size is now a derived **8 KB**, about 1,400
words.

Workstream B must negotiate MTU 247 and **fail loudly** if the peer refuses,
never silently truncate a record.

---

## HD-012 — Inventory truncates to fit, and the failure is no longer silent

Capping session-control payloads at 180 bytes exposed a bug that had been
introduced in the same change: `announceInventory` still tried to send up to 16
packet IDs. A packet ID is 32 hex characters, so **only 4 fit** in 180 bytes.
The encoder threw, the throw was swallowed by a `.catch(() => undefined)`, and
**the entire exchange stopped** for any node holding four or more packets.

Single-packet tests passed throughout, which is why nothing caught it.

Two fixes: the inventory now grows its ID list until the next entry would
overflow and sets `truncated` honestly, and the swallowed catch became an
`announce-failed` error event. A protocol step that cannot run must never fail
quietly.

**Known capacity limit:** only ~4 packet IDs fit per inventory. A node holding
40 packets can only tell a peer about 4 of them per contact, so convergence
takes several contacts. Sending 8-byte ID prefixes as raw bytes instead of
32-character hex strings would raise this to roughly 21 — worth doing, but it
is a wire change and has not been made.

---

## HD-013 — Skip sessions when neither queue has changed

`DiscoverySummary.queueEpoch` existed and nothing used it;
`SessionStateMachine.hasUsefulDifference()` was written and never called. So
every advertisement produced a full session — connection, two inventory
records, two transfer plans — even when both sides had been identical for
minutes. Peers re-advertise constantly, so this was a fixed tax per contact per
round.

The relay loop now remembers the `(their epoch, our epoch)` pair at the last
completed reconciliation and skips the session entirely when neither has moved,
which is exactly what 02-… asks for: *"Do not connect when compact inventory
and epochs indicate no useful difference."*

**Measured, same scenarios before and after:**

| Scenario | Records before | After | Saved |
|---|---:|---:|---:|
| 4-node chain, 1 packet | 81 | 37 | 54% |
| 4-node full mesh, 1 packet | 159 | 75 | 53% |
| 6-node full mesh, 1 packet | 394 | 208 | 47% |
| 4-node mesh, 10 packets | 334 | 274 | 18% |
| 4-node mesh, 40 packets | 528 | 480 | 9% |

Delivery is unchanged in every case. The saving is largest in quiet, converged
neighbourhoods and smallest under genuine churn — which is the correct shape,
because churn means there is real work to do.

**On flooding generally:** the sync-what-you-lack design does **not** duplicate
packets. Redundant sends stayed at 0 in the chain case and were low elsewhere;
copy budgets, per-neighbour known-holder tracking, and previous-hop suppression
already bound replication. The cost that actually scales badly is the
**inventory tax per contact**, which is what HD-013 addresses.
