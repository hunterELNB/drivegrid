'use client';

import Link from 'next/link';
import { formatEnergy, formatPower, formatUSD } from '@/lib/vpp/units';
import { simulationLabel } from '@/lib/vpp/simulation';
import { useDemo } from '../_state/DemoProvider';
import { Panel } from './Panel';
import s from '../demo.module.css';

export function DispatchActivity() {
  const { state } = useDemo();
  const latest = state.history.at(-1);
  return <div style={{ marginBottom: 22 }}><Panel title="Simulated dispatch activity" subtitle="Executed results from shared simulation state · AC export positive, import negative">
    <p className={s.footnote}>{latest ? `Latest status: ${latest.status.toUpperCase()} · ${latest.source} · ${latest.request.command} · ${formatPower(latest.acceptedPowerMW,'fleet')} accepted · ${formatEnergy(latest.acEnergyMWh,'fleet')} grid energy` : 'No dispatch executed. Clock advancement alone sends no dispatch.'} <Link href="/vpp-demo/dispatch" style={{color:'#91bdf4'}}>Open Dispatch →</Link></p>
    <ol className={s.events}>{state.history.slice(-5).toReversed().map(item => <li key={item.timestamp}>
      <time dateTime={item.timestamp}>{simulationLabel(item.step)}</time><span className={s.eventMarker}/>
      <div><h3>{item.source.toUpperCase()} · {item.request.command.toUpperCase()} · {item.status}</h3><p>{formatPower(item.acceptedPowerMW,'fleet')} accepted · {formatEnergy(item.acEnergyMWh,'fleet')} grid energy · {formatUSD(item.grossEnergyValueUSD)} gross energy value · {item.reasons.join('; ') || 'Within power and SOC limits'}</p></div>
    </li>)}</ol>
  </Panel></div>;
}
