'use client';

import { useDemo } from '../_state/DemoProvider';
import { simulationLabel, simulationTimestamp, TOTAL_INTERVALS } from '@/lib/vpp/simulation';
import s from '../assets.module.css';

export function SimulationClock() {
  const { state, dispatch } = useDemo();
  const complete = state.step === TOTAL_INTERVALS;
  return <section className={s.clock} aria-label="Simulation clock">
    <div><span className={s.caption}>SIMULATION CLOCK · {complete ? 'COMPLETE' : state.running ? 'RUNNING' : 'PAUSED'}</span>
      <time dateTime={simulationTimestamp(state.step)}>{simulationLabel(state.step)}</time>
      <small>Interval {state.step} / {TOTAL_INTERVALS} · time-only playback · 15 minutes per step</small>
    </div>
    <div className={s.controls}>
      <button onClick={() => dispatch({ type: state.running ? 'pause' : 'start' })} disabled={complete}>{state.running ? 'Pause' : 'Start'}</button>
      <button onClick={() => dispatch({ type: 'step' })} disabled={state.running || complete}>Step +15 min</button>
      <button onClick={() => dispatch({ type: 'reset' })}>Reset demo</button>
      <small>Playback: every 2 seconds, no dispatch. Reset clears edits and history.</small>
    </div>
  </section>;
}
