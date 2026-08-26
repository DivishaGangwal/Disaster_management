# Content packs — Workstream D

One region is enough (DEC-011). The pack is predownloaded and must render with
no internet (DEC-012, MAP-001, OFF-006).

The shape is defined by `ContentPack` in
`packages/contracts/src/content-pack.ts`. The current Mumbai development pack that works
end-to-end lives in `packages/mapkit/src/mumbai-pack.ts`. The mobile development
build downloads its basemap through MapLibre into the native offline database.

## To ship the real pack

1. Mumbai, Maharashtra is the current focused region (`IN-MH`) within the national platform.
2. Configure an authority-approved/self-hosted MapLibre style with
   `EXPO_PUBLIC_DSM_MAP_STYLE_URL` for production distribution.
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
