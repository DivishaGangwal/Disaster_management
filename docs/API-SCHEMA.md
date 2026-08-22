# API endpoint schema

Backend HTTP surface. Spec: `agent-reference/02-…` "Conceptual online API
obligations". Implementation: `apps/backend/src/server.ts`.

**All request and response sizes are bounded.** Gateway sync tolerates retry
without creating duplicates.

Base URL in development: `http://localhost:8787`
Content type: `application/json` on every endpoint.
Binary packets travel as **base64** in a `bytesBase64` field — never as raw JSON
objects. The canonical bytes are the source of truth, not any JSON rendering.

Status legend: ✅ implemented · ❌ planned (Workstream E)

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

## Planned endpoints (Workstream E)

Required by `02-…` but not yet implemented. Shapes are specified so the mobile
and dashboard clients can be written against them now.

### `GET /responders` ❌
```json
{ "responders": [
  { "responderRef": "RSP-7", "capabilities": ["medical"],
    "available": true, "provisionedByDemo": true }
] }
```
`provisionedByDemo` must render as "demo-provisioned", **never** "verified"
(ROL-003, INT-004).

### `POST /responders/:ref/assign` ❌
```json
{ "incidentId": "INC-7A2C", "dispatcherLabel": "Demo Coordinator" }
```
→ `{ "assignmentId": "ASG-1", "packetId": "…" }`

Emits a `RESPONDER_ASSIGNED` packet onto the outbound queue. State changes
happen **by emitting packets**, never by mutating history invisibly.

### `GET|POST /region/:regionCode/resources` ❌
`GET` → baseline + active overrides.
`POST` → emits a `SHELTER` / `MEDICAL_POST` / `FOOD_WATER` / `SAFE_ZONE` packet.
Body references a **stable compact object ID**; it never carries a full record.

### `GET|POST /region/:regionCode/hazards` ❌ · `…/routes` ❌
Same pattern → `HAZARD` / `ROUTE_STATE` packets.

### `POST /campaigns` ❌ · `POST /campaigns/:id/validate|approve|archive` ❌
Campaign CRUD over the frozen state machine in `@dsm/tier2`. Approve returns
`400` if content changed since validation (WEB-007, DEC-025).

### `GET /campaigns/:id/preview` ❌
```json
{ "totalTier2Bytes": 1840, "totalDurationS": 115,
  "budgetS": 180, "overBudget": false,
  "items": [{ "packetId": "…", "tier1Bytes": 121, "tier2Bytes": 69,
              "frameCount": 1, "repeats": 3, "estimatedAudioMs": 4313 }] }
```
Already computable — `planCampaign()` returns exactly this (WEB-005).
An over-budget campaign reports `overBudget: true`; it is never silently
truncated.

### `POST /campaigns/:id/decode-test` ❌
→ `DecodeTestResult`: expected vs recovered packet IDs, frames
detected/valid/corrupt/duplicate, and `passed` (WEB-009). Blocked on the ggwave
modem.

### `POST /demo/reset` ❌
Controlled non-production only. Restores the checklist in
`tools/seed/src/demo-actors.ts` → `DEMO_RESET_CHECKLIST`.

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
