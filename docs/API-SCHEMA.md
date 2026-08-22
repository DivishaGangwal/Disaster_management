# API endpoint schema

Backend HTTP surface. Spec: `agent-reference/02-…` "Conceptual online API
obligations". Implementation: `apps/backend/src/server.ts`.

**All request and response sizes are bounded.** Gateway sync tolerates retry
without creating duplicates.

Base URL in development: `http://localhost:8787`
Content type: `application/json` on every endpoint.
Binary packets travel as **base64** in a `bytesBase64` field — never as raw JSON
objects. The canonical bytes are the source of truth, not any JSON rendering.

Administrative `/api` mutations require `x-operations-key` and
`x-operator-label`. `POST /api/session` validates those headers and returns the
integrated authority-publisher, coordinator and radio-broadcaster session.
Gateway protocol endpoints keep their separate gateway-token contract.

Status legend: ✅ implemented · 🟡 partial · ❌ planned

---

## 1. `GET /health` ✅ — the live probe

**This is the only thing that may declare a gateway (GTW-001).** An Android
network icon proves nothing.

**Response `200`**
```json
{ "identity": "dsm-backend-demo-v1", "atMs": 1748736000000 }
```

| Field | Type | Notes |
|---|---|---|
| `identity` | string | Must equal the client's expected value. A captive portal returns `200` for anything, so a matching identity is what separates "internet" from "our backend". |
| `atMs` | number | Server wall clock, ms. |

The client treats the proof as expiring after `FRESHNESS.GATEWAY_PROOF_S`
(120 s). A stale proof is not a gateway.

---

## 2. `POST /gateway/register` ✅

**Request**
```json
{ "nodeToken": "a1a10001", "regionCode": "IN-DEMO-01" }
```

| Field | Type | Bound |
|---|---|---|
| `nodeToken` | string | 8 hex chars — the rotating token, never a permanent ID |
| `regionCode` | string | ≤ 32 chars |

**Response `200`**
```json
{ "gatewayToken": "GW-a1a10001" }
```

---

## 3. `POST /gateway/upload` ✅ — mesh → internet

**Request**
```json
{
  "gatewayToken": "GW-a1a10001",
  "batchId": "a1a10001-1748736000000",
  "items": [
    {
      "packetId": "3f2a…",
      "bytesBase64": "RE0BEAAA…",
      "observation": {
        "receivedAtMs": 1748735990000,
        "transport": "tier1-ble",
        "hopCountOnArrival": 2
      }
    }
  ]
}
```

| Field | Type | Bound |
|---|---|---|
| `batchId` | string | **Idempotency key.** Replaying a batch must not create a second observation. |
| `items` | array | ≤ `GATEWAY.MAX_UPLOAD_BATCH` (32); total ≤ 128 KB |
| `packetId` | string | 32 hex chars |
| `bytesBase64` | string | Canonical packet bytes; ≤ 4288 B decoded |
| `transport` | enum | `tier1-ble` · `tier1-classic` · `tier2-mic` · `tier2-direct` · `gateway` · `local` |

**Response `200`**
```json
{
  "batchId": "a1a10001-1748736000000",
  "acceptedAtMs": 1748736000000,
  "results": [
    { "packetId": "3f2a…", "outcome": "accepted", "backendReceiptId": "RCP-3f2a" }
  ]
}
```

| `outcome` | Meaning |
|---|---|
| `accepted` | New canonical packet stored; an acknowledgement is queued outbound. |
| `duplicate` | **Another observation of the same incident** (GTW-003) — never a new victim. |
| `conflicted` | Same packet ID, different payload digest. Quarantined, not projected. |
| `expired` | Past its expiry on arrival. |
| `invalid` | Failed the shared validator; `reason` carries the gate's reason code. |

**Errors:** `413` batch over limit · `500` with `{ "error": "…" }`

---

## 4. `POST /gateway/outbound` ✅ — internet → mesh

**Request**
```json
{
  "gatewayToken": "GW-a1a10001",
  "regionCode": "IN-DEMO-01",
  "cursor": "42",
  "maxItems": 32
}
```

`cursor` is opaque and omitted on first call. Selection is **region and
relevance bounded** (WEB-010).

**Response `200`**
```json
{
  "items": [{ "packetId": "9c1b…", "bytesBase64": "RE0BMQAA…" }],
  "nextCursor": "58",
  "hasMore": false
}
```

