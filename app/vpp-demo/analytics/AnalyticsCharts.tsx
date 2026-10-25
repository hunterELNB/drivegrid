import { useState } from 'react';
import { formatNumber, formatUSD } from '@/lib/vpp/units';
import { analyticsTime } from './presentation';
import { TrendPlotSvg } from './TrendPlotSvg';
import c from './analytics.module.css';

export interface TrendPoint {readonly timestamp:string;readonly step:number;readonly values:readonly number[]}
export function TrendChart({id,points,labels,unit,currency=false}:{id:string;points:readonly TrendPoint[];labels:readonly string[];unit:string;currency?:boolean}){
  const [selection,setSelection]=useState<string|null>(null);
  if(!points.length)return <div className={c.emptyTrend}><span aria-hidden="true">⌁</span><p>No executed intervals in this range. No time series has been synthesized.</p></div>;
  const found=points.findIndex(p=>p.timestamp===selection),selected=found<0?points.length-1:found;
  const display=(value:number)=>currency?formatUSD(value):`${formatNumber(value)} ${unit}`;
  return <><div className={c.chartViewport} tabIndex={0} role="region" aria-label={`${labels.join(' versus ')} trend chart`}><TrendPlotSvg id={id} points={points} labels={labels} unit={unit} currency={currency} selected={selected} onInspect={index=>setSelection(points[index].timestamp)}/></div><div className={c.legend}>{labels.map((label,index)=><span key={label}><i data-color={index===0?'discharge':'charge'}/>{label}</span>)}</div><div className={c.trendReadout}><label>Inspect {id} interval<select value={selected} onChange={e=>setSelection(points[Number(e.target.value)].timestamp)}>{points.map((p,index)=><option key={p.timestamp} value={index}>{analyticsTime(p.timestamp)}</option>)}</select></label><dl>{labels.map((label,index)=><div key={label}><dt>{label}</dt><dd>{display(points[selected].values[index])}</dd></div>)}</dl></div></>;
}
