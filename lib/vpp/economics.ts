export interface PricedEnergy { acEnergyMWh: number; marketPriceUSDPerMWh: number }
export function grossEnergyValueUSD(energyMWh: number, priceUSDPerMWh: number): number {
  if (!Number.isFinite(energyMWh) || !Number.isFinite(priceUSDPerMWh)) throw new Error('Energy and price must be finite.');
  return energyMWh === 0 ? 0 : energyMWh * priceUSDPerMWh;
}
/** Uses executed AC energy once; efficiency losses are already in the physical ledger. */
export function economicSummary(intervals: readonly PricedEnergy[]) {
  for (const interval of intervals) grossEnergyValueUSD(interval.acEnergyMWh,interval.marketPriceUSDPerMWh);
  const exported = intervals.filter(i => i.acEnergyMWh > 0);
  const imported = intervals.filter(i => i.acEnergyMWh < 0);
  const exportedMWh = exported.reduce((sum,i) => sum+i.acEnergyMWh,0);
  const importedMWh = -imported.reduce((sum,i) => sum+i.acEnergyMWh,0);
  const dischargingValueUSD = exported.reduce((sum,i) => sum+grossEnergyValueUSD(i.acEnergyMWh,i.marketPriceUSDPerMWh),0);
  const chargingCostUSD = -imported.reduce((sum,i) => sum+grossEnergyValueUSD(i.acEnergyMWh,i.marketPriceUSDPerMWh),0);
  return {
    cumulativeGrossValueUSD: dischargingValueUSD-chargingCostUSD,
    exportedMWh, importedMWh: importedMWh === 0 ? 0 : importedMWh,
    chargingCostUSD: chargingCostUSD === 0 ? 0 : chargingCostUSD,
    dischargingValueUSD,
    averageExportPriceUSDPerMWh: exportedMWh === 0 ? null : dischargingValueUSD/exportedMWh,
  };
}
