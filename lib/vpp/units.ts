import type { AssetType } from './domain.ts';

export const mwToKw = (mw: number): number => mw * 1000;
export const kwToMw = (kw: number): number => kw / 1000;
export const mwhToKwh = (mwh: number): number => mwh * 1000;
export const kwhToMwh = (kwh: number): number => kwh / 1000;
export const usdPerMwhToUsdPerKwh = (price: number): number => price / 1000;
export const usdPerKwhToUsdPerMwh = (price: number): number => price * 1000;
export function formatPricePerKWh(priceUSDPerMWh: number): string {
  const value = Number(formatNumber(usdPerMwhToUsdPerKwh(priceUSDPerMWh)).replaceAll(',', ''));
  return `${value.toFixed(2)} USD/kWh`;
}
export function formatMarketPrice(price: number): string {
  return `${formatNumber(price)} USD/MWh (${formatPricePerKWh(price)})`;
}
export function formatUSD(value: number): string {
  const rounded = Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Object.is(rounded,-0) ? 0 : rounded);
}

/** Display only: physical and financial calculations retain their original precision. */
export function formatNumber(value: number): string {
  const rounded = Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Object.is(rounded, -0) ? 0 : rounded);
}
/** A rounded-up display ceiling, never an engine/accounting tolerance. */
export function formatToleranceCeiling(value: number): string {
  return formatUSD(Math.ceil(Math.abs(value) * 100) / 100);
}
export const numericInputDisplay = (value: number): string => formatNumber(value).replaceAll(',', '');
export function formatPower(mw: number, context: 'fleet' | 'record' | AssetType): string {
  const small = context === 'record' || context === 'ev-v2g' || context === 'residential-battery'
    || (context === 'commercial-bess' && Math.abs(mw) < 1);
  return `${formatNumber(small ? mwToKw(mw) : mw)} ${small ? 'kW' : 'MW'}`;
}
export function formatEnergy(mwh: number, context: 'fleet' | 'record' | AssetType): string {
  const small = context === 'record' || context === 'ev-v2g' || context === 'residential-battery'
    || (context === 'commercial-bess' && Math.abs(mwh) < 1);
  return `${formatNumber(small ? mwhToKwh(mwh) : mwh)} ${small ? 'kWh' : 'MWh'}`;
}
