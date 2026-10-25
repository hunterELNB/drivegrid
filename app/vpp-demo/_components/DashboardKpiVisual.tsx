import type { DERAsset,portfolioMetrics } from '@/lib/vpp/domain';
import { marketStatistics } from '@/lib/vpp/market-data';
import { formatNumber } from '@/lib/vpp/units';
import v from './DashboardKpiVisual.module.css';
const marketRange=marketStatistics();
/** Visual encodings only; headline KPI values remain in the unchanged Dashboard expressions. */
export function DashboardKpiVisual({index,metrics,assets,price}:{index:number;metrics:ReturnType<typeof portfolioMetrics>;assets:readonly DERAsset[];price:number|null}){
 const total=assets.length;
 if(index===0)return <div className={v.capacity}><div className={v.segments} aria-hidden="true">{metrics.composition.map(type=><span key={type.value} style={{flex:type.capacityMW,background:type.color}}/>)}</div><div className={v.legend}>{metrics.composition.map((type,i)=><span key={type.value}><i style={{background:type.color}}/>{['EV','Home','BESS'][i]} <b>{formatNumber(type.capacityMW)}</b></span>)}</div><small>Rated capacity by type · MW</small></div>;
 if(index===1)return <div className={v.utilization}><div className={v.scale}><span style={{width:`${metrics.availablePowerMW/metrics.ratedPowerMW*100}%`}}/></div><div className={v.endpoints}><span>0 MW</span><b>{formatNumber(metrics.availablePowerMW/metrics.ratedPowerMW*100)}% of rated</b><span>{formatNumber(metrics.ratedPowerMW)} MW</span></div></div>;
 if(index===2)return <div className={v.connections}><svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="22" fill="none" stroke="#2a4358" strokeWidth="5"/><circle cx="28" cy="28" r="22" fill="none" stroke="#77cbdc" strokeWidth="5" pathLength="100" strokeDasharray={`${metrics.connectedAssets/total*100} 100`} transform="rotate(-90 28 28)"/><path d="M20 28h16m-8-8v16" stroke="#a4d1e0"/></svg><div><strong>{formatNumber(metrics.connectedAssets/total*100)}% connected</strong><small>Registered mix</small><p>{metrics.composition.map((type,i)=>`${['EV','Home','BESS'][i]} ${assets.filter(asset=>asset.type===type.value).length.toLocaleString('en-US')}`).join(' · ')}</p></div></div>;
 if(index===3)return <div className={v.soc}><div className={v.battery} aria-hidden="true"><span style={{width:`${metrics.averageSocPct}%`}}/><i/></div><div className={v.endpoints}><span>0%</span><small>Energy-capacity weighted</small><span>100%</span></div></div>;
 if(index===4)return <div className={v.market}><div className={v.priceRange} aria-hidden="true">{price!==null&&<i style={{left:`${(price-marketRange.minimum)/(marketRange.maximum-marketRange.minimum)*100}%`}}/>}</div><div className={v.endpoints}><span>{formatNumber(marketRange.minimum)}</span><small>Synthetic day range</small><span>{formatNumber(marketRange.maximum)}</span></div><small>{price===null?'Scenario complete · no current price':'Marker = current fixture price'} · USD/MWh</small></div>;
 return <div className={v.reference}><span>REFERENCE FIXTURE</span><small>Illustrative daily value</small><p>Actual allocations remain in Settlement.</p></div>;
}
