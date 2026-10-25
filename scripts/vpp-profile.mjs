import {performance} from 'node:perf_hooks';
import {cpus,platform,release,totalmem} from 'node:os';
import {createInitialState,demoReducer,operationsSnapshot} from '../lib/vpp/simulation.ts';
import {portfolioMetrics,filterAssets} from '../lib/vpp/domain.ts';
import {recommendMarket} from '../lib/vpp/market-decision.ts';
import {operationsMetrics} from '../lib/vpp/operations.ts';
import {buildAnalytics} from '../lib/vpp/analytics.ts';
import {runScenario,scenarioPresets} from '../lib/vpp/scenarios.ts';
const state=createInitialState();
const dispatch=()=>demoReducer(state,{type:'execute-dispatch',step:0,resetVersion:0,request:{command:'discharge',requestedPowerMW:1,assetId:null}});
let recorded=state;for(let i=0;i<96;i++)recorded=demoReducer(recorded,{type:'execute-dispatch',step:i,resetVersion:0,request:{command:'idle',requestedPowerMW:0,assetId:null}});
console.log(JSON.stringify({node:process.version,platform:platform(),release:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryGiB:Math.round(totalmem()/2**30),assets:state.assets.length,worstCaseHistory:recorded.history.length,assetRecords:recorded.history.reduce((n,i)=>n+i.records.length,0)}));
for(const [name,fn] of [
 ['initial state',()=>createInitialState()],['dashboard metrics',()=>portfolioMetrics(state.assets)],
 ['asset search/filter/page',()=>filterAssets(state.assets,{search:'0001',type:'all',status:'all',availability:'all'}).slice(0,20)],
 ['dispatch with monitoring',dispatch],['market preview',()=>recommendMarket(state.assets,0,state.marketSettings)],
 ['96-interval scenario',()=>runScenario('base',{...scenarioPresets[0].config},state.assets,state.commercialSettings)],
 ['operations metrics',()=>operationsMetrics(operationsSnapshot(state),state.operations)],
 ['analytics 96 Idle intervals',()=>buildAnalytics(recorded)],
 ['analytics filtered 16 intervals',()=>buildAnalytics(recorded,{mode:'last4h',startStep:0,endStep:96})]]){
 fn();const timings=[];for(let i=0;i<5;i++){const start=performance.now();fn();timings.push(performance.now()-start);}timings.sort((a,b)=>a-b);console.log(JSON.stringify({name,medianMs:+timings[2].toFixed(2),minMs:+timings[0].toFixed(2),maxMs:+timings[4].toFixed(2),samples:5}));
}
