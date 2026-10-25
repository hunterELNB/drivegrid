export type HourlySample = { hour: number; price: number; dispatch: number };
export type PortfolioSegment = { name: string; capacityMW: number; color: string };
export const snapshot = { date: '2026-10-23', timezone: 'America/Chicago', label: '23 Oct 2026 · Central Time' } as const;
export const navigation = [
  { slug: '', label: 'Dashboard', symbol: '◫' },
  { slug: 'assets', label: 'Assets', symbol: '▦' },
  { slug: 'dispatch', label: 'Dispatch', symbol: '↗' },
  { slug: 'market', label: 'Market', symbol: '⌁' },
  { slug: 'settlement', label: 'Settlement', symbol: '≡' },
  { slug: 'owner', label: 'EV Owner Portal', symbol: '⊕' },
  { slug: 'scenarios', label: 'Scenarios', symbol: '◇' },
  { slug: 'operations', label: 'Operations', symbol: '☷' },
  { slug: 'analytics', label: 'Analytics', symbol: '▥' },
] as const;
export const kpis = [
  { label: 'Total Portfolio Capacity', value: '20', unit: 'MW', note: 'Aggregated nameplate capacity' },
  { label: 'Available Dispatch Power', value: '12', unit: 'MW', note: 'Illustrative dispatch availability' },
  { label: 'Connected Assets', value: '1,150', unit: '', note: 'Across the simulated portfolio' },
  { label: 'Average Battery SOC', value: '68', unit: '%', note: 'Illustrative state of charge' },
  { label: 'Simulated Market Price', value: '$85', unit: '/MWh', note: 'Illustrative market snapshot' },
  { label: 'Simulated Daily Revenue', value: '$4,280', unit: '', note: 'Fixture value · not a settlement' },
] as const;
const prices = [42,38,35,32,34,41,53,67,72,65,58,52,48,56,74,96,124,142,118,101,85,70,58,47];
const dispatch = [1,1,0,0,0,1,3,5,6,4,3,2,2,4,7,10,12,12,11,9,7,5,3,2];
export const hourly: readonly HourlySample[] = prices.map((price, hour) => ({ hour, price, dispatch: dispatch[hour] }));
export const portfolio: readonly PortfolioSegment[] = [
  { name: 'Battery storage', capacityMW: 9, color: '#5b9cff' },
  { name: 'Electric vehicles', capacityMW: 6, color: '#39d5d0' },
  { name: 'Solar generation', capacityMW: 3, color: '#8d8bfa' },
  { name: 'Flexible loads', capacityMW: 2, color: '#52d49a' },
];
export const assetStatuses = [
  { label: 'Available', count: 978, color: '#52d49a' },
  { label: 'Standby', count: 138, color: '#5b9cff' },
  { label: 'Offline', count: 34, color: '#f2bc72' },
] as const;
export const events = [
  { time: '14:32', title: 'Portfolio snapshot refreshed', detail: '1,150 simulated assets synchronized', category: 'Portfolio' },
  { time: '14:20', title: 'Dispatch schedule loaded', detail: 'Reference profile · 12 MW peak', category: 'Dispatch' },
  { time: '14:05', title: 'Market fixture published', detail: 'ERCOT demonstration price series', category: 'Market' },
  { time: '13:48', title: 'Scenario initialized', detail: 'Baseline weekday · deterministic dataset', category: 'Scenario' },
] as const;
