'use client';
import Link from 'next/link';
import { useSettlement } from '../_state/useSettlement';
import { Panel } from './Panel';
import { SettlementTotals } from './SettlementTotals';
import s from '../demo.module.css';

export function SettlementSummary() {
  const ledger=useSettlement();
  return <div style={{marginBottom:22}}><Panel title="Simulated settlement allocation" subtitle="Derived from actual asset-interval participation · illustrative commercial model">
    <SettlementTotals totals={ledger.totals} compact/>
    <p className={s.footnote}>Positive asset-interval net values are shared; negative results remain unallocated operating deficits. Deficits are not charged to owners or netted against other payouts. <Link href="/vpp-demo/settlement" style={{color:'#91bdf4'}}>Review assumptions and reconciliation →</Link></p>
  </Panel></div>;
}
