import { memo, useId } from 'react';
import { formatNumber, formatUSD } from '@/lib/vpp/units';
import { comparisonScale } from './presentation';
import type { ComparisonBarGroup } from './presentation';
import c from './scenarios.module.css';

export const ComparisonBarsSvg=memo(function ComparisonBarsSvg({groups,labels,unit,currency=false}:{groups:readonly ComparisonBarGroup[];labels:readonly string[];unit:string;currency?:boolean}){
  const id=useId(),scale=comparisonScale(groups),height=105+groups.length*82;
  const display=(value:number)=>currency?formatUSD(value):formatNumber(value);
  const ticks=[scale.minimum,(scale.minimum+scale.maximum)/2,scale.maximum].filter((v,i,list)=>list.findIndex(other=>display(other)===display(v))===i);
  return <svg viewBox={`0 0 1090 ${height}`} className={c.comparisonSvg} role="img" aria-labelledby={`${id}-title ${id}-desc`}><title id={`${id}-title`}>{`${labels.join(' versus ')} by scenario`}</title><desc id={`${id}-desc`}>{`Linear zero-inclusive ${unit} axis. Signed values are preserved. Input order is retained without a strategy ranking. Full values and terminal constraints are in the comparison table.`}</desc><text x="20" y="28">{unit} · linear scale</text>{ticks.map((tick,index)=><g key={index}><line x1={scale.x(tick)} x2={scale.x(tick)} y1="50" y2={height-38} stroke="#2a455b" strokeDasharray="3 5"/><text x={scale.x(tick)} y={height-13} textAnchor="middle">{display(tick)}</text></g>)}<line x1={scale.x(0)} x2={scale.x(0)} y1="50" y2={height-38} stroke="#89a8bc"/>{groups.map((group,index)=><g key={`${group.label}-${index}`}><text x="254" y={77+index*82} textAnchor="end" className={c.scenarioChartLabel}>{group.label}</text>{group.values.map((value,series)=>{const y=55+index*82+series*25;return <g key={series}><rect x={Math.min(scale.x(0),scale.x(value))} y={y} width={Math.max(1,Math.abs(scale.x(value)-scale.x(0)))} height="15" rx="2" fill={value<0?'#ce918b':series===0?'#6c9ee5':'#44bcb8'} opacity={value===0?.4:.9}/><text x="895" y={y+12} className={value<0?c.negativeAmount:undefined}>{display(value)}</text><title>{`${group.label} · ${labels[series]}: ${display(value)}${currency?'':` ${unit}`}`}</title></g>;})}</g>)}</svg>;
});
