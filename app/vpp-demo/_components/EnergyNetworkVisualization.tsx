'use client';
import { memo,useId,useMemo,useState,useSyncExternalStore } from 'react';
import Link from 'next/link';
import { assetTypes } from '@/lib/vpp/domain';
import type { DERAsset } from '@/lib/vpp/domain';
import { dispatchLimit } from '@/lib/vpp/dispatch';
import type { DispatchInterval } from '@/lib/vpp/simulation';
import { simulationLabel } from '@/lib/vpp/simulation';
import { formatPower,formatEnergy,formatNumber } from '@/lib/vpp/units';
import { Equipment,EquipmentGraphic } from './NetworkEquipment';
import n from './EnergyNetworkVisualization.module.css';

const power=(mw:number)=>formatPower(Math.abs(mw),Math.abs(mw)>0&&Math.abs(mw)<1-1e-9?'record':'fleet');
const energy=(mwh:number)=>formatEnergy(mwh,Math.abs(mwh)>0&&Math.abs(mwh)<.01?'record':'fleet');
const subscribe=(notify:()=>void)=>{document.addEventListener('visibilitychange',notify);return()=>document.removeEventListener('visibilitychange',notify);};
const isVisible=()=>document.visibilityState!=='hidden';
export type ResourceView={id:string;label:string;kind:'ev'|'home'|'bess';count:number;available:number;offline:number;power:number;motion:boolean};
/** Read-only presentation adapter. A future scene can consume the same view model. */
export function EnergyNetworkVisualization({assets,latest}:{assets:readonly DERAsset[];latest?:DispatchInterval}){
 const resources=useMemo<ResourceView[]>(()=>{
   const byId=new Map(assets.map(asset=>[asset.id,asset]));
   return assetTypes.map((type,index)=>{
     const fleet=assets.filter(asset=>asset.type===type.value);
     const records=latest?.records.filter(record=>byId.get(record.assetId)?.type===type.value)??[];
     return {id:type.value,label:type.label,kind:(['ev','home','bess'] as const)[index],count:fleet.length,
       available:fleet.filter(asset=>dispatchLimit(asset,'discharge').powerMW>0).length,
       offline:fleet.filter(asset=>asset.status==='offline').length,
       power:records.reduce((sum,record)=>sum+record.acPowerMW,0),
       motion:records.some(record=>record.acPowerMW!==0&&dispatchLimit(byId.get(record.assetId)!,latest!.request.command).powerMW>0)};
   });
 },[assets,latest]);
 const [replay,setReplay]=useState(0);
 const visible=useSyncExternalStore(subscribe,isVisible,()=>true);
 const mode=!latest?'standby':latest.acceptedPowerMW===0?'idle':latest.request.command;
 return <section className={n.network} aria-label="Energy network command view" data-mode={mode} data-visible={visible}>
   <div className={n.heading}><div><span className={n.eyebrow}>DISTRIBUTED ENERGY NETWORK</span><h2>Energy, orchestrated.</h2></div><div className={n.modeActions}><button className={n.replay} disabled={!resources.some(resource=>resource.power!==0&&resource.motion)} onClick={()=>setReplay(value=>value+1)}>Replay recorded flow ↻</button><span className={n.mode}>{mode==='standby'?'AWAITING EXECUTION':mode==='idle'?'NO ACCEPTED TRANSFER':mode==='charge'?'CHARGE · RECORDED':'DISCHARGE · RECORDED'}</span></div></div>
   <div className={n.scene}>
     <NetworkScene2D resources={resources} recordKey={`${latest?.timestamp??'empty'}-${replay}`}/>
     <div className={n.gridLabel}><span>GRID / SUBSTATION</span><strong>{latest?power(latest.acPowerMW):'—'}</strong><small>{latest?'Recorded accepted AC magnitude':'No dispatch executed'}</small></div>
     {resources.map((resource,index)=><div key={resource.id} className={`${n.sceneLabel} ${[n.evLabel,n.homeLabel,n.bessLabel][index]}`}><span>{resource.count.toLocaleString('en-US')} REGISTERED ASSETS</span><h3>{resource.label}</h3><strong>{latest?power(resource.power):'—'}</strong><small>{!latest?'No recorded transfer':resource.power===0?'No accepted transfer':resource.power<0?'Grid → storage':'Storage → grid'}</small></div>)}
     <div className={n.sceneKey}><span/>ILLUSTRATED TOPOLOGY · NOT A GEOGRAPHIC NETWORK</div>
   </div>
   <div className={n.mobileScene}>
     <div className={n.mobileGrid}><EquipmentGraphic kind="grid"/><div><span className={n.eyebrow}>GRID / SUBSTATION</span><strong>{latest?power(latest.acPowerMW):'—'}</strong><p>Recorded accepted AC magnitude</p></div></div>
     {resources.map(resource=><div className={n.mobileResource} key={resource.id}><EquipmentGraphic kind={resource.kind}/><div><h3>{resource.label}</h3><strong>{latest?power(resource.power):'—'}</strong><p>{!latest?'No execution':resource.power===0?'No accepted transfer':resource.power<0?'Grid → storage':'Storage → grid'}</p></div><span className={n.mobileDirection} aria-hidden="true">{resource.power===0?'—':resource.power<0?'↓':'↑'}</span></div>)}
   </div>
   <div className={n.resourceStatus}>{resources.map(resource=><div key={resource.id}><span>{resource.label}</span><strong>{resource.available.toLocaleString('en-US')} / {resource.count.toLocaleString('en-US')}</strong><small>currently discharge-available · {resource.offline} offline</small></div>)}</div>
   <div className={n.interval} role="status"><div><strong>{latest?`RECORDED INTERVAL · ${simulationLabel(latest.step)} – ${simulationLabel(latest.step+1)}`:'NO RECORDED INTERVAL · READY TO EXPLORE'}</strong><p>{latest?`${latest.request.command.toUpperCase()} / ${latest.status.toUpperCase()} · ${energy(latest.acEnergyMWh)} signed AC energy. Pulses briefly replay this record; no live telemetry or continuous transfer is implied.`:'Execute a dispatch to reveal recorded directions. Clock playback alone does not transfer energy.'}</p></div><Link href="/vpp-demo/dispatch">Dispatch console ↗</Link></div>
   <details className={n.textDetails}><summary>Network interpretation & accessible data</summary><p>The equipment is a schematic illustration of the registered portfolio, not real devices. {resources.map(resource=>`${resource.label}: ${resource.count} assets; ${resource.available} currently discharge-available; ${resource.offline} offline; latest interval ${latest?power(resource.power):'not executed'}, ${resource.power<0?'grid to storage':resource.power>0?'storage to grid':'no accepted transfer'}.`).join(' ')} Current availability follows the existing dispatch capability calculation; health annotations remain advisory. Static arrows retain historical direction; replay pulses stop for Idle/zero transfer, reduced motion, hidden pages or when original contributing assets no longer support that command. Counts are current; transfers are historical. Network scale is illustrative. Registered rated capacity: {formatNumber(assets.reduce((sum,asset)=>sum+asset.ratedPowerMW,0))} MW.</p></details>
 </section>;
}
/** Rendering extension point: keep this SVG scene as the lightweight 2D fallback. */
export const NetworkScene2D=memo(function NetworkScene2D({resources,recordKey}:{resources:readonly ResourceView[];recordKey:string}){
 const id=useId();
 const paths=['M440 350 345 300Q320 280 295 280L208 245','M572 340 641 296Q655 280 680 280L780 225','M575 400 641 430Q655 445 680 445L775 475'];
 return <svg viewBox="0 0 1000 650" className={n.canvas} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
   <title id={`${id}-title`}>Illustrated VPP electrical network</title><desc id={`${id}-desc`}>A central substation connects to EV charging stations, solar homes with residential batteries and commercial storage containers. Direction and accepted power are provided in the adjacent resource labels and accessible data summary.</desc>
   <defs><pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#427793" strokeWidth=".5"/></pattern><radialGradient id={`${id}-aura`}><stop stopColor="#197d98" stopOpacity=".25"/><stop offset="1" stopColor="#0a1829" stopOpacity="0"/></radialGradient></defs>
   <rect width="1000" height="650" fill={`url(#${id}-grid)`} opacity=".22"/>
   <ellipse cx="500" cy="330" rx="420" ry="290" fill={`url(#${id}-aura)`}/>
   <g fill="none" stroke="#2c627c" opacity=".5"><ellipse cx="510" cy="395" rx="185" ry="92"/><ellipse cx="510" cy="395" rx="212" ry="106" strokeDasharray="2 9"/><path d="M510 220v20m0 310v20M280 395h20m420 0h20"/></g>
   <g>{resources.map((resource,index)=>{
     const active=resource.power!==0;
     return <g key={`${resource.id}-${recordKey}`}><path d={paths[index]} fill="none" stroke="#17384f" strokeWidth="13"/><path d={paths[index]} fill="none" className={active?n.activeLine:undefined} stroke={active?'#57cdd7':'#41617b'} strokeWidth={active?2.5:1.5}/>{active&&<><path className={n.activeLine} d={paths[index]} fill="none" stroke="#9bf4e8" strokeWidth="2" opacity=".4"/>{resource.motion&&<path data-flow-direction={resource.power<0?'charge':'discharge'} className={`${n.pulse} ${resource.power>0?n.reverse:''}`} d={paths[index]} pathLength="100" fill="none" stroke="#d3fff8" strokeWidth="4" strokeDasharray="3 97"/>}<path d="m-7-5 8 5-8 5" transform={`translate(${[350,658,658][index]} ${[303,280,438][index]}) rotate(${resource.power<0?[210,-35,25][index]:[30,145,205][index]})`} className={n.directionMark} fill="none" stroke="#a2f0ed" strokeWidth="2.5"/></>}</g>;
   })}</g>
   {resources.some(resource=>resource.power!==0&&resource.motion)&&<ellipse key={recordKey} className={n.replayHalo} cx="510" cy="396" rx="178" ry="88" fill="none" strokeWidth="2"/>}
   <g className={n.gridEquipment} transform="translate(340 205) scale(1.15)"><Equipment kind="grid"/></g>
   <g transform="translate(18 50) scale(.88)"><Equipment kind="ev"/></g>
   <g transform="translate(704 15) scale(.9)"><Equipment kind="home"/></g>
   <g transform="translate(687 385) scale(.92)"><Equipment kind="bess"/></g>
   <g fill="#80a9be" fontSize="9" fontFamily="monospace" letterSpacing="2"><text x="25" y="25">DRIVEGRID / NETWORK SCHEMATIC</text></g>
 </svg>;
});
