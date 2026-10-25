'use client';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { assetMonitoring, dispatchLog, eventTimeline, operationsMetrics } from '@/lib/vpp/operations';
import type { AlertSeverity, AlertStatus, EquipmentHealth, EventType, OperationsState } from '@/lib/vpp/operations';
import { operationsSnapshot, simulationLabel } from '@/lib/vpp/simulation';
import type { DispatchInterval } from '@/lib/vpp/simulation';
import { formatEnergy, formatNumber, formatPower } from '@/lib/vpp/units';
import { useDemo } from '../_state/DemoProvider';
import { Panel } from '../_components/Panel';
import { OperationsOverview, OperationsKpiVisual } from './OperationsOverview';
import s from '../demo.module.css';
import a from '../assets.module.css';
import c from './operations.module.css';

type Monitor=ReturnType<typeof assetMonitoring>;
const pageSize=20;
const time=(timestamp:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/Chicago',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(timestamp))+' CT';
function Badge({value}:{value:string}){return <span className={`${c.status} ${['critical','fault','offline','rejected'].includes(value)?c.critical:['warning','acknowledged','curtailed','stale'].includes(value)?c.warning:['healthy','online','accepted','resolved','ready'].includes(value)?c.normal:c.info}`}>{value}</span>;}
function Pager({page,pages,setPage}:{page:number;pages:number;setPage:(page:number)=>void}){return <div className={a.pagination}><span>Page {page} of {pages}</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</button><button disabled={page>=pages} onClick={()=>setPage(page+1)}>Next</button></div></div>;}
function ScrollTable({label,children}:{label:string;children:ReactNode}){return <div className={`${a.registryScroll} ${c.tableViewport}`} role="region" tabIndex={0} aria-label={label}><table className={`${a.registry} ${c.table}`}>{children}</table></div>;}

export default function OperationsPage(){
  const {state}=useDemo();
  return <OperationsWorkspace key={`${state.resetVersion}-${state.operations.generation}`}/>;
}
function OperationsWorkspace(){
  const {state,dispatch}=useDemo();
  const snapshot=useMemo(()=>operationsSnapshot(state),[state]);
  const monitors=useMemo(()=>snapshot.assets.map(asset=>assetMonitoring(asset,state.operations,snapshot)),[snapshot,state.operations]);
  const metrics=useMemo(()=>operationsMetrics(snapshot,state.operations),[snapshot,state.operations]);
  const latest=state.history.at(-1);
  const cards=[
    ['Registered assets',String(metrics.total),'One shared fleet registry'],
    ['Available assets',String(metrics.available),'Sustainable discharge capability > 0'],
    ['Unavailable assets',String(metrics.unavailable),'Complement of discharge-available count'],
    ['Simulated online / offline',`${metrics.online} / ${metrics.offline}`,'Connectivity follows core offline status'],
    ['Available fleet power',formatPower(metrics.availablePowerMW,'fleet'),'Sustainable AC discharge over 15 minutes'],
    ['Weighted fleet SOC',`${formatNumber(metrics.weightedSocPct)}%`,'Battery-capacity weighted · all assets'],
    ['Active alerts',String(metrics.activeAlerts),'Open + acknowledged · unresolved'],
    ['Critical alerts',String(metrics.criticalAlerts),'Unresolved critical conditions'],
  ];
  return <div className={c.operationsPage}>
    <div className={c.hero}><div><p className={s.eyebrow}>DRIVEGRID / SIMULATED FLEET SUPERVISION</p><h1>Operations Command Center</h1><p>Fleet status. Operational context. Traceable decisions.</p></div><div className={c.heroMeta}><span>SIMULATION · {state.running?'CLOCK PLAYBACK':'PAUSED'}</span><strong>{simulationLabel(state.step)}</strong><small>No live grid or SCADA connection</small><button className={c.reset} onClick={()=>dispatch({type:'operations-reset'})}>Operations Reset</button></div></div>
    <div className={s.notice}>SIMULATION MODE <span>Deterministic monitoring only. No devices, markets, emails or external notifications. Operations Reset preserves core assets, clock, dispatch and finances.</span></div>
    <section className={c.cards} aria-label="Fleet operational status">{cards.map(([label,value,note],index)=><div key={label}><div className={c.cardLabel}><small>{label}</small><span aria-hidden="true">{['▦','✓','Ⅱ','⌁','↗','▤','◇','!'][index]}</span></div><strong>{value}</strong><p>{note}</p><OperationsKpiVisual index={index} metrics={metrics}/></div>)}</section>
    <OperationsOverview monitors={monitors} metrics={metrics} latest={latest}/>
    <div className={c.snapshot}><span>Current simulation timestamp: <strong>{simulationLabel(state.step)}</strong></span><span>Latest dispatch: <strong>{latest?`${latest.request.command} · ${latest.status} · ${simulationLabel(latest.step)}`:'No dispatch executed'}</strong></span></div>
    <Panel title="Operational KPIs" subtitle="Asset counts, capacity-weighted SOC and energy-weighted dispatch acceptance are distinct metrics">
      <div className={c.metrics}>{[
        ['Connectivity',`${formatNumber(metrics.connectivityPct)}%`,'Online / registered assets'],
        ['Asset availability',`${formatNumber(metrics.availabilityPct)}%`,'Discharge-available / registered assets'],
        ['Healthy assets',`${formatNumber(metrics.healthyPct)}%`,'Healthy annotations / registered assets'],
        ['Dispatch acceptance',metrics.acceptancePct===null?'N/A':`${formatNumber(metrics.acceptancePct)}%`,'Accepted / requested AC energy · all executions'],
        ['Curtailed / rejected energy',`${formatEnergy(metrics.curtailedMWh,'fleet')} / ${formatEnergy(metrics.rejectedMWh,'fleet')}`,'Unserved demand counted once per interval'],
        ['Recent / total dispatches',`${metrics.recentDispatchCount} / ${metrics.dispatchCount}`,'Recent = preceding 4 intervals (60 simulated minutes)'],
      ].map(([label,value,note],index)=><div key={label}><small>{label}</small><strong>{value}</strong><p>{note}</p>{index<4&&<div className={c.kpiTrack} aria-hidden="true"><span style={{width:`${[metrics.connectivityPct,metrics.availabilityPct,metrics.healthyPct,metrics.acceptancePct??0][index]}%`}}/></div>}</div>)}</div>
      <p className={c.help}>Open alerts: <strong>{metrics.openBySeverity.info} info · {metrics.openBySeverity.warning} warning · {metrics.openBySeverity.critical} critical</strong>. Monitoring-ready assets: {metrics.operationallyReady} (online, no fault, fresh telemetry and some core charge/discharge capability). This readiness label is advisory and does not add a dispatch interlock.</p>
    </Panel>
    <p className={c.message} role="status" aria-live="polite">{state.operations.message}</p>
    <nav className={c.jumps} aria-label="Operations sections"><a href="#health-monitoring">Asset health</a><a href="#alert-center">Alert center</a><a href="#dispatch-monitoring">Dispatch monitoring</a><a href="#operations-events">Event timeline</a></nav>
    <p className={c.help}>Tables support horizontal and vertical scrolling with sticky headers; each page contains at most 20 records.</p>
    <section id="health-monitoring" className={c.section}><AssetHealth monitors={monitors}/></section>
    <section id="alert-center" className={c.section}><AlertCenter operations={state.operations}/></section>
    <section id="dispatch-monitoring" className={c.section}><DispatchMonitoring history={state.history} operations={state.operations}/></section>
    <section id="operations-events" className={c.section}><EventLog operations={state.operations}/></section>
  </div>;
}
function AssetHealth({monitors}:{monitors:Monitor[]}){
  const {dispatch}=useDemo();
  const [search,setSearch]=useState('');
  const [connection,setConnection]=useState('all');
  const [health,setHealth]=useState('all');
  const [selectedId,setSelectedId]=useState(monitors[0]?.asset.id??'');
  const [page,setPage]=useState(1);
  const selected=monitors.find(m=>m.asset.id===selectedId);
  const filtered=monitors.filter(m=>`${m.asset.id} ${m.asset.name} ${m.asset.location}`.toLowerCase().includes(search.toLowerCase())&&(connection==='all'||(m.online?'online':'offline')===connection)&&(health==='all'||m.health===health));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),current=Math.min(page,pages);
  const candidates=filtered.slice(0,100);
  if(selected&&!candidates.some(m=>m.asset.id===selectedId))candidates.unshift(selected);
  return <Panel title="Asset health monitoring" subtitle="Core capabilities, connectivity and simulated equipment health shown separately">
    <div className={a.filters}>
      <label>Find monitoring asset<input type="search" maxLength={120} placeholder="Asset ID, name or city" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label>
      <label>Connectivity<select value={connection} onChange={e=>{setConnection(e.target.value);setPage(1);}}><option value="all">All connectivity</option><option value="online">Online</option><option value="offline">Offline</option></select></label>
      <label>Equipment health<select value={health} onChange={e=>{setHealth(e.target.value);setPage(1);}}><option value="all">All health</option>{(['healthy','warning','fault'] as const).map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Control target<select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{candidates.map(m=><option value={m.asset.id} key={m.asset.id}>{m.asset.id}</option>)}</select></label>
    </div>
    {selected&&<div className={c.controlBox} role="region" aria-label="Monitoring controls">
      <h3>{selected.asset.id} <Badge value={selected.online?'online':'offline'}/> <Badge value={selected.health}/></h3>
      <p>Core status: {selected.asset.status} · availability flag: {selected.asset.availability} · SOC {formatNumber(selected.asset.socPct)}% · monitoring readiness: {selected.operationallyReady?'ready':'attention required'}.</p>
      <div className={c.buttons}><button disabled={!selected.online} onClick={()=>dispatch({type:'operations-connectivity',assetId:selectedId,online:false})}>Simulate offline → core offline</button><button disabled={selected.online} onClick={()=>dispatch({type:'operations-connectivity',assetId:selectedId,online:true})}>Restore online → previous status</button>
        {(['warning','fault','healthy'] as EquipmentHealth[]).map(value=><button key={value} disabled={selected.health===value} onClick={()=>dispatch({type:'operations-health',assetId:selectedId,health:value})}>{value==='healthy'?'Clear simulated warning/fault':`Simulate ${value}`} · monitoring only</button>)}
      </div>
      <p>Offline temporarily overrides core status and blocks dispatch. Restore returns to the previous status while preserving current availability, SOC limits and health annotations. Seeded offline assets with no previous status return to standby. Operations Reset preserves pending restoration. SOC, energy and past settlement are preserved. Health controls only annotate monitoring; warnings/faults and stale telemetry do not themselves block core dispatch.</p>
    </div>}
    <p className={c.help}>{filtered.length} matching assets. Core capability columns use the accepted 15-minute dispatch engine; health/readiness is advisory. Online telemetry is a seeded simulated heartbeat; offline telemetry freezes. Stale means older than 30 simulated minutes.</p>
    <ScrollTable label="Asset health table"><thead><tr>{['Asset / core status','Connectivity','Health','Last telemetry (CT)','SOC','Core charge capability','Core discharge capability','Dispatch availability','Monitoring readiness','Controls'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{filtered.slice((current-1)*pageSize,current*pageSize).map(m=><tr key={m.asset.id}><th scope="row">{m.asset.id}<small>{m.asset.status} · availability flag: {m.asset.availability}</small></th><td><Badge value={m.online?'online':'offline'}/></td><td><Badge value={m.health}/></td><td>{time(m.lastTelemetryAt)}<small>{formatNumber(m.telemetryAgeMinutes)} min ago · {m.stale?'stale':'fresh'}</small></td><td>{formatNumber(m.asset.socPct)}%</td><td>{formatPower(m.chargingPowerMW,m.asset.type)}</td><td>{formatPower(m.dischargingPowerMW,m.asset.type)}</td><td>{m.dispatchAvailable?'Discharge available':'Discharge unavailable'}</td><td>{m.operationallyReady?'ready':'attention required'}</td><td><button onClick={()=>setSelectedId(m.asset.id)} aria-label={`Inspect monitoring ${m.asset.id}`}>Inspect</button></td></tr>)}</tbody></ScrollTable>
    {!filtered.length&&<p className={c.help}>No assets match these filters.</p>}<Pager page={current} pages={pages} setPage={setPage}/>
  </Panel>;
}
function AlertCenter({operations}:{operations:OperationsState}){
  const {dispatch}=useDemo();
  const [severity,setSeverity]=useState<AlertSeverity|'all'>('all');
  const [status,setStatus]=useState<AlertStatus|'active'|'all'>('active');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const filtered=operations.alerts.filter(alert=>(severity==='all'||alert.severity===severity)&&(status==='all'||(status==='active'?alert.status!=='resolved':alert.status===status))&&`${alert.source} ${alert.description} ${alert.id}`.toLowerCase().includes(search.toLowerCase())).toSorted((left,right)=>right.createdAt.localeCompare(left.createdAt)||left.id.localeCompare(right.id));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),current=Math.min(page,pages);
  return <Panel title="Alert center" subtitle="Acknowledge means reviewed, not repaired. Persistent conditions resolve only when their cause clears.">
    <div className={a.filters}><label>Alert severity<select value={severity} onChange={e=>{setSeverity(e.target.value as AlertSeverity|'all');setPage(1);}}><option value="all">All severities</option>{(['info','warning','critical'] as const).map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Alert status<select value={status} onChange={e=>{setStatus(e.target.value as AlertStatus|'active'|'all');setPage(1);}}><option value="active">Active (open + acknowledged)</option><option value="all">All statuses</option>{(['open','acknowledged','resolved'] as const).map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Find alert<input type="search" maxLength={120} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Asset, subsystem or condition"/></label></div>
    <p className={c.help}>{filtered.length} matching alert episodes. A persistent condition has one episode; recurrence after recovery creates a new episode. Historical rejected/curtailed dispatch alerts can be manually resolved after review; the execution remains in history.</p>
    <ScrollTable label="Operations alerts"><thead><tr>{['Severity / status','Source / deterministic ID','Description','Created / updated (CT)','Underlying condition','Actions'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{filtered.slice((current-1)*pageSize,current*pageSize).map(alert=><tr key={alert.id}><td><Badge value={alert.severity}/><small><Badge value={alert.status}/></small></td><th scope="row">{alert.source}<small className={c.identifier}>{alert.id}</small></th><td className={c.description}>{alert.description}{alert.resolution&&<small>{alert.resolution}</small>}</td><td>{time(alert.createdAt)}<small>{time(alert.updatedAt)}</small></td><td>{alert.active?'Still active':alert.kind==='dispatch'?'Historical outcome':'Cleared'}</td><td><div className={c.buttons}><button disabled={alert.status!=='open'} onClick={()=>dispatch({type:'operations-acknowledge',alertId:alert.id})} aria-label={`Acknowledge ${alert.id}`}>Acknowledge</button><button disabled={alert.status==='resolved'||alert.active} onClick={()=>dispatch({type:'operations-resolve',alertId:alert.id})} aria-label={`Resolve ${alert.id}`} title={alert.active?'Clear the underlying condition first':'Close a reviewed historical alert'}>Resolve</button></div></td></tr>)}</tbody></ScrollTable>
    {!filtered.length&&<p className={c.help}>No alerts match these filters.</p>}<Pager page={current} pages={pages} setPage={setPage}/>
  </Panel>;
}
function DispatchMonitoring({history,operations}:{history:readonly DispatchInterval[];operations:OperationsState}){
  const [selectedStep,setSelectedStep]=useState<number|null>(null);
  const [page,setPage]=useState(1);
  const [recordPage,setRecordPage]=useState(1);
  const log=dispatchLog(history);
  const selected=history.find(i=>i.step===selectedStep)??history.at(-1);
  const pages=Math.max(1,Math.ceil(log.length/pageSize)),current=Math.min(page,pages);
  const detailPages=Math.max(1,Math.ceil((selected?.records.length??0)/pageSize)),detailCurrent=Math.min(recordPage,detailPages);
  return <Panel title="Dispatch execution monitoring" subtitle="Derived directly from shared dispatch history · latest interval first · power magnitudes show request versus acceptance">
    {!log.length?<p className={c.emptyState}>No executed dispatch. Use Dispatch or Market; previews and clock playback create no execution.</p>:<><ScrollTable label="Operations dispatch history"><thead><tr>{['Interval start (CT)','Asset / scope','Command / source','Requested','Accepted','Rejected / curtailed','Outcome','Related alert','Details'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{log.slice((current-1)*pageSize,current*pageSize).map(row=>{const interval=row.interval;const alert=operations.alerts.find(a=>a.key===row.alertKey);const units=interval.request.assetId?'record':'fleet';return <tr key={row.key}><th scope="row">{simulationLabel(interval.step)}</th><td>{row.assetId}</td><td>{interval.request.command}<small>{interval.source}</small></td><td>{formatPower(interval.requestedPowerMW,units)}</td><td>{formatPower(interval.acceptedPowerMW,units)}</td><td>{formatPower(interval.rejectedPowerMW,units)} / {formatPower(interval.curtailedPowerMW,units)}</td><td><Badge value={interval.status}/></td><td className={c.identifier}>{alert?`${alert.id} · ${alert.status}`:'None'}</td><td><button onClick={()=>{setSelectedStep(interval.step);setRecordPage(1);}}>Inspect interval {interval.step}</button></td></tr>;})}</tbody></ScrollTable><Pager page={current} pages={pages} setPage={setPage}/></>}
    {selected&&<><h3 className={c.subheading}>Asset records · {simulationLabel(selected.step)}</h3><p className={c.help}>Fleet unallocated demand is counted once in the interval summary, not duplicated across excluded assets. These are the original per-asset records, including zero-energy Idle records.</p><ScrollTable label="Operations dispatch asset records"><thead><tr>{['Asset ID','Command','Requested','Accepted','Rejected / curtailed','Outcome / reason'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{selected.records.slice((detailCurrent-1)*pageSize,detailCurrent*pageSize).map(record=><tr key={record.assetId}><th scope="row">{record.assetId}</th><td>{selected.request.command}</td><td>{formatPower(record.requestedPowerMW,'record')}</td><td>{formatPower(record.acceptedPowerMW,'record')}</td><td>{formatPower(record.rejectedPowerMW,'record')} / {formatPower(record.curtailedPowerMW,'record')}</td><td><Badge value={record.status}/><small>{record.reasons.join('; ')||'Within limits'}</small></td></tr>)}</tbody></ScrollTable><Pager page={detailCurrent} pages={detailPages} setPage={setRecordPage}/></>}
  </Panel>;
}
function EventLog({operations}:{operations:OperationsState}){
  const [type,setType]=useState<EventType|'all'>('all');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const events=eventTimeline(operations.events,type,search);
  const pages=Math.max(1,Math.ceil(events.length/pageSize)),current=Math.min(page,pages);
  return <Panel title="Operational event timeline" subtitle="Simulation timestamps with stable sequence ordering · hourly clock checkpoints, not repetitive per-tick logs">
    <div className={a.filters}><label>Event type<select value={type} onChange={e=>{setType(e.target.value as EventType|'all');setPage(1);}}><option value="all">All event types</option>{(['asset-change','connectivity','health','dispatch','alert-created','alert-acknowledged','alert-resolved','clock','reset'] as const).map(value=><option key={value}>{value}</option>)}</select></label><label>Find event<input type="search" maxLength={120} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Asset or description"/></label></div>
    <p className={c.help}>{events.length} matching events. Operations Reset starts a new monitoring timeline and restores alert fixtures without deleting shared dispatch history.</p>
    {!events.length&&<div className={c.emptyState}><strong>No events match these filters.</strong><p>Change the existing type or search filters to inspect the recorded timeline.</p></div>}<div className={c.eventTimeline}><ScrollTable label="Operations event timeline"><thead><tr>{['Time (CT) / sequence','Event type','Source','Description','Related alert'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{events.slice((current-1)*pageSize,current*pageSize).map(event=><tr key={event.id}><th scope="row">{time(event.timestamp)}<small>{event.id}</small></th><td><span className={c.eventType} data-event-type={event.type}>{event.type}</span></td><td>{event.source}</td><td className={c.description}>{event.description}</td><td className={c.identifier}>{event.alertId??'—'}</td></tr>)}</tbody></ScrollTable></div><Pager page={current} pages={pages} setPage={setPage}/>
  </Panel>;
}
