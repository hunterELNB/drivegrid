import { memo } from 'react';
import { formatEnergy, formatNumber, formatPower } from '@/lib/vpp/units';
import { EquipmentGraphic } from '../_components/NetworkEquipment';
import type { OwnerAssetView } from './presentation';
import c from './owner.module.css';

/** Replaceable equipment boundary; labels and SOC remain outside the renderer. */
export const OwnerEquipmentView=memo(function OwnerEquipmentView({kind}:{kind:OwnerAssetView['kind']}){
  return <div className={c.equipmentScene}><EquipmentGraphic kind={kind}/></div>;
});
export const OwnerAssetCard=memo(function OwnerAssetCard({asset,priceLabel}:{asset:OwnerAssetView;priceLabel:string}){
  return <section className={c.assetCard} aria-label="Selected EV overview"><header><span className={c.eyebrow}>MY SELECTED ENERGY ASSET</span><span className={c.assetType}>{asset.typeLabel}</span></header><div className={c.assetIdentity}><h2>{asset.name}</h2><p>{asset.id} · {asset.location}</p></div><OwnerEquipmentView kind={asset.kind}/><p className={c.illustrationCaption}>Representative equipment illustration</p><div className={c.battery}><div className={c.batteryHeading}><div><span>Battery state of charge</span><strong>{formatNumber(asset.socPct)}<small>%</small></strong></div><span className={c.snapshot}>Current simulated snapshot</span></div><div className={c.batteryTrack} role="meter" aria-label={`${asset.name} battery state of charge`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={asset.socPct} aria-valuetext={`${formatNumber(asset.socPct)} percent`}><i style={{width:`${asset.socPct}%`}}/><b style={{left:`${asset.minSocPct}%`}}/></div><div className={c.batteryScale}><span>0%</span><span>Equipment minimum {formatNumber(asset.minSocPct)}%</span><span>100%</span></div></div><div className={c.statusRow}><span data-state={asset.availability}>Availability: {asset.availability}</span><span>Status: {asset.status}</span>{asset.v2gEnabled&&<span>V2G enabled</span>}</div><dl className={c.assetSpecs}><div><dt>Equipment rating</dt><dd>{formatPower(asset.ratedPowerMW,'record')}</dd></div><div><dt>Battery capacity</dt><dd>{formatEnergy(asset.energyCapacityMWh,'record')}</dd></div><div><dt>Current synthetic market price</dt><dd>{priceLabel}</dd></div></dl><p className={c.assetNote}>Availability and status are the existing asset fields, not a guarantee of dispatch. Participation is recorded only when a simulated interval is executed.</p></section>;
});
