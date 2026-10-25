'use client';

import { economicSummary } from '@/lib/vpp/economics';
import { formatEnergy, formatNumber, formatUSD } from '@/lib/vpp/units';
import { useDemo } from '../_state/DemoProvider';
import { Panel } from './Panel';
import a from '../assets.module.css';
import s from '../demo.module.css';

export function EconomicSummary() {
  const { state } = useDemo();
  const totals = economicSummary(state.history);
  const cards = [
    ['Cumulative gross energy value', formatUSD(totals.cumulativeGrossValueUSD)],
    ['Grid energy exported', formatEnergy(totals.exportedMWh,'fleet')],
    ['Grid energy imported', formatEnergy(totals.importedMWh,'fleet')],
    ['Charging cost (+) / credit (−)', formatUSD(totals.chargingCostUSD)],
    ['Discharging energy value', formatUSD(totals.dischargingValueUSD)],
    ['Weighted export price', totals.averageExportPriceUSDPerMWh === null ? 'N/A · no exports' : `${formatNumber(totals.averageExportPriceUSDPerMWh)} USD/MWh`],
    ['Latest interval gross value', state.history.length ? formatUSD(state.history.at(-1)!.grossEnergyValueUSD) : 'No execution'],
    ['Executed intervals', String(state.history.length)],
  ];
  return <div style={{marginTop:22,marginBottom:22}}><Panel title="Illustrative gross energy economics" subtitle="Executed dispatch only · includes manual and market-triggered intervals">
    <div className={a.summary} style={{padding:'18px 22px',marginBottom:0}}>{cards.map(([label,value])=><div key={label}><small>{label}</small><strong style={{fontSize:18}}>{value}</strong></div>)}</div>
    <p className={s.footnote}>Signed grid energy (MWh) × synthetic price (USD/MWh). Import at negative prices creates a credit; export at negative prices creates a cost. Losses are already reflected by dispatch physics.</p>
    <p className={s.footnote}>Illustrative gross value excludes market fees, network charges, QSE fees, battery degradation, taxes, and contractual revenue sharing. Not formal settlement or realized revenue.</p>
  </Panel></div>;
}
