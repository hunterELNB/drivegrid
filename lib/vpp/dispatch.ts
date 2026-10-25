import type { DERAsset } from './domain.ts';

export type DispatchCommand = 'charge' | 'discharge' | 'idle';
export type DispatchStatus = 'accepted' | 'curtailed' | 'rejected';
export const DURATION_HOURS = 0.25;
export const CHARGE_EFFICIENCY = 0.95;
export const DISCHARGE_EFFICIENCY = 0.95;
const EPSILON = 1e-10;

export interface DispatchRequest {
  command: DispatchCommand;
  requestedPowerMW: number; // nonnegative AC magnitude; direction comes from command
  assetId: string | null; // null = fleet
}
export interface AssetDispatch {
  assetId: string;
  requestedPowerMW: number;
  acceptedPowerMW: number; // magnitude
  rejectedPowerMW: number;
  curtailedPowerMW: number;
  requestedEnergyMWh: number;
  acceptedEnergyMWh: number;
  rejectedEnergyMWh: number;
  curtailedEnergyMWh: number;
  acPowerMW: number; // export/discharge positive, import/charge negative
  acEnergyMWh: number; // signed power × duration
  batteryEnergyDeltaMWh: number; // stored energy increase positive
  lossMWh: number;
  socBeforePct: number;
  socAfterPct: number;
  status: DispatchStatus;
  reasons: string[];
}
export interface DispatchResult {
  request: DispatchRequest;
  status: DispatchStatus;
  requestedPowerMW: number;
  acceptedPowerMW: number;
  rejectedPowerMW: number;
  curtailedPowerMW: number;
  requestedEnergyMWh: number;
  acceptedEnergyMWh: number;
  rejectedEnergyMWh: number;
  curtailedEnergyMWh: number;
  acPowerMW: number;
  acEnergyMWh: number;
  batteryEnergyDeltaMWh: number;
  lossMWh: number;
  reasons: string[];
  records: AssetDispatch[];
  exclusions: { assetId: string; reasons: string[] }[];
  assets: readonly DERAsset[];
}

export function validDispatchRequest(request: DispatchRequest): boolean {
  // Public demo input bound; accepted equipment/SOC/efficiency calculations are unchanged.
  return Number.isFinite(request.requestedPowerMW) && request.requestedPowerMW >= 0 && request.requestedPowerMW <= 100
    && ['charge','discharge','idle'].includes(request.command)
    && (request.command === 'idle' ? request.requestedPowerMW === 0 : request.requestedPowerMW > 0);
}

function equipmentValid(a: DERAsset): boolean {
  return [a.ratedPowerMW, a.energyCapacityMWh, a.maxChargingPowerMW, a.maxDischargingPowerMW,
    a.socPct, a.minSocPct, a.maxSocPct].every(Number.isFinite)
    && a.ratedPowerMW > 0 && a.energyCapacityMWh > 0
    && a.maxChargingPowerMW >= 0 && a.maxDischargingPowerMW >= 0
    && a.minSocPct >= 0 && a.maxSocPct <= 100 && a.minSocPct <= a.socPct && a.socPct <= a.maxSocPct;
}

export function dispatchLimit(asset: DERAsset, command: DispatchCommand): { powerMW: number; reasons: string[] } {
  if (!equipmentValid(asset)) return { powerMW: 0, reasons: ['Invalid equipment ratings or SOC'] };
  if (command === 'idle') return { powerMW: 0, reasons: [] };
  const blocked: string[] = [];
  if (asset.availability !== 'available') blocked.push('Asset unavailable');
  if (asset.status !== 'ready') blocked.push(`Operational status: ${asset.status}`);
  if (command === 'discharge' && asset.type === 'ev-v2g' && !asset.v2gEnabled) blocked.push('V2G disabled');
  if (blocked.length) return { powerMW: 0, reasons: blocked };
  const charging = command === 'charge';
  const equipmentLimit = Math.min(asset.ratedPowerMW, charging ? asset.maxChargingPowerMW : asset.maxDischargingPowerMW);
  const energyHeadroom = asset.energyCapacityMWh * (charging ? asset.maxSocPct - asset.socPct : asset.socPct - asset.minSocPct) / 100;
  const energyLimit = charging
    ? energyHeadroom / (CHARGE_EFFICIENCY * DURATION_HOURS)
    : energyHeadroom * DISCHARGE_EFFICIENCY / DURATION_HOURS;
  const reasons = [charging ? 'Charging power limit' : 'Discharging power limit'];
  if (energyLimit < equipmentLimit) reasons.unshift(charging ? 'Maximum SOC / energy headroom' : 'Minimum SOC / stored energy reserve');
  return { powerMW: Math.max(0, Math.min(equipmentLimit, energyLimit)), reasons };
}

