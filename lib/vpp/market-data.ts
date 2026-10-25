/** Synthetic demonstration prices, not ERCOT observations or settlement prices. */
export const MARKET_SCENARIO_ID = 'synthetic-ercot-inspired-2026-10-23-phase5';
const priceAnchors: readonly (readonly [number,number])[] = [
  [0,30],[4,30],[7,-80],[8,-200],[9,-200],[12,30],[20,50],[28,110],
  [32,100],[35,100],[44,80],[56,100],[64,300],[68,500],[72,500],
  [73,900],[74,2500],[75,650],[76,500],[80,300],[88,100],[95,30],
];
function syntheticPrice(step: number): number {
  const right=priceAnchors.findIndex(([index])=>index>=step);
  if(priceAnchors[right][0]===step) return priceAnchors[right][1];
  const [start,low]=priceAnchors[right-1];
  const [end,high]=priceAnchors[right];
  return Math.round((low+(high-low)*(step-start)/(end-start))*1000)/1000;
}
export interface MarketPrice { readonly step: number; readonly priceUSDPerMWh: number }
export const marketPrices: readonly MarketPrice[] = Array.from({ length: 96 }, (_, step) => ({
  step,
  priceUSDPerMWh: syntheticPrice(step),
}));
export function marketPriceAt(step: number): number | null {
  return Number.isInteger(step) && step >= 0 && step < marketPrices.length ? marketPrices[step].priceUSDPerMWh : null;
}
export function marketStatistics() {
  const prices = marketPrices.map(p => p.priceUSDPerMWh);
  return { minimum: Math.min(...prices), maximum: Math.max(...prices), average: prices.reduce((sum,p) => sum+p,0)/prices.length };
}
