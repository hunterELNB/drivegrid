import { createAssets, validAssetUpdate } from './domain.ts';
import type { AssetUpdate, DERAsset, OperationalStatus } from './domain.ts';
import { executeDispatch, validDispatchRequest } from './dispatch.ts';
import type { DispatchRequest, DispatchResult } from './dispatch.ts';
import { DEFAULT_MARKET_SETTINGS, recommendMarket, validateMarketSettings } from './market-decision.ts';
import type { MarketSettings } from './market-decision.ts';
import { marketPriceAt, MARKET_SCENARIO_ID } from './market-data.ts';
import { grossEnergyValueUSD } from './economics.ts';
import { DEFAULT_COMMERCIAL_SETTINGS, validateCommercialSettings } from './settlement.ts';
import type { CommercialSettings } from './settlement.ts';
import { createOperationsState, observeOperations, operationsReducer } from './operations.ts';
import type { OperationsAction, OperationsState, OperationsSnapshot } from './operations.ts';

export type DispatchInterval = Omit<DispatchResult, 'assets'> & {
  step: number;
  timestamp: string;
  endTimestamp: string;
  source: 'manual' | 'market';
  marketScenarioId: string;
  marketPriceUSDPerMWh: number;
  grossEnergyValueUSD: number;
};

export const INITIAL_TIME = '2026-10-23T00:00:00-05:00';
export const INTERVAL_MINUTES = 15;
export const TOTAL_INTERVALS = 96;
export const PLAYBACK_MS = 2000;

export interface DemoState {
  readonly assets: readonly DERAsset[];
  readonly step: number;
  readonly running: boolean;
  readonly resetVersion: number;
  readonly history: readonly DispatchInterval[];
  readonly dispatchError: string;
  readonly marketSettings: MarketSettings;
  readonly marketRevision: number;
  readonly commercialSettings: CommercialSettings;
  readonly operations:OperationsState;
  /** Only the status temporarily overridden by connectivity; not a second fleet registry. */
  readonly preOfflineStatus:Readonly<Record<string,Exclude<OperationalStatus,'offline'>>>;
}
type CoreDemoAction =
  | { type: 'start' } | { type: 'pause' } | { type: 'step' } | { type: 'tick' } | { type: 'reset' }
  | { type: 'update-asset'; id: string; update: AssetUpdate }
  | { type: 'execute-dispatch'; step: number; resetVersion: number; request: DispatchRequest }
  | { type: 'execute-market'; step: number; resetVersion: number; revision: number }
  | { type: 'set-market-settings'; settings: MarketSettings }
  | { type: 'set-commercial-settings'; settings: CommercialSettings };
export type DemoAction=CoreDemoAction|OperationsAction;

