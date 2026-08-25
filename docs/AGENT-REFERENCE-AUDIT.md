# Agent-reference conformance audit

**Subject:** `docs/agent-reference/` — the four binding specification files — measured against
the eight downstream documents in `docs/`, the three root documents, and the code on branch
`saksham-the-great`.

**Date:** 2026-08-25 · **Branch:** `saksham-the-great` (7 commits ahead of `main`, merge-base `eabda43`)
**Method:** every line of all four agent-reference files read in full (7,451 lines), then every
downstream doc, then the contract, codec, validator, policy, routing, mapkit, tier2, node-runtime,
store, transport-core, backend, web-console, mobile and native-bridge sources that implement them.

**No code was changed by this audit.** It is a findings document only.

---

## 0. Scope, and how "error" was decided here

`docs/agent-reference/` holds four files that the repository itself declares binding:

| File | Lines | Declared authority |
|---|---:|---|
| `01-PRODUCT-DECISIONS-AND-SCOPE.md` | 755 | *"the binding product definition… If an older pitch, blueprint, comment, mock-up, or implementation conflicts with this file, this file wins."* |
| `02-SYSTEM-ARCHITECTURE-AND-PACKET-RULES.md` | 1,198 | boundaries, protocol, state, persistence, routing, synchronization, failures |
| `03-HACKATHON-BUILD-PLAN-AND-ACCEPTANCE.md` | 1,331 | sequencing, ownership, tests, integration gates, demo evidence |
| `04-BLUEPRINT-finalsih.md` | 2,052 | *"Canonical approved SIH product and engineering blueprint"* |

`03-…` fixes the precedence order as **01 → 02 → 03 → 04 → everything older**, and states the rule
this audit exists to check:

> *"A decision affecting packet identity, transport meaning, offline behavior, role permissions, map
> object semantics, gateway truth, or Tier 2 direction must update **all affected specifications**
> before implementation diverges. Agents must not hide a decision inside one implementation file."*

Four things were counted as findings:

1. **Spec-internal contradiction** — the four files disagree with each other, and the code had to
   pick a side without a recorded decision.
2. **Specified but absent** — a requirement with an ID or a named section exists in
   `agent-reference/` and is neither implemented nor recorded as deferred in
   `DECISIONS-HACKATHON.md`, `FEATURE-MATRIX.md`, or `STATUS.md`.
3. **Divergence** — the code does something different from the spec and no downstream doc says so.
4. **Downstream drift** — a doc in `docs/` or the repo root asserts something the code or the
   agent-reference files do not support.

Things deliberately **not** counted as findings are listed with reasons in §9.

Evidence labels follow `evidence/README.md`: 🟩 static/source check · 🟦 automated test or simulator
run · 🟥 measured on physical hardware. **Nothing in this audit is 🟥.**

---

## 1. The central finding: the binding specs were edited in place, and the edit is half-finished

### 1.1 What happened

Commit **`89feeed` ("frontend", 2026-08-23, Krish Kamlesh Jain)** modified all four
agent-reference files. It is the only commit besides the initial `9d96aca` ever to touch that
directory, and it is *not* on this branch's delta — it landed before the merge-base, so every
commit on `saksham-the-great` inherited it silently.

The commit removed two whole product areas from the specification:

| Removed | From |
|---|---|
| `DEC-021` — "The topology map is observation-based." | 01 decision register |
| `MAP-012` — topology map must display observation age and edge kinds | 01 requirement catalogue |
| `MAP-010`'s "or topology" filter clause | 01 requirement catalogue |
| `T2-012` — "A check-in response must leave by Tier 1 or a later gateway, never by radio." | 01 requirement catalogue |
| Secondary goal "Show judges how the observed mesh topology evolves." | 01 product goals |
| Screen 10 (Network topology and packet journey) and Screen 12 (Check-in form) | 01 screen spec, renumbered 13→12 |
| "optional topology overlay" map layer | 01 screen 5 |
| The whole **Check-in family** protocol definition (`CHECKIN_CAMPAIGN`, `CHECKIN_RESPONSE`) | 02 canonical protocol registry |
| Policy-matrix rows for check-in campaign, check-in response, topology observation | 02 detailed policy matrix |
| The whole **"Network topology map"** section (nodes, edges, freshness rules) | 02 location and topology model |
| Screens 10 (Topology/packet journey) and 12 (Check-in); Profile added as 11 | 04 §26.2 |
| Acceptance scenario **I** retitled `### I. (Removed - Tier 2 check-in)` — **body left intact** | 03 §Required acceptance scenarios |
| Scenario K's topology clause | 03 |

It also *narrowed* screen specs while renumbering them — e.g. 01's Tier 2 screen lost
"microphone permission and active capture indicator", "direct-demo versus microphone source",
"listen timeout and stop control" and "clear 'one-way broadcast' language", and gained
"history of all messages received from gg waves". Diagnostics lost "previous hop".

### 1.2 The removal is not complete — the specs now contradict themselves

Deleting the definitions did not delete the requirements that depend on them. Both concepts are
still load-bearing across all four files.

**Check-in — surviving references after its protocol definition was deleted (🟩):**

| File | Count | The ones that matter |
|---|---:|---|
| `01` | 8 | `WEB-004` still mandates check-in campaigns; screen 14 still requires an "official alert/check-in campaign composer"; the **Complete packet catalogue** still lists both check-in rows; General Public "answer an authority check-in"; Authority Publisher "create Tier 2 campaigns and check-in requests"; non-negotiable decision 3 still describes the Tier 2→form→Tier 1 flow; core user journey step 6 |
| `02` | 8 | Application/domain layer owns "campaign/check-in behavior"; copy budget "Resources/check-ins: medium"; content-pack manifest "cached guides and check-in forms"; map projection "check-in and help-request state"; policy Act "opens a check-in"; queue order class 5 "Check-in campaigns and responses"; map op "activate a cached… check-in form"; Tier 2 campaign structure "optional check-in campaign" |
| `03` | 14 | **Definition of done** still requires "A Tier 2 check-in campaign creates a Tier 1 response"; Epic P9 and P10 stories; Milestone 6 packet-family list; **Milestone 7 deliverable** "Tier 2 check-in to Tier 1 response" and its **exit check**; demo seed scenario; recommended mobile surface "Check-in response form"; authority dashboard surface; **demo narrative step 14**; scenario I's retained body |
| `04` | ~26 | §0 items 5/10/11/18; §7.5 `CHECKIN_CAMPAIGN`; §10.7 cache-op table, `OPEN_CHECKIN_FORM` opcode, the entire "Client-generated response using cached forms" subsection and the worked demo (steps 6–7); §19 Phase 5 deliverable **and exit criterion**; §20.6 acceptance target; §21 demo steps 10 & 15; §22 safe claim; §24 final product statement; §26.3 web surface; §26.6 ownership table (2 rows); §27.1, §27.2 step 9, §27.3, §27.5 steps 8 & 13 |

**Topology / packet journey — surviving references (🟩):**

| File | Count | The ones that matter |
|---|---:|---|
| `02` | 5 | Copy budgets "Files/fragments/topology observations"; storage eviction order step 3; performance budget "peer/topology observation retention"; **Architecture traceability matrix still has a whole `Topology` row** requiring a "Timestamped graph with stale behavior"; section heading "Location and topology model" |
| `03` | 12 | Workstream D owns "topology and packet-journey projection"; Epic P4 story "show topology and journey"; Epic P6 story "topology observations"; time-box 40–60% "topology/journey"; reset must restore "topology observations"; truth audit "Stale location/topology is labeled"; recommended surface "Topology/packet journey view"; **Milestone 4 is literally titled "Automatic multi-hop and topology"** with the deliverable "Topology view based on time-stamped observations" and the exit check "The topology view labels old relationships as old rather than live"; **demo narrative step 5** |
| `04` | 10 | §0 item 9; §2.2 item 10 ("publishes recent node, peer, packet-journey, and gateway observations to the local diagnostic/topology projection"); §24 final product statement; §26.4 durable entities "peer and topology observations with expiry"; §26.7 failure behavior; §26.8 budgets "topology retention"; §27.1 workstream 4; §27.3 acceptance "Stale people/topology markers"; **§27.5 judge demonstration step 4** |

The two files also now carry **numbering gaps that are themselves a signal**: `01` runs
DEC-020 → DEC-022, T2-011 → T2-013, and screen 12 → screen 14. A reader encountering
`T2-012` in the code (it is cited three times, see §7) has no way to look it up.

