import { memo, useId } from 'react';
import { formatNumber } from '@/lib/vpp/units';
import type { ScenarioPoint } from '@/lib/vpp/scenarios';
import { scenarioClock } from './presentation';
import c from './scenarios.module.css';

export const ScenarioTimelineSvg=memo(function ScenarioTimelineSvg({name,points,selected,onInspect}:{name:string;points:readonly ScenarioPoint[];selected:number;onInspect:(index:number)=>void}){
  const id=useId(),left=110,width=980,x=(step:number)=>left+step/96*width;
  const prices=points.map(p=>p.priceUSDPerMWh),minimum=Math.min(0,...prices),maximum=Math.max(1,...prices);
  const priceY=(price:number)=>205-(price-minimum)/(maximum-minimum)*145;
  const energyMax=Math.max(.001,...points.map(p=>Math.abs(p.acEnergyMWh))),small=energyMax<.1;
  const energyY=(value:number)=>360-value/energyMax*46;
  const pricePath=points.map((p,index)=>`${index===0||p.step!==points[index-1].step+1?'M':'L'}${x(p.step)} ${priceY(p.priceUSDPerMWh)}H${x(p.step+1)}`).join(' ');
  return <svg viewBox="0 0 1160 465" className={c.timelineSvg} role="img" aria-labelledby={`${id}-title ${id}-desc`}><title id={`${id}-title`}>{`${name} discrete strategy timeline`}</title><desc id={`${id}-desc`}>Synthetic scenario only. Prices are held constant over each exact fifteen-minute interval, with no smoothing. Cyan marks charge, blue discharge, gray Idle. AC import is negative and export positive. Unsimulated intervals remain blank. Use the interval selector below for exact price, SOC, power, energy and gross value.</desc>
    <text x="16" y="28">PRICE · USD/MWh</text><text x="1090" y="28" textAnchor="end">23 OCT 2026 / ISOLATED DAY</text>
    {[minimum,(minimum+maximum)/2,maximum].map((value,index)=><g key={index}><line x1={left} x2={left+width} y1={priceY(value)} y2={priceY(value)} stroke="#29475e" strokeDasharray="3 5"/><text x="98" y={priceY(value)+4} textAnchor="end">{formatNumber(value)}</text></g>)}
    <path d={pricePath} stroke="#80adf0" strokeWidth="2.3" fill="none"/>
    <text x="16" y="256">DECISION</text>
    {points.map((p,index)=><g key={p.timestamp} onMouseEnter={()=>onInspect(index)}><rect x={x(p.step)+.5} y="241" width={width/96-1} height="24" fill={p.command==='charge'?'#42c3bd':p.command==='discharge'?'#6d9fe8':'#466078'}><title>{`${scenarioClock(p.step)} CT · ${p.command}`}</title></rect></g>)}
    <text x="16" y="299">AC ENERGY · {small?'kWh':'MWh'}</text>
    {[-1,0,1].map(factor=><g key={factor}><line x1={left} x2={left+width} y1={energyY(factor*energyMax)} y2={energyY(factor*energyMax)} stroke={factor===0?'#7b9bb2':'#263e53'} strokeDasharray={factor===0?undefined:'3 5'}/><text x="98" y={energyY(factor*energyMax)+4} textAnchor="end">{formatNumber(factor*energyMax*(small?1000:1))}</text></g>)}
    {points.map((p,index)=><rect key={p.timestamp} x={x(p.step)+1} y={p.acEnergyMWh===0?359:Math.min(360,energyY(p.acEnergyMWh))} width={width/96-2} height={Math.max(2,Math.abs(energyY(p.acEnergyMWh)-360))} fill={p.command==='charge'?'#42c3bd':p.command==='discharge'?'#6d9fe8':'#6b8196'} onMouseEnter={()=>onInspect(index)}><title>{`${scenarioClock(p.step)} CT · ${p.command} · ${formatNumber(p.acEnergyMWh*(small?1000:1))} ${small?'kWh':'MWh'}`}</title></rect>)}
    {points[selected]&&<line x1={x(points[selected].step+.5)} x2={x(points[selected].step+.5)} y1="45" y2="411" stroke="#cfedf5" strokeDasharray="3 4" opacity=".7"/>}
    {[0,24,48,72,96].map(step=><g key={step}><line x1={x(step)} x2={x(step)} y1="413" y2="419" stroke="#7193ab"/><text x={x(step)} y="441" textAnchor="middle">{scenarioClock(step)}</text></g>)}<text x="600" y="462" textAnchor="middle">Exact 15-minute boundaries · Central Time · blank = outside simulated intervals</text>
  </svg>;
});
