import { dispatchLimit } from './dispatch.ts';

export type AssetType = 'ev-v2g' | 'residential-battery' | 'commercial-bess';
export type OperationalStatus = 'ready' | 'standby' | 'offline' | 'maintenance';
export type Availability = 'available' | 'unavailable';

export interface DERAsset {
  readonly id: string;
  readonly name: string;
  readonly type: AssetType;
  readonly location: string;
  readonly ratedPowerMW: number;
  readonly energyCapacityMWh: number;
  readonly maxChargingPowerMW: number;
  readonly maxDischargingPowerMW: number;
  readonly minSocPct: number;
  readonly maxSocPct: number;
  readonly v2gEnabled: boolean;
  readonly socPct: number;
  readonly availability: Availability;
  readonly status: OperationalStatus;
}

export const assetTypes: ReadonlyArray<{ value: AssetType; label: string; color: string }> = [
  { value: 'ev-v2g', label: 'EV / V2G', color: '#39d5d0' },
  { value: 'residential-battery', label: 'Residential battery', color: '#5b9cff' },
  { value: 'commercial-bess', label: 'Commercial BESS', color: '#8d8bfa' },
];
export const operationalStatuses: readonly OperationalStatus[] = ['ready', 'standby', 'offline', 'maintenance'];

/** Representative equipment ratings; no random values or external data. */
export function createAssets(): DERAsset[] {
  return assetTypes.flatMap(({ value: type, label }) => {
    const count = type === 'ev-v2g' ? 1000 : type === 'residential-battery' ? 100 : 50;
    const readyCount = type === 'ev-v2g' ? 900 : type === 'residential-battery' ? 80 : 40;
    const ratedPowerMW = type === 'ev-v2g' ? 0.007 : type === 'residential-battery' ? 0.01 : 0.24;
    const energyCapacityMWh = type === 'ev-v2g' ? 0.075 : type === 'residential-battery' ? 0.027 : 0.8;
    const maxDischargingPowerMW = type === 'ev-v2g' ? 0.006 : type === 'residential-battery' ? 0.01 : 0.145;
    return Array.from({ length: count }, (_, index) => {
      const offline = type === 'ev-v2g' && index >= 966;
      return {
        id: `${type}-${String(index + 1).padStart(4, '0')}`,
        name: `${label} ${String(index + 1).padStart(4, '0')}`,
        type, location: ['Dallas', 'Houston', 'Austin', 'San Antonio'][index % 4],
        ratedPowerMW, energyCapacityMWh, maxChargingPowerMW: ratedPowerMW,
        maxDischargingPowerMW, minSocPct: 20, maxSocPct: 100,
        socPct: 68, v2gEnabled: type === 'ev-v2g',
        availability: index < readyCount ? 'available' : 'unavailable',
        status: offline ? 'offline' : index < readyCount ? 'ready' : 'standby',
      };
    });
  });
}

export type AssetUpdate = Pick<DERAsset, 'socPct' | 'availability' | 'status'>;

export function validAssetUpdate(asset: DERAsset, update: AssetUpdate): boolean {
  return Number.isFinite(update.socPct)
    && update.socPct >= asset.minSocPct && update.socPct <= asset.maxSocPct
    && (update.availability === 'available' || update.availability === 'unavailable')
    && operationalStatuses.includes(update.status);
}

/** AC discharge power sustainable for the next 15-minute interval. */
export function availableDispatchMW(asset: DERAsset): number {
  return dispatchLimit(asset, 'discharge').powerMW;
}

export function portfolioMetrics(assets: readonly DERAsset[]) {
  const energyCapacityMWh = assets.reduce((sum, a) => sum + a.energyCapacityMWh, 0);
  return {
    ratedPowerMW: assets.reduce((sum, a) => sum + a.ratedPowerMW, 0),
    availablePowerMW: assets.reduce((sum, a) => sum + availableDispatchMW(a), 0),
    energyCapacityMWh,
    connectedAssets: assets.filter(a => a.status !== 'offline' && a.status !== 'maintenance').length,
    averageSocPct: energyCapacityMWh === 0 ? 0 : assets.reduce((sum, a) => sum + a.socPct * a.energyCapacityMWh, 0) / energyCapacityMWh,
    composition: assetTypes.map(type => ({ ...type, capacityMW: assets.filter(a => a.type === type.value).reduce((sum, a) => sum + a.ratedPowerMW, 0) })),
    statuses: [
      { label: 'Available', count: assets.filter(a => availableDispatchMW(a) > 0).length, color: '#52d49a' },
      { label: 'Standby', count: assets.filter(a => a.status !== 'offline' && a.status !== 'maintenance' && availableDispatchMW(a) === 0).length, color: '#5b9cff' },
      { label: 'Offline / maintenance', count: assets.filter(a => a.status === 'offline' || a.status === 'maintenance').length, color: '#f2bc72' },
    ],
  };
}

export interface AssetFilters {
  search: string;
  type: AssetType | 'all';
  status: OperationalStatus | 'all';
  availability: Availability | 'all';
}
export function filterAssets(assets: readonly DERAsset[], filters: AssetFilters): DERAsset[] {
  const query = filters.search.trim().toLowerCase();
  return assets.filter(a => (filters.type === 'all' || a.type === filters.type)
    && (filters.status === 'all' || a.status === filters.status)
    && (filters.availability === 'all' || a.availability === filters.availability)
    && `${a.id} ${a.name} ${a.location}`.toLowerCase().includes(query));
}
