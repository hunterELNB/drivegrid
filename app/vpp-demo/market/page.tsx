'use client';
import { PrecisionInput } from '../_components/PrecisionInput';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { marketPriceAt, marketStatistics } from '@/lib/vpp/market-data';
import { recommendMarket, validateMarketSettings } from '@/lib/vpp/market-decision';
import type { MarketRecommendation } from '@/lib/vpp/market-decision';
import { formatEnergy, formatNumber, formatPower, formatUSD, formatMarketPrice, formatPricePerKWh } from '@/lib/vpp/units';
import { simulationLabel, TOTAL_INTERVALS } from '@/lib/vpp/simulation';
import { useDemo } from '../_state/DemoProvider';
import { Panel } from '../_components/Panel';
import { EconomicSummary } from '../_components/EconomicSummary';
import { MarketPriceChart } from './MarketPriceChart';
import { marketPriceViews } from './market-presentation';
import a from '../assets.module.css';
import s from '../demo.module.css';
import m from './market.module.css';

type Preview = { recommendation: MarketRecommendation; revision: number; resetVersion: number };
const priceLabel = (value: number|null) => value === null ? 'N/A' : formatMarketPrice(value);

export default function MarketPage() {
  const { state } = useDemo();
  return <MarketWorkspace key={state.resetVersion}/>;
}

