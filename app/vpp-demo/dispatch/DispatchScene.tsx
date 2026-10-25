import { memo, useMemo, useState } from 'react';
import type { DispatchInterval } from '@/lib/vpp/simulation';
import { simulationLabel } from '@/lib/vpp/simulation';
import { formatEnergy, formatNumber, formatPower } from '@/lib/vpp/units';
import { DispatchSceneSvg } from './DispatchSceneSvg';
import type { RecordedFlowView } from './DispatchSceneSvg';
import d from './dispatch.module.css';

/** Read-only recorded-flow renderer. The editable command never drives animation. */
export const DispatchScene = memo(function DispatchScene({ latest, soc, socLabel }: { latest?: DispatchInterval; soc: number; socLabel: string }) {
  const [replay, setReplay] = useState(0);
  const active = !!latest && latest.acceptedPowerMW > 0 && latest.request.command !== 'idle' && latest.status !== 'rejected';
  const mode = latest?.request.command ?? 'idle';
  const context = latest?.request.assetId === null ? 'fleet' : 'record';
  const flow = useMemo<RecordedFlowView>(() => ({ mode, active, replayKey: `${latest?.timestamp}-${replay}` }), [mode,active,latest?.timestamp,replay]);
  return <section className={d.scene} data-mode={mode} aria-label="Recorded energy dispatch">
    <header><div><span className={d.overline}>02 / ENERGY TRANSFER</span><h2>Power in motion.</h2></div><span className={d.stateTag}>{latest ? `${mode.toUpperCase()} · RECORDED` : 'AWAITING EXECUTION'}</span></header>
    <div className={d.diagram}>
      <DispatchSceneSvg flow={flow}/>
      <div className={d.transfer}><small>RECORDED ACCEPTED AC</small><strong>{latest ? formatPower(latest.acceptedPowerMW,context) : '—'}</strong><span>{active ? mode === 'charge' ? 'GRID → STORAGE' : 'STORAGE → GRID' : 'NO TRANSFER'}</span></div>
    </div>
    <div className={d.socBlock}><div><span className={d.overline}>CURRENT STORED ENERGY</span><h3>{socLabel}</h3><p>Current snapshot · not an animated SOC estimate</p></div><strong>{formatNumber(soc)}<small>%</small></strong><div className={d.battery} role="img" aria-label={`${socLabel}: ${formatNumber(soc)} percent`}><span style={{width:`${soc}%`}}/></div><div className={d.scale}><span>0%</span><span>State of charge</span><span>100%</span></div></div>
    <footer><div><strong>{latest ? `RECORDED INTERVAL · ${simulationLabel(latest.step)}` : 'READY FOR YOUR FIRST COMMAND'}</strong><p>{latest ? `${latest.request.assetId ?? 'Entire fleet'} · ${latest.status} · ${formatEnergy(latest.acEnergyMWh,context)} signed AC energy` : 'Configure and confirm a paused 15-minute interval.'}</p><p>Illustrative topology. Finite recorded replay only; no live telemetry.</p></div><button type="button" disabled={!active} onClick={()=>setReplay(value=>value+1)}>Replay recorded flow ↻</button></footer>
  </section>;
});
