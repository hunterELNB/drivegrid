'use client';
import { PrecisionInput } from '../_components/PrecisionInput';

import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { assetTypes, availableDispatchMW, filterAssets, operationalStatuses, portfolioMetrics, validAssetUpdate } from '@/lib/vpp/domain';
import type { AssetFilters, Availability, DERAsset, OperationalStatus } from '@/lib/vpp/domain';
import { useDemo } from '../_state/DemoProvider';
import { Panel } from '../_components/Panel';
import s from '../demo.module.css';
import a from '../assets.module.css';
import f from './fleet.module.css';
import { AssetGlyph, FleetOverview, SocGauge } from './FleetOverview';
import { EquipmentGraphic } from '../_components/NetworkEquipment';

const PAGE_SIZE = 20;
const initialFilters: AssetFilters = { search: '', type: 'all', status: 'all', availability: 'all' };
import { formatPower, formatEnergy, formatNumber } from '@/lib/vpp/units';

export default function AssetsPage() {
  const { state, dispatch } = useDemo();
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(state.assets[0].id);
  const [message, setMessage] = useState({ text: '', resetVersion: 0 });
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const selected = state.assets.find(asset => asset.id === selectedId)!;
  const filtered = filterAssets(state.assets, filters);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const metrics = useMemo(()=>portfolioMetrics(state.assets),[state.assets]);

  function changeFilter<K extends keyof AssetFilters>(key: K, value: AssetFilters[K]) {
    setFilters(previous => ({ ...previous, [key]: value }));
    setPage(1);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const update = {
      socPct: Number(data.get('soc')),
      availability: data.get('availability') as Availability,
      status: data.get('status') as OperationalStatus,
    };
    if(!validAssetUpdate(selected,update)){setMessage({text:'Use an SOC within the displayed limits and a valid status/availability.',resetVersion:state.resetVersion});return;}
    dispatch({type:'update-asset',id:selectedId,update});
    setMessage({ text: `Saved simulated changes for ${selected.name}. Dashboard metrics updated.`, resetVersion: state.resetVersion });
  }

  return <div className={f.fleetPage}>
    <div className={f.hero}><div><p className={s.eyebrow}>DRIVEGRID / DISTRIBUTED ENERGY RESOURCES</p><h1>Distributed Energy Asset Fleet</h1><p>Inspect, understand and configure your simulated energy portfolio.</p></div><div className={f.heroTag}>FLEET MANAGEMENT<span>SIMULATED ASSETS · NO LIVE DEVICES</span></div></div>
    <div className={s.notice}>SIMULATED ASSETS <span>Changes affect this browser session only. No device commands are sent.</span></div>
    <section className={`${a.summary} ${f.totals}`} aria-label="Asset portfolio totals">
      <div><small>Registered assets</small><strong>{state.assets.length.toLocaleString('en-US')}</strong></div>
      <div><small>Rated power</small><strong>{formatNumber(metrics.ratedPowerMW)} MW</strong></div>
      <div><small>Available dispatch</small><strong>{formatNumber(metrics.availablePowerMW)} MW</strong></div>
      <div><small>Energy capacity</small><strong>{formatNumber(metrics.energyCapacityMWh)} MWh</strong></div>
    </section>
    <FleetOverview assets={state.assets}/>
    <Panel title="Asset registry" subtitle="Select an asset to inspect ratings, SOC limits, and operational settings.">
      <div className={a.filters}>
        <label>Search assets<input type="search" maxLength={120} value={filters.search} placeholder="Name, ID, or city" onChange={e => changeFilter('search', e.target.value)}/></label>
        <label>Resource type<select value={filters.type} onChange={e => changeFilter('type', e.target.value as AssetFilters['type'])}><option value="all">All resource types</option>{assetTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label>Operational status<select value={filters.status} onChange={e => changeFilter('status', e.target.value as AssetFilters['status'])}><option value="all">All statuses</option>{operationalStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
        <label>Availability<select value={filters.availability} onChange={e => changeFilter('availability', e.target.value as AssetFilters['availability'])}><option value="all">All availability</option><option value="available">available</option><option value="unavailable">unavailable</option></select></label>
        <button onClick={() => { setFilters(initialFilters); setPage(1); }}>Clear filters</button>
      </div>
      <div className={a.registryScroll} tabIndex={0} role="region" aria-label="Scrollable asset table">
        <table className={a.registry}><caption>{filtered.length.toLocaleString('en-US')} matching assets · Individual equipment units shown in each cell</caption>
          <thead><tr><th scope="col">Asset / location</th><th scope="col">Status</th><th scope="col">Availability</th><th scope="col">Rated power</th><th scope="col">Available power</th><th scope="col">Energy capacity</th><th scope="col">SOC</th><th scope="col">Details</th></tr></thead>
          <tbody>{visible.map(asset => <tr key={asset.id} className={selectedId === asset.id ? a.selectedRow : undefined}>
            <th scope="row"><div className={f.assetIdentity}><AssetGlyph type={asset.type}/><div>{asset.name}<small>{asset.id} · {asset.location}</small></div></div></th>
            <td><span className={`${a.status} ${asset.status === 'ready' ? a.ready : a.inactive}`}>{asset.status}</span></td>
            <td><span key={asset.availability} className={f.availability} data-available={asset.availability === 'available'}>{asset.availability}</span></td><td>{formatPower(asset.ratedPowerMW, asset.type)}</td><td>{formatPower(availableDispatchMW(asset), asset.type)}</td><td>{formatEnergy(asset.energyCapacityMWh, asset.type)}</td><td><SocGauge value={asset.socPct} compact/></td>
            <td><button aria-label={`View ${asset.name}`} aria-controls="asset-detail" onClick={() => { setSelectedId(asset.id); setMessage({ text: '', resetVersion: state.resetVersion }); detailHeading.current?.focus(); }}>View</button></td>
          </tr>)}</tbody>
        </table>
        {visible.length === 0 && <p className={a.empty}>No assets match these filters. Clear filters to restore the registry.</p>}
      </div>
      <div className={a.pagination}><span>Page {currentPage} of {pageCount}</span><div><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
    </Panel>
    <section id="asset-detail" className={a.detail} aria-label="Asset details">
      <div className={a.detailHeading}><div><p className={s.eyebrow}>SELECTED ASSET</p><h2 ref={detailHeading} tabIndex={-1}>{selected.name}</h2><p>{selected.id} · {selected.location}</p></div><span className={s.badge}>SIMULATED</span></div>
      {!filtered.some(asset => asset.id === selected.id) && <p className={a.help}>The selected asset is outside your current filters.</p>}
      <div className={f.detailVisual}><div className={f.detailEquipment}><EquipmentGraphic kind={selected.type === 'ev-v2g' ? 'ev' : selected.type === 'residential-battery' ? 'home' : 'bess'}/></div><div className={f.detailSnapshot}><span className={f.eyebrow}>CURRENT ASSET SNAPSHOT</span><div className={f.detailStatuses}><span key={selected.status} className={f.availability} data-available={selected.status === 'ready'}>{selected.status}</span><span key={selected.availability} className={f.availability} data-available={selected.availability === 'available'}>{selected.availability}</span></div><p>Battery state of charge</p><SocGauge value={selected.socPct}/><small>Existing stored SOC · changes apply only after saving</small></div></div>
      <AssetRatings asset={selected}/>
      <form key={`${state.resetVersion}-${selected.id}-${selected.socPct}-${selected.status}-${selected.availability}`} className={a.editForm} onSubmit={save}>
        <label>SOC (%)<PrecisionInput name="soc" step="any" min={selected.minSocPct} max={selected.maxSocPct} defaultValue={selected.socPct} required/><small>Allowed range: {formatNumber(selected.minSocPct)}–{formatNumber(selected.maxSocPct)}% · focus for exact value</small></label>
        <label>Availability<select name="availability" defaultValue={selected.availability}><option value="available">available</option><option value="unavailable">unavailable</option></select></label>
        <label>Operational status<select name="status" defaultValue={selected.status}>{operationalStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
        <button type="submit">Save simulated changes</button>
      </form>
      <p className={a.help}>Dispatch requires available + ready status, SOC above the minimum, and V2G enabled for EVs. Available power is sustainable for 15 minutes at 95% discharge efficiency. Manual dispatch changes SOC; clock playback alone does not.</p>
    </section>
    <p role="status" className={a.feedback}>{message.resetVersion === state.resetVersion ? message.text : ''}</p>
  </div>;
}

function AssetRatings({ asset }: { asset: DERAsset }) {
  const ratings = [
    ['Rated power', formatPower(asset.ratedPowerMW, asset.type)],
    ['Available dispatch', formatPower(availableDispatchMW(asset), asset.type)],
    ['Energy capacity', formatEnergy(asset.energyCapacityMWh, asset.type)],
    ['Max charging power', formatPower(asset.maxChargingPowerMW, asset.type)],
    ['Max discharging power', formatPower(asset.maxDischargingPowerMW, asset.type)],
    ['SOC limits', `${formatNumber(asset.minSocPct)}–${formatNumber(asset.maxSocPct)}%`],
    ['V2G enabled', asset.type === 'ev-v2g' ? asset.v2gEnabled ? 'Yes' : 'No' : 'Not applicable'],
  ];
  return <dl className={a.ratings}>{ratings.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}