function MarketWorkspace() {
  const { state, dispatch } = useDemo();
  const [preview,setPreview] = useState<Preview|null>(null);
  const [dirty,setDirty] = useState(false);
  const [error,setError] = useState('');
  const settings=state.marketSettings;
  const stats=marketStatistics();
  const current=marketPriceAt(state.step);
  const next=marketPriceAt(state.step+1);
  const blocked=state.running || state.step>=TOTAL_INTERVALS;
  const fresh=preview !== null && preview.revision===state.marketRevision && preview.resetVersion===state.resetVersion && preview.recommendation.step===state.step && !dirty;
  const recent=state.history.filter(item=>item.source==='market');
  const last=recent.at(-1);
  const intervals=useMemo(()=>marketPriceViews(settings),[settings]);
  const signal=intervals[state.step]?.command;

  function apply(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const values={chargeThresholdUSDPerMWh:Number(data.get('charge')),dischargeThresholdUSDPerMWh:Number(data.get('discharge')),requestedFleetPowerMW:Number(data.get('power'))};
    const invalid=validateMarketSettings(values);
    if(invalid) {setError(invalid);return;}
    dispatch({type:'set-market-settings',settings:values});
    setDirty(false);setPreview(null);setError('');
  }
  function execute(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!preview || !fresh) return;
    dispatch({type:'execute-market',step:preview.recommendation.step,resetVersion:preview.resetVersion,revision:preview.revision});
  }
  const cards:[string,number|null][]=[['Current interval price',current],['Next interval price',next],['Daily minimum',stats.minimum],['Daily maximum',stats.maximum],['Daily average',stats.average]];
  return <div className={m.marketPage}>
    <div className={m.hero}><div><p className={s.eyebrow}>DRIVEGRID / SYNTHETIC MARKET SIGNALS</p><h1>Electricity Market Intelligence</h1><p>Price visibility. Transparent decisions.</p></div><div className={m.heroClock}><span>SIMULATION · {state.running ? 'CLOCK PLAYBACK' : 'PAUSED'}</span><strong>{simulationLabel(state.step)}</strong><small>No live market connection</small></div></div>
    <div className={s.notice}>SIMULATION MODE <span>Illustrative synthetic prices only. No live ERCOT data, bidding, or actual settlement prices.</span></div>
    <div className={m.signalBanner} data-command={signal ?? 'idle'}><span className={m.signalIcon}>{signal === 'charge' ? '↙' : signal === 'discharge' ? '↗' : 'Ⅱ'}</span><div><small>CURRENT APPLIED PRICE-RULE SIGNAL</small><strong>{signal ? signal.toUpperCase() : 'SCENARIO COMPLETE'}</strong><span>Preview below to check physical feasibility. No automatic execution.</span></div><div className={m.heroPrice}><small>CURRENT SYNTHETIC PRICE</small><strong>{current === null ? 'N/A' : `${formatNumber(current)} USD/MWh`}</strong><span>{current === null ? 'Reset to replay' : formatPricePerKWh(current)}</span></div></div>
    <section className={`${a.summary} ${m.statistics}`} aria-label="Synthetic market statistics">{cards.map(([label,value],index)=><div key={label}><div className={m.statTop}><small>{label}</small><span aria-hidden="true">{['⌁','→','↙','↗','≈'][index]}</span></div><strong className={m.statValue}>{value===null?'N/A':`${formatNumber(value)} USD/MWh`}</strong><small>{value===null?'No interval':formatPricePerKWh(value)}</small><div className={m.miniScale} aria-hidden="true">{value !== null && <i style={{left:`${(value-stats.minimum)/(stats.maximum-stats.minimum)*100}%`}}/>}</div></div>)}</section>
    {current===null && <p className={m.help}>The 24-hour scenario is complete. No current or next interval price exists. Reset to replay.</p>}
    <div className={m.chartPanel}><Panel title="24-hour synthetic price scenario" subtitle="96 fifteen-minute intervals · discrete prices, full negative valley and scarcity spike"><MarketPriceChart activeStep={state.step} intervals={intervals} chargeThreshold={settings.chargeThresholdUSDPerMWh} dischargeThreshold={settings.dischargeThresholdUSDPerMWh}/><p className={m.help}>The 2,500 USD/MWh (2.50 USD/kWh) extreme spike is an intentional stress interval, not a normal or typical ERCOT price. KPI markers show positions within this synthetic day&apos;s minimum/maximum range.</p></Panel></div>
    <div className={m.decisionGrid}><section className={`${m.section} ${m.controlPanel}`}><Panel title="Price-based decision rules" subtitle="Simple deterministic thresholds · recommendations require explicit execution">
      <form className={a.filters} onSubmit={apply} onChange={()=>{setDirty(true);setPreview(null);setError('');}}>
        <label>Charge below (USD/MWh)<PrecisionInput name="charge" min={-100000} max={100000} step="any" defaultValue={settings.chargeThresholdUSDPerMWh} required/></label>
        <label>Discharge above (USD/MWh)<PrecisionInput name="discharge" min={-100000} max={100000} step="any" defaultValue={settings.dischargeThresholdUSDPerMWh} required/></label>
        <label>Requested fleet power (MW)<PrecisionInput name="power" max={100} min="0.000001" step="any" defaultValue={settings.requestedFleetPowerMW} required/></label>
        <button type="submit">Apply thresholds</button>
      </form>
      <p className={m.help}>Applied: charge below {priceLabel(settings.chargeThresholdUSDPerMWh)}; discharge above {priceLabel(settings.dischargeThresholdUSDPerMWh)}; otherwise Idle. Threshold equality also means Idle. Target {formatPower(settings.requestedFleetPowerMW,'fleet')} for energy-transfer commands.</p>
      <div className={m.actions}><button disabled={blocked||dirty} onClick={()=>{try{setPreview({recommendation:recommendMarket(state.assets,state.step,settings),revision:state.marketRevision,resetVersion:state.resetVersion});setError('');}catch{setPreview(null);setError('Preview could not be calculated. Check the inputs or reset the demo.');}}}>Preview recommendation</button><span>{dirty?'Apply edits before preview.':blocked?'Pause playback or reset after end of day.':'Preview does not change assets, time, or economics.'}</span></div>
      <p className={m.error} role="alert">{error || (!fresh ? state.dispatchError : '')}</p>
    </Panel></section>
    {preview ? <section className={`${m.section} ${m.previewPanel}`} data-command={preview.recommendation.request.command} aria-label="Market recommendation preview"><Panel title={`Recommendation · ${simulationLabel(preview.recommendation.step)}`} subtitle={`${preview.recommendation.request.command.toUpperCase()} · PREVIEW ONLY · ${fresh?'CURRENT':'STALE — preview again'}`}>
      <div key={`${preview.recommendation.step}-${preview.revision}`} className={m.previewSignal}><span>{preview.recommendation.request.command === 'charge' ? '↙' : preview.recommendation.request.command === 'discharge' ? '↗' : 'Ⅱ'}</span><div><small>PHYSICAL FEASIBILITY PREVIEW</small><h3>{preview.recommendation.request.command.toUpperCase()} · {preview.recommendation.physicalPreview.status}</h3><p>{fresh ? 'Ready for explicit confirmation' : 'Stale preview · refresh before execution'}</p></div></div>
      <p className={m.help}>{preview.recommendation.explanation}</p>
      <div className={a.summary} style={{padding:'12px 22px',marginBottom:0}}>
        <div><small>Recommended request</small><strong>{formatPower(preview.recommendation.request.requestedPowerMW,'fleet')}</strong></div>
        <div><small>Physically feasible power</small><strong>{formatPower(preview.recommendation.physicalPreview.acceptedPowerMW,'fleet')}</strong></div>
        <div><small>Rejected / curtailed power</small><strong>{formatPower(preview.recommendation.physicalPreview.rejectedPowerMW,'fleet')} / {formatPower(preview.recommendation.physicalPreview.curtailedPowerMW,'fleet')}</strong></div>
        <div><small>Physical preview status</small><strong>{preview.recommendation.physicalPreview.status}</strong></div>
      </div>
      <p className={m.help}>{preview.recommendation.physicalPreview.reasons.join('; ') || 'Feasible within current power, SOC, availability and efficiency limits.'} Allocation and SOC use the Phase 3 engine. Requested power is a target; physical acceptance may be lower.</p>
      <form className={m.execute} onSubmit={execute}>
        <label><input key={`${state.step}-${state.marketRevision}`} type="checkbox" required disabled={!fresh||blocked}/>Confirm this preview for the interval starting {simulationLabel(preview.recommendation.step)}.</label>
        <button type="submit" disabled={!fresh||blocked}>Execute recommendation</button>
      </form>
      <p className={m.help}>Execution consumes one 15-minute interval, including Idle or rejection. Changed assets, thresholds, time, or reset invalidate a preview. Navigation and clock playback never execute recommendations.</p>
    </Panel></section> : <section className={`${m.section} ${m.previewEmpty}`} aria-label="Recommendation workspace"><span>DECISION WORKSPACE</span><h2>Inspect first. Execute deliberately.</h2><p>Apply thresholds, then preview the current interval&apos;s recommendation and physical limits.</p><div><span>01 / Apply rules</span><span>02 / Preview</span><span>03 / Confirm execution</span></div><small>Price signals alone do not move energy or create revenue.</small></section>}</div>
    <EconomicSummary/>
    {last && <section className={m.section} aria-label="Executed market result"><Panel title="Latest market-triggered execution" subtitle={`${simulationLabel(last.step)} · ${last.request.command.toUpperCase()} · ${last.status.toUpperCase()}`}>
      <div key={last.timestamp} className={m.executionReceipt} data-command={last.request.command}><div><small>RECORDED EXECUTION · {last.status.toUpperCase()}</small><h3>{last.request.command.toUpperCase()} · {formatPower(last.acceptedPowerMW,'fleet')} accepted</h3><span>{simulationLabel(last.step)} · no continuous trading activity</span></div><div><small>INTERVAL GROSS ENERGY VALUE</small><strong>{formatUSD(last.grossEnergyValueUSD)}</strong></div></div>
      <p className={m.help}>Requested {formatPower(last.requestedPowerMW,'fleet')} · accepted {formatPower(last.acceptedPowerMW,'fleet')} · rejected {formatPower(last.rejectedPowerMW,'fleet')} · curtailed {formatPower(last.curtailedPowerMW,'fleet')}.</p>
      <p className={m.help}>Signed grid energy {formatEnergy(last.acEnergyMWh,'fleet')} × {priceLabel(last.marketPriceUSDPerMWh)} = {formatUSD(last.grossEnergyValueUSD)} interval gross energy value. {last.reasons.join('; ') || 'Accepted within physical limits.'}</p>
      <p className={m.help}>Battery energy change {formatEnergy(last.batteryEnergyDeltaMWh,'fleet')} · energy loss {formatEnergy(last.lossMWh,'fleet')}. Individual SOC and energy records are available in the shared Dispatch history.</p>
    </Panel></section>}
    <section className={m.section}><Panel title="Recent market-related executions" subtitle="Last 10 market-triggered intervals · manual executions remain in shared Dispatch history">
      {!recent.length ? <p className={m.help}>No market recommendation has been executed. Preview alone creates no economic result.</p> : <div className={a.registryScroll} tabIndex={0} role="region" aria-label="Market execution history"><table className={a.registry}><thead><tr>{['Interval start (CT)','Synthetic price (USD/MWh)','Command','Requested / accepted (MW)','Grid energy (MWh)','Gross value (USD)','Status / reason'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{recent.slice(-10).toReversed().map(item=><tr key={item.timestamp}><th scope="row">{simulationLabel(item.step)}</th><td>{formatNumber(item.marketPriceUSDPerMWh)}</td><td>{item.request.command}</td><td>{formatPower(item.requestedPowerMW,'fleet')} / {formatPower(item.acceptedPowerMW,'fleet')}</td><td>{formatEnergy(item.acEnergyMWh,'fleet')}</td><td>{formatUSD(item.grossEnergyValueUSD)}</td><td>{item.status}<small>{item.reasons.join('; ') || 'Within limits'}</small></td></tr>)}</tbody></table></div>}
    </Panel></section>
  </div>;
}
