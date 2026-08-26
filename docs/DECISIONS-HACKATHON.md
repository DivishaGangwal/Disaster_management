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

## HD-009 — `RECORD_UPSERT` uses a bounded dynamic map

Its `fields` member uses a deterministic string-keyed map extension. Keys are
UTF-8, canonically sorted and bounded to 64 bytes; at most 32 entries are
accepted. Values are bounded scalars, bytes, or scalar arrays. Nested arbitrary
objects are rejected so the previously fail-closed behavior remains intact.

---

## HD-010 — The console composes check-ins and returns responses over Tier 1

WEB-004 is restored. The operations console composes public alerts, regional
map records, and `CHECKIN_CAMPAIGN` packets. A recovered campaign opens the
cached Mumbai form on the Android client. The client creates a canonical
`CHECKIN_RESPONSE`, saves it in SQLite, and advertises it through the existing
Tier 1 relay; an available gateway may upload it during the normal sync cycle.
The response is never encoded as WavePX because Tier 2 remains one-way.

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

**Known capacity limit — RESOLVED, see HD-014.** The four-ID cap was real and
the prescription was right: 8-byte raw prefixes now carry **21 IDs**, measured.

The diagnosis in the sentence above was wrong in one respect worth recording.
It said convergence would "take several contacts". It would not have: the
announced list came from `listRelayable()` in a fixed order with no rotation,
so entries 5..N were announced *never*, not eventually — and HD-013's epoch
skip then removed the contacts that might have corrected it. Two mechanisms
that are individually sound compounded into a permanent blind spot. Neither
review caught it because both were reasoned about alone.

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


---

## HD-014 — The hello phase now emits a record, and the inventory is compact

Two defects with one root: **session-control records were paying 34 bytes to
say a 16-byte thing, and one of the eight session phases was not on the wire
at all.**

### The inventory was hex-encoded

A packet ID is 16 binary bytes. Every payload field carrying one was a
**32-character hex string**, which in the value codec costs
`TAG.TEXT(1) + uvarint(32)(1) + 32 = 34 bytes` against ~164 usable bytes in a
180-byte session-control payload. Hence four (HD-012).

IDs now travel as one concatenated blob of **8-byte prefixes** — `TAG.BYTES(1)
+ uvarint(len)(1) + 8N` — under a new `idPrefixes` field (wire key 6). One blob
rather than an array of byte fields, because an array pays tag+length per
element and stops at 16.

**Measured: 4 → 21 IDs per record, 5.25×,** in 242 of the 244-byte write budget.

`criticalIds` / `entries` / `terminalIds` are still *read* so an older peer is
understood, and are no longer sent. The receiver folds every form into one
prefix-keyed set.

**Why 8 bytes is safe.** A 64-bit prefix over the 2,000-packet storage ceiling
gives a birthday-collision probability near 1e-8. A collision costs one
suppressed offer on one link for one session; the copy budget is 12 and this
is not the only route. That is categorically unlike a Bloom filter, whose false
positives would poison a shared structure rather than one link.

**The failure mode this introduces is silence.** Announcing a prefix while
testing membership against a full ID matches nothing, so every session would
re-send everything with no error raised anywhere. Both sides now derive
membership through `packetIdPrefixKey()` and a test asserts the two agree.

### The hello phase sent nothing

`runSession()` advanced `establish → hello → inventory` with two
`machine.advance()` calls and no record. The proof it was never real:
`SessionStateMachine.negotiate()` had **zero callers**, and the `'incompatible'`
close reason could not fire.

`HELLO_CAPABILITY` (102 B) is now sent at that phase, carrying what the 12-byte
advertisement has no room for: protocol range, usable record size, and battery
and storage bands.

**What it changes:**

- `negotiate()` runs. An incompatible peer closes cleanly instead of being
  discovered one layer down as a run of validator rejections.
- The forwarding score's battery term reads the **peer's** band. It previously
  read `localBatteryBand` only — so the term never described the node it was
  scoring, and a relay would push non-critical traffic into a peer at 4%. The
  term is now `min(local, peer)` with a hard gate at band 0.
- Record size is negotiated as `min(local, peer)`. **Both ends report 244
  today, so this currently changes nothing** — its value is that the phase is
  real, so plumbing the natively negotiated ATT MTU (517 was granted on both
  handsets) through later changes one number instead of adding a protocol step.

**Ordering, deliberately.** The initiator sends hello *and* inventory without
waiting, so its own inventory is sized at the local budget. Waiting would need
a blocking primitive inside the session — the cost HD-001 rejected — and would
deadlock against a peer that never says hello. The accepting side answers after
absorbing the hello, and **both** sides hold the peer's capability before
either reaches `pushOffers`, which is where it is actually consumed.

### `truncated` now means something

It was written honestly and **read by nothing**, so a partial list was
indistinguishable from a complete one. It now suppresses HD-013's session skip
for that peer: "neither epoch moved" does not mean there is nothing to exchange
when the peer never finished saying what it holds.

### Two defects found while proving this

- **`listRelayable()` ignored priority on device.** SQLite ordered by
  `stored_at_ms` only while `memory-store` — and therefore all 69 tests —
  ordered by priority then age (the §6.2 disagreement). Harmless while nothing
  was cut; the moment truncation cut at 21, a fresh SOS could be dropped from
  the announcement by older, lower-priority records. Now sorted identically to
  `memory-store`. **Age weighting is unchanged**: priority is the primary key,
  oldest-first remains the tiebreak, and the routing score's `age` term is
  untouched.
- **The peer-observed handler wiped the capability fields.** It rebuilt
  `PeerObservationRecord` field by field, so every advertisement — one every
  1–8 s — erased what the hello had just learned. Exactly the defect the
  comment directly above it already warned about for the reliability counters.
  Caught by a test asserting a non-default battery band, not by inspection.

### `PACKET_REQUEST` is still not sent

HD-001 stands. Its justification is stronger now, not weaker: the push filter's
correctness rests on inventory accuracy, and the inventory is no longer capped
at four. Fragment-level resume remains the real thing HD-001 gives up.
