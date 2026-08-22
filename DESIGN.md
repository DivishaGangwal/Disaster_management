# NDON Assam Design System

This document records the shipped visual and interaction authority for the National Disaster Operations Network Assam web console. It describes the implementation in `apps/web-authority`; it does not expand product or evidence claims.

## Direction

The product is a **state control atlas**: a calm, civic operations surface organised around one living Assam map, formal registers, and explicit state transitions. It should feel like public-service command infrastructure—not a generic SaaS dashboard, developer console, or technology demo.

The visual world is light-first: warm porcelain working surfaces over a cool ground, framed by deep command navy. Vermilion, orange, amber, cobalt, and green are operational inks, not decoration. The small tricolour brand mark is restrained; nationalism must never become ornamental.

## Authority and type

- `command-atlas.css` is the final visual override and is loaded after `styles.css`.
- Use **Atkinson Hyperlegible Next Variable**, loaded locally through `@fontsource-variable/atkinson-hyperlegible-next`, with `system-ui, sans-serif` fallback.
- Use the same family for map popovers and controls. Reserve monospace for packet IDs, coordinates, digests, frame data, and exact-byte evidence.
- Headings are compact and decisive, with modest negative tracking. Supporting copy should remain readable and plain. Uppercase and letter spacing are for short jurisdiction, state, and evidence labels only.
- Numbers that update or compare use tabular numerals.

## Core palette

| Role | Token / value | Use |
| --- | --- | --- |
| Porcelain | `--atlas-paper: #fffdf7` | Primary panels, map chrome, selected surfaces |
| Ground | `--atlas-ground: #edf0ed` | App background and visual breathing room |
| Command navy | `--atlas-navy: #102b3a` | Navigation, map overlays, decoder header, high-authority surfaces |
| Ink | `--atlas-ink: #17242d` | Primary text |
| Muted ink | `--atlas-muted: #60717b` | Metadata and supporting labels |
| Rule | `--atlas-line: #ccd4d4` | Default structural borders |
| Strong rule | `--atlas-line-strong: #9eabad` | Inputs and higher-emphasis boundaries |
| Action / selection | `--atlas-blue: #2767c8` | Primary actions, selected records, gateways, focus context |
| Critical | `--atlas-red: #c82f45` | Life-critical incidents and unsafe/blocked states |
| Urgent | `--atlas-orange: #ed7a28` | Severity 2 urgency |
| Caution | `--atlas-amber: #d69a1c` | Restricted/full/watch/stale states and early campaign state |
| Usable / confirmed | `--atlas-green: #18865f` | Open, available, online, cleared, completed, or exact-match states |

Colour is semantic and must be paired with a label, glyph, number, shape, or state text. Never rely on colour alone.

## Spatial system

- Use a compact rhythm built primarily from 4, 8, 12, 14, 18, 24, and 32 px increments. Dense rows are intentional; keep related metadata close and separate major work regions with 14–24 px gaps.
- Borders, not shadows, carry most hierarchy. Use 1 px cool-grey rules to build registers, ledgers, rails, and fact grids.
- The default surface radius is `10px`; major contained workspaces use 10–12 px, controls 5–8 px, and state labels about 4 px. Circles are reserved for map points, compact state dots, status lights, severity markers, and identity/resource glyphs.
- Shadows are sparse and functional: floating map chrome, notices, access panels, and selected segmented controls only. Do not make every region a floating card.
- Controls should feel crisp and compact. Active selection is shown with a cobalt inset rule or contained blue outline, not a glow.

## Information hierarchy

### Global shell

The desktop shell uses a 238 px navy command rail, a compact top bar, and a narrow live-metrics strip. Navigation is operational: **Coordinate**, **Publish**, **Campaigns**, and **Packet network**. Connection state, operator identity, jurisdiction, and refresh/sign-out remain visible without competing with the work.

### Coordinate: map first

The map is the primary spatial control surface and occupies most of the first working viewport. It selects the same incident, centre, route, hazard, or gateway records used by the priority rail and the detail deck below it.

- Map layers, priority filters, queue rows, gateway pulse, response units, and operational objects are linked views of shared records.
- Operational objects use interactive HTML button markers above the map canvas so they remain visible and keyboard-addressable. Each marker carries an accessible name with its label and operational summary; hover, focus, and selection reveal the visible label.
- Selected records receive a visible halo or cobalt selection treatment and update the detail deck.
- Incident labels always expose severity, people reported, observation count, location age, and accuracy where available.
- “Reported position” must never be phrased as a live tracker.
- Technical packet details follow the selected operation; they do not displace the operational decision.

### Publish: state control

Publishing remains map-first: one working map, one object-control rail, then the regional register, delivery trail, and optional packet evidence. State choices must include their operational consequence. Publishing changes a regional record; it does not prove physical delivery, responder action, or rescue outcome.

### Campaigns: register first

Campaigns open on the version register. The selected campaign owns the focus pane with its lifecycle, exact content, budget, approval digest, and allowed next action.

