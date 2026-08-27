/**
 * Canonical deployment identity shared by every runtime surface.
 *
 * Disaster SOS Mesh is a national platform. Mumbai is the currently selected
 * operational deployment; changing cities must replace this configuration,
 * never fork packet or transport contracts.
 */
export const DEPLOYMENT = {
  productName: 'National Disaster Operations Network',
  platformScope: 'India',
  regionCode: 'IN-MH',
  regionName: 'Mumbai',
  stateName: 'Maharashtra',
  operationalLabel: 'Mumbai Operational Region',
  contentPackId: 'PACK-IN-MH-MUM-OPS',
  contentPackVersion: 1,
  backendIdentity: 'dsm-coordination-v1',
  productionBackendUrl: 'https://disaster-management-web-authority.vercel.app',
  defaultDatabaseFile: 'mumbai-operations.sqlite',
  developmentOperationsKey: 'mumbai-operations-local',
  languages: ['en', 'hi', 'mr'],
  map: {
    minLatE7: 188800000,
    minLonE7: 727700000,
    maxLatE7: 193000000,
    maxLonE7: 729900000,
    centerLat: 19.09,
    centerLon: 72.85,
    minZoom: 8,
    maxZoom: 14,
  },
} as const;

export type DeploymentRegionCode = typeof DEPLOYMENT.regionCode;