### 1.3 What the code actually does

**Check-in — the type surface exists, the loop does not (🟩🟦):**

| Layer | State |
|---|---|
| `packages/contracts/src/registry.ts` | `CHECKIN_CAMPAIGN: 0x70`, `CHECKIN_RESPONSE: 0x71` — present, frozen |
| `payloads.ts`, `enums.ts` | `CheckinCampaignPayload`, `CheckinResponsePayload`, `CheckinStatus` — present |
| `codec/field-maps.ts`, `size-limits.ts` | field maps and payload caps — present |
| `codec/builders.ts` | `buildCheckinCampaign()`, `buildCheckinResponse()` — **present** |
| `validator/schemas.ts` | schema rules — present; `AUTHORITY_ONLY` gate covers `CHECKIN_CAMPAIGN` |
| `policy/index.ts` | `act: 'open-checkin'` returned for `CHECKIN_CAMPAIGN` — present |
| `mapkit/assam-pack.ts` | cached form `AS-FORM-CHECKIN` ("Are you safe?", 3 fields) — present |
| **Mobile app** | **No check-in route.** `apps/mobile/app/` has 12 screens, none of them a form. `open-checkin` is returned by policy and consumed by nothing. |
| **Console** | `POST /api/campaigns` **rejects** `dataType: "check-in"` — documented as `HD-010` |
| **Tests** | scenario I has no test |

So a `CHECKIN_CAMPAIGN` packet can be built, validated, relayed and policy-decided, and the cached
form it names exists in the pack — but nothing can compose one and nothing opens the form.
`buildCheckinResponse()` has no caller.

**Topology — no projection, no screen, but the plumbing was built (🟩):**

| Layer | State |
|---|---|
| `registry.ts` | `NETWORK_STATUS_OBSERVATION: 0xf3` with an `edgeKind` field (`0 discovered, 1 transferred, 2 ack returned, 3 gateway upload, 4 radio bridge`) — present, **no builder, no producer, no consumer** |
| `limits.ts` | `STORAGE.TOPOLOGY_OBSERVATION_RETENTION_S = 900` — present, **read by nothing** |
| `map-ops.ts` | `upsert-peer-marker` operation — declared, handled by `MapProjection`, **never produced by `toMapOperations()`** |
| `PeerRepository` | peer observations with `lastSeenAtMs`, `sessionsCompleted/Failed` — present and used by routing |
| **Mobile** | no topology screen; `screen-registry.ts` lists "optional topology" only as a map layer with no data source |

`upsert-peer-marker` being unreachable also means 01 screen 5's layer *"recently reported
participating peers, where permitted"* and 01 §Map behavior's *"recently observed participating
nodes"* have no implementation — that gap is a direct consequence of the topology removal, and it
is not recorded anywhere.

### 1.4 What has to be decided

This is one decision, not two, and it is the highest-priority item in this audit. Either:

- **(a) The removal stands.** Then 01/02/03/04 must be swept for the ~83 surviving references,
  `03`'s Definition of done and Milestone 7, `04`'s Phase 5 exit criterion and final product
  statement must be amended, scenario I's body must be deleted or re-scoped, and
  `DECISIONS-HACKATHON.md` needs an `HD-0xx` recording *why* — because right now the only trace is
  a commit named "frontend". `HD-010` covers the console half of the check-in decision but says
  nothing about the spec edit that preceded it, and nothing at all covers topology.
- **(b) The removal was a mistake.** Then `git revert` the doc portion of `89feeed` and the
  check-in form screen and topology projection return to the backlog.

Until one is chosen, the repository's own precedence rule cannot be applied: `03`'s Definition of
done and `01`'s requirement catalogue give opposite answers about whether check-in is in scope.

---

## 2. Contradictions *between* the four spec files that the code resolved silently

`DECISIONS-HACKATHON.md` records two of these (`HD-007`). The rest are undocumented.

### 2.1 Validation pipeline: 15 gates (02) vs 14 gates (04 §8.1) — **undocumented**

`02` lists 15 ordered gates. `04 §8.1` lists 14, and they are not a subset — `04` has a gate the
other does not:

> `04 §8.1` gate 12: **"withdrawal, rate, and abuse rules"**

The implementation follows `02` exactly: `packages/contracts/src/reasons.ts` declares 15
`ValidationGate` constants, `validator/index.ts` runs them in `02`'s order, and there is **no rate
limiting, no abuse rule, and no withdrawal check anywhere in the codebase** (🟩 — `grep -ri
"rateLimit|abuse|withdrawal"` over `packages/ apps/ native/` returns only two comments).

This matters beyond the gate list. `04 §15.2` names *"rate limits by source token and packet type"*
as a **minimum prototype defense**, and `04 §7.5` defines a `CONTENT_WITHDRAWAL` message type that
does not exist in the registry. `04 §15.1` lists "fake SOS flooding" and "denial of service through
connection churn" as threats. Connection churn *is* bounded (`backoffMs()`, `shouldInitiate()`), but
packet-rate flooding by a single source token is not.

**Recommendation:** record the choice of `02`'s gate list as an `HD-` entry, and either implement a
per-source-token rate limit or move it to the explicit deferred list. It is currently in neither.

### 2.2 Routing modes: 5 (02) vs 6 (04 §6.3) — **undocumented**

`04 §6.3` adds a sixth mode `02` does not have:

> **Perimeter/fallback** — "Greedy routing is stuck at a local maximum; use alternate neighbors or
> limited flooding"

Not implemented, not mentioned. `HD-004` documents the absence of **directed forwarding** in
careful detail (and its reasoning — the privacy rule forbids location in advertisements — is sound
and worth keeping), but perimeter/fallback is a different mode and is unaddressed. In fairness it is
also moot: perimeter routing is a recovery mode *for* greedy geographic routing, which `HD-004`
already excludes.

**Recommendation:** one sentence appended to `HD-004` — "perimeter/fallback is excluded as a
consequence, since it only exists to recover greedy geographic routing."

### 2.3 Forwarding utility: 11 inputs (02) / 9 weighted terms (04 §6.2) vs 6 implemented

`packages/routing/src/index.ts` `UTILITY_WEIGHTS` has six terms: `gatewayProven`, `novelty`,
`urgency`, `linkReliability`, `age`, `batterySuitability`.

| Spec term | 02 | 04 §6.2 | Implemented |
|---|:--:|:--:|---|
| verified fresh gateway status | ✓ | `Wg` | ✅ `gatewayProven` |
| novelty of neighbour inventory/contact set | ✓ | `Wv` | ⚠️ approximated — measures *this node's* `copiesMade / copyBudget`, not the neighbour's expected novel reach |
| link reliability from recent sessions | ✓ | `Wr` | ✅ `sessionsCompleted / attempts` |
| battery suitability | ✓ | `Wb` | ✅ |
| packet age and urgency | ✓ | — | ✅ two separate terms |
| recent copy overlap | ✓ | `Wc` | ⚠️ hard gate (`knownHolders`, `peerInventory`) rather than a weighted penalty |
| failure/backoff state | ✓ | — | ⚠️ separate function `backoffMs()`, not a score term |
| **progress toward explicit destination/region** | ✓ | `Wd` | ❌ — documented, `HD-004` |
| **movement / store-carry potential** | ✓ | `Wm` | ❌ **undocumented** |
| **responder relevance / source-role utility** | ✓ | `Ws` | ❌ **undocumented** |
| **receiver queue/storage suitability** | ✓ | `Wq` | ❌ **undocumented** |

`02` permits simplification — *"Weights may be simplified for the hackathon, but behavior and reason
codes must be deterministic"* — and the implementation is deterministic and documented in-file, so
this is compliant. But `REL-009` explicitly names *"congestion"* among the inputs relay decisions
"must consider", and the receiver's queue state is never consulted. `HelloCapabilityPayload` already
carries `queueEpoch` and `highestWaitingPriority`, and `DiscoverySummary` carries both too, so the
input is available and simply unused.

**Recommendation:** record the three unimplemented terms in `DECISIONS-HACKATHON.md` alongside
`HD-004`, noting that `Wq` is cheap to add because the data already crosses the wire.

### 2.4 Message-type names differ between 02 and 04 §7.5

