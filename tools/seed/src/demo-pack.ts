/**
 * DEMO REGIONAL CONTENT PACK  (synthetic)
 *
 * Spec: DEC-011 (one region is enough), MAP-002 (stable compact IDs),
 * INT-006: "Synthetic judging data must be used for personal identities and
 * locations."
 *
 * OWNERSHIP: Workstream D replaces this with the real selected-city pack and
 * a provenance/licence note. Everything else keys off the compact IDs below,
 * so swapping the pack does not touch any other package.
 *
 * Coordinates are synthetic points in a bounded demo box. They are NOT real
 * facility locations and must not be presented as such.
 */

import type { ContentPack } from '@dsm/contracts';

const REGION_CODE = 'IN-DEMO-01';

export const DEMO_PACK: ContentPack = {
  manifest: {
    packId: 'PACK-DEMO',
    packVersion: 1,
    regionCode: REGION_CODE,
    regionName: 'Demo Region (synthetic)',
    bounds: { minLatE7: 284900000, minLonE7: 770800000, maxLatE7: 285900000, maxLonE7: 771800000 },
    createdAtMs: Date.UTC(2025, 0, 1),
    schemaVersion: 1,
    baseMapArtifact: 'demo-basemap-v1',
    languages: ['en', 'hi'],
    integrity: 'sha256-placeholder-replace-with-real-pack',
    sizeBytes: 0,
    readiness: 'ready',
    counts: {
      shelter: 3,
      medical: 2,
      'food-water': 2,
      'safe-zone': 1,
      'help-centre': 1,
      route: 3,
      region: 1,
      guide: 1,
      form: 1,
      phrase: 4,
    },
    sourceNote:
      'SYNTHETIC demo data generated for the hackathon prototype. Not derived from any real facility register. Workstream D must replace this with a sourced pack and record its licence here.',
  },
  objects: [
    { objectId: 'SHL-001', type: 'shelter', name: 'North Community Hall', latE7: 285500000, lonE7: 771100000, baselineState: 1, labels: { en: 'North Community Hall', hi: 'उत्तर सामुदायिक हॉल' } },
    { objectId: 'SHL-002', type: 'shelter', name: 'Riverside School', latE7: 285200000, lonE7: 771400000, baselineState: 1 },
    { objectId: 'SHL-003', type: 'shelter', name: 'East Depot', latE7: 285350000, lonE7: 771600000, baselineState: 1 },
    { objectId: 'MED-001', type: 'medical', name: 'Central Medical Post', latE7: 285400000, lonE7: 771250000, baselineState: 1, capabilityBits: 0b0111 },
    { objectId: 'MED-002', type: 'medical', name: 'South Clinic', latE7: 285050000, lonE7: 771200000, baselineState: 1, capabilityBits: 0b0011 },
    { objectId: 'FWD-001', type: 'food-water', name: 'Market Square Distribution', latE7: 285450000, lonE7: 771350000, baselineState: 1 },
    { objectId: 'FWD-002', type: 'food-water', name: 'West Gate Water Point', latE7: 285300000, lonE7: 770950000, baselineState: 1 },
    { objectId: 'SFZ-001', type: 'safe-zone', name: 'Hilltop Assembly Area', latE7: 285700000, lonE7: 771300000, baselineState: 1 },
    { objectId: 'HLP-001', type: 'help-centre', name: 'District Help Desk', latE7: 285380000, lonE7: 771280000, baselineState: 1 },
    { objectId: 'REG-001', type: 'region', name: 'Demo Region', latE7: 285400000, lonE7: 771300000 },
    { objectId: 'GID-001', type: 'guide', name: 'Flood safety guide' },
    { objectId: 'FRM-001', type: 'form', name: 'Standard check-in' },
  ],
  routes: [
    { objectId: 'RTE-001', name: 'River Road', fromLatE7: 285200000, fromLonE7: 771000000, toLatE7: 285200000, toLonE7: 771500000, baselineState: 0 },
    { objectId: 'RTE-002', name: 'Hill Approach', fromLatE7: 285500000, fromLonE7: 771200000, toLatE7: 285700000, toLonE7: 771300000, baselineState: 0 },
    { objectId: 'RTE-003', name: 'Market Link', fromLatE7: 285400000, fromLonE7: 771300000, toLatE7: 285450000, toLonE7: 771350000, baselineState: 0 },
  ],
  forms: [
    {
      objectId: 'FRM-001',
      title: 'Are you safe?',
      fields: [
        { key: 'status', kind: 'status', required: true, options: [0, 1, 2, 3, 4] },
        { key: 'peopleCount', kind: 'count', required: false },
        { key: 'location', kind: 'location', required: false },
      ],
    },
  ],
  phrases: [
    { phraseId: 1, text: { en: 'Trapped, cannot move', hi: 'फंसे हुए हैं, हिल नहीं सकते' } },
    { phraseId: 2, text: { en: 'Need medical help', hi: 'चिकित्सा सहायता चाहिए' } },
    { phraseId: 3, text: { en: 'Water rising', hi: 'पानी बढ़ रहा है' } },
    { phraseId: 4, text: { en: 'Safe, need supplies', hi: 'सुरक्षित हैं, सामान चाहिए' } },
  ],
};

export const DEMO_REGION_CODE = REGION_CODE;
