import { DEPLOYMENT, type ContentPack } from '@dsm/contracts';

/**
 * Mumbai (Maharashtra) development operational registry.
 * Coordinates are approximate and must not be represented as authority data.
 * Replace with BMC/NDMA authority-issued data before production deployment.
 */
export const MUMBAI_CONTENT_PACK: ContentPack = {
  manifest: {
    packId: DEPLOYMENT.contentPackId, packVersion: DEPLOYMENT.contentPackVersion, regionCode: DEPLOYMENT.regionCode, regionName: DEPLOYMENT.regionName,
    bounds: { minLatE7: 188800000, minLonE7: 727700000, maxLatE7: 193000000, maxLonE7: 729900000 },
    createdAtMs: Date.UTC(2026, 7, 26), schemaVersion: 1,
    baseMapArtifact: 'openfreemap-liberty-mumbai-z5-z14', languages: ['en', 'hi', 'mr'],
    integrity: 'mumbai-development-operational-registry-v1', sizeBytes: 0, readiness: 'ready',
    counts: { shelter: 5, medical: 5, 'food-water': 3, 'safe-zone': 3, 'help-centre': 4, route: 4, region: 1, guide: 2, form: 1, phrase: 4 },
    sourceNote: 'Development registry with approximate Mumbai facility coordinates. Replace with BMC/NDMA authority-issued data before operational deployment.',
  },
  objects: [
    // --- Shelters (large public venues usable as relief camps) ---
    { objectId: 'MUM-SHL-MMRDA', type: 'shelter', name: 'MMRDA Grounds, BKC', latE7: 190658000, lonE7: 728657000, baselineState: 1 },
    { objectId: 'MUM-SHL-WANK', type: 'shelter', name: 'Wankhede Stadium, Marine Lines', latE7: 189398000, lonE7: 728251000, baselineState: 1 },
    { objectId: 'MUM-SHL-AZAD', type: 'shelter', name: 'Azad Maidan, Fort', latE7: 189370000, lonE7: 728328000, baselineState: 1 },
    { objectId: 'MUM-SHL-ANDHERI', type: 'shelter', name: 'Andheri Sports Complex', latE7: 191196000, lonE7: 728458000, baselineState: 1 },
    { objectId: 'MUM-SHL-DHARAVI', type: 'shelter', name: 'Dharavi Community Hall', latE7: 190390000, lonE7: 728557000, baselineState: 1 },

    // --- Medical (major public hospitals) ---
    { objectId: 'MUM-MED-KEM', type: 'medical', name: 'KEM Hospital, Parel', latE7: 190013000, lonE7: 728413000, baselineState: 1 },
    { objectId: 'MUM-MED-NAIR', type: 'medical', name: 'Nair Hospital, Mumbai Central', latE7: 189649000, lonE7: 728161000, baselineState: 1 },
    { objectId: 'MUM-MED-SION', type: 'medical', name: 'Lokmanya Tilak Municipal Hospital, Sion', latE7: 190401000, lonE7: 728614000, baselineState: 1 },
    { objectId: 'MUM-MED-COOPER', type: 'medical', name: 'Cooper Hospital, Vile Parle', latE7: 191127000, lonE7: 728367000, baselineState: 1 },
    { objectId: 'MUM-MED-JJH', type: 'medical', name: 'JJ Hospital, Byculla', latE7: 189854000, lonE7: 728381000, baselineState: 1 },

    // --- Food & Water ---
    { objectId: 'MUM-FWD-DADAR', type: 'food-water', name: 'Dadar Relief Distribution Point', latE7: 190182000, lonE7: 728329000, baselineState: 1 },
    { objectId: 'MUM-FWD-KURLA', type: 'food-water', name: 'Kurla Supply Distribution', latE7: 190658000, lonE7: 728782000, baselineState: 1 },
    { objectId: 'MUM-FWD-BORIVALI', type: 'food-water', name: 'Borivali Supply Point', latE7: 192290000, lonE7: 728565000, baselineState: 1 },

    // --- Safe Zones (high ground / elevated areas) ---
    { objectId: 'MUM-SFZ-MALABAR', type: 'safe-zone', name: 'Malabar Hill (High Ground)', latE7: 189520000, lonE7: 728078000, baselineState: 1 },
    { objectId: 'MUM-SFZ-POWAI', type: 'safe-zone', name: 'Powai Elevated Zone', latE7: 191177000, lonE7: 729060000, baselineState: 1 },
    { objectId: 'MUM-SFZ-AAREY', type: 'safe-zone', name: 'Aarey Colony High Ground', latE7: 191548000, lonE7: 728758000, baselineState: 1 },

    // --- Help Centres (BMC / Government offices) ---
    { objectId: 'MUM-HLP-BMC', type: 'help-centre', name: 'BMC Headquarters, CST Road', latE7: 189322000, lonE7: 728354000, baselineState: 1 },
    { objectId: 'MUM-HLP-WARD-K', type: 'help-centre', name: 'BMC Ward K-East Office, Andheri', latE7: 191120000, lonE7: 728540000, baselineState: 1 },
    { objectId: 'MUM-HLP-WARD-S', type: 'help-centre', name: 'BMC Ward S Office, Kurla', latE7: 190620000, lonE7: 728810000, baselineState: 1 },
    { objectId: 'MUM-HLP-COLABA', type: 'help-centre', name: 'Colaba Disaster Relief Desk', latE7: 189067000, lonE7: 728147000, baselineState: 1 },

    // --- Region marker ---
    { objectId: 'MUM-REGION', type: 'region', name: 'Mumbai Metropolitan Region', latE7: 190900000, lonE7: 728500000 },

    // --- Guides ---
    { objectId: 'MUM-GUIDE-FLOOD', type: 'guide', name: 'Mumbai Flood and Cyclone Safety Guide' },
    { objectId: 'MUM-GUIDE-BUILD', type: 'guide', name: 'Building Collapse Response Guide' },

    // --- Form ---
    { objectId: 'MUM-FORM-CHECKIN', type: 'form', name: 'Household Safety Check-in' },
  ],
  routes: [
    { objectId: 'MUM-RTE-WE', name: 'Western Express Highway Corridor', fromLatE7: 188980000, fromLonE7: 728251000, toLatE7: 192290000, toLonE7: 728565000, baselineState: 0 },
    { objectId: 'MUM-RTE-EE', name: 'Eastern Freeway Corridor', fromLatE7: 189320000, fromLonE7: 728370000, toLatE7: 190820000, toLonE7: 728820000, baselineState: 0 },
    { objectId: 'MUM-RTE-LBS', name: 'LBS Marg East Corridor', fromLatE7: 190070000, fromLonE7: 728810000, toLatE7: 191800000, toLonE7: 729050000, baselineState: 0 },
    { objectId: 'MUM-RTE-SL', name: 'Sion–Panvel Highway Corridor', fromLatE7: 190380000, fromLonE7: 728617000, toLatE7: 190050000, toLonE7: 729500000, baselineState: 0 },
  ],
  forms: [{ objectId: 'MUM-FORM-CHECKIN', title: 'Are you safe?', fields: [{ key: 'status', kind: 'status', required: true, options: [0, 1, 2, 3, 4] }, { key: 'peopleCount', kind: 'count', required: false }, { key: 'location', kind: 'location', required: false }] }],
  phrases: [
    { phraseId: 1, text: { en: 'Trapped, cannot move', hi: 'फंसे हुए हैं, हिल नहीं सकते', mr: 'अडकलो आहोत, हलता येत नाही' } },
    { phraseId: 2, text: { en: 'Need medical help', hi: 'चिकित्सा सहायता चाहिए', mr: 'वैद्यकीय मदत हवी आहे' } },
    { phraseId: 3, text: { en: 'Water rising / flooding', hi: 'पानी बढ़ रहा है / बाढ़ आ रही है', mr: 'पाणी वाढत आहे / पूर येत आहे' } },
    { phraseId: 4, text: { en: 'Safe, need supplies', hi: 'सुरक्षित हैं, सामान चाहिए', mr: 'सुरक्षित आहोत, साहित्य हवे आहे' } },
  ],
};
