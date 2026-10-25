import type { SettlementAmounts } from '@/lib/vpp/settlement';
import { formatUSD } from '@/lib/vpp/units';
import a from '../assets.module.css';

export function SettlementTotals({ totals, compact=false }: { totals:SettlementAmounts; compact?:boolean }) {
  const all:[string,number][]=[['Gross energy value',totals.grossCents],['QSE service fees',totals.qseCents],['Transaction fees',totals.transactionCents],['Degradation costs',totals.degradationCents],['Net distributable value (signed)',totals.netCents],['Asset-owner earnings',totals.ownerCents],['DriveGrid platform share',totals.platformCents],['Unallocated deficits',totals.deficitCents]];
  const cards=compact?all.slice(4):all;
  return <div className={a.summary} style={{padding:'18px 22px',marginBottom:0}}>{cards.map(([label,cents])=><div key={label}><small>{label}</small><strong style={{fontSize:20}}>{formatUSD(cents/100)}</strong></div>)}</div>;
}