- **Compose** is a conditional workspace entered from the register; it is not a permanent column.
- **Audio decoder** is a separate station workspace with its own navy header and approved-campaign selector.
- The lifecycle is explicit: Draft → Budget checked → Authority approved → Broadcast desk → Audio ready → Software decode passed → Scheduled → Playback recorded → Archived.
- The lifecycle is a wrapping grid: five columns on desktop and three columns on mobile. Do not turn it into a horizontally scrolling strip.
- Actions unlock only when their prerequisite state is satisfied. Disabled controls and guidance must explain why.
- Transmission, WAV export, microphone reception, file decode, and exact frame comparison are station tools, not campaign-authoring decoration.
- The decoder also provides an explicit **GGWave audio preview**. It starts only from a user action, plays through the current device, exposes a real stop control, and never records a broadcast event.

## Operational state semantics

- **Incidents:** S3 critical = red; S2 urgent = orange; S1 assistance = amber; lower/default activity = green or neutral. Severity is always printed as `S#` and accompanied by descriptive copy.
- **Resources and centres:** `open` means usable. `closed`, `damaged`, `blocked`, or active hazard conditions are red/restricted. `full`, `restricted`, and `watch` are amber and require review.
- **Routes:** only `open` means “Route available”; other states mean “Do not route.”
- **Hazards:** only `cleared` is usable/green; an active hazard remains unsafe/red.
- **Gateways:** online activity within the defined window is green; stale is amber/neutral. Gateway identity, transfer counts, observation counts, and last activity are separate facts.
- **Campaigns:** amber marks draft entry, blue marks validation, authority approval, broadcast-desk, and audio-preparation states, and green marks verified/scheduled/played progress. The written lifecycle state remains primary.
- **Selection/action:** cobalt means selected, actionable, or navigational. It must not imply operational success.

Across queues and registers, semantic state uses a compact coloured dot beside explicit state or severity text. Do not use vertical colour bands as the state indicator.

## Interaction and motion

- Use direct selection, segmented filters, registers, timelines, and state controls. Keep the next valid action near the selected record.
- Hover confirms affordance; active press may scale to `.96`; transitions use the shipped fast curve (`160ms cubic-bezier(.16, 1, .3, 1)`). Avoid ornamental motion.
- Notices use `status` or `alert` semantics. Loading, disconnected, stale, disabled, empty, and error states need explicit words.
- Audio preview and listening controls must have explicit start and stop actions. Stopping preview must cancel playback state without creating broadcast evidence.
- Reveal raw packets, route ledgers, frame inventories, and hashes through tabs or disclosure controls. Evidence is inspectable, not the default reading burden.

## Evidence and truth constraints

- One packet may have many gateway observations; observations do not create additional incidents or victims.
- Link receipt, gateway upload, backend acknowledgement, responder progress, arrival, resolution, scheduled broadcast, playback, and reception are distinct states. Do not collapse or visually equate them.
- Gateway map coordinates are **synthetic demo placements**. Label them as such in popovers and detail views; never imply measured gateway location.
- Software WAV/frame comparison proves comparison against a prepared artifact. It does not prove licensed radio-chain transmission or physical acoustic reception.
- Playing the user-triggered GGWave preview is local audition only. It is not scheduled playback and must not be written to broadcast history.
- Organisation-provisioned operator/responder records are not cryptographic personal identity proof.
- Synthetic activity may demonstrate workflows but must not be styled or described as field evidence.
- Never fabricate deployment, identity, reception, transport, or rescue outcomes.

## Accessibility and responsive behaviour

- Target WCAG AA. Preserve a visible 3 px focus outline, the skip link, semantic landmarks, labels, `aria-pressed` layer controls, and live-region status/error messaging.
- Critical controls must be keyboard-operable and reach at least 44 px on narrow screens. Mobile text inputs stay at 16 px to avoid browser zoom.
- Respect `prefers-reduced-motion`: animations and transitions collapse to near-zero duration.
- At ≤1060 px, the sidebar becomes a horizontal command header. At ≤820 px, maps stay dominant at about 58 vh, rails and selection decks stack, campaign register/editor/decoder become single-column, lifecycle steps reflow to three columns, metrics may scroll horizontally, and map keys remain readable.
- Preserve dense tables by horizontal scrolling when necessary rather than destroying column relationships.
- Long IDs and evidence strings must wrap, truncate with a visible surrounding label, or live in scrollable monospace regions.

## Anti-patterns

Do not introduce:

- generic dashboard card grids, equal-weight KPI tiles, or excessive rounded containers;
- glassmorphism, gradients as decoration, neon/dark-tech themes, glow effects, or oversized hero typography;
- decorative maps, fake live tracking, unlabeled status dots, or colour-only state;
- vertical status bands, inaccessible canvas-only map markers, or horizontally scrolling campaign lifecycles;
- permanent campaign composer/broadcast/decoder columns;
- developer-first protocol detail ahead of the operational decision;
- vague AI-generated slogans, inflated capability claims, decorative icons, excessive badges, or fabricated activity;
- ornamental nationalism, stock disaster imagery, or demo labels that weaken the civic command tone.

When extending the console, prefer one stronger shared operational surface, one clear selected record, and one truthful next action.
