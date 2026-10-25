import { memo, useId } from 'react';
import { formatEnergy, formatNumber } from '@/lib/vpp/units';
import { analyticsTime, energyPlotGeometry } from './presentation';
import type { RecordedEnergyPoint } from './presentation';
import c from './analytics.module.css';

export const EnergyPerformanceSvg=memo(function EnergyPerformanceSvg({points,selected,onInspect}:{
  points:readonly RecordedEnergyPoint[];selected:number;onInspect:(index:number)=>void;
}){
  const id=useId();
  const plot=energyPlotGeometry(points);
  const smallScale=plot.maximum<.1;
  const ticks=[...new Set([0,Math.floor(points.length/2),points.length-1])].filter(i=>i>=0);
  return <svg viewBox="0 0 1080 410" className={c.performanceSvg} role="group" aria-labelledby={`${id}-title ${id}-desc`}>
    <title id={`${id}-title`}>Recorded signed AC energy performance</title>
    <desc id={`${id}-desc`}>Charge imports are negative, discharge exports positive, Idle or rejected zero transfers remain at zero. Bars span recorded fifteen-minute intervals on a true time axis; gaps have no fabricated values. Focus a bar or use the interval selector for exact values.</desc>
    <defs><linearGradient id={`${id}-blue`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#83baff"/><stop offset="1" stopColor="#346cc0"/></linearGradient><linearGradient id={`${id}-cyan`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#22898e"/><stop offset="1" stopColor="#67e3dc"/></linearGradient></defs>
    <text x="18" y="28">Signed AC energy · {smallScale?'kWh':'MWh'}</text><text x="1000" y="28" textAnchor="end">EXECUTED RECORDS ONLY</text>
    {[-1,-.5,0,.5,1].map(factor=>{const value=factor*plot.maximum;return <g key={factor}><line x1="130" x2="1000" y1={plot.y(value)} y2={plot.y(value)} stroke={factor===0?'#829aaf':'#263d53'} strokeDasharray={factor===0?undefined:'3 6'}/><text x="116" y={plot.y(value)+4} textAnchor="end">{formatNumber(smallScale?value*1000:value)}</text></g>;})}
    {points.map((p,index)=>{const x=plot.x(p.timestamp),y=plot.y(p.acEnergyMWh),zero=plot.y(0),active=index===selected;
      const label=`${analyticsTime(p.timestamp)} · ${p.command} · ${p.status} · signed AC ${formatEnergy(p.acEnergyMWh,'record')}`;
      return <g key={p.timestamp}>
        {active&&<rect x={x-plot.barWidth/2-7} y="57" width={plot.barWidth+14} height="287" rx="5" fill="#8ec9ed" opacity=".07"/>}
        <rect className={c.energyBar} x={x-plot.barWidth/2} y={p.acEnergyMWh===0?zero-3:Math.min(y,zero)} width={plot.barWidth} height={p.acEnergyMWh===0?6:Math.abs(y-zero)} rx="3"
          fill={p.command==='idle'?'#9baec4':`url(#${id}-${p.command==='charge'?'cyan':'blue'})`} stroke={active?'#dcfaff':'transparent'}
          tabIndex={0} role="button" aria-label={label} aria-pressed={active} onMouseEnter={()=>onInspect(index)} onFocus={()=>onInspect(index)} onClick={()=>onInspect(index)}
          onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Enter',' '].includes(e.key)){e.preventDefault();onInspect(e.key==='ArrowLeft'?Math.max(0,selected-1):e.key==='ArrowRight'?Math.min(points.length-1,selected+1):index);}}}><title>{label}</title></rect>
      </g>;
    })}
    {ticks.map(index=><g key={index}><line x1={plot.x(points[index].timestamp)} x2={plot.x(points[index].timestamp)} y1="344" y2="350" stroke="#7490a7"/><text x={plot.x(points[index].timestamp)} y="373" textAnchor="middle">{analyticsTime(points[index].timestamp).split(', ')[1]}</text></g>)}
    <text x="565" y="401" textAnchor="middle">23 Oct 2026 · recorded interval start · Central Time</text>
  </svg>;
});
