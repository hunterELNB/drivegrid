'use client';
import { useMemo } from 'react';
import Image from 'next/image';
import { EnergyNetworkVisualization } from './_components/EnergyNetworkVisualization';
import { DashboardKpiVisual } from './_components/DashboardKpiVisual';
import { EnergyIcon } from './_components/EnergyIcon';
import c from './dashboard.module.css';

import { events, kpis as referenceKpis, snapshot } from '@/lib/vpp/fixtures';
import { portfolioMetrics } from '@/lib/vpp/domain';
import { simulationLabel } from '@/lib/vpp/simulation';
import { useDemo } from './_state/DemoProvider';
import { Panel } from './_components/Panel';
import { DemoGuide } from './_components/DemoGuide';
import { TimeSeriesChart } from './_components/TimeSeriesChart';
import { DispatchActivity } from './_components/DispatchActivity';
import { EconomicSummary } from './_components/EconomicSummary';
import { SettlementSummary } from './_components/SettlementSummary';
import { marketPriceAt } from '@/lib/vpp/market-data';
import { formatNumber, formatUSD } from '@/lib/vpp/units';
import s from './demo.module.css';

export default function Dashboard() {
  const { state } = useDemo();
  const metrics = useMemo(()=>portfolioMetrics(state.assets),[state.assets]);
  const total = state.assets.length;
  const kpis = [
    { label: 'Total Portfolio Capacity', value: formatNumber(metrics.ratedPowerMW), unit: 'MW', note: 'Sum of asset rated power' },
    { label: 'Available Dispatch Power', value: formatNumber(metrics.availablePowerMW), unit: 'MW', note: 'Sustainable AC discharge over 15 minutes' },
    { label: 'Connected Assets', value: metrics.connectedAssets.toLocaleString('en-US'), unit: '', note: 'Excludes offline and maintenance assets' },
    { label: 'Average Battery SOC', value: formatNumber(metrics.averageSocPct), unit: '%', note: 'Weighted by energy capacity · all assets' },
    { label: 'Synthetic Market Price', value: marketPriceAt(state.step) === null ? '—' : formatNumber(marketPriceAt(state.step)!), unit: 'USD/MWh', note: 'Clock-aligned synthetic scenario price' },
    // The legacy reference fixture stores a display string; format its amount
    // at this presentation boundary without changing the fixture or ledger.
    ...referenceKpis.slice(5).map(kpi => ({ ...kpi, value: formatUSD(Number(kpi.value.replace(/[$,]/g, ''))) })),
  ];
  const segments = metrics.composition.map((p, index) => {
    const start = metrics.composition.slice(0, index).reduce((sum, item) => sum + item.capacityMW, 0) / metrics.ratedPowerMW * 100;
    const end = start + p.capacityMW / metrics.ratedPowerMW * 100;
    return `${p.color} ${start}% ${end}%`;
  });
  return <div className={c.dashboard}>
    <header className={c.hero}>
      <div className={c.identity}><Image src="/logo.jpg" alt="DriveGrid" width={892} height={413}/><div><p className={c.eyebrow}>DRIVEGRID / ENERGY INTELLIGENCE</p><h1>Virtual Power Plant <span>Command Center</span></h1></div></div>
      <div className={c.heroTime}><span className={c.tag}>SIMULATION ENVIRONMENT</span><strong>{simulationLabel(state.step)}</strong><small>{state.running?'Clock playback · no automatic dispatch':'Clock paused · your independent simulation'}</small></div>
      <p className={c.disclaimer}><span>SIMULATED DATA</span> Synthetic assets and prices. No live grid, ERCOT connections or payments. Reference fixtures remain labeled.</p>
    </header>
    <div className={c.commandDeck}>
      <EnergyNetworkVisualization assets={state.assets} latest={state.history.at(-1)}/>
    <section className={c.kpis} aria-label="Portfolio key performance indicators">
      {kpis.map((kpi,i) => <article key={kpi.label} className={c.kpi}><div className={c.kpiTop}><span className={c.kpiIndex}>0{i+1}</span><EnergyIcon kind={i}/></div><h2>{kpi.label}</h2><p className={c.kpiValue}>{kpi.value}<span>{kpi.unit}</span></p><p className={c.kpiNote}>{kpi.note}</p><DashboardKpiVisual index={i} metrics={metrics} assets={state.assets} price={marketPriceAt(state.step)}/></article>)}
    </section>
    </div>
    <div className={c.guide}><DemoGuide/></div>
    <DispatchActivity/>
    <EconomicSummary/>
    <SettlementSummary/>
    <div className={s.chartGrid}>
      <Panel title="Electricity price" subtitle="Reference fixture · not driven by the simulation clock"><TimeSeriesChart kind="price"/></Panel>
      <Panel title="Dispatch power" subtitle="Reference fixture · not a simulated dispatch result"><TimeSeriesChart kind="dispatch"/></Panel>
    </div>
    <div className={s.lowerGrid}>
      <Panel title="DER portfolio" subtitle={`Rated power by resource type · ${formatNumber(metrics.energyCapacityMWh)} MWh energy capacity`}>
        <div className={s.portfolio}>
          <div className={s.donut} style={{ background: `conic-gradient(${segments.join(',')})` }} role="img" aria-label={metrics.composition.map(p => `${p.label}: ${formatNumber(p.capacityMW)} MW`).join(', ')}><div><strong>{formatNumber(metrics.ratedPowerMW)}<span>MW</span></strong><small>Rated power</small></div></div>
          <ul className={s.legend}>{metrics.composition.map(p => <li key={p.value}><span className={s.dot} style={{background:p.color}}/><span>{p.label}</span><strong>{formatNumber(p.capacityMW)} MW<small>{formatNumber(p.capacityMW / metrics.ratedPowerMW * 100)}%</small></strong></li>)}</ul>
        </div>
      </Panel>
      <Panel title="Asset status" subtitle="Dispatch eligibility from shared demo state">
        <p className={s.statusTotal}>{total.toLocaleString('en-US')} <span>registered assets</span></p>
        <div className={s.statusBar} aria-hidden="true">{metrics.statuses.map(a => <span key={a.label} style={{width:`${a.count/total*100}%`,background:a.color}}/>)}</div>
        <ul className={s.statusList}>{metrics.statuses.map(a => <li key={a.label}><span className={s.dot} style={{background:a.color}}/>{a.label}<strong>{a.count.toLocaleString('en-US')}</strong><small>{formatNumber(a.count/total*100)}%</small></li>)}</ul>
        <p className={s.footnote}>Available = ready, available, above minimum SOC, and V2G enabled for EVs.</p>
      </Panel>
    </div>
    <Panel title="Recent operations" subtitle="Reference fixture events · 23 Oct 2026 · not a live audit log">
      <ol className={s.events}>{events.map(e => <li key={e.time}><time dateTime={`${snapshot.date}T${e.time}:00-05:00`}>{e.time}<small>CT</small></time><span className={s.eventMarker}/><div><h3>{e.title}</h3><p>{e.detail}</p></div><span className={s.eventCategory}>{e.category}</span></li>)}</ol>
    </Panel>
  </div>;
}