export function createInitialState(): DemoState {
  const assets=createAssets();
  return { assets, step: 0, running: false, resetVersion: 0, history: [], dispatchError: '', marketSettings: { ...DEFAULT_MARKET_SETTINGS }, marketRevision: 0, commercialSettings:{...DEFAULT_COMMERCIAL_SETTINGS},operations:createOperationsState({assets,step:0,history:[],timestamp:simulationTimestamp(0)}),preOfflineStatus:{} };
}
export function simulationTimestamp(step: number): string {
  return new Date(Date.parse(INITIAL_TIME) + step * INTERVAL_MINUTES * 60_000).toISOString();
}
export function simulationLabel(step: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Chicago', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(simulationTimestamp(step))) + ' CT';
}
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  try { return reduceDemo(state,action); }
  catch {
    return {...state,running:false,dispatchError:'The simulation action could not be completed. Your previous state was retained. Reset demo to start again.'};
  }
}
function reduceDemo(state: DemoState, action: DemoAction): DemoState {
  if(action.type==='operations-connectivity'){
    const asset=state.assets.find(a=>a.id===action.assetId);
    if(!asset||(asset.status!=='offline')===action.online)return state;
    // Seeded offline assets have no known prior status: retain the safe standby fallback.
    const restoredStatus=state.preOfflineStatus[asset.id]??'standby';
    const next=preserveOfflineStatus(state,coreDemoReducer(state,{type:'update-asset',id:asset.id,update:{socPct:asset.socPct,availability:asset.availability,status:action.online?restoredStatus:'offline'}}));
    const operations=observeOperations(state.operations,operationsSnapshot(state),operationsSnapshot(next),action.type);
    return {...next,operations:{...operations,message:action.online?`Connectivity restored; core status is ${restoredStatus}. Current availability, SOC limits and health annotations are preserved; dispatch eligibility is recalculated.`:'Asset is offline in shared core status. Previous status is retained for restoration; SOC, availability and settled history are unchanged.'}};
  }
  if(action.type==='operations-health'||action.type==='operations-acknowledge'||action.type==='operations-resolve'||action.type==='operations-reset'){
    const operations=operationsReducer(state.operations,action,operationsSnapshot(state));
    return operations===state.operations?state:{...state,operations};
  }
  const next=preserveOfflineStatus(state,coreDemoReducer(state,action));
  if(action.type==='reset')return next;
  if(next===state)return state;
  const operations=observeOperations(state.operations,operationsSnapshot(state),operationsSnapshot(next),action.type);
  return operations===next.operations?next:{...next,operations};
}
/** Track entry into offline once; explicit later status edits supersede saved restoration. */
function preserveOfflineStatus(before:DemoState,after:DemoState):DemoState {
  if(before.assets===after.assets||before.resetVersion!==after.resetVersion)return after;
  const previous=new Map(before.assets.map(asset=>[asset.id,asset]));
  let saved=after.preOfflineStatus;
  for(const asset of after.assets){
    const prior=previous.get(asset.id);
    if(!prior||prior.status===asset.status)continue;
    if(asset.status==='offline'&&prior.status!=='offline')saved={...saved,[asset.id]:prior.status};
    else if(prior.status==='offline'&&asset.id in saved){const copy={...saved};delete copy[asset.id];saved=copy;}
  }
  return saved===after.preOfflineStatus?after:{...after,preOfflineStatus:saved};
}
export function operationsSnapshot(state:DemoState):OperationsSnapshot {
  return {assets:state.assets,history:state.history,step:state.step,timestamp:simulationTimestamp(state.step)};
}
function coreDemoReducer(state:DemoState,action:CoreDemoAction):DemoState {
  switch (action.type) {
    case 'start': return state.step >= TOTAL_INTERVALS ? state : { ...state, running: true };
    case 'pause': return { ...state, running: false };
    case 'tick':
      if (!state.running) return state;
      return advance(state, false);
    case 'step': return advance(state, true);
    case 'reset': return { ...createInitialState(), resetVersion: state.resetVersion + 1 };
    case 'set-market-settings': {
      const error = validateMarketSettings(action.settings);
      return error ? { ...state, dispatchError: error } : { ...state, marketSettings: { ...action.settings }, marketRevision: state.marketRevision + 1, dispatchError: '' };
    }
    case 'set-commercial-settings': {
      const error=validateCommercialSettings(action.settings);
      return error?{...state,dispatchError:error}:{...state,commercialSettings:{...action.settings},dispatchError:''};
    }
    case 'execute-market':
    case 'execute-dispatch': {
      if (state.running || state.step >= TOTAL_INTERVALS || action.step !== state.step
        || action.resetVersion !== state.resetVersion || state.history.some(h => h.step === action.step)) {
        return { ...state, dispatchError: 'Dispatch blocked: pause playback, use the current unexecuted interval, and reset after end of day.' };
      }
      if (action.type === 'execute-market' && action.revision !== state.marketRevision) return { ...state, dispatchError: 'Market preview is stale. Preview the current assets and thresholds again.' };
      const recommendation = action.type === 'execute-market' ? recommendMarket(state.assets,state.step,state.marketSettings) : null;
      const request = action.type === 'execute-market' ? recommendation!.request : action.request;
      if (!validDispatchRequest(request)) return { ...state, dispatchError: 'Use a finite power from 0 to 100 MW: positive for Charge/Discharge, zero for Idle.' };
      if(request.assetId!==null&&!state.assets.some(asset=>asset.id===request.assetId))return {...state,dispatchError:'The selected asset is unavailable. Select an existing asset and try again.'};
      const { assets, ...result } = recommendation ? recommendation.physicalPreview : executeDispatch(state.assets, request);
      const price = marketPriceAt(state.step)!;
      const interval: DispatchInterval = {
        ...result, step: state.step, timestamp: simulationTimestamp(state.step), endTimestamp: simulationTimestamp(state.step + 1),
        source: action.type === 'execute-market' ? 'market' : 'manual', marketScenarioId: MARKET_SCENARIO_ID,
        marketPriceUSDPerMWh: price, grossEnergyValueUSD: grossEnergyValueUSD(result.acEnergyMWh,price),
      };
      return { ...state, assets, step: state.step + 1, history: [...state.history, interval], dispatchError: '', marketRevision: state.marketRevision + 1 };
    }
    case 'update-asset': {
      const asset = state.assets.find(a => a.id === action.id);
      if (!asset || !validAssetUpdate(asset, action.update)) return state;
      return { ...state, assets: state.assets.map(a => a.id === action.id ? { ...a, ...action.update } : a), marketRevision: state.marketRevision + 1 };
    }
  }
}
function advance(state: DemoState, pause: boolean): DemoState {
  const step = Math.min(state.step + 1, TOTAL_INTERVALS);
  return { ...state, step, running: !pause && state.running && step < TOTAL_INTERVALS };
}
