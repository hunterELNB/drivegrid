import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { assetTypes, portfolioMetrics } from '@/lib/vpp/domain';
import type { DERAsset } from '@/lib/vpp/domain';
import { formatNumber } from '@/lib/vpp/units';
import { EquipmentGraphic } from '../_components/NetworkEquipment';
import f from './fleet.module.css';

export function AssetGlyph({ type }: { type: DERAsset['type'] }) {
  return <svg className={f.glyph} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{type === 'ev-v2g' ? <><path d="m4 14 2-6h12l2 6v5H4ZM6 8l2-3h8l2 3M4 13h16M7 19v2m10-2v2"/><path d="M7 16h2m6 0h2"/></> : type === 'residential-battery' ? <><path d="m2 11 10-8 10 8M5 9v12h14V9M9 21v-7h6v7M9 8h6"/></> : <><path d="M3 5h18v16H3ZM7 5V3h10v2M7 9v8m5-8v8m5-8v8"/></>}</svg>;
}

export function SocGauge({ value, compact = false }: { value: number; compact?: boolean }) {
  return <div className={compact ? f.socCompact : f.soc}>
    <strong>{formatNumber(value)}<small>%</small></strong>
    <span className={f.socTrack} aria-hidden="true"><span style={{ width: `${value}%` }}/></span>
  </div>;
}

/** Aggregate existing domain selectors by category; no independent fleet model. */
export const FleetOverview = memo(function FleetOverview({ assets }: { assets: readonly DERAsset[] }) {
  const groups = useMemo(() => assetTypes.map(type => {
    const members = assets.filter(asset => asset.type === type.value);
    return { ...type, count: members.length, metrics: portfolioMetrics(members) };
  }), [assets]);
  return <section className={f.overview} aria-label="Fleet category overview">
    <div className={f.sectionTitle}><div><span className={f.eyebrow}>01 / DISTRIBUTED PORTFOLIO</span><h2>One fleet. Three energy resources.</h2></div><p>Current simulated portfolio · all registered assets</p></div>
    <div className={f.categories}>{groups.map((group,index) => <article key={group.value} className={f.category} style={{'--category':group.color} as CSSProperties}>
      <header><span className={f.categoryNumber}>0{index+1}</span><div><p>{group.value === 'residential-battery' ? 'RESIDENTIAL BESS' : group.label.toUpperCase()}</p><h3>{group.value === 'ev-v2g' ? 'Bidirectional mobility' : group.value === 'residential-battery' ? 'Energy at home' : 'Commercial flexibility'}</h3></div><AssetGlyph type={group.value}/></header>
      <div className={f.equipment}><EquipmentGraphic kind={group.value === 'ev-v2g' ? 'ev' : group.value === 'residential-battery' ? 'home' : 'bess'}/></div>
      <div className={f.categoryFacts}><div><small>REGISTERED ASSETS</small><strong>{formatNumber(group.count)}</strong></div><div><small>DISCHARGE-AVAILABLE</small><strong>{formatNumber(group.metrics.statuses[0].count)}<span> assets</span></strong></div></div>
      <dl className={f.categoryRatings}><div><dt>Rated power</dt><dd>{formatNumber(group.metrics.ratedPowerMW)} MW</dd></div><div><dt>Energy capacity</dt><dd>{formatNumber(group.metrics.energyCapacityMWh)} MWh</dd></div></dl>
      <footer><div><span>Weighted battery SOC</span><SocGauge value={group.metrics.averageSocPct} compact/></div><p>Energy-capacity weighted · current snapshot</p></footer>
    </article>)}</div>
    <div className={f.composition}><div><span className={f.eyebrow}>FLEET COMPOSITION</span><h3>Rated power by resource</h3><p>Segment widths represent rated MW, not asset counts.</p></div><div className={f.compositionChart}><div className={f.segments} aria-hidden="true">{groups.map(group=><span key={group.value} style={{flex:group.metrics.ratedPowerMW,background:group.color}}/>)}</div><ul>{groups.map(group=><li key={group.value}><i style={{background:group.color}}/><span>{group.label}</span><strong>{formatNumber(group.metrics.ratedPowerMW)} MW</strong></li>)}</ul></div></div>
  </section>;
});
