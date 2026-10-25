'use client';

import Link from 'next/link';
import { useState } from 'react';
import { aggregateSettlement } from '@/lib/vpp/settlement';
import { formatEnergy, formatMarketPrice, formatNumber, formatPower, formatUSD } from '@/lib/vpp/units';
import { marketPriceAt } from '@/lib/vpp/market-data';
import { simulationLabel } from '@/lib/vpp/simulation';
import { useDemo } from '../_state/DemoProvider';
import { useSettlement } from '../_state/useSettlement';
import { Panel } from '../_components/Panel';
import { ownerAssetView } from './presentation';
import { OwnerAssetCard } from './OwnerAssetCard';
import { OwnerActivity, OwnerEarnings } from './OwnerParticipation';
import a from '../assets.module.css';
import s from '../demo.module.css';
import c from './owner.module.css';

export default function OwnerPage() {
  const {state}=useDemo();
  const ledger=useSettlement();
  const evs=state.assets.filter(asset=>asset.type==='ev-v2g');
  const [selectedId,setSelectedId]=useState(evs[0].id);
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const asset=evs.find(item=>item.id===selectedId)!;
  const matches=evs.filter(item=>`${item.id} ${item.name} ${item.location}`.toLowerCase().includes(search.toLowerCase())).slice(0,100);
  const rows=ledger.rows.filter(row=>row.assetId===selectedId);
  const totals=aggregateSettlement(rows);
  const exported=rows.reduce((sum,row)=>sum+Math.max(row.acEnergyMWh,0),0);
  const imported=-rows.reduce((sum,row)=>sum+Math.min(row.acEnergyMWh,0),0);
  const participation=rows.filter(row=>row.acEnergyMWh!==0).length;
  const pages=Math.max(1,Math.ceil(rows.length/20));const currentPage=Math.min(page,pages);
  const currentPrice=marketPriceAt(state.step);
  const cards:[string,string][]=[['Participating energy intervals',String(participation)],['Grid energy exported',formatEnergy(exported,'record')],['Grid energy imported',formatEnergy(imported,'record')],['Attributed gross energy value',formatUSD(totals.grossCents/100)],['QSE + transaction fees',formatUSD((totals.qseCents+totals.transactionCents)/100)],['Battery degradation cost',formatUSD(totals.degradationCents/100)],['Illustrative owner earnings',formatUSD(totals.ownerCents/100)],['Unallocated operating deficit',formatUSD(totals.deficitCents/100)]];
  return <div className={c.ownerPage}>
    <header className={c.pageHeader}><div><p className={c.eyebrow}>DRIVEGRID / ENERGY ASSET OWNER PORTAL</p><h1>My Energy</h1><p>Your battery. Your participation. A clearer view of simulated value.</p></div><div className={c.headerContext}><span>SELECTED DEMONSTRATION ASSET</span><strong>{asset.name}</strong><small>{asset.id} · {asset.location}</small><div className={c.quickAllocation}><span>Simulated allocation · not paid</span><b>{formatUSD(totals.ownerCents/100)}</b></div></div></header>
    <div className={s.notice}>SIMULATION MODE <span>No real identity, account, banking, payments, or guaranteed earnings.</span></div>
    <Panel title="Select a simulated EV" subtitle="One shared asset and settlement source across the demo">
      <div className={`${a.filters} ${c.selector}`}>
        <label>Find EV asset<input type="search" maxLength={120} value={search} onChange={e=>setSearch(e.target.value)} placeholder="EV ID, name, or city"/></label>
        <label>Selected EV<select value={selectedId} onChange={e=>{setSelectedId(e.target.value);setPage(1);}}>{!matches.some(item=>item.id===selectedId)&&<option value={selectedId}>{asset.name} · {asset.location}</option>}{matches.map(item=><option key={item.id} value={item.id}>{item.name} · {item.location}</option>)}</select><small className={c.selectNote}>First 100 matches. Search by ID to find any of the 1,000 EVs.</small></label>
      </div>
      {!matches.length&&<p className={c.help}>No matching EVs. The existing selection remains active.</p>}
    </Panel>
    <div className={c.portfolioGrid}>
    <OwnerAssetCard asset={ownerAssetView(asset)} priceLabel={currentPrice===null?'Scenario complete':formatMarketPrice(currentPrice)}/>
    <Panel title="Your illustrative participation results" subtitle={`${asset.id} · all executed records, including zero-energy records in history`}>
      <OwnerEarnings cards={cards} totals={totals} ownerSharePct={state.commercialSettings.ownerSharePct} period={rows.length?`${simulationLabel(rows[0].step)} — ${simulationLabel(rows.at(-1)!.step)} · recorded interval starts`:'No executed records for this EV'}/>
      <div className={c.energySummary}>{cards.slice(0,3).map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
      <p className={c.help}>No earnings are inferred from nameplate capacity. Only this EV’s executed grid energy and battery energy change are attributed. Market fleet dispatch is allocated by stable asset ID and may use BESS before EVs.</p>
    </Panel>
    </div>
    <section className={c.section}><Panel title="How these earnings are calculated" subtitle="Illustrative assumptions applied to every executed asset interval">
      <p className={c.help}>Gross = signed grid energy (MWh) × that interval’s synthetic price (USD/MWh). Positive grid energy exports; negative imports. Manual dispatch uses the same interval price as market dispatch.</p>
      <p className={c.help}>Deduct QSE {formatNumber(state.commercialSettings.qseFeePct)}% of positive gross, {formatNumber(state.commercialSettings.transactionUSDPerMWh)} USD/MWh absolute grid energy, and {formatNumber(state.commercialSettings.degradationUSDPerKWh)} USD/kWh absolute battery energy change. Positive net is shared {formatNumber(state.commercialSettings.ownerSharePct)}% to owners and {formatNumber(state.commercialSettings.platformSharePct)}% to DriveGrid, with cent rounding. Efficiency losses are not charged twice.</p>
      <p className={c.help}>Zero/negative net generates no owner payout. Deficits remain unallocated and do not offset other positive earnings. These are demonstration results, not amounts payable. <Link href="/vpp-demo/settlement" style={{color:'#91bdf4'}}>Review the commercial model →</Link></p>
    </Panel></section>
    <section className={c.section}><Panel title="EV earnings history" subtitle="Grid energy in kWh · USD amounts rounded per asset interval">
      {!!rows.length&&<OwnerActivity records={rows.toReversed().slice((currentPage-1)*20,currentPage*20).slice(0,5)} pageRecordCount={rows.slice((currentPage-1)*20,currentPage*20).length}/>}
      {!rows.length?<p className={c.help}>No executed records for this EV. Use Individual asset on Dispatch and select {asset.id}; previews and time-only clock steps create no earnings.</p>:<div className={a.registryScroll} tabIndex={0} role="region" aria-label="EV earnings table"><table className={a.registry}><thead><tr>{['Interval (CT)','Direction / source','Accepted power','Grid energy (kWh)','Synthetic price','Gross','QSE','Transaction','Degradation','Net','Owner earnings','Deficit'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.toReversed().slice((currentPage-1)*20,currentPage*20).map(row=><tr key={row.key}><th scope="row">{simulationLabel(row.step)}</th><td>{row.direction}<small>{row.source} · {row.status}</small></td><td>{formatPower(row.acceptedPowerMW,'record')}</td><td>{formatEnergy(row.acEnergyMWh,'record')}</td><td>{formatMarketPrice(row.priceUSDPerMWh)}</td>{[row.grossCents,row.qseCents,row.transactionCents,row.degradationCents,row.netCents,row.ownerCents,row.deficitCents].map((value,index)=><td key={index}>{formatUSD(value/100)}</td>)}</tr>)}</tbody></table></div>}
      <div className={a.pagination}><span>Page {currentPage} of {pages} · {rows.length} executed records</span><div><button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</button><button disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Next</button></div></div>
    </Panel></section>
  </div>;
}

