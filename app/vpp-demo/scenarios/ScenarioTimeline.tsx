import { useState } from 'react';
import { formatEnergy, formatMarketPrice, formatNumber, formatPower, formatUSD } from '@/lib/vpp/units';
import type { ScenarioDisplayResult } from './presentation';
import { scenarioClock } from './presentation';
import { ScenarioTimelineSvg } from './ScenarioTimelineSvg';
import c from './scenarios.module.css';

export function ScenarioTimeline({result:r}:{result:ScenarioDisplayResult}){
  const [selection,setSelection]=useState(0),selected=Math.min(selection,r.points.length-1),p=r.points[selected];
  return <><div className={c.chartScroll} tabIndex={0} role="region" aria-label={`${r.name} timeline chart`}><ScenarioTimelineSvg name={r.name} points={r.points} selected={selected} onInspect={setSelection}/></div><div className={c.legend}><span><i className={c.chargeKey}/>Charge / import</span><span><i className={c.dischargeKey}/>Discharge / export</span><span><i className={c.idleKey}/>Idle</span></div><div className={c.timelineInspection}><div className={c.inspectControls}><label>Inspect {r.name} interval<select value={selected} onChange={e=>setSelection(Number(e.target.value))}>{r.points.map((point,index)=><option key={point.timestamp} value={index}>{scenarioClock(point.step)} CT · {point.command}</option>)}</select></label><button aria-label={`Previous ${r.name} interval`} disabled={selected===0} onClick={()=>setSelection(selected-1)}>←</button><button aria-label={`Next ${r.name} interval`} disabled={selected===r.points.length-1} onClick={()=>setSelection(selected+1)}>→</button></div><dl aria-live="polite">{[
    ['Command',p.command],['Synthetic market price',formatMarketPrice(p.priceUSDPerMWh)],['Signed AC power',formatPower(p.acPowerMW,'fleet')],['Signed grid energy',formatEnergy(p.acEnergyMWh,'record')],['Weighted SOC',`${formatNumber(p.averageSocPct)}%`],['Raw gross market value',formatUSD(p.grossEnergyValueUSD)],
  ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></>;
}
