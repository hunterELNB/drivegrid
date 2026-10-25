import { memo, useMemo, useState } from 'react';
import type { AnalyticsModel } from '@/lib/vpp/analytics';
import { formatEnergy, formatNumber, formatUSD } from '@/lib/vpp/units';
import { EquipmentGraphic } from '../_components/NetworkEquipment';
import { analyticsTime, executiveItems, recordedEnergyPoints } from './presentation';
import type { RecordedEnergyPoint } from './presentation';
import { EnergyPerformanceSvg } from './EnergyPerformanceSvg';
import c from './analytics.module.css';

export const ExecutiveOverview=memo(function ExecutiveOverview({model}:{model:AnalyticsModel}){
  return <section className={c.executive} aria-label="Executive analytics overview">{executiveItems(model).map((item,index)=><article key={item.label} data-tone={item.tone}><div className={c.cardIndex}>0{index+1}<span aria-hidden="true">{['↗','↙','Σ','◫','◉','≡'][index]}</span></div><h2>{item.label}</h2><strong>{item.value}</strong>{index===3||index===4?<div className={c.meter} aria-hidden="true"><i style={{width:`${index===3?model.energy.acceptancePct??0:model.operations.availabilityPct}%`}}/></div>:<div className={c.cardRule}/>}<p>{item.note}</p></article>)}</section>;
});

function RecordedPerformance({points}:{points:readonly RecordedEnergyPoint[]}){
  const [selection,setSelection]=useState<string|null>(null);
  const found=points.findIndex(p=>p.timestamp===selection),selected=found<0?points.length-1:found;
  const point=points[selected];
  const inspect=(index:number)=>setSelection(points[index].timestamp);
  return <>
    <div className={c.chartViewport} role="region" tabIndex={0} aria-label="Signed energy performance chart"><EnergyPerformanceSvg points={points} selected={selected} onInspect={inspect}/></div>
    <div className={c.performanceFooter}><div className={c.legend}><span><i data-color="charge"/>Charge / import −</span><span><i data-color="discharge"/>Discharge / export +</span><span><i data-color="idle"/>Idle / zero</span></div><span>15-minute records · no gap filling</span></div>
    <div className={c.inspection} aria-label="Recorded interval inspection"><label>Inspect recorded interval<select value={selected} onChange={e=>inspect(Number(e.target.value))}>{points.map((p,index)=><option key={p.timestamp} value={index}>{analyticsTime(p.timestamp)} · {p.command}</option>)}</select></label><div className={c.inspectionButtons}><button aria-label="Previous recorded interval" disabled={selected===0} onClick={()=>inspect(selected-1)}>←</button><button aria-label="Next recorded interval" disabled={selected===points.length-1} onClick={()=>inspect(selected+1)}>→</button></div><dl aria-live="polite"><div><dt>Command / outcome</dt><dd data-command={point.command}>{point.command} · {point.status}</dd></div><div><dt>Signed grid energy</dt><dd>{formatEnergy(point.acEnergyMWh,'record')}</dd></div><div><dt>Settled gross / net</dt><dd>{formatUSD(point.grossCents/100)} / {formatUSD(point.netCents/100)}</dd></div></dl></div>
  </>;
}
export const PerformanceIntelligence=memo(function PerformanceIntelligence({model}:{model:AnalyticsModel}){
  const points=useMemo(()=>recordedEnergyPoints(model),[model]);
  return <section className={c.performance} aria-label="Recorded performance intelligence"><header className={c.sectionHeader}><div><span className={c.overline}>01 / RECORDED PERFORMANCE</span><h2>Energy, with a clear direction.</h2><p>Signed AC energy from existing dispatch records · selected analysis period</p></div><div className={c.recordBadge}><strong>{points.length}</strong><span>EXECUTED INTERVALS</span></div></header>{points.length?<RecordedPerformance points={points}/>:<div className={c.emptyPerformance}><span aria-hidden="true">⌁</span><h3>Your recorded performance starts here.</h3><p>No recorded dispatch in the selected time range. No time series has been synthesized.</p><p>Execute a simulated interval on Dispatch or change the time filter. Current asset and operational snapshots remain available below.</p></div>}</section>;
});

export const FleetTypeOverview=memo(function FleetTypeOverview({types,total}:{types:AnalyticsModel['typePerformance'];total:number}){
  const maxEnergy=Math.max(0,...types.flatMap(t=>[t.importedMWh,t.exportedMWh]));
  return <div className={c.fleetCards}>{types.map((type,index)=><article key={type.value}><div className={c.fleetTop}><div><span className={c.overline}>RESOURCE 0{index+1}</span><h3>{type.label}</h3><strong>{formatNumber(type.count)} <small>assets</small></strong></div><div className={c.equipment}><EquipmentGraphic kind={type.value==='ev-v2g'?'ev':type.value==='residential-battery'?'home':'bess'}/></div></div><div className={c.fleetCount} aria-label={`${type.label}: ${type.count} of ${total} assets`}><i style={{width:`${total?type.count/total*100:0}%`}}/></div><p className={c.micro}>Asset count share · current fleet</p><div className={c.throughput}><div><span>Imported</span><strong>{formatEnergy(type.importedMWh,'fleet')}</strong><i data-color="charge" style={{width:`${maxEnergy?type.importedMWh/maxEnergy*100:0}%`}}/></div><div><span>Exported</span><strong>{formatEnergy(type.exportedMWh,'fleet')}</strong><i data-color="discharge" style={{width:`${maxEnergy?type.exportedMWh/maxEnergy*100:0}%`}}/></div></div><p className={c.micro}>Recorded energy · selected range · common magnitude scale</p><footer><span>Simulated net</span><strong data-sign={type.totals.netCents<0?'negative':'other'}>{formatUSD(type.totals.netCents/100)}</strong></footer></article>)}</div>;
});
