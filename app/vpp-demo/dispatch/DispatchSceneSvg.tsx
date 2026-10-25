import { memo } from 'react';
import { Equipment } from '../_components/NetworkEquipment';
import d from './dispatch.module.css';

/** Presentation-only renderer contract. No assets, reducer or dispatch calculations. */
export interface RecordedFlowView {
  readonly mode: 'charge' | 'discharge' | 'idle';
  readonly active: boolean;
  readonly replayKey: string;
}

/** Default renderer and future GLB scene replacement boundary; retain SVG fallback. */
export const DispatchSceneSvg = memo(function DispatchSceneSvg({ flow }: { flow: RecordedFlowView }) {
  const { mode, active, replayKey } = flow;
  return <svg viewBox="0 0 800 340" role="img" aria-label={`Electrical grid and aggregate storage schematic. ${active ? mode === 'charge' ? 'Recorded flow from grid to storage.' : 'Recorded flow from storage to grid.' : 'No directional energy transfer.'}`}>
    <path d="M265 218H550" className={d.conduit}/><path d="M265 230H550" className={d.conduit}/>
    {active && <g key={replayKey} className={`${d.flow} ${mode === 'discharge' ? d.reverse : ''}`}><path d="M275 224H540"/><path d={mode === 'charge' ? 'm406 214 12 10-12 10' : 'm418 214-12 10 12 10'} className={d.arrow}/></g>}
    <g transform="translate(18 48) scale(.95)"><Equipment kind="grid"/></g>
    <g transform="translate(493 69) scale(.95)"><Equipment kind="bess"/></g>
    <text x="155" y="306" textAnchor="middle">ELECTRICAL GRID</text><text x="637" y="306" textAnchor="middle">AGGREGATE STORAGE</text>
  </svg>;
});
