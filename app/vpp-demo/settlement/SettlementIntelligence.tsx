import { memo, useMemo } from 'react';
import type { CommercialSettings, SettlementAmounts, settleHistory } from '@/lib/vpp/settlement';
import { formatNumber, formatUSD } from '@/lib/vpp/units';
import { settlementBridge } from './settlement-presentation';
import { RevenueBridgeSvg } from './RevenueBridgeSvg';
import c from './settlement.module.css';

export const SettlementKpis=memo(function SettlementKpis({totals}:{totals:SettlementAmounts}){
  const cards=[
    ['Gross energy value',totals.grossCents,'value','Signed market energy value','⌁'],
    ['QSE service fees',totals.qseCents,'cost','Deduction · positive gross basis','−'],
    ['Transaction fees',totals.transactionCents,'cost','Deduction · absolute AC throughput','−'],
    ['Degradation costs',totals.degradationCents,'cost','Deduction · battery energy movement','−'],
    ['Net distributable value (signed)',totals.netCents,'value','After existing fees and costs','Σ'],
    ['Asset-owner earnings',totals.ownerCents,'value','Actual positive asset-interval allocations','↗'],
    ['DriveGrid platform share',totals.platformCents,'value','Actual positive asset-interval allocations','◇'],
    ['Unallocated deficits',totals.deficitCents,'deficit','Operating deficits · not owner charges','!'],
  ] as const;
  return <div className={c.financialKpis}>{cards.map(([label,cents,kind,note,icon])=><article key={label} data-kind={kind} data-sign={cents<0?'negative':cents>0?'positive':'zero'}><header><small>{label}</small><span aria-hidden="true">{icon}</span></header><strong>{formatUSD(cents/100)}</strong><p>{note}</p><span className={c.signCaption}>{kind==='cost'?'COST':kind==='deficit'?'DEFICIT':cents<0?'NEGATIVE':cents>0?'POSITIVE':'ZERO'}</span></article>)}</div>;
});

export const SettlementIntelligence=memo(function SettlementIntelligence({totals,settings}:{totals:SettlementAmounts;settings:CommercialSettings}){
  const steps=useMemo(()=>settlementBridge(totals),[totals]);
  const moving=steps.some(step=>step.deltaCents!==0);
  const payoutCents=totals.ownerCents+totals.platformCents;
  const showSplit=totals.netCents>0&&payoutCents>0;
  return <div className={c.intelligenceGrid}>
    <section className={c.bridgePanel} aria-label="Revenue waterfall"><header><span className={c.overline}>01 / FINANCIAL BRIDGE</span><h2>From energy value to net.</h2><p>Existing ledger totals · all executed intervals · independent of detail filters</p></header>{moving?<div className={c.bridgeScroll} role="region" aria-label="Scrollable revenue waterfall" tabIndex={0}><RevenueBridgeSvg steps={steps}/></div>:<div className={c.zeroBridge}><strong>$0.00</strong><h3>No financial movement in the current ledger</h3><p>Executed zero-energy records remain visible through the existing ledger toggle. Previews create no settlement.</p></div>}<dl className={c.bridgeAmounts}>{steps.map(step=><div key={step.label}><dt>{step.label}{step.kind==='cost'?' · deducted':''}</dt><dd data-sign={step.deltaCents<0?'negative':'other'}>{formatUSD(step.deltaCents/100)}</dd></div>)}</dl><p className={c.bridgeNote}>Cost bars subtract the already calculated QSE, transaction and degradation amounts. Negative gross and net retain their signs. No physical loss is deducted again.</p></section>
    <section className={c.sharingPanel} aria-label="Actual revenue allocation"><header><span className={c.overline}>02 / REVENUE ALLOCATION</span><h2>Participation, allocated.</h2><p>Actual rounded asset-interval results · not a hypothetical fleet split</p></header>{showSplit?<div className={c.sharingVisual}><span>ACTUAL POSITIVE-ROW PAYOUTS</span><div className={c.splitBar} role="img" aria-label={`Actual asset-owner allocation ${formatUSD(totals.ownerCents/100)}; DriveGrid allocation ${formatUSD(totals.platformCents/100)}`}><span style={{flex:totals.ownerCents}}/><span style={{flex:totals.platformCents}}/></div><p>Segment widths use actual allocated cents. Per-row rounding can change the aggregate ratio.</p></div>:<div className={c.noSplit}><span aria-hidden="true">{totals.netCents<0?'−':'○'}</span><h3>{totals.netCents<0?'Aggregate net is negative':'No positive aggregate net'}</h3><p>No hypothetical positive split is drawn. Any existing positive-row payouts remain listed below; deficits are not netted against those payouts.</p></div>}<dl className={c.allocationAmounts}><div><dt><i/>Asset owners</dt><dd>{formatUSD(totals.ownerCents/100)}</dd></div><div><dt><i/>DriveGrid</dt><dd>{formatUSD(totals.platformCents/100)}</dd></div><div><dt>Unallocated deficits</dt><dd>{formatUSD(totals.deficitCents/100)}</dd></div></dl><p className={c.bridgeNote}>Applied per positive asset-interval: {formatNumber(settings.ownerSharePct)}% owner / {formatNumber(settings.platformSharePct)}% DriveGrid. Actual outputs above come from the existing engine. Negative net is not billed to owners or deducted from other positive payouts.</p></section>
  </div>;
});

export function ReconciliationReadout({ledger}:{ledger:ReturnType<typeof settleHistory>}){
  return <div className={c.reconcileReadout} data-reconciled={ledger.reconciled} aria-label="Exact reconciliation outputs"><div><small>ENGINE RECONCILIATION</small><strong>{ledger.reconciled?'RECONCILED':'REVIEW REQUIRED'}</strong><p>Original engine result · no new pass/fail rule</p></div><div><small>ALLOCATION RESIDUAL</small><strong>{formatUSD(ledger.residualCents/100)}</strong><p>Display rounded to cents only</p></div><div><small>ASSET-ROUNDING DIFFERENCE · USD</small><code>{formatUSD(ledger.roundingDifferenceUSD)}</code><p>Original tolerance: <code>{formatUSD(ledger.roundingToleranceUSD)}</code></p></div><div><small>RAW SOURCE DIFFERENCE · USD</small><code>{formatUSD(ledger.sourceDifferenceUSD)}</code><p>Original tolerance: <code>{formatUSD(ledger.sourceToleranceUSD)}</code></p></div></div>;
}