Implementation follows `02` (higher precedence) in every case. Worth recording because `04` is what
a judge or new contributor is most likely to read:

| `04 §7.5` name | `02` / implemented name | Note |
|---|---|---|
| `BACKEND_RECEIPT` | `BACKEND_ACKNOWLEDGEMENT` (`0x31`) | same meaning |
| `MEDICAL_POST` | `HOSPITAL_OR_MEDICAL_POST` in 02 prose; `MEDICAL_POST` (`0x41`) in code | code matches 04 here |
| `ROUTE_SEGMENT` | `ROUTE_BLOCKAGE_OR_CHANGE` in 02; `ROUTE_STATE` (`0x51`) in code | **code matches neither name** |
| `FILE_CHUNK` | `FILE_FRAGMENT` (`0xa1`) | same meaning |
| `CONTENT_WITHDRAWAL` | — | **defined in 04 only, absent from the registry** |
| `WEATHER_BULLETIN` | not in 02's registry | present in code as `0x61`, no builder, no producer |

`CONTENT_WITHDRAWAL` is functionally covered by `RECORD_TOMBSTONE` (`0x93`) and `CACHE_INVALIDATE`
(`0x94`), but nothing says so.

### 2.5 File size limit: three different numbers across four documents

| Source | Limit |
|---|---|
| `04 §9.3` | "default citizen file limit: **100–250 KB** for the prototype" |
| `FIL-007` (01) | "one strict maximum" — no number |
| `HD-003` (`DECISIONS-HACKATHON.md`) | "Demo maximum is **128 KB** (FIL-007)… ceiling is about 1 MB" |
| `HD-011` + `limits.ts` | `STORAGE.MAX_FILE_BYTES = 8 * 1024` — **8 KB**, derived from the BLE write budget |

`HD-011` supersedes `HD-003` and explains the derivation well (247 ATT MTU → 244 usable → 180
payload → 120 bytes fragment data × 64 fragments ≈ 8 KB). The problem is that `HD-003` was never
amended, so `DECISIONS-HACKATHON.md` states 128 KB and 8 KB as current facts in the same file.

### 2.6 File content categories: `04 §9.1` vs `HD-011`

`04 §9.1` lists six supported data categories including *"compressed offline map tiles"*, *"small
images useful for identification or damage context"*, *"PDFs or documents"*, and *"authority public
keys, revocation lists"*. `04 §9.2`–`9.3` build a whole protocol around them (thumbnails, MIME
sniffing, decompression-ratio limits, zip-bomb defence).

`HD-011` reduced this to **UTF-8 text only** — `ACCEPTED_MIME_CATEGORIES = new Set([MimeCategory.TEXT])`
— and the reasoning is excellent: *"no image decoder, no audio decoder, and no decompressor
anywhere in the prototype, so 'no unbounded decompression' and 'no executables' hold because the
capability does not exist."*

This is correctly documented in `DECISIONS-HACKATHON.md`. It is listed here only because `04 §9`
was never annotated, so anyone reading the blueprint will believe images are in scope — and `01`'s
`DEC-018` and `FIL-001`…`FIL-007` all say "files/**images**", as does the acceptance scenario
`J. File/image does not harm emergencies` and 03's `Epic P11 — Bounded file/image`.

**Recommendation:** add a one-line "superseded by HD-011" note at `04 §9.1` and `01 FIL-006`.

### 2.7 Envelope layout (already documented — `HD-007`)

Recorded here only for completeness, because `HD-007` correctly flags both as **unratified**:

- **Offset 58 width.** `04 §7.2` says 2 bytes for source/campaign class; `envelope-codec.ts` uses
  1 byte at 58 plus a reserved byte at 59.
- **Severity has no home in `04 §7.2`.** `02` "Fixed envelope fields" requires *"priority and
  severity"*; `04 §7.2` lists only Priority at byte 6. The implementation packs priority into the
  high nibble and severity into the low nibble of byte 6.

Both are still awaiting a decision. Given that `packet-codec.test.ts` and the fuzz corpus now depend
on this layout and the branch has generated persisted campaign artifacts with a stored
`artifactDigest`, ratifying the current layout is now considerably cheaper than changing it.

---

## 3. Specified, never built, and never recorded as deferred

The three "remaining" lists that a reader would consult — `FEATURE-MATRIX.md` §Complete remaining
list (3 items), `STATUS.md` §Explicitly deferred or unmeasured (4 items), and
`PROJECT-WORKFLOW.md` §10 (7 + 8 items) — do not contain any of the following.

### 3.1 The cached-content family cannot be created by anything (🟩)

`04 §10.7` is 140 lines — the longest single feature section in the blueprint — and is the answer it
gives to *"why is a 8–16 B/s modem useful?"*: Tier 2 sends **references, not assets**.

Build status by layer:

| Layer | `CACHE_CATALOG` | `CONTENT_ACTIVATE` | `RECORD_UPSERT` | `RECORD_TOMBSTONE` | `CACHE_INVALIDATE` |
|---|:--:|:--:|:--:|:--:|:--:|
| registry code | ✅ | ✅ | ✅ | ✅ | ✅ |
| payload type | ✅ | ✅ | ✅ | ✅ | ✅ |
| field map | ✅ | ✅ | ✅ | ✅ | ✅ |
| validator schema | ✅ | ✅ | ✅ | ✅ | ✅ |
| **builder in `codec/builders.ts`** | ❌ | ❌ | ❌ | ❌ | ❌ |
| encodable at all | ✅ | ✅ | ❌ (`HD-009`) | ✅ | ✅ |
| `toMapOperations()` case | ❌ | ✅ | ❌ | ✅ | ❌ |
| any producer in the repo | ❌ | ❌ | ❌ | ❌ | ❌ |

`codec/builders.ts` exports 18 `build*` functions. None of the five cached-content types has one, so
even the encodable ones cannot be constructed through the sanctioned path. The console composer
offers exactly two `dataType` values (`official-alert`, `regional-record`, per `API-SCHEMA.md`), so
no cached-content packet is ever produced.

`HD-009` documents that `RECORD_UPSERT` cannot be encoded — its `fields` member is a
caller-keyed map with no entry in `NESTED_FIELD_MAPS`, so `writeValue()` throws — and that is an
honest record. But `HD-009` frames it as one unusable type. In practice the whole family is inert,
and the consequences are unrecorded:

- **`04 §10.7`'s worked demo is not runnable.** Its step 3 is *"a small `RECORD_UPSERT`: Shelter A
  is full; Shelter B is open with 42 spaces."* That is precisely the packet that throws.
- **`04 §20.6` acceptance target** *"Cached-content activation — correct bundle/object/action
  resolved for 100% of clean valid test vectors"* has no test vectors and no test.
