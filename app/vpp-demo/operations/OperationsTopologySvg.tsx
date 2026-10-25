import { memo, useId } from 'react';
import { Equipment } from '../_components/NetworkEquipment';
import c from './operations.module.css';

export interface OperationsResourceView {
  readonly id: string;
  readonly label: string;
  readonly kind: 'ev' | 'home' | 'bess';
  readonly count: number;
  readonly available: number;
  readonly online: number;
  readonly offline: number;
}

/** Replaceable equipment renderer: static schematic only; no business-state access. */
export const OperationsTopologySvg = memo(function OperationsTopologySvg({ resources }: { resources: readonly OperationsResourceView[] }) {
  const id=useId();
  return <><svg className={c.topologySvg} viewBox="0 0 1200 280" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
    <title id={`${id}-title`}>Simulated operations equipment topology</title><desc id={`${id}-desc`}>An illustrated grid interface and three registered resource categories. Lines show schematic organization only, not live connectivity or energy flow. Current category counts are provided below.</desc>
    <defs><pattern id={`${id}-grid`} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#6aa1b2" strokeWidth=".5"/></pattern></defs>
    <rect width="1200" height="280" fill={`url(#${id}-grid)`} opacity=".11"/>
    <path d="M164 70V34H1058M452 34v39M755 34v39M1058 34v39" fill="none" stroke="#47768b" strokeWidth="1.5" strokeDasharray="4 6"/>
    <g transform="translate(37 55) scale(.78)"><Equipment kind="grid"/></g>
    {resources.map((resource,index)=><g key={resource.id} transform={`translate(${[335,638,941][index]} 66) scale(.75)`}><Equipment kind={resource.kind}/></g>)}
    <g fill="#aecbd9" fontSize="11" letterSpacing="1.4"><text x="156" y="262" textAnchor="middle">ILLUSTRATED GRID INTERFACE</text>{resources.map((resource,index)=><text key={resource.id} x={[450,753,1056][index]} y="262" textAnchor="middle">{resource.label.toUpperCase()}</text>)}</g>
  </svg><svg className={c.topologyMobile} viewBox="0 0 640 470" role="img" aria-labelledby={`${id}-mobile-title ${id}-mobile-desc`}>
    <title id={`${id}-mobile-title`}>Simulated operations equipment topology</title><desc id={`${id}-mobile-desc`}>Static grid, EV, residential and commercial storage illustrations. Schematic connections are not live energy flows. Current status counts are listed below.</desc>
    <path d="M165 110h310M165 110v230h310V110" fill="none" stroke="#47768b" strokeWidth="1.5" strokeDasharray="4 6" opacity=".5"/>
    <g transform="translate(30 18) scale(.85)"><Equipment kind="grid"/></g>
    {resources.map((resource,index)=><g key={resource.id} transform={`translate(${[350,30,350][index]} ${[18,248,248][index]}) scale(.85)`}><Equipment kind={resource.kind}/></g>)}
    <g fill="#b6d3df" fontSize="12" letterSpacing="1"><text x="160" y="220" textAnchor="middle">GRID INTERFACE</text>{resources.map((resource,index)=><text key={resource.id} x={[480,160,480][index]} y={[220,450,450][index]} textAnchor="middle">{resource.label.toUpperCase()}</text>)}</g>
  </svg></>;
});
