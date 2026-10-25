import { memo, useId } from 'react';
import type { PriceIntervalView } from './market-presentation';
import m from './market.module.css';

export interface PricePlotView {
  readonly intervals: readonly PriceIntervalView[];
  readonly activeStep: number;
  readonly inspectedStep: number;
  readonly chargeThreshold: number;
  readonly dischargeThreshold: number;
}

/** Lightweight 2D financial renderer: presentation geometry only, no market decisions. */
export const MarketPricePlot = memo(function MarketPricePlot({ view, onInspect }: { view: PricePlotView; onInspect: (step: number) => void }) {
  const id = useId();
  const x = (step: number) => 78 + step / 96 * 1044;
  const y = (price: number) => 330 - (price + 300) / 3000 * 270;
  const color = (command: PriceIntervalView['command']) => command === 'charge' ? '#72dcc3' : command === 'discharge' ? '#79b7ff' : '#637e94';
  const path = view.intervals.map((point,index) => `${index === 0 ? 'M' : 'V'}${index === 0 ? `${x(point.step)} ` : ''}${y(point.priceUSDPerMWh)}H${x(point.step+1)}`).join('');
  return <svg className={m.chart} viewBox="0 0 1180 465" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
    <title id={`${id}-title`}>Synthetic 24-hour ERCOT-inspired price scenario</title><desc id={`${id}-desc`}>All 96 discrete fifteen-minute prices on a linear scale from minus 300 to 2700 USD per MWh, including the full negative valley and scarcity spike. Step segments hold the exact price for each interval. Teal marks charge signals, blue discharge and gray Idle. The current interval is cyan. Inspect exact values with the interval control or price table.</desc>
    <defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#5f9be0" stopOpacity=".2"/><stop offset="1" stopColor="#5f9be0" stopOpacity=".01"/></linearGradient></defs>
    <rect x="78" y={y(0)} width="1044" height={330-y(0)} fill="#42bea0" opacity=".055"/>
    {[-200,0,500,1000,1500,2000,2500].map(price=><g key={price}><line x1="78" x2="1122" y1={y(price)} y2={y(price)} stroke={price === 0 ? '#607f94' : '#2a435a'} strokeDasharray={price === 0 ? undefined : '2 6'}/><text x="64" y={y(price)+4} textAnchor="end">{price.toLocaleString('en-US')}</text></g>)}
    <text x="20" y="30">USD/MWh · linear scale</text>
    {[0,16,32,48,64,80,96].map(step=><g key={step}><line x1={x(step)} x2={x(step)} y1="60" y2="330" stroke="#2a435a" strokeDasharray="2 6"/><text x={x(step)} y="357" textAnchor="middle">{`${String(step/4).padStart(2,'0')}:00`}</text></g>)}
    <path d={`${path}V330H78Z`} fill={`url(#${id}-area)`}/>
    {[{value:view.chargeThreshold,label:'CHARGE',color:'#72dcc3'},{value:view.dischargeThreshold,label:'DISCHARGE',color:'#79b7ff'}].map(threshold=>threshold.value>=-300&&threshold.value<=2700?<g key={threshold.label}><line x1="78" x2="1122" y1={y(threshold.value)} y2={y(threshold.value)} stroke={threshold.color} opacity=".65" strokeDasharray="7 5"/></g>:null)}
    {view.activeStep>=0&&view.activeStep<96&&<g key={view.activeStep} className={m.currentBand}><rect x={x(view.activeStep)} y="60" width={1044/96} height="270" fill="#79e5e0" opacity=".18"/><line x1={x(view.activeStep)} x2={x(view.activeStep)} y1="50" y2="330" stroke="#92eee6" strokeWidth="1.5"/></g>}
    <path d={path} fill="none" stroke="#8bc4ff" strokeWidth="2.5" strokeLinejoin="miter"/>
    {view.intervals.map(point=><g key={point.step}><rect x={x(point.step)} y="60" width={1044/96} height="270" fill="transparent" onMouseEnter={()=>onInspect(point.step)}/><rect x={x(point.step)+.7} y="389" width={1044/96-1.4} height="19" rx="2" fill={color(point.command)} opacity={point.step===view.activeStep?1:.65} onMouseEnter={()=>onInspect(point.step)}/>{point.step>0&&point.command!==view.intervals[point.step-1].command&&<path d={`M${x(point.step)-3} 381h6l-3 5Z`} fill="#c3dce9"><title>Applied price-rule signal changes at this interval boundary</title></path>}</g>)}
    {view.intervals[view.inspectedStep]&&<g pointerEvents="none"><line x1={x(view.inspectedStep+.5)} x2={x(view.inspectedStep+.5)} y1="60" y2="409" stroke="#c1e3f4" strokeDasharray="3 5" opacity=".55"/><circle cx={x(view.inspectedStep+.5)} cy={y(view.intervals[view.inspectedStep].priceUSDPerMWh)} r="4" fill="#d3f8f6" stroke="#10344b" strokeWidth="2"/></g>}
    <text x="78" y="438">OPPORTUNITY STRIP · APPLIED PRICE RULE ONLY · NOT PHYSICAL ACCEPTANCE</text><text x="1122" y="460" textAnchor="end">23 Oct 2026 · Central Time · cyan band = current interval</text>
  </svg>;
});
