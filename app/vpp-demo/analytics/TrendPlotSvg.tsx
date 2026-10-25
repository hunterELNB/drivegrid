import { memo, useId } from 'react';
import { formatNumber, formatUSD } from '@/lib/vpp/units';
import { analyticsTime } from './presentation';
import type { TrendPoint } from './AnalyticsCharts';
import c from './analytics.module.css';

const colors=['#7dafff','#49d6cf'];
export const TrendPlotSvg=memo(function TrendPlotSvg({id,points,labels,unit,currency,selected,onInspect}:{id:string;points:readonly TrendPoint[];labels:readonly string[];unit:string;currency:boolean;selected:number;onInspect:(index:number)=>void}){
  const unique=useId(),title=`${id}-${unique}`;
  const minimum=Math.min(0,...points.flatMap(p=>[...p.values])),maximum=Math.max(.001,...points.flatMap(p=>[...p.values]));
  const first=Date.parse(points[0].timestamp),last=Date.parse(points.at(-1)!.timestamp);
  const x=(timestamp:string)=>last===first?490:155+(Date.parse(timestamp)-first)/(last-first)*635;
  const y=(value:number)=>230-(value-minimum)/(maximum-minimum)*170;
  const display=(value:number)=>currency?formatUSD(value):formatNumber(value);
  const ticks=[...new Set([0,Math.floor(points.length/2),points.length-1])];
  const values=[minimum,(minimum+maximum)/2,maximum].filter((value,index,list)=>list.findIndex(other=>display(other)===display(value))===index);
  return <svg viewBox="0 0 870 300" className={c.trendSvg} role="img" aria-labelledby={`${title}-title ${title}-desc`}>
    <title id={`${title}-title`}>{`${labels.join(' versus ')} by recorded interval`}</title><desc id={`${title}-desc`}>{`Actual executed intervals only; units ${unit}. Linear zero-inclusive axes and straight segments between adjacent fifteen-minute records. Gaps are not filled. Exact recorded values are available in the interval selector below.`}</desc>
    <text x="20" y="28">{unit} · linear scale</text>
    {values.map((value,index)=><g key={index}><line x1="155" x2="790" y1={y(value)} y2={y(value)} stroke={value===0?'#7893ac':'#2b4056'} strokeDasharray={value===0?undefined:'3 5'}/><text x="140" y={y(value)+4} textAnchor="end">{display(value)}</text></g>)}
    <line x1={x(points[selected].timestamp)} x2={x(points[selected].timestamp)} y1="48" y2="238" stroke="#b9d6e8" opacity=".4" strokeDasharray="3 4"/>
    {labels.map((label,index)=><g key={label}>{points.slice(1).map((p,i)=>Date.parse(p.timestamp)-Date.parse(points[i].timestamp)===15*60*1000?<line key={p.timestamp} x1={x(points[i].timestamp)} y1={y(points[i].values[index])} x2={x(p.timestamp)} y2={y(p.values[index])} stroke={colors[index]} strokeWidth="2.5"/>:null)}{points.map((p,i)=><circle key={p.timestamp} cx={x(p.timestamp)} cy={y(p.values[index])} r={i===selected?5:3.5} fill={colors[index]} stroke={i===selected?'#e4f8ff':'#102033'} strokeWidth="1.5" onMouseEnter={()=>onInspect(i)}><title>{`${analyticsTime(p.timestamp)} · ${label}: ${display(p.values[index])}${currency?'':` ${unit}`}`}</title></circle>)}</g>)}
    {ticks.map(index=><text key={index} x={x(points[index].timestamp)} y="267" textAnchor="middle">{analyticsTime(points[index].timestamp).split(', ')[1]}</text>)}<text x="470" y="292" textAnchor="middle">Recorded interval start · Central Time</text>
  </svg>;
});
