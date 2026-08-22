## What changed

<!-- One paragraph. Reference the requirement IDs (OFF-xxx, SOS-xxx, REL-xxx, ...)
     or the epic (P1..P12) from docs/agent-reference/. -->

## Workstream

- [ ] A - product/domain + mobile
- [ ] B - native Android Bluetooth
- [ ] C - protocol/persistence/routing
- [ ] D - offline map + regional data
- [ ] E - backend + web
- [ ] F - ggwave/QA/evidence

## Boundary checklist

- [ ] I did not edit files outside my workstream's CODEOWNERS paths (or I got the owner's review).
- [ ] I did not change `packages/contracts` (or I followed docs/CONTRACT-FREEZE.md and updated every affected spec).
- [ ] No Bluetooth / internet / ggwave detail leaked into domain, map, incident, or UI code.
- [ ] No new internet dependency in an offline workflow.
- [ ] `npm run build && npm test && npm run boundaries` passes.

## Evidence type

- [ ] Static check only
- [ ] Simulator run
- [ ] Real Android device

<!-- 03-...-ACCEPTANCE.md working rule 10: never blur these three. -->
