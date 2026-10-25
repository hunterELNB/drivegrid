import Link from 'next/link';
import s from './DemoGuide.module.css';

export function DemoGuide(){
  return <details className={s.guide}>
    <summary>New here? Start with a simulated dispatch</summary>
    <p>Explore how 1,150 EVs and batteries can act as a virtual power plant. All data is synthetic; there are no real devices, ERCOT connections or payments. Your simulation is held in this page session and is not saved.</p>
    <p>Start in <Link href="/vpp-demo/dispatch">Dispatch</Link>: keep the default 1 MW discharge, confirm the interval, then Execute. Review the results in Settlement and Analytics. Start/Step on the clock only advances time; it does not dispatch.</p>
    <ul>
      <li>Assets: inspect and edit the portfolio. Market: preview synthetic price-based decisions.</li>
      <li>Settlement and EV Owner Portal: inspect illustrative allocations. Analytics: filter recorded performance.</li>
      <li>Scenarios: compare isolated strategies. Operations: simulate connectivity, health and alerts.</li>
    </ul>
    <p>Reset demo clears main edits, history, monitoring and scenario views. Operations Reset restores monitoring only; Reset scenarios clears only that lab. Refresh starts a clean simulation.</p>
  </details>;
}
