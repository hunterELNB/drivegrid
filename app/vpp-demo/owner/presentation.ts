import type { DERAsset } from '@/lib/vpp/domain';

export interface OwnerAssetView {
  readonly id:string;readonly name:string;readonly location:string;
  readonly kind:'ev'|'home'|'bess';readonly typeLabel:string;
  readonly socPct:number;readonly minSocPct:number;readonly maxSocPct:number;
  readonly ratedPowerMW:number;readonly energyCapacityMWh:number;
  readonly status:string;readonly availability:string;readonly v2gEnabled:boolean;
}
/** Presentation selection only; this does not create owner/asset associations. */
export function ownerAssetView(asset:DERAsset):OwnerAssetView {
  return {id:asset.id,name:asset.name,location:asset.location,
    kind:asset.type==='ev-v2g'?'ev':asset.type==='residential-battery'?'home':'bess',
    typeLabel:asset.type==='ev-v2g'?'EV / V2G':asset.type==='residential-battery'?'Residential battery':'Commercial BESS',
    socPct:asset.socPct,minSocPct:asset.minSocPct,maxSocPct:asset.maxSocPct,
    ratedPowerMW:asset.ratedPowerMW,energyCapacityMWh:asset.energyCapacityMWh,
    status:asset.status,availability:asset.availability,v2gEnabled:asset.v2gEnabled};
}
export type OwnerDisplayCard=readonly [label:string,value:string];
