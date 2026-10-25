import { formatNumber } from '@/lib/vpp/units';
import { hourly } from '@/lib/vpp/fixtures';
import s from '../demo.module.css';
import c from '../dashboard.module.css';
export function TimeSeriesChart({ kind }: { kind: 'price' | 'dispatch' }) {
  const isPrice = kind === 'price';
  const max = isPrice ? 160 : 16;
  const unit = isPrice ? '$/MWh' : 'MW';
  const color = isPrice ? '#5b9cff' : '#39d5d0';
  const x = (hour: number) => 52 + hour / 23 * 570;
  const y = (value: number) => 205 - value / max * 168;
  const points = hourly.map(p => `${x(p.hour)},${y(p[kind])}`).join(' ');
  return <><div className={c.chartViewport} role="region" tabIndex={0} aria-label={`${isPrice?'Price':'Power'} reference chart · scroll horizontally on small screens`}><svg className={c.chart} viewBox="0 0 650 252" role="img" aria-labelledby={`${kind}-title ${kind}-description`}>
    <title id={`${kind}-title`}>{`24-hour simulated ${isPrice ? 'electricity price' : 'dispatch power'}`}</title>
    <desc id={`${kind}-description`}>Hourly samples from 00:00 to 23:00 Central Time, measured in {unit}. Expand the data table for exact values.</desc>
    <defs><linearGradient id={`${kind}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".3"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs><text x="12" y="17" className={c.chartLabel}>{unit}</text>
    {[0,1,2,3,4].map(i => <g key={i}><line x1="52" x2="622" y1={y(i * max / 4)} y2={y(i * max / 4)} stroke="#263e57" strokeDasharray="2 6"/><text x="40" y={y(i * max / 4) + 4} textAnchor="end" className={c.chartLabel}>{i * max / 4}</text></g>)}
    {isPrice ? <><polygon points={`52,205 ${points} 622,205`} fill={`url(#${kind}-area)`}/><polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round"/>{hourly.map(p => <circle key={p.hour} cx={x(p.hour)} cy={y(p.price)} r="3" fill={color}><title>{`${String(p.hour).padStart(2,'0')}:00 · $${formatNumber(p.price)}/MWh`}</title></circle>)}</> : hourly.map(p => <rect key={p.hour} x={x(p.hour)-6} y={y(p.dispatch)} width="12" height={205-y(p.dispatch)} rx="3" fill={color} opacity=".85"><title>{`${String(p.hour).padStart(2,'0')}:00 · ${formatNumber(p.dispatch)} MW`}</title></rect>)}
    {[0,4,8,12,16,20,23].map(h => <text key={h} x={x(h)} y="228" textAnchor="middle" className={c.chartLabel}>{String(h).padStart(2,'0')}:00</text>)}
    <text x="337" y="249" textAnchor="middle" className={c.chartLabel}>Hour of day · Central Time</text>
  </svg></div><details className={s.dataDetails}><summary>View hourly data</summary><div className={s.tableWrap}><table><caption>Simulated {isPrice ? 'electricity price' : 'dispatch power'} · 23 Oct 2026</caption><thead><tr><th scope="col">Time (CT)</th><th scope="col">{unit}</th></tr></thead><tbody>{hourly.map(p => <tr key={p.hour}><th scope="row">{String(p.hour).padStart(2,'0')}:00</th><td>{formatNumber(p[kind])}</td></tr>)}</tbody></table></div></details></>;
}

