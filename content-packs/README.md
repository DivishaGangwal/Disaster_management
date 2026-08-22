# Content packs — Workstream D

One region is enough (DEC-011). The pack is predownloaded and must render with
no internet (DEC-012, MAP-001, OFF-006).

The shape is defined by `ContentPack` in
`packages/contracts/src/content-pack.ts`. A synthetic example that already works
end-to-end lives in `tools/seed/src/demo-pack.ts`.

## To ship the real pack

1. Choose the city/region and record the decision here.
2. Produce the offline base map artifact.
3. Build the object registry with **stable compact IDs** (MAP-002). Once an ID
   ships it is permanent — packets reference it by that ID forever.
4. Add route edges, cached guides, check-in forms, prepared phrases, and
   translations.
5. Write the **provenance and licence note** into `PackManifest.sourceNote`.
   This is a required Workstream D deliverable, not a nicety.
6. Compute the integrity value and set `readiness`.

## Rules

- Compact IDs resolve **only** through the typed registry. A packet never
  supplies a path, URL, query, or command.
- A missing object produces fallback text and a logged miss — never a silent
  substitution to a different object (MAP-008).
- Use synthetic identities and locations for anything person-shaped (INT-006).
