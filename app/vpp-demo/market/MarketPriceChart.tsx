import { useCallback, useMemo, useState } from 'react';
import type { PriceIntervalView } from './market-presentation';
import { simulationLabel } from '@/lib/vpp/simulation';
import { formatNumber, formatMarketPrice, formatPricePerKWh } from '@/lib/vpp/units';
import { MarketPricePlot } from './MarketPricePlot';
import a from '../assets.module.css';
import m from './market.module.css';

export function MarketPriceChart({ activeStep, intervals, chargeThreshold, dischargeThreshold }: { activeStep: number; intervals: readonly PriceIntervalView[]; chargeThreshold: number; dischargeThreshold: number }) {
  const [inspected,setInspected] = useState<number|null>(null);
  const inspectedStep = inspected ?? (activeStep<96 ? activeStep : 95);
  const point = intervals[inspectedStep];
  const inspect = useCallback((step:number)=>setInspected(step),[]);
  const view = useMemo(()=>({intervals,activeStep,inspectedStep,chargeThreshold,dischargeThreshold}),[intervals,activeStep,inspectedStep,chargeThreshold,dischargeThreshold]);
  return <>
    <div className={m.chartLegend}><span><i className={m.chargeDot}/>Charge below {formatNumber(chargeThreshold)} USD/MWh</span><span><i className={m.dischargeDot}/>Discharge above {formatNumber(dischargeThreshold)} USD/MWh</span><span><i className={m.idleDot}/>Otherwise Idle · equality included</span></div>
    {[chargeThreshold,dischargeThreshold].some(value=>value < -300 || value > 2700) && <p className={m.help}>An applied threshold is outside the plotted price scale; its numeric value remains above. All 96 prices remain on the full linear dataset scale.</p>}
    <p className={m.chartHint}>Scroll the chart horizontally on smaller screens. The interval inspector below remains available for exact prices across the full day.</p>
    <div className={m.chartScroll} tabIndex={0} role="region" aria-label="Scrollable synthetic price chart"><MarketPricePlot view={view} onInspect={inspect}/></div>
    <div className={m.inspector}><div className={m.inspectValue} data-command={point.command}><span>INSPECTED INTERVAL · {simulationLabel(point.step)}</span><strong>{formatMarketPrice(point.priceUSDPerMWh)}</strong><p>{point.command.toUpperCase()} price-rule signal · inspecting does not change simulation time</p></div><label>Inspect price interval<input type="range" min="0" max="95" step="1" value={inspectedStep} onChange={event=>setInspected(Number(event.target.value))}/><small>Keyboard arrows select any of the 96 intervals. Hover the chart for the same exact values.</small></label></div>
    <details className={m.help}><summary>View all 96 synthetic prices</summary><div className={m.priceTable}>
      <table className={a.registry}><caption>Synthetic prices, not observed ERCOT settlement data</caption><thead><tr><th scope="col">Interval start (CT)</th><th scope="col">Price (USD/MWh)</th><th scope="col">Equivalent USD/kWh</th></tr></thead><tbody>{intervals.map(p=><tr key={p.step} className={p.step===activeStep?a.selectedRow:undefined} aria-current={p.step===activeStep?'time':undefined}><th scope="row">{simulationLabel(p.step)}</th><td>{formatNumber(p.priceUSDPerMWh)}{p.step===activeStep?' · CURRENT':''}</td><td>{formatPricePerKWh(p.priceUSDPerMWh)}</td></tr>)}</tbody></table>
    </div></details>
  </>;
}