export function dispatchAsset(asset: DERAsset, command: DispatchCommand, requestedPowerMW: number): AssetDispatch {
  const valid = Number.isFinite(requestedPowerMW) && requestedPowerMW >= 0 && ['charge','discharge','idle'].includes(command);
  const limit = dispatchLimit(asset, command);
  const validIdle = command === 'idle' && requestedPowerMW === 0 && equipmentValid(asset);
  const accepted = valid && command !== 'idle' ? Math.min(requestedPowerMW, limit.powerMW) : 0;
  const status: DispatchStatus = !valid || !equipmentValid(asset) || (command === 'idle' && !validIdle)
    || (!validIdle && (requestedPowerMW === 0 || accepted <= EPSILON)) ? 'rejected'
    : accepted + EPSILON < requestedPowerMW ? 'curtailed' : 'accepted';
  const power = status === 'rejected' ? 0 : accepted;
  const acPowerMW = command === 'charge' ? -power : power;
  const acEnergyMWh = acPowerMW * DURATION_HOURS;
  const batteryEnergyDeltaMWh = command === 'charge'
    ? -acEnergyMWh * CHARGE_EFFICIENCY : -acEnergyMWh / DISCHARGE_EFFICIENCY;
  const socAfterPct = asset.socPct + batteryEnergyDeltaMWh / asset.energyCapacityMWh * 100;
  return {
    assetId: asset.id, requestedPowerMW: valid ? requestedPowerMW : 0, acceptedPowerMW: power,
    rejectedPowerMW: status === 'rejected' && valid ? requestedPowerMW : 0,
    curtailedPowerMW: status === 'curtailed' ? requestedPowerMW - power : 0,
    requestedEnergyMWh: valid ? requestedPowerMW * DURATION_HOURS : 0,
    acceptedEnergyMWh: power * DURATION_HOURS,
    rejectedEnergyMWh: status === 'rejected' && valid ? requestedPowerMW * DURATION_HOURS : 0,
    curtailedEnergyMWh: status === 'curtailed' ? (requestedPowerMW - power) * DURATION_HOURS : 0,
    acPowerMW, acEnergyMWh, batteryEnergyDeltaMWh,
    lossMWh: Math.max(0, -acEnergyMWh - batteryEnergyDeltaMWh),
    socBeforePct: asset.socPct,
    socAfterPct: status === 'rejected' ? asset.socPct : Math.min(asset.maxSocPct, Math.max(asset.minSocPct, socAfterPct)),
    status, reasons: !valid ? ['Request must be finite, nonnegative, and use a valid command']
      : command === 'idle' && !validIdle ? ['Idle requires zero requested power and valid equipment']
      : command !== 'idle' && requestedPowerMW === 0 ? ['Charge/discharge requires positive power']
      : status === 'accepted' ? [] : limit.reasons,
  };
}

/** Stable ID order, greedy allocation. No optimization or uncontrolled randomness. */
export function executeDispatch(assets: readonly DERAsset[], request: DispatchRequest): DispatchResult {
  const records: AssetDispatch[] = [];
  const exclusions: DispatchResult['exclusions'] = [];
  const validRequest = validDispatchRequest(request);
  const candidates = assets.filter(a => request.assetId === null || a.id === request.assetId)
    .toSorted((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  let remaining = validRequest ? request.requestedPowerMW : 0;
  if (validRequest) {
    for (const asset of candidates) {
      if (request.assetId !== null || request.command === 'idle') {
        records.push(dispatchAsset(asset, request.command, request.requestedPowerMW));
        continue;
      }
      const limit = dispatchLimit(asset, request.command);
      if (limit.powerMW <= EPSILON) { exclusions.push({ assetId: asset.id, reasons: limit.reasons }); continue; }
      if (remaining <= EPSILON) continue;
      const record = dispatchAsset(asset, request.command, Math.min(remaining, limit.powerMW));
      records.push(record);
      remaining = Math.max(0, remaining - record.acceptedPowerMW);
    }
  }
  const acceptedPowerMW = records.reduce((sum,r) => sum + r.acceptedPowerMW,0);
  const status: DispatchStatus = !validRequest || !candidates.length || records.some(r => request.command === 'idle' && r.status === 'rejected')
    || (request.command !== 'idle' && acceptedPowerMW <= EPSILON) ? 'rejected'
    : acceptedPowerMW + EPSILON < request.requestedPowerMW ? 'curtailed' : 'accepted';
  const updates = new Map(records.map(r => [r.assetId,r.socAfterPct]));
  const requested = validRequest ? request.requestedPowerMW : 0;
  return {
    request, status, requestedPowerMW: requested, acceptedPowerMW,
    rejectedPowerMW: status === 'rejected' ? requested : 0,
    curtailedPowerMW: status === 'curtailed' ? Math.max(0, requested - acceptedPowerMW) : 0,
    requestedEnergyMWh: requested * DURATION_HOURS,
    acceptedEnergyMWh: acceptedPowerMW * DURATION_HOURS,
    rejectedEnergyMWh: status === 'rejected' ? requested * DURATION_HOURS : 0,
    curtailedEnergyMWh: status === 'curtailed' ? Math.max(0, requested - acceptedPowerMW) * DURATION_HOURS : 0,
    acPowerMW: records.reduce((sum,r) => sum + r.acPowerMW,0),
    acEnergyMWh: records.reduce((sum,r) => sum + r.acEnergyMWh,0),
    batteryEnergyDeltaMWh: records.reduce((sum,r) => sum + r.batteryEnergyDeltaMWh,0),
    lossMWh: records.reduce((sum,r) => sum + r.lossMWh,0),
    reasons: !validRequest ? ['Invalid power or command; Idle requires zero, Charge/Discharge require positive power']
      : !candidates.length ? ['No matching assets']
      : status === 'accepted' ? []
      : request.assetId !== null ? records.flatMap(r => r.reasons)
      : ['Fleet eligible power / SOC headroom exhausted', ...Array.from(new Set(exclusions.flatMap(e => e.reasons)))],
    records, exclusions,
    assets: assets.map(a => updates.has(a.id) ? { ...a, socPct: updates.get(a.id)! } : a),
  };
}
