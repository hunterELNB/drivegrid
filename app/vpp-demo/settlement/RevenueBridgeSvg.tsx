import { memo, useId } from 'react';
import type { BridgeStep } from './settlement-presentation';
import { formatUSD } from '@/lib/vpp/units';
import c from './settlement.module.css';

/** Read-only 2D financial renderer; no settlement rules or shared state. */
export const RevenueBridgeSvg=memo(function RevenueBridgeSvg({steps}:{steps:readonly BridgeStep[]}){
  const id=useId();
  const low=Math.min(0,...steps.flatMap(step=>[step.fromCents,step.toCents]));
  const high=Math.max(0,...steps.flatMap(step=>[step.fromCents,step.toCents]));
  const span=high-low||1;
  const y=(cents:number)=>70+(high-cents)/span*230;
  const x=(index:number)=>130+index*170;
  const ticks=Array.from({length:5},(_,index)=>low+span*index/4);
  return <svg className={c.bridgeSvg} viewBox="0 0 1000 400" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
    <title id={`${id}-title`}>Revenue bridge from gross value through costs to signed net</title><desc id={`${id}-desc`}>Existing integer-cent ledger totals on a linear USD axis. Each fee is a deduction even when gross or net is negative. Actual exact amounts are listed beside this chart and in the ledger. No fee or allocation rules are calculated by this renderer.</desc>
    <defs><pattern id={`${id}-grid`} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#6193a4" strokeWidth=".5"/></pattern></defs><rect x="90" y="45" width="850" height="285" fill={`url(#${id}-grid)`} opacity=".13"/>
    <text x="20" y="28">USD · linear scale</text>
    {ticks.filter((tick,index)=>ticks.findIndex(value=>formatUSD(value/100)===formatUSD(tick/100))===index).map((tick,index)=><g key={index}><line x1="100" x2="940" y1={y(tick)} y2={y(tick)} stroke="#2e4b60" strokeDasharray="3 6"/><text x="88" y={y(tick)+4} textAnchor="end">{formatUSD(tick/100)}</text></g>)}
    <line x1="100" x2="940" y1={y(0)} y2={y(0)} stroke="#7697aa"/>
    {steps.map((step,index)=>{
      const top=Math.min(y(step.fromCents),y(step.toCents));
      const height=Math.abs(y(step.fromCents)-y(step.toCents));
      const fill=step.kind==='cost'?'#bd9c71':step.toCents<0?'#cf8e89':step.kind==='net'?'#79b9ed':'#69cfb7';
      return <g key={step.label}><title>{step.label}: {formatUSD(step.deltaCents/100)}{step.kind==='cost'?' deduction':''}</title><rect x={x(index)} y={top} width="105" height={Math.max(1,height)} rx="3" fill={fill} opacity={height===0?.45:.85}/><text x={x(index)+52.5} y={top-13} textAnchor="middle" className={c.bridgeValue}>{formatUSD(step.deltaCents/100)}</text>{index<steps.length-1&&<line x1={x(index)+105} x2={x(index+1)} y1={y(step.toCents)} y2={y(step.toCents)} stroke="#7a99aa" strokeDasharray="3 4"/>}<text x={x(index)+52.5} y="355" textAnchor="middle">{step.label}</text><text x={x(index)+52.5} y="376" textAnchor="middle">{step.kind==='cost'?'Deduction':step.kind==='net'?'Authoritative net':'Signed gross'}</text></g>;
    })}
  </svg>;
});
