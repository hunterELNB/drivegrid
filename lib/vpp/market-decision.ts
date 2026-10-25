import type { DERAsset } from './domain.ts';
import { executeDispatch } from './dispatch.ts';
import type { DispatchRequest, DispatchResult } from './dispatch.ts';
import { marketPriceAt } from './market-data.ts';
import { formatNumber } from './units.ts';

export interface MarketSettings {
  chargeThresholdUSDPerMWh: number;
  dischargeThresholdUSDPerMWh: number;
  requestedFleetPowerMW: number;
}
export const DEFAULT_MARKET_SETTINGS: Readonly<MarketSettings> = {
  chargeThresholdUSDPerMWh: 50, dischargeThresholdUSDPerMWh: 300, requestedFleetPowerMW: 1,
};
export function validateMarketSettings(settings: MarketSettings): string | null {
  if (![settings.chargeThresholdUSDPerMWh,settings.dischargeThresholdUSDPerMWh,settings.requestedFleetPowerMW].every(Number.isFinite)) return 'Thresholds and requested power must be finite numbers.';
  if (settings.chargeThresholdUSDPerMWh >= settings.dischargeThresholdUSDPerMWh) return 'Charge threshold must be strictly lower than discharge threshold.';
  if (settings.requestedFleetPowerMW <= 0) return 'Requested fleet power must be positive.';
  if (settings.requestedFleetPowerMW > 100) return 'Requested fleet power must not exceed 100 MW in this demo.';
  if (Math.max(Math.abs(settings.chargeThresholdUSDPerMWh),Math.abs(settings.dischargeThresholdUSDPerMWh)) > 100_000) return 'Thresholds must be between −100,000 and 100,000 USD/MWh.';
  return null;
}
export interface MarketRecommendation {
  step: number;
  priceUSDPerMWh: number;
  request: DispatchRequest;
  explanation: string;
  physicalPreview: DispatchResult;
}
export function recommendMarket(assets: readonly DERAsset[], step: number, settings: MarketSettings): MarketRecommendation {
  const price = marketPriceAt(step);
  if (price === null) throw new Error('No synthetic price exists for this interval. Reset after the 24-hour scenario.');
  return recommendAtPrice(assets, step, settings, price);
}
/** Shared strategy rule for the main market and isolated synthetic scenarios. */
export function recommendAtPrice(assets: readonly DERAsset[], step: number, settings: MarketSettings, price: number): MarketRecommendation {
  const error = validateMarketSettings(settings);
  if (error) throw new Error(error);
  if (!Number.isFinite(price)) throw new Error('Price must be finite.');
  const command = price < settings.chargeThresholdUSDPerMWh ? 'charge' : price > settings.dischargeThresholdUSDPerMWh ? 'discharge' : 'idle';
  const request: DispatchRequest = { command, assetId: null, requestedPowerMW: command === 'idle' ? 0 : settings.requestedFleetPowerMW };
  const explanation = command === 'charge' ? `Price ${formatNumber(price)} USD/MWh is below the charge threshold ${formatNumber(settings.chargeThresholdUSDPerMWh)} USD/MWh.`
    : command === 'discharge' ? `Price ${formatNumber(price)} USD/MWh is above the discharge threshold ${formatNumber(settings.dischargeThresholdUSDPerMWh)} USD/MWh.`
    : `Price ${formatNumber(price)} USD/MWh is between or equal to the thresholds. Boundary prices recommend Idle.`;
  return { step, priceUSDPerMWh: price, request, explanation, physicalPreview: executeDispatch(assets,request) };
}
