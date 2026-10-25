import { memo, useMemo } from 'react';
import { assetTypes } from '@/lib/vpp/domain';
import type { assetMonitoring, operationsMetrics } from '@/lib/vpp/operations';
import type { DispatchInterval } from '@/lib/vpp/simulation';
import { simulationLabel } from '@/lib/vpp/simulation';
import { formatEnergy, formatNumber, formatPower } from '@/lib/vpp/units';
import { OperationsTopologySvg } from './OperationsTopologySvg';
import type { OperationsResourceView } from './OperationsTopologySvg';
import c from './operations.module.css';

type Metrics=ReturnType<typeof operationsMetrics>;
type Monitor=ReturnType<typeof assetMonitoring>;

/** Group existing authoritative monitoring flags; no new readiness or alarm rules. */
export const OperationsOverview=memo(function OperationsOverview({ monitors, metrics, latest }: { monitors: readonly Monitor[]; metrics: Metrics; latest?: DispatchInterval }) {
  const resources=useMemo<OperationsResourceView[]>(()=>assetTypes.map((type,index)=>{
    const group=monitors.filter(monitor=>monitor.asset.type===type.value);
    return {id:type.value,label:type.label,kind:(['ev','home','bess'] as const)[index],count:group.length,available:group.filter(monitor=>monitor.dispatchAvailable).length,online:group.filter(monitor=>monitor.online).length,offline:group.filter(monitor=>!monitor.online).length};
  }),[monitors]);
  return <section className={c.overview} aria-label="Operational topology and status distribution">
    <header><div><span className={c.eyebrow}>01 / FLEET SUPERVISION</span><h2>Operational state, in context.</h2></div><span className={c.schematicLabel}>STATIC SCHEMATIC · SYNTHETIC DATA</span></header>
    <OperationsTopologySvg resources={resources}/>
    <div className={c.resourceSummaries}>{resources.map(resource=><article key={resource.id}><div><span>{resource.label}</span><strong>{formatNumber(resource.available)} <small>/ {formatNumber(resource.count)}</small></strong><p>Currently discharge-available</p></div><div className={c.connectionCounts}><span>{formatNumber(resource.online)} online</span><small>{formatNumber(resource.offline)} offline</small></div></article>)}</div>
    <div className={c.overviewBottom}><div className={c.distribution}><span className={c.eyebrow}>DISPATCH AVAILABILITY</span><h3>Existing fleet capability</h3><div className={c.distributionBar} aria-hidden="true"><span style={{flex:metrics.available}}/><span style={{flex:metrics.unavailable}}/></div><p><span>{formatNumber(metrics.available)} available</span><span>{formatNumber(metrics.unavailable)} unavailable</span></p><small>Capability follows the accepted dispatch engine, independently of advisory health labels.</small></div><div className={c.recordedActivity}><span className={c.eyebrow}>LATEST RECORDED DISPATCH</span><h3>{latest ? `${latest.request.command.toUpperCase()} · ${latest.status}` : 'No dispatch executed'}</h3>{latest ? <><strong>{formatPower(latest.acceptedPowerMW,latest.request.assetId ? 'record' : 'fleet')}</strong><p>{latest.acPowerMW<0?'Grid → storage':latest.acPowerMW>0?'Storage → grid':'No accepted transfer'} · {formatEnergy(latest.acEnergyMWh,latest.request.assetId ? 'record' : 'fleet')} signed AC energy</p><small>{simulationLabel(latest.step)} · historical record, not live activity</small></> : <p>Previews and clock playback create no execution. No energy flow is implied.</p>}</div></div>
  </section>;
});

export function OperationsKpiVisual({ index, metrics }: { index: number; metrics: Metrics }) {
  if(index===4)return <span className={c.capacityTag}>AC CAPABILITY / 15 MIN</span>;
  if(index===6)return <span className={c.alertKey}>Open only · {metrics.openBySeverity.info} info / {metrics.openBySeverity.warning} warning / {metrics.openBySeverity.critical} critical</span>;
  if(index===7)return <span className={c.criticalTag}>UNRESOLVED CRITICAL</span>;
  const value=index===3?metrics.connectivityPct:index===5?metrics.weightedSocPct:metrics.availabilityPct;
  return <div className={`${c.kpiTrack} ${index===5?c.socTrack:''}`} aria-hidden="true">{index===0||index===2?<><span style={{flex:metrics.available}}/><span className={c.unavailableFill} style={{flex:metrics.unavailable}}/></>:<span style={{width:`${value}%`}}/>}</div>;
}
