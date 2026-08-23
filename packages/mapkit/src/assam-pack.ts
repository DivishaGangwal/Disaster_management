import type { ContentPack } from '@dsm/contracts';

/**
 * Assam-focused hackathon registry. Coordinates are approximate city/district
 * anchors and every operational facility label is explicitly demo data; a
 * production authority can replace this pack without changing packet IDs or UI.
 */
export const ASSAM_CONTENT_PACK: ContentPack = {
  manifest: {
    packId: 'PACK-IN-AS-DEMO', packVersion: 1, regionCode: 'IN-AS', regionName: 'Assam',
    bounds: { minLatE7: 240900000, minLonE7: 896500000, maxLatE7: 282000000, maxLonE7: 961500000 },
    createdAtMs: Date.UTC(2026, 7, 23), schemaVersion: 1,
    baseMapArtifact: 'openfreemap-liberty-assam-z5-z12', languages: ['en', 'as', 'bn', 'hi'],
    integrity: 'synthetic-assam-operational-registry-v1', sizeBytes: 0, readiness: 'ready',
    counts: { shelter: 5, medical: 4, 'food-water': 3, 'safe-zone': 3, 'help-centre': 4, route: 4, region: 1, guide: 2, form: 1, phrase: 4 },
    sourceNote: 'Synthetic hackathon operational registry at approximate Assam city anchors. Basemap is downloaded separately through the configured MapLibre style; verify and replace facilities with authority-issued data before deployment.',
  },
  objects: [
    { objectId: 'AS-SHL-GHY', type: 'shelter', name: 'Guwahati Flood Relief Hub (demo)', latE7: 261440000, lonE7: 916860000, baselineState: 1 },
    { objectId: 'AS-SHL-SIL', type: 'shelter', name: 'Silchar Community Shelter (demo)', latE7: 247330000, lonE7: 928780000, baselineState: 1 },
    { objectId: 'AS-SHL-DBR', type: 'shelter', name: 'Dibrugarh Relief Shelter (demo)', latE7: 274720000, lonE7: 949120000, baselineState: 1 },
    { objectId: 'AS-SHL-JOR', type: 'shelter', name: 'Jorhat Transit Shelter (demo)', latE7: 267500000, lonE7: 942030000, baselineState: 1 },
    { objectId: 'AS-SHL-TEZ', type: 'shelter', name: 'Tezpur Emergency Shelter (demo)', latE7: 266520000, lonE7: 923920000, baselineState: 1 },
    { objectId: 'AS-MED-GHY', type: 'medical', name: 'Guwahati Medical Coordination Point (demo)', latE7: 261120000, lonE7: 917210000, baselineState: 1 },
    { objectId: 'AS-MED-SIL', type: 'medical', name: 'Silchar Medical Post (demo)', latE7: 247560000, lonE7: 928010000, baselineState: 1 },
    { objectId: 'AS-MED-DBR', type: 'medical', name: 'Dibrugarh Medical Post (demo)', latE7: 274850000, lonE7: 949050000, baselineState: 1 },
    { objectId: 'AS-MED-TEZ', type: 'medical', name: 'Tezpur Medical Post (demo)', latE7: 266330000, lonE7: 923870000, baselineState: 1 },
    { objectId: 'AS-FWD-GHY', type: 'food-water', name: 'Guwahati Supply Distribution (demo)', latE7: 261850000, lonE7: 917450000, baselineState: 1 },
    { objectId: 'AS-FWD-NGN', type: 'food-water', name: 'Nagaon Food and Water Point (demo)', latE7: 263480000, lonE7: 926840000, baselineState: 1 },
    { objectId: 'AS-FWD-DHU', type: 'food-water', name: 'Dhubri Supply Point (demo)', latE7: 260200000, lonE7: 899740000, baselineState: 1 },
    { objectId: 'AS-SFZ-KAZ', type: 'safe-zone', name: 'Kaziranga Evacuation Assembly (demo)', latE7: 265770000, lonE7: 934100000, baselineState: 1 },
    { objectId: 'AS-SFZ-HFL', type: 'safe-zone', name: 'Haflong High-Ground Assembly (demo)', latE7: 251650000, lonE7: 930170000, baselineState: 1 },
    { objectId: 'AS-SFZ-DPH', type: 'safe-zone', name: 'Diphu Assembly Area (demo)', latE7: 258430000, lonE7: 932920000, baselineState: 1 },
    { objectId: 'AS-HLP-GHY', type: 'help-centre', name: 'Assam State Help Centre — Guwahati (demo)', latE7: 261150000, lonE7: 917080000, baselineState: 1 },
    { objectId: 'AS-HLP-BRP', type: 'help-centre', name: 'Barpeta Help Desk (demo)', latE7: 263220000, lonE7: 910060000, baselineState: 1 },
    { objectId: 'AS-HLP-LKP', type: 'help-centre', name: 'North Lakhimpur Help Desk (demo)', latE7: 272380000, lonE7: 940990000, baselineState: 1 },
    { objectId: 'AS-HLP-KRB', type: 'help-centre', name: 'Karimganj Help Desk (demo)', latE7: 248650000, lonE7: 923550000, baselineState: 1 },
    { objectId: 'AS-REGION', type: 'region', name: 'Assam State Operational Area', latE7: 264000000, lonE7: 928000000 },
    { objectId: 'AS-GUIDE-FLOOD', type: 'guide', name: 'Assam flood safety guide' },
    { objectId: 'AS-GUIDE-LAND', type: 'guide', name: 'Landslide and road isolation guide' },
    { objectId: 'AS-FORM-CHECKIN', type: 'form', name: 'Offline household check-in' },
  ],
  routes: [
    { objectId: 'AS-RTE-GHY-TEZ', name: 'Guwahati–Tezpur corridor (demo)', fromLatE7: 261440000, fromLonE7: 916860000, toLatE7: 266520000, toLonE7: 923920000, baselineState: 0 },
    { objectId: 'AS-RTE-TEZ-DBR', name: 'Tezpur–Dibrugarh corridor (demo)', fromLatE7: 266520000, fromLonE7: 923920000, toLatE7: 274720000, toLonE7: 949120000, baselineState: 0 },
    { objectId: 'AS-RTE-GHY-SIL', name: 'Guwahati–Silchar corridor (demo)', fromLatE7: 261440000, fromLonE7: 916860000, toLatE7: 247330000, toLonE7: 928780000, baselineState: 0 },
    { objectId: 'AS-RTE-GHY-DHU', name: 'Guwahati–Dhubri corridor (demo)', fromLatE7: 261440000, fromLonE7: 916860000, toLatE7: 260200000, toLonE7: 899740000, baselineState: 0 },
  ],
  forms: [{ objectId: 'AS-FORM-CHECKIN', title: 'Are you safe?', fields: [{ key: 'status', kind: 'status', required: true, options: [0, 1, 2, 3, 4] }, { key: 'peopleCount', kind: 'count', required: false }, { key: 'location', kind: 'location', required: false }] }],
  phrases: [
    { phraseId: 1, text: { en: 'Trapped, cannot move', as: 'আৱদ্ধ হৈ আছোঁ, লৰচৰ কৰিব নোৱাৰোঁ', bn: 'আটকে আছি, নড়তে পারছি না', hi: 'फंसे हुए हैं, हिल नहीं सकते' } },
    { phraseId: 2, text: { en: 'Need medical help', as: 'চিকিৎসাৰ সহায় লাগে', bn: 'চিকিৎসা সহায়তা দরকার', hi: 'चिकित्सा सहायता चाहिए' } },
    { phraseId: 3, text: { en: 'Water rising', as: 'পানী বাঢ়ি আছে', bn: 'পানি বাড়ছে', hi: 'पानी बढ़ रहा है' } },
    { phraseId: 4, text: { en: 'Safe, need supplies', as: 'নিৰাপদ, সামগ্ৰী লাগে', bn: 'নিরাপদ, সরবরাহ দরকার', hi: 'सुरक्षित हैं, सामान चाहिए' } },
  ],
};