Downloaded packets go through the phone's **same validator and policy path** as
any Bluetooth packet (GTW-005). There is no privileged backend ingress.

---

## 5. `POST /gateway/outbound/ack` ✅

**Request**
```json
{ "gatewayToken": "GW-a1a10001", "cursor": "58", "packetIds": ["9c1b…"] }
```

**Response `200`** → `{ "ok": true }`

The client's cursor advances **only after this succeeds**. A lost response
causes a re-delivery, never a lost packet.

---

## 6. `GET /incidents` ✅

**Response `200`**
```json
{
  "incidents": [
    {
      "incidentId": "INC-7A2C",
      "state": "assigned",
      "severity": 3,
      "category": 1,
      "peopleTotal": 4,
      "latE7": 285355000,
      "lonE7": 771234000,
      "locationAccuracyM": 12,
      "locationAgeS": 8,
      "updatedAtS": 20000135,
      "observationCount": 2,
      "delivery": { "distinctPeerReceipts": 3, "backendAcceptedAtS": 20000130 }
    }
  ]
}
```

WEB-001: **one** entry per incident ID. `observationCount` is how many gateway
observations back it — that is the honest way to show corroboration without
inventing duplicate victims.

`locationAgeS` and `locationAccuracyM` are mandatory in any UI that renders a
position (WEB-003, DEC-020). There is no undated "live" marker.

---

## 7. `GET /incidents/:incidentId` ✅

**Response `200`**
```json
{
  "incident": { "…": "as above, plus timeline[]" },
  "observations": [
    {
      "packetId": "3f2a…",
      "gatewayToken": "GW-a1a10001",
      "receivedAtMs": 1748735990000,
      "uploadedAtMs": 1748736000000,
      "hopCountOnArrival": 2,
      "transport": "tier1-ble"
    }
  ]
}
```

`404` → `{ "error": "unknown incident" }`

---

## Operations Console endpoints

All console endpoints use the `/api` prefix.

### `GET /api/overview` ✅

Returns Assam scope, active-incident, responder, outbound-packet and approved-
campaign counts plus recent audit entries.

### `GET /api/packets` ✅

Returns the stored canonical read model used by Packet Network. This is locally
observed backend evidence, not a live or global packet tracker. Each item includes
packet, type and source identity; family, priority, severity and flags; hop and
fragment facts; digest and expiry; decoded payload; gateway observations;
outbound regions; and both base64 and exact hexadecimal bytes. Its direction is
`mesh-local`, `mesh-to-internet`, `internet-to-mesh`, or `radio-to-mesh` and is
derived from recorded evidence rather than invented topology.

### `GET /api/responders` ✅
```json
{ "responders": [
  { "responderRef": "RSP-7", "capabilities": ["medical"],
    "available": true, "provisionedByDemo": true }
] }
```
`provisionedByDemo` is a legacy storage field and renders as
"organisation-provisioned", **never** "verified"
(ROL-003, INT-004).

### `POST /api/responders/:ref/assign` ✅
```json
{ "incidentId": "INC-7A2C" }
```
→ `{ "responder": { "responderRef": "RSP-AS-01", "assignmentId": "ASG-…", "incidentId": "INC-…", "status": "assigned" } }`

Emits a `RESPONDER_ASSIGNED` packet onto the outbound queue. State changes
happen **by emitting packets**, never by mutating history invisibly.

### `POST /api/responders/:ref/state` ✅

Body: `{ "action": "accepted|en-route|arrived|resolved" }`. Each legal action
emits the matching responder-provisioned packet, advances the incident reducer,
and records the authenticated operator who entered the field report. Illegal
state shortcuts are rejected.

### `GET /api/region/IN-AS/records` ✅

Returns the prepared Assam operational register. The current records remain
development data until Workstream D supplies a sourced and licensed pack.

### `POST /api/region/IN-AS/records` ✅

Creates a temporary shelter, medical post, food/water point or safe zone. Body:
`{ "kind", "name", "district", "latE7", "lonE7", "state" }`. The backend
assigns a stable temporary object ID and emits the same canonical regional
packet consumed by gateway, Tier 1 and Tier 2 projection paths.

### `POST /api/region/IN-AS/records/:objectId` ✅

