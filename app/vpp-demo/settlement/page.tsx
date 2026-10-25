'use client';
import { PrecisionInput } from '../_components/PrecisionInput';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { assetTypes } from '@/lib/vpp/domain';
import { aggregateSettlement, validateCommercialSettings } from '@/lib/vpp/settlement';
import type { CommercialSettings } from '@/lib/vpp/settlement';
import { formatEnergy, formatMarketPrice, formatNumber, formatPower, formatUSD } from '@/lib/vpp/units';
import { simulationLabel } from '@/lib/vpp/simulation';
import { useDemo } from '../_state/DemoProvider';
import { useSettlement } from '../_state/useSettlement';
import { ReconciliationReadout, SettlementIntelligence, SettlementKpis } from './SettlementIntelligence';
import { Panel } from '../_components/Panel';
import a from '../assets.module.css';
import s from '../demo.module.css';
import c from './settlement.module.css';

export default function SettlementPage() {
  const {state}=useDemo();
  return <SettlementWorkspace key={state.resetVersion}/>;
}

function SettlementWorkspace() {
  const {state}=useDemo();
  const ledger=useSettlement();
  const [search,setSearch]=useState('');
  const [type,setType]=useState('all');
  const [interval,setInterval]=useState('all');
  const [direction,setDirection]=useState('all');
  const [includeZero,setIncludeZero]=useState(false);
  const [page,setPage]=useState(1);
  const filtered=ledger.rows.filter(row=>row.assetId.toLowerCase().includes(search.trim().toLowerCase())&&(type==='all'||row.assetType===type)&&(interval==='all'||row.timestamp===interval)&&(direction==='all'||row.direction===direction)&&(includeZero||row.acEnergyMWh!==0));
  const pages=Math.max(1,Math.ceil(filtered.length/20));
  const currentPage=Math.min(page,pages);
  const subtotal=aggregateSettlement(filtered);

  return <div className={c.settlementPage}>
    <div className={c.pageHero}><div><p className={s.eyebrow}>DRIVEGRID / ILLUSTRATIVE COMMERCIAL RESULTS</p><h1>Energy Settlement & Revenue Intelligence</h1><p>Executed energy. Transparent costs. Traceable allocation.</p></div><div className={c.heroContext}><span>SIMULATED LEDGER / FULL RUN</span><strong>{simulationLabel(state.step)}</strong><small>{ledger.intervals.length} executed intervals · no real payments</small></div></div>
    <div className={s.notice}>SIMULATION MODE <span>Demonstration assumptions, not verified ERCOT tariffs, contractual terms, payments, or formal financial settlement.</span></div>
    <Panel title="Fleet settlement summary" subtitle="All executed manual and market records · independent of detail filters"><SettlementKpis totals={ledger.totals}/><p className={c.help}>Positive net value is shared at the asset-interval level. Negative net value remains an unallocated deficit; it is not billed to owners or deducted from other positive payouts.</p></Panel>
    <SettlementIntelligence totals={ledger.totals} settings={state.commercialSettings}/>
    <section className={c.section}><CommercialForm/></section>
    <section className={c.section}><Panel title="Reconciliation" subtitle="Integer-cent allocation identities, plus an explicit bridge to unrounded grid energy value">
      <ReconciliationReadout ledger={ledger}/>
      <div className={c.reconciliation}><span className={s.badge} data-reconciled={ledger.reconciled}>{ledger.reconciled?'RECONCILED':'REVIEW REQUIRED'}</span><p>Gross − QSE − transaction − degradation = owner + platform − deficit.</p>
        <p>Allocation residual: <strong>{formatUSD(ledger.residualCents/100)}</strong>. Raw fleet gross: {formatUSD(ledger.rawFleetGrossUSD)}. Asset-rounding difference: {formatUSD(ledger.roundingDifferenceUSD)}; original currency-rounding tolerance ±{formatUSD(ledger.roundingToleranceUSD)} (rounded to cents for display only).</p>
        <p>Raw asset/fleet source difference: {formatUSD(ledger.sourceDifferenceUSD)} (internal floating-point check passed: {String(Math.abs(ledger.sourceDifferenceUSD)<=ledger.sourceToleranceUSD)}; original tolerance {formatUSD(ledger.sourceToleranceUSD)}). Displayed differences and tolerances are rounded to cents only; $0.00 does not mean exact zero. Original full-precision engine comparisons remain enforced. Duplicate asset-interval records suppressed: {ledger.duplicatesIgnored}.</p>
        <p>Each asset gross value and cost is rounded to cents, half away from zero. Owner share is rounded; platform receives the positive-net residual cent. Summaries sum rows, not separately rounded fleet calculations.</p>
      </div>
    </Panel></section>
    <section className={c.section}><Panel title="Settlement history" subtitle="One view per executed interval · same shared dispatch history">
      {!ledger.intervals.length?<p className={c.help}>No executed dispatch yet. Previews create no settlement.</p>:<div className={a.registryScroll} tabIndex={0} role="region" aria-label="Settlement interval history"><table className={a.registry}><thead><tr>{['Interval start (CT)','Source','Synthetic price','Gross','Fees + costs','Net','Owner','DriveGrid','Deficit','Details'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{ledger.intervals.toReversed().map(item=><tr key={item.timestamp}><th scope="row">{simulationLabel(item.step)}</th><td>{item.source}</td><td>{formatMarketPrice(item.priceUSDPerMWh)}</td><td>{formatUSD(item.grossCents/100)}</td><td>{formatUSD((item.qseCents+item.transactionCents+item.degradationCents)/100)}</td><td>{formatUSD(item.netCents/100)}</td><td>{formatUSD(item.ownerCents/100)}</td><td>{formatUSD(item.platformCents/100)}</td><td>{formatUSD(item.deficitCents/100)}</td><td><button onClick={()=>{setInterval(item.timestamp);setPage(1);}}>View interval {item.step}</button></td></tr>)}</tbody></table></div>}
    </Panel></section>
    <section className={c.section}><Panel title="Asset-level settlement details" subtitle="Actual participating asset energy · no nameplate-based revenue allocation">
      <div className={a.filters}>
        <label>Find settlement asset<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Asset ID"/></label>
        <label>Asset type<select value={type} onChange={e=>{setType(e.target.value);setPage(1);}}><option value="all">All types</option>{assetTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label>Executed interval<select value={interval} onChange={e=>{setInterval(e.target.value);setPage(1);}}><option value="all">All intervals</option>{ledger.intervals.map(i=><option key={i.timestamp} value={i.timestamp}>{simulationLabel(i.step)}</option>)}</select></label>
        <label>Direction<select value={direction} onChange={e=>{setDirection(e.target.value);setPage(1);}}><option value="all">All directions</option>{['charge','discharge','idle'].map(value=><option key={value}>{value}</option>)}</select></label>
      </div>
      <label className={c.toggle}><input type="checkbox" checked={includeZero} onChange={e=>{setIncludeZero(e.target.checked);setPage(1);}}/>Include idle/rejected zero-energy records (no payouts)</label>
      <p className={c.help}>{filtered.length} matching records / {ledger.rows.length} total. Filtered gross {formatUSD(subtotal.grossCents/100)} · owner {formatUSD(subtotal.ownerCents/100)} · platform {formatUSD(subtotal.platformCents/100)} · deficit {formatUSD(subtotal.deficitCents/100)}.</p>
      <div className={a.registryScroll} tabIndex={0} role="region" aria-label="Asset settlement table"><table className={a.registry}><caption>USD amounts rounded per asset interval · positive grid energy = export; negative = import</caption><thead><tr>{['Asset / type','Interval (CT)','Direction / status','Accepted power','Grid energy (kWh)','Synthetic price','Gross','QSE','Transaction','Degradation','Net','Owner','DriveGrid','Deficit'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{filtered.slice((currentPage-1)*20,currentPage*20).map(row=><tr key={row.key}><th scope="row">{row.assetId}<small>{assetTypes.find(t=>t.value===row.assetType)?.label}</small></th><td>{simulationLabel(row.step)}</td><td><span className={c.ledgerDirection}>{row.direction}</span><small>{row.status} · {row.source}</small></td><td>{formatPower(row.acceptedPowerMW,'record')}</td><td>{formatEnergy(row.acEnergyMWh,'record')}</td><td>{formatMarketPrice(row.priceUSDPerMWh)}</td>{[row.grossCents,row.qseCents,row.transactionCents,row.degradationCents,row.netCents,row.ownerCents,row.platformCents,row.deficitCents].map((value,index)=><td key={index} className={c.amount} data-sign={value<0?'negative':value>0?'positive':'zero'} data-kind={index>=1&&index<=3?'cost':index===7?'deficit':'value'}>{formatUSD(value/100)}</td>)}</tr>)}</tbody></table></div>
      {!filtered.length&&<p className={c.help}>No matching energy transfers. Execute dispatch or adjust filters; zero-energy records are hidden by default.</p>}
      <div className={a.pagination}><span>Page {currentPage} of {pages}</span><div><button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</button><button disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Next</button></div></div>
    </Panel></section>
  </div>;
}

function CommercialForm() {
  const {state,dispatch}=useDemo();
  const [error,setError]=useState('');
  const settings=state.commercialSettings;
  function apply(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const values:CommercialSettings={ownerSharePct:Number(form.get('owner')),platformSharePct:Number(form.get('platform')),qseFeePct:Number(form.get('qse')),transactionUSDPerMWh:Number(form.get('transaction')),degradationUSDPerKWh:Number(form.get('degradation'))};
    const invalid=validateCommercialSettings(values);
    if(invalid){setError(invalid);return;}
    dispatch({type:'set-commercial-settings',settings:values});setError('');
  }
  return <Panel title="Commercial assumptions" subtitle="Illustrative defaults; applying changes recalculates all executed records in this run">
    <form className={a.filters} onSubmit={apply}>
      <label>Asset-owner share (%)<PrecisionInput name="owner" min="0" max="100" step="any" defaultValue={settings.ownerSharePct} required/></label>
      <label>DriveGrid share (%)<PrecisionInput name="platform" min="0" max="100" step="any" defaultValue={settings.platformSharePct} required/></label>
      <label>QSE fee (% positive gross)<PrecisionInput name="qse" min="0" max="100" step="any" defaultValue={settings.qseFeePct} required/></label>
      <label>Transaction fee (USD/MWh grid)<PrecisionInput name="transaction" min="0" max="1000000" step="any" defaultValue={settings.transactionUSDPerMWh} required/></label>
      <label>Degradation (USD/kWh battery)<PrecisionInput name="degradation" min="0" max="1000000" step="any" defaultValue={settings.degradationUSDPerKWh} required/></label>
      <button type="submit">Apply commercial model</button>
    </form>
    <p className={c.help}>Applied shares {formatNumber(settings.ownerSharePct)}% owner / {formatNumber(settings.platformSharePct)}% DriveGrid; QSE {formatNumber(settings.qseFeePct)}% of positive gross; transaction {formatUSD(settings.transactionUSDPerMWh)}/MWh absolute grid energy; degradation {formatUSD(settings.degradationUSDPerKWh)}/kWh absolute battery energy change.</p>
    <p className={c.help}>Efficiency losses are already in dispatch physics and are not deducted again. Negative asset-interval net values are tracked as unallocated deficits. Assumptions are not verified tariffs or contracts; no payments are made.</p>
    <p className={c.error} role="alert">{error}</p>
  </Panel>;
}

