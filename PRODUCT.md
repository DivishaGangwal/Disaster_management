# Product

<!-- impeccable:product-schema 1 -->

## Platform

Android mobile app plus a web operations console

## Users

Assam authority, coordination, and radio-broadcast operators working under time pressure in a shared disaster operations room. They triage incoming incidents, understand resource and route availability, assign responders, publish regional changes, approve public-information campaigns, and operate or inspect the separate ggwave audio path.

## Product Purpose

The Assam Operations Console turns compact disaster packets into one shared operational picture. Success means an operator can see what changed, identify what needs action, understand which centres and gateways are usable, dispatch the right responder, and move an approved campaign through broadcast without switching applications or confusing transport evidence with rescue progress.

## Positioning

One canonical packet model joins Bluetooth mesh, opportunistic internet gateways, and one-way authority radio downlink. Every transport updates the same incident, resource, campaign, and audit projections while preserving packet identity and evidence boundaries.

## Operating Context

- The primary surface is a continuously updating command dashboard used on desktop displays and laptops, with a functional mobile adaptation.
- The map is the primary spatial control surface and must remain linked to incident, responder, centre, route, hazard, and gateway workflows.
- Campaign work follows a controlled register and approval lifecycle; audio transmission and audio/file decoding are station tools, not permanent columns in the campaign editor.
- Demonstration data may be synthetic when clearly identified in documentation and must be rich enough to exercise real workflows.

## Capabilities and Constraints

- Tier 1 is bidirectional Bluetooth store-and-forward: BLE is preferred and Bluetooth Classic is the native fallback when required roles are unavailable. Tier 2 is a separate one-way ggwave authority downlink.
- Multiple gateway observations of one packet remain observations of one incident, not additional victims.
- Packet views show locally stored observations, not continuous or global network tracking after transmission.
- Tier 2 fragments carry the same complete canonical packet bytes consumed by gateway and Bluetooth ingestion; manifests verify expected bytes but do not reconstruct missing packet meaning.
- Link receipt, gateway upload, backend acknowledgement, responder progress, arrival, and resolution are distinct states.
- Authority and responder identities are organisation-provisioned prototype records, not cryptographic personal identity proof.
- Software frame comparison validates a prepared artifact; it does not by itself prove physical acoustic reception.
- The console must preserve current packet contracts, campaign lifecycle rules, regional-record publishing, responder actions, and audit history.

## Brand Commitments

The product is the National Disaster Operations Network console for the Assam deployment. Its voice is calm, direct, civic, and operational. It must feel built for public-service command work—not like a generic SaaS dashboard, a developer console, or a decorative technology demo.

## Evidence on Hand

- Product and protocol decisions: `docs/agent-reference/01-PRODUCT-DECISIONS-AND-SCOPE.md`
- Console behavior and deployment notes: `docs/WEB-CONSOLE.md`
- Existing working React/MapLibre implementation: `apps/web-authority/src/`
- Synthetic Assam seed data: `apps/backend/src/demo-seed.ts`
- User-provided screenshots showing the current hierarchy, density, empty-map, and campaign-composition failures.

No production deployment, cryptographic identity, licensed radio-chain result, or physical two-device reception result should be fabricated.

## Product Principles

1. Put live operational state and the next decision ahead of implementation detail.
2. Let the map, registers, and timelines select and update the same underlying records.
3. Reveal technical evidence on demand instead of making it the default interface.
4. Use realistic synthetic activity to demonstrate behavior without presenting it as field evidence.
5. Preserve protocol truth in every label, status, and metric.

## Accessibility & Inclusion

Meet WCAG AA, support keyboard operation and reduced motion, avoid colour-only state communication, keep touch targets at least 44 px, and maintain readable information hierarchy under stress.
