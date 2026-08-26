import Constants from 'expo-constants';
import { OfflineManager, OfflinePackDownloadState, type OfflinePackStatus } from '@maplibre/maplibre-react-native';
import { DEPLOYMENT } from '@dsm/contracts';

export const MUMBAI_MAP_PACK_NAME = 'mumbai-operational-basemap-v1';
export const MUMBAI_MAP_STYLE_URL = process.env.EXPO_PUBLIC_DSM_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty';
export const MUMBAI_MAP_BOUNDS: [[number, number], [number, number]] = [
  [DEPLOYMENT.map.maxLonE7 / 1e7, DEPLOYMENT.map.maxLatE7 / 1e7],
  [DEPLOYMENT.map.minLonE7 / 1e7, DEPLOYMENT.map.minLatE7 / 1e7],
];

export interface OfflineMapSnapshot {
  readonly status: 'checking' | 'downloading' | 'ready' | 'not-downloaded' | 'error';
  readonly progress: number;
  readonly completedBytes: number;
  readonly completedResources: number;
  readonly error?: string;
}

const unavailable: OfflineMapSnapshot = { status: 'not-downloaded', progress: 0, completedBytes: 0, completedResources: 0 };

export class OfflineMapService {
  async snapshot(): Promise<OfflineMapSnapshot> {
    if (Constants.appOwnership === 'expo') return unavailable;
    try {
      const pack = await OfflineManager.getPack(MUMBAI_MAP_PACK_NAME);
      if (!pack) return unavailable;
      return fromStatus(await pack.status());
    } catch (reason) {
      return { ...unavailable, status: 'error', error: messageOf(reason) };
    }
  }

  async download(onProgress: (snapshot: OfflineMapSnapshot) => void): Promise<OfflineMapSnapshot> {
    if (Constants.appOwnership === 'expo') throw new Error('Offline basemap download requires the Android/iOS development build, not stock Expo Go.');
    OfflineManager.setTileCountLimit(75_000);
    OfflineManager.setProgressEventThrottle(750);
    const existing = await OfflineManager.getPack(MUMBAI_MAP_PACK_NAME);
    const complete = (status: OfflinePackStatus) => status.state === OfflinePackDownloadState.Complete || status.percentage >= 100;
    if (existing) {
      const current = await existing.status();
      if (complete(current)) return fromStatus(current);
    }
    return new Promise<OfflineMapSnapshot>((resolve, reject) => {
      const progress = (_pack: unknown, status: OfflinePackStatus) => {
        const snapshot = fromStatus(status);
        onProgress(snapshot);
        if (complete(status)) resolve(snapshot);
      };
      const failure = (_pack: unknown, error: { message?: string }) => reject(new Error(error.message ?? 'Offline map download failed'));
      void (async () => {
        if (existing) {
          await OfflineManager.subscribe(MUMBAI_MAP_PACK_NAME, progress, failure);
          await existing.resume();
        } else {
          await OfflineManager.createPack({
            name: MUMBAI_MAP_PACK_NAME,
            styleURL: MUMBAI_MAP_STYLE_URL,
            bounds: MUMBAI_MAP_BOUNDS,
            minZoom: DEPLOYMENT.map.minZoom,
            maxZoom: DEPLOYMENT.map.maxZoom,
          }, progress, failure);
        }
      })().catch(reject);
    });
  }
}

function fromStatus(status: OfflinePackStatus): OfflineMapSnapshot {
  const progress = Math.max(0, Math.min(100, Math.round(status.percentage || 0)));
  return {
    status: status.state === OfflinePackDownloadState.Complete || progress >= 100 ? 'ready' : 'downloading',
    progress,
    completedBytes: status.completedResourceSize ?? status.completedTileSize ?? 0,
    completedResources: status.completedResourceCount ?? 0,
  };
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }

export const offlineMapService = new OfflineMapService();
