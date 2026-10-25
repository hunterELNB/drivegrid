import type { SettlementAmounts } from '@/lib/vpp/settlement';

export interface BridgeStep {
  readonly label: string;
  readonly kind: 'gross' | 'cost' | 'net';
  readonly deltaCents: number;
  readonly fromCents: number;
  readonly toCents: number;
}

/** Cumulative placement of existing cent outputs only, never fee/share calculation.
 * The final net column uses the engine value rather than a recomputed settlement.
 */
export function settlementBridge(totals: SettlementAmounts): readonly BridgeStep[] {
  const afterQse=totals.grossCents-totals.qseCents;
  const afterTransaction=afterQse-totals.transactionCents;
  return [
    {label:'Gross energy value',kind:'gross',deltaCents:totals.grossCents,fromCents:0,toCents:totals.grossCents},
    {label:'QSE service fee',kind:'cost',deltaCents:-totals.qseCents,fromCents:totals.grossCents,toCents:afterQse},
    {label:'Market / transaction',kind:'cost',deltaCents:-totals.transactionCents,fromCents:afterQse,toCents:afterTransaction},
    {label:'Battery degradation',kind:'cost',deltaCents:-totals.degradationCents,fromCents:afterTransaction,toCents:totals.netCents},
    {label:'Signed net value',kind:'net',deltaCents:totals.netCents,fromCents:0,toCents:totals.netCents},
  ];
}
