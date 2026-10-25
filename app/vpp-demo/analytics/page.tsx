'use client';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { analyticsRange, analyticsRecords, analyticsSnapshot, assetPerformanceRows, filteredAnalyticsHistory, DEFAULT_ANALYTICS_FILTER, DEFAULT_PERFORMANCE_FILTER } from '@/lib/vpp/analytics';
import type { AnalyticsFilter, AnalyticsMode, AssetPerformanceFilter, PerformanceSort } from '@/lib/vpp/analytics';
import { aggregateSettlement } from '@/lib/vpp/settlement';
import { assetTypes } from '@/lib/vpp/domain';
import { formatEnergy, formatNumber, formatPower, formatUSD } from '@/lib/vpp/units';
import { useDemo } from '../_state/DemoProvider';
import { Panel } from '../_components/Panel';
import { financialItems, analyticsTime } from './presentation';
import { TrendChart } from './AnalyticsCharts';
import { ExecutiveOverview, FleetTypeOverview, PerformanceIntelligence } from './AnalyticsIntelligence';
import s from '../demo.module.css';
import a from '../assets.module.css';
import c from './analytics.module.css';

const timeLabel=(step:number)=>step===96?'24:00 (next midnight)':`${String(Math.floor(step/4)).padStart(2,'0')}:${String(step%4*15).padStart(2,'0')}`;
const pageSize=20;
export default function AnalyticsPage(){const {state}=useDemo();return <AnalyticsWorkspace key={state.resetVersion}/>;}
function AnalyticsWorkspace(){
  const {state}=useDemo();
  const [filter,setFilter]=useState<AnalyticsFilter>({...DEFAULT_ANALYTICS_FILTER});
  const [draftMode,setDraftMode]=useState<AnalyticsMode>('all');
  const [assetFilter,setAssetFilter]=useState<AssetPerformanceFilter>({...DEFAULT_PERFORMANCE_FILTER});
  const [page,setPage]=useState(1);
  const [error,setError]=useState('');
  const rangeClock=filter.mode==='last4h'?state.step:0;
  const range=useMemo(()=>analyticsRange(filter,rangeClock),[filter,rangeClock]);
  const history=useMemo(()=>filteredAnalyticsHistory(state.history,range),[state.history,range]);
  const records=useMemo(()=>analyticsRecords(state.assets,history,state.commercialSettings),[state.assets,history,state.commercialSettings]);
  const model=useMemo(()=>analyticsSnapshot(state,range,records),[state,range,records]);
  const rows=useMemo(()=>assetPerformanceRows(model.assets,assetFilter),[model.assets,assetFilter]);
  const subtotal=useMemo(()=>aggregateSettlement(rows.map(row=>row.totals)),[rows]);
  const pages=Math.max(1,Math.ceil(rows.length/pageSize)),current=Math.min(page,pages);
  function apply(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);
    const next:AnalyticsFilter={mode:draftMode,startStep:Number(form.get('start')),endStep:Number(form.get('end'))};
    try{analyticsRange(next,state.step);setFilter(next);setPage(1);setError('');}catch(problem){setError(problem instanceof Error?problem.message:'Invalid time range.');}
  }
  function changeAsset<K extends keyof AssetPerformanceFilter>(key:K,value:AssetPerformanceFilter[K]){setAssetFilter(before=>({...before,[key]:value}));setPage(1);}
  const financial=financialItems(model);
  const op=model.operations;
  return <div className={c.analyticsPage}>
    <div className={c.toolbar}>
      <header className={c.hero}><div><p className={c.overline}>DRIVEGRID / PERFORMANCE INTELLIGENCE</p><h1>Analytics Intelligence</h1><p>Recorded energy. Economic clarity. Operational perspective.</p></div><div className={c.heroContext}><span>SIMULATED ANALYSIS / READ ONLY</span><time>{analyticsTime(model.snapshotAt)}</time><small>{range.label} · {model.history.length} executed intervals</small></div></header>
      <div className={s.notice}>SIMULATED DATA <span>Read-only analytics. No invented dispatch or telemetry history; scenario terminal marks are excluded from revenue.</span></div>
      <form className={a.filters} onSubmit={apply} aria-label="Analytics time filters">
        <label>Time range<select value={draftMode} onChange={e=>setDraftMode(e.target.value as AnalyticsMode)}><option value="all">All recorded intervals</option><option value="day">Simulation day · 23 Oct 2026</option><option value="last4h">Last 4 simulated hours</option><option value="custom">Custom simulation range</option></select></label>
        <label>Custom start (CT)<select name="start" defaultValue="0" disabled={draftMode!=='custom'}>{Array.from({length:96},(_,step)=><option key={step} value={step}>{timeLabel(step)}</option>)}</select></label>
        <label>Custom end exclusive (CT)<select name="end" defaultValue="96" disabled={draftMode!=='custom'}>{Array.from({length:96},(_,index)=>index+1).map(step=><option key={step} value={step}>{timeLabel(step)}</option>)}</select></label>
        <button type="submit">Apply time filter</button>
      </form>
      <p className={c.filterSummary}>Active: <strong>{range.label}</strong> · {model.history.length} executed intervals · {model.assetRecordCount} actual asset records. Start inclusive, end exclusive. Current operational/asset snapshots remain as of {analyticsTime(model.snapshotAt)}.</p>
      <p className={c.error} role="alert">{error}</p>
    </div>
    <div>
      {!model.history.length&&<p className={c.empty}>No recorded dispatch in the selected time range. Financial and energy results are zero; current asset and operational snapshots still apply.</p>}
      <ExecutiveOverview model={model}/>
      <PerformanceIntelligence model={model}/>
      <div className={c.chapter}><div><span className={c.overline}>02 / ECONOMIC INTELLIGENCE</span><h2>Value, attributed to execution.</h2><p>Simulated settlement results in the selected range · scenario terminal valuations excluded</p></div><span className={c.reconciled} data-ok={model.ledger.reconciled}>{model.ledger.reconciled?'RECONCILED':'REVIEW REQUIRED'}</span></div>
      <section className={c.cards} aria-label="Financial analytics">{financial.map(([label,value],index)=><div key={label} data-kind={index>=4&&index<=6?'cost':index===7?'deficit':'value'} data-sign={value<0?'negative':'other'}><small>{label}</small><strong>{formatUSD(value)}</strong><span>{index>=4&&index<=6?'COST':index===7?'UNALLOCATED DEFICIT':value<0?'SIGNED NEGATIVE':'SIMULATED RESULT'}</span></div>)}</section>
      <p className={c.help}>Import cost can be negative (credit); export revenue can be negative (cost). These two raw-energy values reconcile to raw fleet gross {formatUSD(model.ledger.rawFleetGrossUSD)}. Per-asset cent rounding bridges {formatUSD(model.ledger.roundingDifferenceUSD)} to settlement gross. Gross − fees − costs = owner + DriveGrid − deficit; allocation residual {formatUSD(model.ledger.residualCents/100)} · {model.ledger.reconciled?'RECONCILED':'REVIEW REQUIRED'}. Applied commercial settings recalculate recorded settlement exactly as in Phase 5.</p>
      <div className={c.chartGrid}>
        <Panel title="Financial trend" subtitle="Settled gross and signed net per executed interval · USD"><TrendChart id="financial" points={model.trends.map(point=>({timestamp:point.timestamp,step:point.step,values:[point.grossCents/100,point.netCents/100]}))} labels={['Gross energy value','Net distributable value']} unit="USD" currency/></Panel>
        <Panel title="Revenue and cost breakdown" subtitle="Absolute bar lengths · signs retained in labels · deficit is not a second cost deduction"><div className={c.breakdown}>{financial.slice(0,8).map(([label,value],index)=><div key={label} data-kind={index>=4&&index<=6?'cost':index===7?'deficit':'value'} data-sign={value<0?'negative':'other'}><span>{label}</span><strong>{formatUSD(value)}</strong><i style={{width:`${Math.abs(value)/Math.max(1,...financial.slice(0,8).map(([,v])=>Math.abs(v)))*100}%`}}/></div>)}</div><p className={c.help}>Rows overlap in accounting meaning; bars are not additive shares. Allocation comes from positive asset-interval results. No fee, loss or deficit is deducted again.</p></Panel>
      </div>
      <Panel title="Energy & dispatch analytics" subtitle="Filtered execution summaries · positive grid energy = export; positive battery change = stored energy gain">
        <div className={c.energyGrid}>{[
          ['Grid energy imported',formatEnergy(model.energy.importedMWh,'fleet')],['Grid energy exported',formatEnergy(model.energy.exportedMWh,'fleet')],['Net grid energy',formatEnergy(model.energy.netGridMWh,'fleet')],['Battery energy change',formatEnergy(model.energy.batteryEnergyDeltaMWh,'fleet')],['Estimated conversion losses',formatEnergy(model.energy.lossMWh,'fleet')],['Dispatch request count',String(model.history.length)],['Accepted dispatch count',String(model.outcomes.accepted)],['Rejected / curtailed count',`${model.outcomes.rejected} / ${model.outcomes.curtailed}`],['Dispatch acceptance (energy)',model.energy.acceptancePct===null?'N/A':`${formatNumber(model.energy.acceptancePct)}%`],['Charge / discharge / idle',`${model.commands.charge} / ${model.commands.discharge} / ${model.commands.idle}`],['Peak requested / accepted',`${formatPower(model.energy.peakRequestedMW,'fleet')} / ${formatPower(model.energy.peakAcceptedMW,'fleet')}`],['Curtailed / rejected energy',`${formatEnergy(model.energy.curtailedMWh,'fleet')} / ${formatEnergy(model.energy.rejectedMWh,'fleet')}`],
        ].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
        <p className={c.help}>Acceptance = accepted / requested AC energy magnitudes (N/A if no requested energy). Counts use interval outcomes; accepted Idle counts as an accepted interval with zero energy. Grid net + battery change + losses = {formatEnergy(model.energy.netGridMWh+model.energy.batteryEnergyDeltaMWh+model.energy.lossMWh,'fleet')} (display resolution). Physics already includes efficiency losses once.</p>
      </Panel>
      <div className={c.chartGrid}>
        <Panel title="Recorded grid energy flow" subtitle="Import/export magnitudes per executed interval · MWh"><TrendChart id="energy" points={model.history.map(i=>({timestamp:i.timestamp,step:i.step,values:[Math.max(0,-i.acEnergyMWh),Math.max(0,i.acEnergyMWh)]}))} labels={['Grid import','Grid export']} unit="MWh"/></Panel>
        <Panel title="Dispatch request versus acceptance" subtitle="AC power magnitudes per executed interval · MW"><TrendChart id="dispatch" points={model.history.map(i=>({timestamp:i.timestamp,step:i.step,values:[i.requestedPowerMW,i.acceptedPowerMW]}))} labels={['Requested','Accepted']} unit="MW"/></Panel>
      </div>
      <div className={c.chapter}><div><span className={c.overline}>03 / FLEET & ENERGY ATTRIBUTION</span><h2>Every resource. A traceable contribution.</h2><p>Current fleet composition alongside recorded energy · no synthetic asset telemetry</p></div></div>
      <section className={c.section}><Panel title="Asset type performance" subtitle="Actual asset attribution over the same time-filtered records"><FleetTypeOverview types={model.typePerformance} total={model.assets.length}/><div className={c.tableViewport} role="region" tabIndex={0} aria-label="Analytics asset category details"><table className={a.registry}><thead><tr>{['Resource','Assets','Import / export MWh','Gross','Net','Owner / DriveGrid'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{model.typePerformance.map(type=><tr key={type.value}><th scope="row">{type.label}</th><td>{type.count}</td><td>{formatNumber(type.importedMWh)} / {formatNumber(type.exportedMWh)}</td><td>{formatUSD(type.totals.grossCents/100)}</td><td>{formatUSD(type.totals.netCents/100)}</td><td>{formatUSD(type.totals.ownerCents/100)} / {formatUSD(type.totals.platformCents/100)}</td></tr>)}</tbody></table></div></Panel></section>
      <section className={c.section}><Panel title="Asset performance" subtitle="Historical contribution for the selected range; SOC/connectivity/health are CURRENT snapshot fields">
        <div className={a.filters}><label>Find performance asset<input type="search" maxLength={120} value={assetFilter.search} onChange={e=>changeAsset('search',e.target.value)} placeholder="Asset ID"/></label><label>Performance asset type<select value={assetFilter.type} onChange={e=>changeAsset('type',e.target.value)}><option value="all">All types</option>{assetTypes.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label>Sort performance<select value={assetFilter.sort} onChange={e=>changeAsset('sort',e.target.value as PerformanceSort)}>{(['net','gross','owner','exported','imported','dispatches','soc','id'] as const).map(value=><option key={value}>{value}</option>)}</select></label><label>Sort direction<select value={assetFilter.direction} onChange={e=>changeAsset('direction',e.target.value as 'asc'|'desc')}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label></div>
        <p className={c.help}>{rows.length} matching assets · matching subtotal net {formatUSD(subtotal.netCents/100)}, owner {formatUSD(subtotal.ownerCents/100)}. Table filters do not narrow headline totals. Dispatch count is the number of actual asset records, including recorded Idle/rejected rows; assets with no records show zero.</p>
        <div className={c.tableViewport} role="region" tabIndex={0} aria-label="Analytics asset performance"><table className={a.registry}><thead><tr>{['Asset ID / type','Current SOC','Current discharge availability','Current connectivity / health','Import / export MWh','Dispatch count','Gross','Net','Owner','DriveGrid'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.slice((current-1)*pageSize,current*pageSize).map(row=><tr key={row.asset.id}><th scope="row">{row.asset.id}<small>{row.asset.type}</small></th><td>{formatNumber(row.asset.socPct)}%</td><td>{row.monitor.dispatchAvailable?'available':'unavailable'}</td><td>{row.monitor.online?'online':'offline'} / {row.monitor.health}</td><td>{formatNumber(row.importedMWh)} / {formatNumber(row.exportedMWh)}</td><td>{row.dispatchCount}</td>{[row.totals.grossCents,row.totals.netCents,row.totals.ownerCents,row.totals.platformCents].map((value,index)=><td key={index}>{formatUSD(value/100)}</td>)}</tr>)}</tbody></table></div>
        {!rows.length&&<p className={c.help}>No assets match these table filters.</p>}<div className={a.pagination}><span>Page {current} of {pages}</span><div><button disabled={current===1} onClick={()=>setPage(current-1)}>Previous</button><button disabled={current===pages} onClick={()=>setPage(current+1)}>Next</button></div></div>
      </Panel></section>
      <section className={c.section}><Panel title="Current operational snapshot" subtitle={`As of ${analyticsTime(model.snapshotAt)} · not historical uptime or historical availability`}>
        <div className={c.energyGrid}>{[
          ['Online / offline',`${op.online} / ${op.offline}`],['Available / unavailable',`${op.available} / ${op.unavailable}`],['Healthy / warning / fault',`${op.healthy} / ${op.warning} / ${op.fault}`],['Open / acknowledged / resolved',`${op.alertCounts.open} / ${op.alertCounts.acknowledged} / ${op.alertCounts.resolved}`],['Fleet connectivity',`${formatNumber(op.connectivityPct)}%`],['Asset availability',`${formatNumber(op.availabilityPct)}%`],
        ].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
        <p className={c.help}>Snapshot counts ignore the time filter. There is no historical telemetry sample series. {model.alerts.length} alert episodes were created in the selected range; statuses are current snapshots. Event timestamps use the selected half-open range independently of dispatch interval starts.</p>
        <div className={c.tableViewport} role="region" tabIndex={0} aria-label="Analytics operational events"><table className={a.registry}><caption>Latest {Math.min(10,model.events.length)} of {model.events.length} actual event records in range</caption><thead><tr>{['Timestamp (CT)','Type','Source','Description'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{model.events.slice(0,10).map(event=><tr key={event.id}><th scope="row">{analyticsTime(event.timestamp)}</th><td>{event.type}</td><td>{event.source}</td><td className={c.description}>{event.description}</td></tr>)}</tbody></table></div>
      </Panel></section>
    </div>
  </div>;
}