Body may contain only `{ "state": "open|full|closed|damaged|active|watch|cleared|restricted|blocked" }`
or a full edit with `kind`, `name`, `district`, `latE7`, `lonE7` and `state` to
move or rename the object.
The backend emits the appropriate resource, hazard, or route packet using the
stable compact object ID.

Regional records include `latE7` and `lonE7` for MapLibre. Popup actions use
this same endpoint; there is no UI-only closed or disabled state.

### `GET|POST /api/campaigns` ✅

Lists campaigns or creates a bounded Tier 2 packet draft. `dataType` is one of:

- `official-alert` — compact authority instruction, optionally carrying a
  broadcast point as `latE7`, `lonE7` and `radiusM` (degrees × 1e7, metres);
- `regional-record` — snapshots a known shelter, medical post, food/water
  point, safe zone, hazard, or route by `objectId`.

The regional form reuses the frozen regional packet types; it is not a
transport-specific alias. Unknown regional IDs are rejected. `check-in` is no
longer accepted by this endpoint (HD-010); the frozen `CHECKIN_CAMPAIGN` type
itself is untouched.

### `PUT /api/campaigns/:id` ✅

Edits content and applies `contentEdited()`; approved-or-later content returns
to draft rather than retaining stale approval.

### `POST /api/campaigns/:id/transition` ✅

Body: `{ "state": "validated|approved|broadcaster-ready|..." }`. The backend
enforces `CAMPAIGN_TRANSITIONS`; approval fails if content changed after
validation.

### `GET /api/campaigns/:id/preview` ✅

Returns the immutable calculated preview for the current campaign version.
```json
{ "totalTier2Bytes": 1840, "totalDurationS": 115,
  "budgetS": 180, "overBudget": false,
  "items": [{ "packetId": "…", "tier1Bytes": 121, "tier2Bytes": 69,
              "frameCount": 1, "repeats": 3, "estimatedAudioMs": 4313 }] }
```
An over-budget campaign reports `overBudget: true`; it is never silently
truncated.

### `POST /api/campaigns/:id/broadcast-program` ✅

Creates the immutable raw Tier 2 frame list through the vendored WavePX-style
browser transport backed by `ggwave`, plus the scheduled repetition sequence,
records a SHA-256 artifact digest, and advances `broadcaster-ready` to
`audio-generated`. Repeated calls return the same stored program.

### `POST /api/campaigns/:id/broadcast-reception` ✅

Body: `{ "framesBase64": ["..."], "receptionTransport": "tier2-mic|tier2-direct" }`.
Each recovered frame is decoded through the Tier 2 CRC gate and compared with
the exact program frame set. A complete match persists `passed: true` and
advances `audio-generated` to `decode-tested`; incomplete/corrupt input leaves
the campaign at `audio-generated`.

### `POST /api/campaigns/:id/broadcast-events` ✅

Body: `{ "event": "exported|played" }`. Export requires a passed exact decode
test and records/schedules the tested artifact. Playback additionally requires
the campaign to be scheduled. Every event persists the program ID, campaign
version, artifact digest, authenticated operator and timestamp; playback then
advances the campaign to `played`.

### `GET /api/gateway-audit` ✅ · `GET /api/audit` ✅

Return per-gateway upload/download/ack history, packet observations,
region-bounded outbound queues, and the append-only operations log.

### `POST /api/demo/reset` ✅
Controlled non-production only. Restores deterministic synthetic Assam
operations data. Set
`DSM_DEMO_MODE=false` to disable the endpoint.

---

## Rules for anyone adding an endpoint

1. **Bound every input before allocating.** `readJson` caps the body; per-field
   caps come from `@dsm/contracts` `limits.ts`. Never trust a declared length.
2. **Revalidate every packet** with `@dsm/validator`. The backend is not a
   trusted source; it runs the same 15 gates the phones do.
3. **State changes emit packets.** Never mutate an incident directly — emit the
   packet and let the reducer project it, so the mesh and the dashboard cannot
   diverge.
4. **Make writes idempotent.** Every mutating endpoint needs a batch/idempotency
   key or a natural one. Retries must be safe.
5. **Never put personal data in a URL or query string.**
6. **The backend is optional.** No offline behaviour may start depending on it —
   `02-…`: it "is not in the critical path for local SOS creation, relay,
   display, or local responder action."
