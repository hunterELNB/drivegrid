'use client';
import { PrecisionInput } from '../_components/PrecisionInput';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { dispatchLimit } from '@/lib/vpp/dispatch';
import type { DispatchCommand } from '@/lib/vpp/dispatch';
import { formatEnergy, formatNumber, formatPower, formatUSD, kwToMw } from '@/lib/vpp/units';
import { simulationLabel, TOTAL_INTERVALS } from '@/lib/vpp/simulation';
import { useDemo } from '../_state/DemoProvider';
import { Panel } from '../_components/Panel';
import { portfolioMetrics } from '@/lib/vpp/domain';
import { DispatchScene } from './DispatchScene';
import s from '../demo.module.css';
import a from '../assets.module.css';
import d from './dispatch.module.css';

export default function DispatchPage() {
  const { state, dispatch } = useDemo();
  const [scope, setScope] = useState('fleet');
  const [query, setQuery] = useState('');
  const [assetId, setAssetId] = useState(state.assets[0].id);
  const [command, setCommand] = useState<DispatchCommand>('discharge');
  const [viewStep, setViewStep] = useState<number | null>(null);
  const [recordPage, setRecordPage] = useState(1);
  const asset = state.assets.find(item => item.id === assetId)!;
  const matches = state.assets.filter(item => `${item.id} ${item.name} ${item.location}`.toLowerCase().includes(query.toLowerCase())).slice(0, 100);
  const latest = state.history.at(-1);
  const viewed = state.history.find(item => item.step === viewStep) ?? latest;
  const pageCount = Math.max(1, Math.ceil((viewed?.records.length ?? 0) / 20));
  const currentPage = Math.min(recordPage,pageCount);
  const resultContext = viewed?.request.assetId === null ? 'fleet' : 'record';
  const capacity = (scope === 'fleet' ? state.assets : [asset]).reduce((sum,item) => sum + dispatchLimit(item,command).powerMW,0);
  const blocked = state.running || state.step >= TOTAL_INTERVALS;

  function execute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = Number(new FormData(event.currentTarget).get('power'));
    dispatch({ type: 'execute-dispatch', step: state.step, resetVersion: state.resetVersion,
      request: { command, assetId: scope === 'fleet' ? null : assetId,
        requestedPowerMW: command === 'idle' ? 0 : scope === 'fleet' ? input : kwToMw(input) } });
    setViewStep(state.step);
    setRecordPage(1);
  }

  return <div className={d.commandCenter}>
    <div className={d.hero}><div><p className={s.eyebrow}>DRIVEGRID / ENERGY CONTROL</p><h1>Dispatch Command Center</h1><p>Precision control. Transparent execution.</p></div><div className={d.heroBadge}>SIMULATION ENVIRONMENT<span>15-minute intervals · no live devices</span></div></div>
    <div className={s.notice}>SIMULATION MODE <span>Manual execution consumes the current interval and advances time. Playback and Step only advance time.</span></div>
    <div className={d.workspace}><div className={d.controls}><span className={d.controlIndex}>01 / COMMAND CONFIGURATION</span><Panel title="Dispatch controls" subtitle={`Next interval: ${simulationLabel(state.step)} · AC-side power magnitude`}>
      <form className={d.form} onSubmit={execute}>
        <div className={a.filters}>
          <label>Dispatch scope<select value={scope} onChange={e => setScope(e.target.value)}><option value="fleet">Entire fleet</option><option value="asset">Individual asset</option></select></label>
          <label>Command<select value={command} onChange={e => setCommand(e.target.value as DispatchCommand)}><option value="discharge">Discharge</option><option value="charge">Charge</option><option value="idle">Idle</option></select></label>
          <label>Requested AC power ({scope === 'fleet' ? 'MW' : 'kW'})<PrecisionInput key={`${scope}-${command}-${state.resetVersion}`} name="power" step="any" max={scope === 'fleet' ? 100 : 100000} min={command === 'idle' ? 0 : 0.000001} defaultValue={command === 'idle' ? 0 : scope === 'fleet' ? 1 : 6} required disabled={command === 'idle'}/></label>
        </div>
        {scope === 'asset' && <div className={a.filters}>
          <label>Find an asset<input type="search" maxLength={120} value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, ID, or city"/></label>
          <label>Selected asset<select value={assetId} onChange={e => setAssetId(e.target.value)}>
            {!matches.some(item => item.id === assetId) && <option value={asset.id}>{asset.name} · {asset.location}</option>}
            {matches.map(item => <option key={item.id} value={item.id}>{item.name} · {item.location}</option>)}
          </select><small>First 100 search matches. Search by ID for any asset.</small></label>
        </div>}
        <label className={d.confirmation}><input key={`${state.step}-${state.resetVersion}`} type="checkbox" required disabled={blocked}/>Execute only the interval starting {simulationLabel(state.step)}. Confirm again for each interval.</label>
        <div className={d.controlFooter}>
          <div><p>Available for this command: <strong>{formatPower(capacity, scope === 'fleet' ? 'fleet' : asset.type)}</strong></p>
            {scope === 'asset' && <p>{asset.name} · SOC {formatNumber(asset.socPct)}% · {formatEnergy(asset.energyCapacityMWh,asset.type)} · {asset.status} / {asset.availability}</p>}
            <p>Charging efficiency 95% · discharging efficiency 95% · fixed 0.25-hour interval</p>
          </div>
          <button type="submit" disabled={blocked}>Execute interval</button>
        </div>
      </form>
      <p className={d.help}>Pause playback before executing. Every valid attempt (including a physical rejection or Idle) uses one interval. Repeated clicks for the same interval are blocked. AC export is positive; import is negative. Battery energy increase is positive.</p>
      <p className={d.feedback} role="status">{state.dispatchError || (latest ? `Last dispatch: ${latest.request.command} · ${latest.status} · ${formatPower(latest.acceptedPowerMW,latest.request.assetId === null ? 'fleet' : 'record')} accepted` : 'No dispatch intervals executed yet.')}</p>
    </Panel></div><DispatchScene latest={latest} soc={scope === 'fleet' ? portfolioMetrics(state.assets).averageSocPct : asset.socPct} socLabel={scope === 'fleet' ? 'Fleet energy-capacity-weighted SOC' : `${asset.name} SOC`}/></div>
    {viewed && <section className={d.result} aria-label="Dispatch result">
      <Panel title={`Interval result · ${simulationLabel(viewed.step)}`} subtitle={`${viewed.request.command.toUpperCase()} · ${viewed.status.toUpperCase()} · interval start timestamp`}>
        <div key={viewed.timestamp} className={d.resultBanner} data-status={viewed.status}><span>{viewed.request.command === 'charge' ? '↙' : viewed.request.command === 'discharge' ? '↗' : 'Ⅱ'}</span><div><small>03 / EXECUTION RECEIPT · {viewed.request.assetId ?? 'Entire fleet'}</small><h3>{viewed.status === 'curtailed' ? 'Power limited to available capability' : viewed.status === 'rejected' ? 'Dispatch rejected' : viewed.request.command === 'idle' ? 'Idle interval recorded' : 'Dispatch accepted'}</h3><p>Recorded result · {simulationLabel(viewed.step)} · not an executing action</p></div></div>
        <div className={d.comparison}><div><span>Requested magnitude</span><strong>{formatPower(viewed.requestedPowerMW,resultContext)}</strong></div><div className={d.comparisonTrack}><span style={{width:`${viewed.requestedPowerMW > 0 ? Math.min(100,viewed.acceptedPowerMW/viewed.requestedPowerMW*100) : 0}%`}}/></div><div><span>Accepted magnitude</span><strong>{formatPower(viewed.acceptedPowerMW,resultContext)}</strong></div></div>
        <div className={a.summary}>
          <div><small>Requested AC magnitude</small><strong>{formatPower(viewed.requestedPowerMW,resultContext)}</strong></div>
          <div><small>Accepted AC magnitude</small><strong>{formatPower(viewed.acceptedPowerMW,resultContext)}</strong></div>
          <div><small>Rejected / curtailed power</small><strong>{formatPower(viewed.rejectedPowerMW,resultContext)} / {formatPower(viewed.curtailedPowerMW,resultContext)}</strong></div>
          <div><small>AC energy (+ export / − import)</small><strong>{formatEnergy(viewed.acEnergyMWh,resultContext)}</strong></div>
        </div>
        <div className={d.energyReceipt}><div><small>BATTERY ENERGY CHANGE</small><strong>{formatEnergy(viewed.batteryEnergyDeltaMWh,resultContext)}</strong><span>Signed stored-energy change</span></div><div><small>CONVERSION LOSS</small><strong>{formatEnergy(viewed.lossMWh,resultContext)}</strong><span>Existing 95% efficiency model</span></div><div><small>SOC AFTER EXECUTION</small><strong>{viewed.request.assetId === null ? 'Per-asset records below' : viewed.records[0] ? `${formatNumber(viewed.records[0].socAfterPct)}%` : '—'}</strong><span>{viewed.request.assetId === null ? 'Current selection SOC shown above' : 'Recorded asset snapshot'}</span></div></div>
        <p className={d.help}>Requested / accepted AC energy magnitude: {formatEnergy(viewed.requestedEnergyMWh,resultContext)} / {formatEnergy(viewed.acceptedEnergyMWh,resultContext)} · Rejected / curtailed energy magnitude: {formatEnergy(viewed.rejectedEnergyMWh,resultContext)} / {formatEnergy(viewed.curtailedEnergyMWh,resultContext)}. Battery energy change: {formatEnergy(viewed.batteryEnergyDeltaMWh,resultContext)} · Conversion loss: {formatEnergy(viewed.lossMWh,resultContext)}. {viewed.reasons.join('; ') || 'Request accepted within equipment and energy limits.'}</p>
        <div className={a.registryScroll} tabIndex={0} role="region" aria-label="Dispatch asset records">
          <table className={a.registry}><caption>Individual records · positive grid energy = export; negative = import · positive battery change = stored energy gain · page {currentPage} / {pageCount}</caption>
            <thead><tr>{['Asset','Requested','Accepted','Rejected / curtailed','Grid Energy (kWh)','Battery Energy Change (kWh)','Energy Loss (kWh)','Battery SOC Before → After','Status / reason'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{viewed.records.slice((currentPage-1)*20,currentPage*20).map(record => <tr key={record.assetId}>
              <th scope="row">{record.assetId}</th><td>{formatPower(record.requestedPowerMW,'record')}</td><td>{formatPower(record.acceptedPowerMW,'record')}</td>
              <td>{formatPower(record.rejectedPowerMW,'record')} / {formatPower(record.curtailedPowerMW,'record')}</td>
              <td>{formatEnergy(record.acEnergyMWh,'record')}</td><td>{formatEnergy(record.batteryEnergyDeltaMWh,'record')}</td><td>{formatEnergy(record.lossMWh,'record')}</td>
              <td>{formatNumber(record.socBeforePct)}% → {formatNumber(record.socAfterPct)}%</td><td>{record.status}<small>{record.reasons.join('; ') || 'Within limits'}</small></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className={a.pagination}><span>{viewed.records.length} records · {viewed.exclusions.length} excluded assets</span><div><button disabled={currentPage===1} onClick={()=>setRecordPage(currentPage-1)}>Previous records</button><button disabled={currentPage===pageCount} onClick={()=>setRecordPage(currentPage+1)}>Next records</button></div></div>
        {viewed.exclusions.length > 0 && <details className={d.help}><summary>Excluded asset reasons</summary><ul>{viewed.exclusions.map(item=><li key={item.assetId}>{item.assetId}: {item.reasons.join('; ')}</li>)}</ul></details>}
      </Panel>
    </section>}
    <section className={d.result}><Panel title="Dispatch history" subtitle="Executed intervals only · skipped clock intervals do not dispatch">
      {state.history.length > 0 && <ol className={d.timeline} aria-label="Recent executed intervals">{state.history.slice(-3).toReversed().map(item=><li key={item.timestamp}><span className={d.eventDot}/><div><time>{simulationLabel(item.step)}</time><strong>{item.request.command.toUpperCase()} · {item.status}</strong><span>{item.request.assetId ?? 'Entire fleet'} · {formatPower(item.acceptedPowerMW,item.request.assetId === null ? 'fleet' : 'record')} accepted</span></div><button onClick={()=>{setViewStep(item.step);setRecordPage(1);}}>Inspect interval {item.step}</button></li>)}</ol>}
      {state.history.length === 0 ? <p className={d.help}>Execute a paused interval to create a simulated dispatch record.</p> : <div className={a.registryScroll} tabIndex={0} role="region" aria-label="Dispatch history table"><table className={a.registry}><thead><tr>{['Interval start (CT)','Command / scope','Status','Accepted power','Grid energy','Source','Synthetic price (USD/MWh)','Gross energy value (USD)','Details'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{state.history.toReversed().map(item=><tr key={item.timestamp}><th scope="row">{simulationLabel(item.step)}</th><td>{item.request.command}<small>{item.request.assetId ?? 'Entire fleet'}</small></td><td>{item.status}</td><td>{formatPower(item.acceptedPowerMW,item.request.assetId === null ? 'fleet' : 'record')}</td><td>{formatEnergy(item.acEnergyMWh,item.request.assetId === null ? 'fleet' : 'record')}</td><td>{item.source}</td><td>{formatNumber(item.marketPriceUSDPerMWh)}</td><td>{formatUSD(item.grossEnergyValueUSD)}</td><td><button onClick={()=>{setViewStep(item.step);setRecordPage(1);}}>View interval {item.step}</button></td></tr>)}</tbody></table></div>}
    </Panel></section>
  </div>;
}



