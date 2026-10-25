'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { initialScenarioControls, runScenario, scenarioPresets, validateScenario } from '@/lib/vpp/scenarios';
import type { ScenarioConfig, ScenarioResult as EngineScenarioResult } from '@/lib/vpp/scenarios';
import { formatEnergy, formatNumber, formatPower, formatUSD } from '@/lib/vpp/units';
import { portfolioMetrics } from '@/lib/vpp/domain';
import { DEFAULT_TERMINAL_SETTINGS, validateTerminalSettings } from '@/lib/vpp/terminal-energy';
import type { TerminalSettings } from '@/lib/vpp/terminal-energy';
import { useDemo } from '../_state/DemoProvider';
import { Panel } from '../_components/Panel';
import { PrecisionInput } from '../_components/PrecisionInput';
import { StrategyCards, StrategyPriceBand } from './StrategySelection';
import { ScenarioResultOverview, ScenarioComparisonVisuals } from './ScenarioIntelligence';
import { ScenarioTimeline } from './ScenarioTimeline';
import s from '../demo.module.css';
import a from '../assets.module.css';
import c from './scenarios.module.css';
type ScenarioResult=Omit<EngineScenarioResult,'name'>&{name:string};

export default function ScenariosPage(){
  const {state}=useDemo();
  return <ScenarioWorkspace key={state.resetVersion}/>;
}
function ScenarioWorkspace(){
  const {state}=useDemo();
  const [controls,setControls]=useState(initialScenarioControls);
  const [results,setResults]=useState<ScenarioResult[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [formVersion,setFormVersion]=useState(0);
  const [targetMode,setTargetMode]=useState('initial');
  const initialSocPct=portfolioMetrics(state.assets).averageSocPct;
  const preset=scenarioPresets.find(p=>p.id===controls.presetId)!;
  function selectPreset(id:string){const p=scenarioPresets.find(p=>p.id===id)!;setControls({presetId:p.id,config:{...p.config}});setError('');}
  function run(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const action=(event.nativeEvent as SubmitEvent).submitter?.getAttribute('value')??'run';
    const requiredTerminalFields=targetMode==='custom'?['terminalPrice','terminalTarget','terminalTolerance']:['terminalPrice','terminalTolerance'];
    if(requiredTerminalFields.some(key=>String(form.get(key)??'').trim()==='')){setError('Complete the terminal comparison assumptions.');return;}
    const config=Object.fromEntries(Object.keys(controls.config).map(key=>[key,Number(form.get(key))])) as unknown as ScenarioConfig;
    const terminal:TerminalSettings={referencePriceUSDPerMWh:Number(form.get('terminalPrice')),targetSocPct:targetMode==='initial'?null:Number(form.get('terminalTarget')),tolerancePct:Number(form.get('terminalTolerance'))};
    const invalid=(action==='run'?validateScenario(config):null)||validateTerminalSettings(terminal);
    if(invalid){setError(invalid);return;}
    if(action==='run')setControls({...controls,config});
    execute(action,config,terminal);
  }
  function execute(action:string,config:ScenarioConfig,terminal:TerminalSettings){
    // Copy synchronously before scheduling so every comparison uses the same snapshot.
    const assets=state.assets.map(asset=>({...asset}));
    const commercial={...state.commercialSettings};
    setBusy(true);setError('');
    window.setTimeout(()=>{
      try{
        const completed=action==='compare'
          ?scenarioPresets.map(p=>runScenario(p.id,{...p.config},assets,commercial,terminal))
          :action==='reference'
            ?([{label:'Strategy A · 50 / 300',charge:50,discharge:300},{label:'Strategy B · 10 / 100',charge:10,discharge:100}]).map(strategy=>({...runScenario('base',{...scenarioPresets[0].config,chargeThresholdUSDPerMWh:strategy.charge,dischargeThresholdUSDPerMWh:strategy.discharge},assets,commercial,terminal),name:strategy.label}))
            :[runScenario(controls.presetId,config,assets,commercial,terminal)];
        setResults(completed);
      }
      catch{setError('The scenario could not be calculated. Check the assumptions and try again, or reset scenarios.');}
      finally{setBusy(false);}
    },30);
  }
  return <div className={c.scenariosPage} aria-busy={busy}>
    <header className={c.hero}><div><p className={c.overline}>DRIVEGRID / ISOLATED STRATEGY LAB</p><h1>Strategy Intelligence</h1><p>Test the strategy. Trace the economics. Compare the assumptions.</p></div><div className={c.heroContext}><span>HYPOTHETICAL SIMULATION</span><strong>23 Oct 2026 · isolated day</strong><small>15-minute intervals · {results.length?`${results.length} captured results`:'No captured results'}<br/>Selected: {preset.name}</small></div></header>
    <div className={s.notice}>SYNTHETIC & ILLUSTRATIVE <span>No ERCOT forecasts. Scenario results never alter the main clock, assets, history or commercial configuration.</span></div>
    <div className={c.chapter}><div><span className={c.overline}>01 / STRATEGY DESIGN</span><h2>Six perspectives. One disciplined experiment.</h2><p>Choose a documented preset, then inspect or edit its existing parameters.</p></div><span className={c.contextTag}>96 INTERVALS IN EACH PRESET</span></div>
    <StrategyCards presets={scenarioPresets} selected={controls.presetId} busy={busy} onSelect={selectPreset}/>
    <Panel title="Scenario configuration" subtitle="Run your selected configuration, or compare all six documented presets">
      <div className={c.body}>
        <label className={c.selector}>Scenario preset<select disabled={busy} value={controls.presetId} onChange={e=>selectPreset(e.target.value)}>{scenarioPresets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <p className={c.help}>{preset.description}</p>
        <StrategyPriceBand config={controls.config}/>
        <form key={formVersion} onSubmit={run}>
          <fieldset disabled={busy} className={c.fieldset}><div key={controls.presetId} className={a.filters}>
            {([
              ['chargeThresholdUSDPerMWh','Charge below (USD/MWh)'],['dischargeThresholdUSDPerMWh','Discharge above (USD/MWh)'],
              ['requestedFleetPowerMW','Target fleet power (MW)'],['reserveSocPct','Minimum SOC reserve (%)'],
              ['capacityMultiplier','Storage capacity multiplier'],['intervals','15-minute intervals'],
            ] as const).map(([key,label])=><label key={key}>{label}<PrecisionInput name={key} defaultValue={controls.config[key]} required/></label>)}
          </div>
          <h3 className={c.subheading}>Common terminal comparison assumptions</h3>
          <div className={a.filters}>
            <label>Terminal reference price (USD/MWh)<PrecisionInput name="terminalPrice" defaultValue={DEFAULT_TERMINAL_SETTINGS.referencePriceUSDPerMWh} required/></label>
            <label>Terminal SOC target basis<select value={targetMode} onChange={e=>setTargetMode(e.target.value)}><option value="initial">Initial weighted SOC</option><option value="custom">Custom target</option></select></label>
            {targetMode==='custom'?<label>Terminal SOC target (%)<PrecisionInput name="terminalTarget" defaultValue={initialSocPct} min={0} max={100} required/></label>:<p className={c.targetDefault}>Target: {formatNumber(initialSocPct)}% · current initial weighted SOC</p>}
            <label>Terminal SOC tolerance (percentage points)<PrecisionInput name="terminalTolerance" defaultValue={DEFAULT_TERMINAL_SETTINGS.tolerancePct} min={0} max={100} required/></label>
          </div>
          <div className={c.actions}><button type="submit" value="run">Run Scenario</button><button type="submit" value="compare" formNoValidate>Compare Scenarios</button><button type="submit" value="reference" formNoValidate>Compare Strategy A / B</button><button type="button" onClick={()=>{setControls(initialScenarioControls());setTargetMode('initial');setFormVersion(v=>v+1);setResults([]);setError('');}}>Reset scenarios</button></div></fieldset>
        </form>
        <p className={c.help}>Run uses your strategy controls. Compare Scenarios uses six preset defaults; Compare Strategy A / B uses the same Base Case defaults with thresholds 50/300 and 10/100. Both comparisons ignore custom strategy edits and apply the terminal assumptions above to one shared snapshot of current assets and commercial settings. Each independent day starts at 00:00 CT on 23 Oct 2026; existing dispatch history is excluded.</p>
        <p className={c.help}>Terminal adjustment = change in stored battery MWh × assumed reference price. Adjusted economic value = operating net + terminal adjustment. This comparison-only inventory valuation is not realized market revenue, guaranteed liquidation value or an owner/platform payout. It never enters settlement. The terminal target is assessed after dispatch; there is no terminal-aware scheduling or forced recharge.</p>
        <p className={c.help}>Reserve never relaxes equipment minimum SOC. Assets below the requested reserve may charge but cannot export until reserve is reached. Storage scaling changes MWh and initial stored energy at the same SOC, without increasing MW ratings. Decisions use strict thresholds; equality means idle. Target zero disables dispatch.</p>
        <p className={c.help}>Numeric fields show two decimals at rest; focus reveals the exact editable value. Saving retains full precision.</p>
        <p role="status" aria-live="polite">{busy?'Running isolated simulations…':results.length?`${results.length} completed scenario${results.length===1?'':'s'} · main simulation unchanged`:''}</p><p role="alert" className={c.error}>{error}</p>
      </div>
    </Panel>
    {!results.length?<div className={c.empty}><span aria-hidden="true">⌁</span><h2>A strategy becomes useful when its assumptions are visible.</h2><p>Select a strategy and run a simulation to explore energy, SOC and illustrative financial outcomes.</p><small>No scenario history has been generated. The main simulation remains independent.</small></div>:<>
      <ScenarioResultOverview results={results}/>
      <section className={c.section}><Panel title="Strategy comparison" subtitle="Captured results · rerun after changing main assets or commercial assumptions">
        <p className={c.help}>Cash earnings and inventory valuation are separate. No strategy ranking is assigned. A failed terminal constraint means the result is non-comparable under that constraint, even if operating earnings are higher. Passing SOC alone does not make different price profiles, capacities or initial inventories equivalent.</p>
        <ScenarioComparisonVisuals results={results}/>
        {results.length>1&&<p className={c.help}>Swipe or scroll horizontally to compare every strategy.</p>}<div className={a.registryScroll} tabIndex={0} role="region" aria-label="Scenario comparison results"><table className={`${a.registry} ${results.length>1?c.comparison:c.singleComparison}`}><thead><tr><th scope="col">Metric</th>{results.map((r,index)=><th scope="col" key={index}>{r.name}<strong className={r.terminal.comparable?c.constraintPass:c.constraintFail}>{constraintLabel(r)}</strong></th>)}</tr></thead>
          {comparisonGroups.map(group=><tbody key={group.label}><tr className={c.groupHeading}><th colSpan={results.length+1} scope="rowgroup">{group.label}</th></tr>{group.rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th>{results.map((r,index)=><td key={index}>{row.value(r)}</td>)}</tr>)}</tbody>)}
        </table></div>
        <p className={c.help}>Net = gross − QSE − transaction − degradation. Positive asset-interval net is split between owner and platform; deficits remain separate and are not netted against positive payouts. Every result reconciles in integer cents. Rejected/curtailed figures are unserved energy requests, counted once per interval.</p>
      </Panel></section>
      <div className={c.results}>{results.map((result,index)=><ResultChart key={index} result={result}/>)}</div>
    </>}
  </div>;
}
function constraintLabel(r:ScenarioResult):string {
  return r.terminal.status==='pass'?'PASS · within terminal SOC constraint':r.terminal.status==='fail'?'FAIL · non-comparable under terminal SOC constraint':'N/A · no storage capacity; non-comparable';
}
type ComparisonRow={label:string;value:(r:ScenarioResult)=>string};
const comparisonGroups:{label:string;rows:ComparisonRow[]}[]=[{label:'Realized simulated operating earnings · settlement only',rows:[
  ...(['grossCents','netCents','ownerCents','platformCents','deficitCents'] as const).map((key,index)=>({label:['Gross energy value','Net distributable value','Asset-owner earnings','DriveGrid revenue','Unallocated deficit'][index],value:(r:ScenarioResult)=>formatUSD(r.totals[key]/100)})),
  {label:'Reconciliation residual',value:r=>formatUSD(r.residualCents/100)},
  {label:'Owner / platform shares',value:r=>`${formatNumber(r.commercial.ownerSharePct)}% / ${formatNumber(r.commercial.platformSharePct)}%`},
]},{label:'Stored battery energy · capacity-weighted accounting',rows:[
  {label:'Initial stored energy',value:r=>formatEnergy(r.terminal.initialStoredMWh,'fleet')},
  {label:'Final stored energy',value:r=>formatEnergy(r.terminal.finalStoredMWh,'fleet')},
  {label:'Net stored energy change',value:r=>formatEnergy(r.terminal.netStoredMWh,'fleet')},
  {label:'Initial weighted SOC',value:r=>`${formatNumber(r.terminal.initialSocPct)}%`},
  {label:'Actual terminal SOC',value:r=>`${formatNumber(r.terminal.finalSocPct)}%`},
]},{label:'Comparison only · not settlement or realized payouts',rows:[
  {label:'Terminal reference price',value:r=>`${formatNumber(r.terminal.referencePriceUSDPerMWh)} USD/MWh`},
  {label:'Terminal energy adjustment',value:r=>formatUSD(r.terminal.adjustmentUSD)},
  {label:'Adjusted economic value',value:r=>formatUSD(r.terminal.adjustedEconomicValueUSD)},
  {label:'Terminal SOC target',value:r=>`${formatNumber(r.terminal.targetSocPct)}%`},
  {label:'Terminal SOC tolerance',value:r=>`±${formatNumber(r.terminal.tolerancePct)} percentage points`},
  {label:'Terminal SOC deviation',value:r=>`${formatNumber(r.terminal.deviationPct)} percentage points`},
  {label:'Terminal SOC constraint status',value:constraintLabel},
]},{label:'Physical dispatch activity',rows:[
  {label:'Intervals',value:r=>String(r.points.length)},
  {label:'Energy imported',value:r=>formatEnergy(r.importedMWh,'fleet')},{label:'Energy exported',value:r=>formatEnergy(r.exportedMWh,'fleet')},
  {label:'Charge / discharge / idle',value:r=>`${r.commands.charge} / ${r.commands.discharge} / ${r.commands.idle}`},
  {label:'Rejected / curtailed',value:r=>`${formatEnergy(r.rejectedMWh,'fleet')} / ${formatEnergy(r.curtailedMWh,'fleet')}`},
  {label:'Storage / rated power',value:r=>`${formatEnergy(r.initialMetrics.energyCapacityMWh,'fleet')} / ${formatPower(r.initialMetrics.ratedPowerMW,'fleet')}`},
]}];
function ResultChart({result:r}:{result:ScenarioResult}){
  return <Panel title={r.name} subtitle={`${r.points.length} intervals · synthetic price profile · captured scenario only`}><ScenarioTimeline result={r}/><details className={c.details}><summary>Interval results and strategy assumptions</summary><p className={c.help}>Charge below {formatNumber(r.config.chargeThresholdUSDPerMWh)} / discharge above {formatNumber(r.config.dischargeThresholdUSDPerMWh)} USD/MWh · target {formatPower(r.config.requestedFleetPowerMW,'fleet')} · reserve {formatNumber(r.config.reserveSocPct)}% · storage ×{formatNumber(r.config.capacityMultiplier)}.</p><div className={a.registryScroll}><table className={a.registry}><thead><tr>{['Time (CT)','Price USD/MWh','Command','AC power','Grid energy','SOC','Raw gross'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{r.points.map(p=><tr key={p.timestamp}><th scope="row">{String(Math.floor(p.step/4)).padStart(2,'0')}:{String(p.step%4*15).padStart(2,'0')}</th><td>{formatNumber(p.priceUSDPerMWh)}</td><td>{p.command}</td><td>{formatPower(p.acPowerMW,'fleet')}</td><td>{formatEnergy(p.acEnergyMWh,'fleet')}</td><td>{formatNumber(p.averageSocPct)}%</td><td>{formatUSD(p.grossEnergyValueUSD)}</td></tr>)}</tbody></table></div></details></Panel>;
}