- **`T2-009`** (*"Tier 2 may activate/update predownloaded map objects, guides, translations, and
  forms by compact ID"*) is unmet: the Assam pack carries `AS-GUIDE-FLOOD`, `AS-GUIDE-LAND` and
  `AS-FORM-CHECKIN`, and nothing can activate any of them.
- **Three internal contradictions** now exist in the code itself:
  - `policy/index.ts` puts `RECORD_UPSERT` in `MAP_DELTA_TYPES`, so the policy engine returns
    `act: 'apply-map'` for it — but `packet-to-map.ts` has no `RECORD_UPSERT` case and returns `[]`.
  - `validator/schemas.ts:368` comments that its strictness protects *"RECORD_UPSERT and
    CONTENT_ACTIVATE, which mutate the map projection"* — `RECORD_UPSERT` mutates nothing.
  - `MessageType.CACHE_CATALOG` and `CACHE_INVALIDATE` are in the validator's `AUTHORITY_ONLY` set,
    gating a packet no code can create.

**What the branch did here:** nothing. The family was already in this state at the merge-base; the
branch's Tier 2 work (commits `2683afa`, `8f2faad`, `c4d9e31`, `b38e6bc`) went into the
**WavePX/ggwave transport** and the **regional-record** path instead, which is a defensible
priority — regional records carry the same map changes through `SHELTER`/`HAZARD`/`ROUTE_STATE`
without needing the cached-content indirection. That is a real design decision and it is
undocumented. See §9 for the recommended wording.

### 3.2 Explainable triage assistance — `04 §8.8` (🟩)

Fully specified, with a formula:

```text
triage_score = emergency_severity_weight + trapped_or_immobile_weight
             + injured_people_weight + stale_contact_weight
             + low_battery_contact_risk + corroboration_weight
             - resolved_or_responder_arrived_weight
```

`04 §19` Phase 4 lists *"rescuer RSSI trend view and explainable triage score"* as a deliverable and
`04 §27.1` assigns it to a workstream. **Not implemented.** `grep -i triage` over the whole
repository returns only two responder capability tags in `apps/backend/src/demo-seed.ts`.

Every input the formula needs is already present (`header.severity`, `mobility`, `injured`,
`PacketObservation.receivedAtMs`, `batteryBand`, `listObservations()` for corroboration,
`IncidentRecord.state`), so this is a small, self-contained addition — but it is not on any list.

### 3.3 Rescuer final-approach RSSI view — `04 §8.7` (🟩)

Specified in detail, including the honesty constraint (*"signal becoming stronger/weaker, not an
exact metre estimate… never as a precise distance or burial-depth measurement"*), and cross-checked
by `04 §25`'s supersession record (*"No burial-depth claim and rescuer RSSI approach aid — Added
explicitly"*).

RSSI is captured end-to-end — `PeerObservedEvent.rssi`, `RecordReceivedEvent.rssi`,
`PacketObservation.rssi`, `PeerObservationRecord.rssi`, and `relay-loop.ts:120` persists it — but
**no UI surfaces it**. `apps/mobile/app/responder/detail.tsx` shows no proximity trend, no last-BLE-
contact time, and no proximity-handshake control for `RESPONDER_ARRIVED`. `ArrivalEvidence` has a
`PROXIMITY_ASSISTED` value that nothing can select.

The data is collected and thrown away. Not on any list.

### 3.4 Family/group hashed check-in code — `04 §7.6`, `§8.6`, `§25` (🟩)

`04 §7.6`'s example SOS payload includes `group_code_hash: optional opted-in family/group
rendezvous identifier`, `§8.6` gives it a behaviour row, and `§23` open decision 12 is about its
privacy/rotation rules. **Absent from `SosCreatePayload` and from every field map.** Not on any
list. (Reasonable to cut — see §9 — but the cut is unrecorded.)

### 3.5 Language filtering and cached translations — `04 §8.6`, `01`, `02` (🟩)

Specified as: *"Select a matching cached translation when possible; otherwise show the compact
fallback text and mark that the preferred language was unavailable."*

What exists:
- `PackManifest.languages` = `['en', 'as', 'bn', 'hi']` ✅
- `PackObject.labels` — a `Record<languageTag, string>` ✅
- `PreparedPhrase.text` — 4 phrases × 4 languages in `assam-pack.ts` ✅
- `SosCreatePayload.language` and `OfficialAlertPayload.language` on the wire ✅
- `FIELD_LIMITS.MAX_LANGUAGE_PREFERENCES = 3` ✅

What is missing: **any resolution step.** There is no i18n layer, no locale state, and no code path
that reads `PackObject.labels` or `PreparedPhrase.text`. `grep -i "i18n|locale"` over
`apps/mobile/` returns only two `toLocaleTimeString` calls. The Assamese, Bengali and Hindi strings
committed in `assam-pack.ts` are unreachable, and `preparedPhraseId` is written to the wire but
never resolved for display anywhere.

`FIELD_LIMITS.MAX_LANGUAGE_PREFERENCES = 3` also implies an ordered list, but
`SosCreatePayload.language` is a single tag — the limit is unenforceable and unused.

Not on any list. This is a visible demo gap: a judge selecting "Assamese" in the SOS composer gets
an English UI and an English phrase list.

### 3.6 Accessibility — `01` §Accessibility and disaster usability, `04 §17.5` (🟩)

`01` lists eleven mandatory items (large touch targets, no colour-only state, screen-reader labels,
vibration alternatives, list equivalents for maps, visible stop controls, one-handed use). `03`'s
Workstream A must deliver *"accessibility and disaster-state copy"*.

Measured: **22 accessibility props across 3 of the 15 mobile screen files**
(`(tabs)/index.tsx`, `(tabs)/map.tsx`, `tier2.tsx`). Nine screens have none. Severity is
communicated by colour in `composer.tsx`'s `sevLevels` block with a text label alongside (so that
one passes), but `screen-registry.ts` `Map` still lists *"a LIST equivalent for accessibility and
low-performance devices"* as required and marks the screen `partial`.

**Partially documented, in the wrong place.** `IMPLEMENTATION-CHANGES-2026-08-23.md` §Scope says
*"Accessibility, privacy, and broader production-security work were explicitly outside this
implementation pass"* — a correct and honest statement. But `FEATURE-MATRIX.md` §Complete remaining
list and `STATUS.md` §Explicitly deferred both omit it, and those are the two documents `README.md`
and `PROJECT-WORKFLOW.md` point readers at. A reader following the pointer chain never sees it.

### 3.7 Packet families with no producer (🟩)

`DEC-014` — *"All requested packet families are in scope. Each has schema, ownership, priority,
state behavior, map behavior, and tests"* — and `03` working rule 7 — *"Do not remove a required
packet family merely because it is not central to the main demo"* — are the governing rules.

Beyond the five cached-content types (§3.1), these registry entries have no builder and no producer:

| Type | Code | Status |
|---|---|---|
| `WEATHER_BULLETIN` | `0x61` | schema ✅, field map ✅, builder ❌, producer ❌, map op ❌ |
| `NETWORK_STATUS_OBSERVATION` | `0xf3` | schema ✅, field map ✅, builder ❌, producer ❌ — the topology packet (§1.3) |
| `PACKET_REQUEST` | `0xf2` | builder ✅, **never sent** — correctly documented as `HD-001` |

`RESOURCE_REQUEST` (`0x80`) has `buildResourceRequest()` but no caller — `01` grants General Public
*"create a resource request when enabled"* and `03` Epic P9 lists it; there is no UI for it.

`DEC-014`'s "and tests" clause is unmet for all of the above.

### 3.8 The evidence bundle does not exist (🟩)

`03` §Final evidence package structure specifies thirteen artifacts. `evidence/README.md` restates
seven of them as a table with named owners. **`evidence/` contains only that README.**
`tools/ggwave-artifact/src/` is an **empty directory**.

| Required artifact | Owner | Present |
|---|---|:--:|
| `packet-size-sheet.md` | WS-C | ❌ |
| `device-matrix.md` | WS-B | ❌ |
| `timing-sheet.md` | WS-B/F | ❌ |
| `tier2-decode-report.md` | WS-F | ❌ |
| `battery-report.md` | WS-F | ❌ |
| `scenario-runs/` A–K | WS-F | ❌ |
| `demo-rehearsal.md` | WS-F | ❌ |
| Golden vector files | WS-C | ❌ — flagged ⚠️ in `CONTRACT-FREEZE.md` |
| Prepared radio-program WAV master + SHA-256 + regeneration script (`02`, `04 §10.6`) | WS-F | ❌ |

Most of these legitimately require hardware and are correctly covered by
"physical evidence, not code" in `FEATURE-MATRIX.md` item 1. **Four do not:**

- The **packet size sheet** needs no hardware. `04 §26.8` requires an evidence row per demo packet;
  `Gate I` in `CONTRACT-FREEZE.md` marks "encoded sizes recorded" as ⚠️. The numbers already exist
  as comments in `limits.ts` (*"full SOS 84 B, official alert 69 B, hazard 44 B, shelter 32 B"*) —
  they just were never written into an evidence file.
- **Golden vector files** need no hardware; `CONTRACT-FREEZE.md` says round-trip and determinism
  tests exist but committed vectors remain.
- The **prepared radio-program artifact** is generated at runtime by
  `POST /api/campaigns/:id/broadcast-program` (with a real SHA-256 `artifactDigest`), but there is
  no committed master, no expected-packet manifest file, and no `04 §10.6` spoken-program structure
  (station ID → manifest → alert → explanation → shelter → hazard → repeat → …). The branch built
  the *generator*; the *artifact* is not in the repository.
- `scenario-runs/` for the **nine scenarios that do have automated tests** (see §3.9) could be
  written from test output today.

### 3.9 Acceptance scenario coverage (🟦)

`03` requires eleven scenarios A–K. Automated coverage, measured by running the suite (**69 tests
passing**, `packages/simulator/src/acceptance.test.ts` + `apps/backend/src/gateway-loop.test.ts`):

| Scenario | Test | Where |
|---|:--:|---|
| A — offline three-hop SOS | ✅ | `acceptance.test.ts` (2 tests, incl. "no server is ever contacted") |
| B — local responder completion, no internet | ✅ | `acceptance.test.ts` |
| C — store-carry-forward | ✅ | `acceptance.test.ts` |
| D — conditional mesh-to-internet | ✅ | `gateway-loop.test.ts` (2 tests) |
| E — internet-to-mesh map update | ✅ | `gateway-loop.test.ts` |
| F — Tier 2 **microphone** decode | ❌ | requires hardware — correctly deferred |
| G — Tier 2 direct-audio equivalence | ✅ | `acceptance.test.ts` (combined with H) |
| H — radio-to-mesh bridge | ✅ | `acceptance.test.ts` |
| I — Tier 2 check-in | ❌ | removed from the spec (§1); body retained |
| J — file/image does not harm emergencies | ✅ | `acceptance.test.ts` |
| K — stale people | ✅ | `acceptance.test.ts` |

Nine of eleven. This is good coverage and the two gaps are both explained (one hardware, one
scope). It should be *stated* somewhere — no document currently maps scenarios to tests, which is
exactly what `03` §Requirement-to-test traceability demands (*"Every mandatory requirement… must
have owning epic, implementation location, test reference, current status, evidence link, known
limitation"*). That traceability matrix does not exist in any form.

### 3.10 `DemoMetrics` is defined and never produced (🟩)

`01` §Product analytics for the demo lists ten questions the product "must emit enough local events
to answer". `packages/contracts/src/events.ts` encodes them precisely as the `DemoMetrics`
interface — discovery latency, request-to-stored, distinct peers, duplicates suppressed, encoded
bytes by type, gateway proven time, backend ack latency, Tier 2 frame counts, map objects changed by
transport.

`grep -rn "DemoMetrics"` returns **one hit: the definition.** Nothing computes it, nothing renders
it. The underlying `DiagnosticEvent` stream *is* produced and rendered (`apps/mobile/app/tier2.tsx`
filters it; `diagnostics.tsx` renders it), so the raw material exists — the aggregate does not.

---

## 4. Mobile registry duplication and wire hazards

`MODULE-BOUNDARIES.md` rule 2 is *"One source of truth per registry… The checker fails the build if
any other file re-declares them."* `03` says *"agents must avoid duplicating the same packet
registry or policy in mobile and backend."*

`apps/mobile/` re-declares protocol enumerations four separate times. None of it is caught, because
`tools/boundaries/check-boundaries.mjs` only scans `apps/` for three regexes
(`SOS_CREATE\s*:\s*0x`, `PROTOCOL_MAGIC\s*=\s*0x`, `CLASS_BUDGETS\s*=\s*\{`).

### 4.1 Four dead data files carrying contradictory numeric IDs (🟩)

`apps/mobile/data/{categories,severities,mobilityOptions,preparedPhrases}.ts` are imported by
**nothing** — `grep` for every plausible import path returns zero hits. They are dead code, but they
are dead code that looks authoritative and disagrees with the frozen contract on every value:

| `data/categories.ts` | its `id` | `EmergencyCategory` at that value |
|---|:--:|---|
| Fire | 0 | `MEDICAL` |
| Flood | 1 | `TRAPPED` |
| Earthquake | 2 | `FIRE` |
| Medical | 3 | `FLOOD` |
| Landslide | 4 | `VIOLENCE` |
| Cyclone | 5 | `STRUCTURAL_COLLAPSE` |
| Building Collapse | 6 | `MISSING_PERSON` |
| Chemical/Gas | 7 | `OTHER` |
| Violence | 8 | *out of range* |
| Other | 9 | *out of range* |

`data/mobilityOptions.ts` is off by one at every position (`Mobile: 0` vs `Mobility.UNKNOWN = 0`).

If anyone wires these up believing they are the registry, every SOS category and mobility value on
the wire becomes wrong, and it will not fail a build or a test — the values are all in range.

### 4.2 The composer maps to the wire with an inline magic array (🟩)

`apps/mobile/app/sos/composer.tsx:48-50`:

```ts
const categoryWire = [0, 2, 3, 7, 7, 7, 5, 7, 4, 7];
const mobilityWire = [1, 2, 3, 4, 0];
const languageTags = ['en', 'hi', 'mr', 'as'];
```

The mapping is **correct** — verified position by position against `EmergencyCategory` and
`Mobility`. That is the good news. Three problems remain:

1. **It is a fifth copy of the registry**, in a screen file, with no reference to
   `@dsm/contracts`. Nothing keeps it correct if a code is ever added.
2. **`EmergencyCategory.TRAPPED` (1) and `MISSING_PERSON` (6) are unreachable from the UI.** Four
   composer options (Earthquake, Landslide, Cyclone, Chemical/Gas) collapse to `OTHER` — acceptable,
   since no enum value exists for them — but `TRAPPED` is the **flagship demo category**: `03`
   demo narrative step 2 and `04 §21` step 1 and `§27.5` step 2 all specify *"a trapped-person Level
   3 SOS"*. The composer cannot produce one. Trapped-ness can only be expressed through
   `mobility = TRAPPED`, which is a different field with different downstream meaning.
3. **`languageTags` includes `'mr'` (Marathi) and omits `'bn'` (Bengali).** The Assam pack declares
   `languages: ['en', 'as', 'bn', 'hi']`. Marathi is a leftover from the pre-Assam default
   (`IMPLEMENTATION-CHANGES-2026-08-23.md` §1 records the Mumbai → Assam region migration; this
   list was missed). Bengali is a major Assam language, is present in all four pack phrases, and
   cannot be selected.

### 4.3 Two contradictory prepared-phrase registries (🟩)

`preparedPhraseId` travels on the wire (`field-maps.ts:73` and `:87`) and is meant to resolve
against the content pack — `02` §Object resolution: *"Incoming compact object IDs resolve only
through the typed registry."*

| ID | `assam-pack.ts` `phrases` (the pack registry, 4 entries × 4 languages) | `apps/mobile/data/preparedPhrases.ts` (10 entries, English only) |
|:--:|---|---|
| 0 | — | Need immediate rescue |
| 1 | Trapped, cannot move | Trapped under debris |
| 2 | Need medical help | Need medical help |
| 3 | Water rising | Water rising fast |
| 4 | Safe, need supplies | Building unstable |
| 5–9 | — | Fire spreading / Children with us / Cannot move / Gas leak detected / Safe but need supplies |

ID 4 means opposite things in the two registries. IDs 0 and 5–9 have no pack entry, so a receiving
phone would hit the `MAP-008` missing-object path. The mobile file is currently dead (§4.1) and the
composer has **no phrase picker at all**, so nothing sends a `preparedPhraseId` today — the hazard
is latent, not live. But `01` screen 3 requires *"short constrained note **or prepared phrase**"*,
so building the picker is expected, and whoever builds it will reach for the file in
`apps/mobile/data/`.

### 4.4 The short-note limit is a character count, not a byte count (🟩)

`composer.tsx` sets `maxLength={64}` on the note field. The frozen limit is
`FIELD_LIMITS.SHORT_NOTE_BYTES = 120` **bytes**, enforced by
`validator/schemas.ts:55` as `{ kind: 'text', field: 'shortNote', maxBytes: 120 }`.

For ASCII, 64 chars = 64 bytes and the UI limit is merely over-strict. For the Assamese, Bengali and
Hindi that the composer offers, Devanagari and Bengali script encode at **3 bytes per character in
UTF-8**, so 64 characters is up to **192 bytes** — over the limit.

The failure mode is not silent. `mobileController.saveSos()` validates before committing (per
`OFF-002` and `STATUS.md`: *"The packet is validated and committed locally before the UI reports
success"*), so the encoder throws, `handleConfirm()` catches, and the user sees
`Alert.alert('SOS not saved', …)`. **A non-Latin-script user filling the note field can be blocked
from creating an SOS.**

The team already knows about this class of bug on the other side of the system:
`apps/backend/src/broadcast-program.test.ts:143` is named *"campaign text limits are enforced in
UTF-8 bytes"*. The mobile side was not covered.

### 4.5 The boundary checker is narrower than `MODULE-BOUNDARIES.md` describes (🟩)

`MODULE-BOUNDARIES.md` §5 states: *"Truthful copy is a build error — The checker greps user-facing
copy for `verified`…, `guaranteed`, and `help is coming`."*

The check runs over exactly **two files**:

```js
const CLAIM_FILES = [
  join(ROOT, 'packages', 'contracts', 'src', 'profile.ts'),
  join(ROOT, 'packages', 'validator', 'src', 'index.ts'),
];
```

No mobile screen and no web console file is scanned. `INT-004` ("the UI must not use 'verified'"),
`DEC-022` and `03`'s Truth audit all concern **user-facing UI copy**, which is the part not covered.
The current copy does appear to be clean on inspection, so this is a gap in the guard rather than a
live violation — but the doc describes a guarantee the tool does not provide.

Two smaller gaps in the same file:
- Rules 1–3 (dependency graph, contracts purity, platform-leak) scan `packages/` and `tools/` only.
  `apps/` is scanned for rule 4 alone.
- `PLATFORM_TERMS` includes `'ggwave'` but not `'wavepx'` / `'WavePX'`, which is the name the branch
  actually uses at the transport boundary now.
- The walker only collects `.ts`/`.tsx`. `tools/mesh-simulator/engine.js` (untracked, on this
  working tree) is invisible to it.

---

## 5. Contract surface that exists but is unreachable

Distinct from §3 (never built) — these are declared, wired into consumers, and cannot be triggered.

| Declared | Consumer exists | Producer exists | Consequence |
|---|:--:|:--:|---|
| `MapOperationKind: 'set-resource-state'` | ✅ `projection.ts:219` | ❌ | folded into `upsert-resource`; the standalone op is dead |
| `MapOperationKind: 'set-capacity'` | ✅ `projection.ts:220` | ❌ | as above |
| `MapOperationKind: 'clear-hazard'` | ✅ `projection.ts:265` | ❌ | `02`'s *"add, update, or **clear** a hazard"* is only reachable via `RECORD_TOMBSTONE` |
| `MapOperationKind: 'upsert-peer-marker'` | ✅ `projection.ts:328` | ❌ | **`MAP-003`'s "permitted peer" layer and `01` screen 5's peer layer have no data source** (see §1.3) |
| `PolicyContext.regionCode` | — | ✅ populated | never read by `DefaultPolicyEngine.decide()` |
| `PolicyContext.packRegionKnown` | — | ✅ populated | never read — gate 13 (geographic relevance) is deferred to policy per `HD-005`, and policy only checks `displayRadiusM` distance, never region |
| `FIELD_LIMITS.MAX_LANGUAGE_PREFERENCES` | — | — | no ordered-language field exists to bound |
| `STORAGE.TOPOLOGY_OBSERVATION_RETENTION_S` | — | — | topology removed (§1) |
| `ArrivalEvidence.PROXIMITY_ASSISTED` | ✅ schema | ❌ | no proximity handshake UI (§3.3) |
| `TransportKind: 'tier2-direct'` on mobile | ✅ labelled in `tier2.tsx:98` | ❌ | `AudioInputAdapter.feedDirectAudio()` and native `feedWavePxDirectPcm` both exist; **nothing in `apps/mobile/` calls them** |

The last row deserves emphasis. `T2-003` requires the direct clean-audio path, and `04 §26.2`
screen 10 requires the receiver to distinguish its source. The native Kotlin
(`AndroidRadioBridgeModule.kt:91,118`) and the TS adapter
(`native/android-radio-bridge/src/index.ts:114`) both implement it end to end. The mobile Tier 2
screen offers only a microphone start/stop toggle and renders `'WavePX direct input'` as a label for
packets that can never arrive that way on a phone. The direct path is demonstrated in the **browser
console** instead (`WEB-CONSOLE.md` §Broadcast Studio, audio-file recovery) — which satisfies
acceptance scenario **G** at the system level and is tested (🟦), but does not satisfy the *screen*
requirement. `screen-registry.ts` correctly marks `Tier2Listen` as `partial`.

---

## 6. Downstream documents that overstate or have drifted

### 6.1 `screen-registry.ts` marks screens `complete` whose own `mustShow` list is unmet (🟩)

The registry's header calls it *"the checklist reviewers and QA run against, so nothing is quietly
dropped"* and instructs *"Update it in the same PR that builds the screen."* Two entries are wrong
in the direction that matters.

**`SosComposer` — `status: 'complete'`.** Its `mustShow` list has seven items. Three are absent from
`apps/mobile/app/sos/composer.tsx`:

| `mustShow` item | Present |
|---|:--:|
| category, 4-level severity, people count, injured count | ✅ |
| mobility: mobile / limited / immobile / trapped / unknown | ✅ |
| short constrained note **or prepared phrase** | ⚠️ note only, no phrase picker |
| **location source, accuracy, and age** | ❌ the word "location" appears once, in a comment |
| language preference | ✅ (but see §4.2) |
| **confirmation of what will be shared locally** | ❌ |
| creation must succeed with NO location and NO internet | ✅ (handled in the controller) |

`01` screen 3 requires all of these, and `01`'s data-minimisation section makes the share
confirmation a privacy requirement, not a nicety: *"Show users what will be broadcast locally"*
(`04 §15.4`).

**`NearbyIncidents` — `status: 'complete'`, with a narrowed requirement.** Its `mustShow` reads
*"Responder: sort by severity **ONLY**"*. `01` screen 6 requires: *"sorting by severity, age,
distance, people/injury indicators, assignment state, and last update"*, and adds the rule
*"Severity alone cannot hide older unhandled cases indefinitely"* — which severity-only sorting
does exactly. The registry did not record an unmet requirement; it **rewrote the requirement** and
then marked it satisfied. That is the specific failure mode `03` warns about
(*"Agents must not hide a decision inside one implementation file"*).

### 6.2 `FEATURE-MATRIX.md`: "All 12 required routes exist" is true against one list and not another (🟩)

The mobile app has 12 screens matching `04 §26.2`'s post-edit list exactly. But `03` §Recommended
product surfaces gives a **different** 12-item list for the same app, and two of its entries have
no route:

| `03` mobile surface | Route |
|---|---|
| Role entry, offline home, SOS creation + active state, nearby incidents, offline map, local resources/hazards, delivery timeline, relay/gateway, Tier 2 listening, diagnostics | ✅ all present |
| **Topology/packet journey view** | ❌ (§1) |
| **Check-in response form** | ❌ (§1) |

`03` outranks `04` in the precedence order. So "all 12 required routes exist" is correct only if
`04 §26.2` is the operative list — which it is only *because of* the undocumented `89feeed` edit.

### 6.3 Test count drift (🟩)

`STATUS.md`, `IMPLEMENTATION-CHANGES-2026-08-23.md` §9, and `PROJECT-WORKFLOW.md` §9 all state
**68/68 passing**. The suite currently reports **69**:

```text
ℹ tests 69   ℹ pass 69   ℹ fail 0
```

Minor, but these are the documents that carry the verification evidence block.

### 6.4 `DECISIONS-HACKATHON.md` has two decisions numbered `HD-010` (🟩)

- `## HD-010 — The console composes alerts and map records, not check-ins`
- `## HD-010 — Advertising channels, collisions, and the corrected byte budget`

Both are substantive and both are referenced elsewhere: `surface-registry.ts` and `API-SCHEMA.md`
cite `HD-010` meaning the first; `PROJECT-WORKFLOW.md` §7 cites `HD-010` meaning the first;
`limits.ts`'s advertisement block implements the second. A cross-reference to "HD-010" is currently
ambiguous. The second should become `HD-014` (or the first renumbered), and `HD-003`'s superseded
128 KB figure should be annotated at the same time (§2.5).

### 6.5 `MODULE-BOUNDARIES.md` §5 overstates the truthful-copy guard

Covered in §4.5.

### 6.6 `WEB-CONSOLE.md` describes the Android receiver as future work (🟩)

> *"Raw Tier 2 bytes are not wrapped as WavePX text, so the frozen frame contract remains consumable
> by the **future** Android receiver."*

The Android receiver shipped on this branch — `WavePxAudioReceiver.kt` (122 lines),
`wavepx-jni.cpp`, a vendored ggwave C++ decoder, and a four-ABI native build. The file was updated
on this branch (`+59/-…`) but this sentence survived.

### 6.7 `CONTRACT-FREEZE.md` Gate I still carries two open ⚠️ items

*"committed golden vector files remain (WS-C)"* and *"full evidence sheet remains (WS-C)"*. Both are
accurate and honest; noted here because §3.8 shows neither has moved and both are achievable
without hardware.

### 6.8 `PROJECT-WORKFLOW.md` §7 "Redundancy & Overlap Analysis" misses four real overlaps

The section is a genuinely good piece of work — it correctly catalogues `PACKET_REQUEST`,
check-in dead code, `RECORD_UPSERT`, the two transport adapters, and the two WavePX receivers, and
correctly concludes "not redundant" for each. It does not catch:

- the four dead `apps/mobile/data/` files (§4.1);
- the two contradictory prepared-phrase registries (§4.3);
- the inline `categoryWire` / `mobilityWire` arrays (§4.2);
- the four unreachable `MapOperationKind` values (§5).

Its opening claim — *"✅ No Redundant Features Found in Core Logic… Build fails if re-declared
elsewhere"* — is true for the three regexes the checker actually tests, and not true in general.

---

## 7. Code comments citing spec anchors that the `89feeed` edit moved (🟩)

These are one-line fixes, but each one sends a reader to the wrong place — and two of them cite an
identifier that no longer exists at all.

| File | Says | Should say |
|---|---|---|
| `packages/contracts/src/reasons.ts:8` | *"the Diagnostics screen (01-… screen 13)"* | 01 screen **12** |
| `packages/contracts/src/campaign.ts` (Tier2Metrics) | *"01-… screen 11"* | 01 screen **10** (11 is now Profile) |
| `packages/tier2/src/receiver.ts:5, :198` | *"01-… screen 11"* | 01 screen **10** |
| `packages/contracts/src/campaign.ts:11` | *"A check-in RESPONSE leaves by Tier 1 (T2-012)"* | **`T2-012` was deleted from 01** |
| `packages/contracts/src/payloads.ts` (`CheckinResponsePayload`) | *"T2-012 / DEC-008"* | as above |
| `packages/tier2/src/index.ts:9` | *"A check-in RESPONSE becomes a Tier 1 packet (T2-012)"* | as above |
| `apps/mobile/src/screens/screen-registry.ts:4` | *"04-BLUEPRINT 26.2 'Required mobile screens' (**13 screens**)"* | 26.2 now lists **12**; the file itself contains 12 and sets `REQUIRED_SCREEN_COUNT = 12` |
| `packages/contracts/src/campaign.ts:9`, `tier2/src/index.ts:6` | *"**DEC-007**: WavePX is Tier 2 ONLY"* | `DEC-007` says *"**ggwave** is Tier 2 only"* — see §8.2 |

The `T2-012` citations are the notable ones: three separate source files justify a design decision
by citing a requirement ID that a documentation commit removed. That is the exact coupling `03`'s
change-control rule was written to prevent, observed in the wild.

---

## 8. What branch `saksham-the-great` did, area by area

Seven commits, 128 files, +15,626 / −1,147 (excluding `package-lock.json` and Gradle caches).
**`docs/agent-reference/` is untouched by this branch** — the spec edit (§1) predates the
merge-base.

| Commit | Scope |
|---|---|
| `b64cccb` Build disaster mesh runtime and operations console | backend services, gateway loop, console shell, mobile controller, SQLite repositories |
| `ab571e7` fixed backend app | backend fixes |
| `2683afa` feat: make WavePX a standalone audio station | vendored WavePX (21 new files), `audio-link.ts` rewrite, station UI |
| `1260164` Improve MapLibre operations and harden Android relay | `map.tsx` (+387/−…), `offline-map.ts`, `assam-pack.ts`, GATT hardening, `RelayForegroundService.kt` |
| `8f2faad` Implement WavePX Tier 2 audio pipeline | ggwave C++ vendored into `native/`, `wavepx-jni.cpp`, `WavePxAudioReceiver.kt`, four-ABI build |
| `c4d9e31` Streamline WavePX campaign and mobile map receipts | campaign desk workflow, received-packet ledger, `keyed-reconciler` |
| `b38e6bc` Fix legacy campaign crash in WavePX console | legacy campaign preview rebuild from stored canonical bytes |

### 8.1 Against §1 (the half-finished spec edit)

**Nothing.** The branch inherited it and did not notice. `HD-010` (console drops check-in composition)
was written *before* the merge-base and is the closest thing to a record; it explicitly frames itself
as a **"Deliberate scope reduction, not a spec resolution"** and states *"WEB-004 is unmet until a
check-in composer returns"* — which is exactly the right posture, and is why this is a documentation
gap rather than a dishonesty. Nobody connected it to the deletion of `T2-012` and the check-in
protocol definitions.

### 8.2 Tier 2: the branch layered WavePX over ggwave — a real architecture change, thinly recorded

`DEC-007` says *"**ggwave** is Tier 2 only"*. The branch introduced **WavePX** as the audio
orchestration layer, keeping ggwave as WavePX's internal physical modem. This is compatible with
`DEC-007` in substance — `04 §10.5` explicitly anticipates it: *"The packet framing, validation,
integrity, and client policy layers remain independent from ggwave so that a different modem can be
evaluated after the hackathon."*

The record of it is good in places and thin in others:

| Recorded | Where |
|---|---|
| Why WavePX was vendored (npm package unavailable, no built `dist/lib`) | `vendor/wavepx/NOTICE.md` ✅ |
| Upstream commit pin `81c7c30…` and MIT licence | `NOTICE.md`, `audio-link.ts`, `WEB-CONSOLE.md` ✅ |
| "ggwave remains WavePX's physical modem" | `NOTICE.md`, `STATUS.md`, `FEATURE-MATRIX.md` ✅ |
| That raw frames use a narrow `onRawReceive`/`decodeSamples` extension rather than WavePX's QR/image/text/game message types | `NOTICE.md` ✅ |
| **That `DEC-007`'s wording now needs reading as "the acoustic stack", not "the literal library"** | ❌ nowhere |
| **An `HD-` entry for the substitution** | ❌ nowhere |

Consequences visible in the code: `campaign.ts:9` and `tier2/index.ts:6` both assert
*"DEC-007: WavePX is Tier 2 ONLY"*, silently substituting the product name into a quoted decision.
`tools/boundaries/check-boundaries.mjs` `PLATFORM_TERMS` still bans `'ggwave'` from domain packages
but does not ban `'wavepx'`, so the guard no longer covers the name actually in use.

The branch also brought the ggwave C++ source into `native/android-radio-bridge/android/src/main/cpp/vendor/ggwave/`
(2,007-line `ggwave.cpp`, `fft.h`, a Reed–Solomon implementation, two LICENSE files and a
`NOTICE.md`) — correctly attributed, and a genuine delivery: `04 §10.2` Path A now has a real
on-device implementation.

### 8.3 Tier 2 frame format vs `04 §10.3`

`packages/tier2/src/frame-codec.ts` implements a 12-byte-overhead frame. `04 §10.3` specifies
thirteen fields. The mapping:

| `04 §10.3` field | Implementation |
|---|---|
| Wake/preamble tones, Sync word, End marker/guard | delegated to ggwave/WavePX ✅ reasonable |
| Forward error correction | delegated to ggwave Reed–Solomon ✅ reasonable, and `04 §10.5` says so |
| Protocol version | ✅ byte 1 high nibble |
| Campaign ID | ✅ bytes 3–4 (16-bit handle) |
| Packet ID prefix | ✅ bytes 6–7 (16-bit handle) — plus the **complete canonical packet** in the payload |
| Fragment index/count | ✅ bytes 1–2 |
| Payload length | ⚠️ implicit from frame length rather than an explicit field — safe, since the frame is length-delimited by the modem |
| CRC | ✅ 2 bytes trailing |
| **Frame sequence** (distinct from fragment index) | ❌ absent |
| **Authority channel ID** | ❌ absent |

The **authority channel ID** absence is the substantive one. `04 §10.3` uses it to *"select prototype
campaign/source policy"*, `04 §15.2` names *"provisioned authority campaign/channel registry"* as a
minimum prototype defence, and `04 §10.8` says the build *"validates… the locally provisioned
authority-channel registry"*. There is no channel registry in the code. What exists instead is
`SourceClass.TIER2_BROADCAST` in the canonical envelope, which the validator's `rolePermits()` treats
as privileged — a coarser but functional equivalent. Undocumented.

Two things the branch got notably right here, worth preserving in any rewrite:

- **The frame carries the complete canonical Tier 1 packet**, not a manifest-reconstructed one. The
  in-file comment explains why: *"A phone that hears a new radio campaign must not need a private
  copy of the packet header in order to recover its identity or meaning."* That is a stronger
  reading of `T2-004`/`T2-011` than the spec required, and `Gate V` in `CONTRACT-FREEZE.md` records
  it correctly.
- **`Tier2Receiver` works with no resolver at all** (`constructor(private resolver?: …)`), so
  campaign completeness degrades to `campaign-incomplete` rather than failing — matching `02`'s
  *"Never fabricate missing map changes."*

One naming nit: `crc16()` in `frame-codec.ts` is `crc32(bytes, 0, end) & 0xffff` — a truncated
CRC-32, not a CRC-16 polynomial. Functionally fine for corruption detection; the name is misleading.

### 8.4 Map and Android relay

`1260164` is well documented — `IMPLEMENTATION-CHANGES-2026-08-23.md` §§1–6 cover the persistent
MapLibre offline pack, the Assam region migration, restart-safe SOS recovery, SQLite bounds, GATT
callback-confirmed writes and the foreground `Stop` broadcast, in file-by-file detail. This is the
strongest documentation in the repository and is the model the rest should follow.

Two items it records that no other doc carries forward:

- The Mumbai → Assam region migration, including the Zustand persistence migration. The stale
  `'mr'` language tag in the composer (§4.2) is a missed edge of exactly this migration.
- `MapLibre logged 'Invalid geometry in line layer'` (§10, nonfatal warnings) — *"should be traced
  to a specific route/line geometry separately."* Still open; the Assam pack ships four route edges,
  so it is a bounded search.

### 8.5 Backend and console

`API-SCHEMA.md` was updated on this branch (+49 lines) and is accurate against `server.ts` —
26 route handlers, all documented, all marked ✅. `WEB-CONSOLE.md` explains the nine registered
surfaces → four workspaces consolidation clearly. `02`'s *"Conceptual online API obligations"* lists
eleven required operations; all eleven are present.

The branch also added `POST /api/session` operator-key authentication and audit-record operator
attribution, which is beyond what the specs require and is honestly labelled
(*"it is not cryptographic proof of a person's identity"*).

---

## 9. Inclusion and exclusion register

What was deliberately **not** written up as a finding, and why. `03`'s change-control rule applies to
this audit too.

| Not reported | Reason |
|---|---|
| Absence of physical BLE / acoustic / battery / screen-off evidence | Correctly and repeatedly documented in `STATUS.md`, `FEATURE-MATRIX.md` item 1, `PROJECT-WORKFLOW.md` §10 and `evidence/README.md`. Requires hardware. Not a documentation error. |
| Absence of production cryptography, signatures, key rotation | `DEC-019`, `04 §15.3` and `01 INT-008` all make this explicit future work, and every doc repeats it. Correct as-is. |
| Synthetic Assam facility data | Labelled as demo data in `assam-pack.ts` itself, in `PackManifest.sourceNote`, in `content-packs/README.md`, and in three status docs. Exemplary. |
| Hackathon map tile host (`openfreemap.org`) | Documented in four places with the `EXPO_PUBLIC_DSM_MAP_STYLE_URL` escape hatch. |
| `HD-001` literal `PACKET_REQUEST` deviation | Documented thoroughly, with measured before/after numbers. |
| `HD-004` directed forwarding exclusion | Documented, with a genuine privacy-vs-routing tension analysis and three costed options. Only the *consequential* omissions (§2.2, §2.3) are reported. |
| `HD-013` session-skip optimisation | Documented with a measured 9–54% reduction table. |
| iOS absence | `DEC-002`. |
| Simulated-vs-native adapter duality | `Gate II`, by design. |
| Console consolidating nine surfaces into four workspaces | Explicitly reconciled in `WEB-CONSOLE.md` with a 1:1 mapping table. Good practice. |
| `04 §11`–`§13` feasibility numbers (BLE rates, battery estimates, ggwave 8–16 B/s) | Planning figures, labelled as such by `04` itself (*"engineering budgets to validate, not literature-derived guarantees"*). Not implementable claims. |
| `04 §23` twelve open decisions | Marked open in the spec. Six of them (Android minimum, codec choice, copy budgets, duty cycles, file sizes, who may issue `RESOLVED`) have in fact been settled by `limits.ts` and `validator/index.ts` and could be closed — noted here rather than as a finding, since deciding them is a team call. |
| `04 §25` Team Doc v3 supersession record | A model of the practice this audit is asking for. No action. |
| `data/` files being dead code *per se* | Dead code is not automatically an error. Reported in §4.1 only because the values contradict the frozen registry and the files sit in the path a contributor would search. |

### Findings I judged and chose to report as **spec** problems rather than **code** problems

- §1 (topology / check-in) — the code is a coherent product; the *specification* is now
  self-contradictory. Fixing the docs is the cheaper and more correct move either way.
- §2.1 (gate 12) — the implementation followed the higher-precedence file correctly. The error is
  that `04` was left asserting a gate that does not run.
- §2.5, §2.6 (file limits and categories) — `HD-003`/`HD-011` made the right calls; `04 §9` and
  `01 FIL-*` were never annotated.

### Findings I judged as **code** problems

- §4.4 (note byte limit) — a reachable user-facing failure for non-Latin scripts.
- §4.1–§4.3 (duplicated registries) — latent wire-correctness hazards.
- §6.1 (`screen-registry.ts` false `complete`) — the checklist the docs designate as the review
  instrument is itself inaccurate, which defeats its purpose.
- §3.1 (cached-content family) — the internal contradiction between `policy`, `packet-to-map` and
  `schemas.ts` about whether `RECORD_UPSERT` mutates the map.

---

## 10. Priority order

Judged by "what breaks a reviewer's ability to trust the docs", not by effort.

**Blocking a coherent read of the specification:**

1. §1 — decide (a) or (b) on topology/check-in, then sweep all four files. Nothing else in
   `agent-reference/` can be trusted as binding until the four files agree with each other.

**Reachable defects:**

2. §4.4 — the short-note character/byte mismatch blocks SOS creation for Assamese, Bengali and
   Hindi note text.
3. §4.2 — `EmergencyCategory.TRAPPED` unreachable from the composer, in a demo whose headline
   scenario is a trapped person.
4. §4.2 — `'mr'` / missing `'bn'` in the language list.

**Documentation integrity:**

5. §6.1 — correct the two false `complete` statuses and restore `NearbyIncidents`' original
   requirement text.
6. §6.4 — resolve the duplicate `HD-010`; annotate `HD-003`'s superseded 128 KB.
7. §7 — fix the eight moved/dangling spec citations in source comments.
8. §3.6 — promote the accessibility deferral from `IMPLEMENTATION-CHANGES` into
   `FEATURE-MATRIX.md` and `STATUS.md`, which are the documents readers are pointed to.
9. §8.2 — add an `HD-` entry for the ggwave → WavePX layering and its relationship to `DEC-007`.

**Recording what was decided:**

10. §3.1 — record the cached-content family's status and the choice to carry map changes through
    regional-record packets instead.
11. §2.1, §2.2, §2.3, §2.4 — record the four spec-conflict resolutions the code already made.
12. §3.2–§3.5, §3.7, §3.10 — add triage, RSSI approach, group codes, language resolution, the
    producerless packet families and `DemoMetrics` to the deferred list, or delete them from the
    specs.

**Achievable without hardware:**

13. §3.8 — `evidence/packet-size-sheet.md`, golden vector files, a scenario→test traceability
    matrix, and a committed Tier 2 artifact manifest. Four of the nine missing evidence artifacts
    need no device.
14. §4.5 — widen the truthful-copy check to `apps/`, add `wavepx` to `PLATFORM_TERMS`.

---

## 11. Reproducing this audit

```bash
npm test                                    # 69 passing at the time of writing
npm run build && npm run boundaries
git show --stat 89feeed -- docs/agent-reference/
git diff 9d96aca 89feeed -- docs/agent-reference/
grep -rn -i "topolog\|packet journey" docs/agent-reference/
grep -rn -i "check-in\|checkin"       docs/agent-reference/
grep -rn "DemoMetrics\|triage\|feedDirectAudio" --include=*.ts --include=*.tsx apps packages
```

Every claim above is 🟩 source inspection or 🟦 a test run in this working tree. No claim is 🟥.
