import { memo,useId } from 'react';

/** Hand-authored vector equipment; a reusable 2D fallback, independent of simulation logic. */
export const Equipment=memo(function Equipment({kind}:{kind:'grid'|'ev'|'home'|'bess'}){
 const id=useId();
 const metal=`url(#${id}-metal)`,top=`url(#${id}-top)`,side=`url(#${id}-side)`;
 return <g strokeLinecap="round" strokeLinejoin="round">
   <defs><linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7194a9"/><stop offset=".45" stopColor="#45687f"/><stop offset="1" stopColor="#223e55"/></linearGradient><linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#91aebd"/><stop offset="1" stopColor="#42657e"/></linearGradient><linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#345871"/><stop offset="1" stopColor="#142d43"/></linearGradient></defs>
   {kind==='grid'?<>
     <ellipse cx="156" cy="181" rx="136" ry="27" fill="#020b15" opacity=".6"/>
     <path d="m26 153 116-55 129 60-114 56Z" fill="#7896a9" opacity=".1"/>

     <ellipse cx="150" cy="166" rx="137" ry="34" fill="#54bce0" opacity=".09"/>
     <path d="m14 148 127-62 145 65-129 65Z" fill="#142e44" stroke="#44718c"/><path d="m14 148 143 65 129-62v12l-129 65-143-65Z" fill="#0d1d30" stroke="#355469"/>
     {[47,225].map(x=><g key={x} transform={`translate(${x} 0)`} stroke="#8eb5c9" fill="none" strokeWidth="2"><path d="M12 15-8 144M12 15l24 130M-3 116h32M1 88h23M5 58h15M-7 40h39M-17 62h60M12 15v130M1 88l28 28M24 88l-27 28M5 58l19 30M20 58 1 88"/><path d="M-17 62v11m60-11v11M-7 40v10m39-10v10" stroke="#4bd7dc" strokeWidth="4"/></g>)}
     <path d="M30 48Q144 80 257 48M20 76Q145 105 268 76" fill="none" stroke="#5993aa" strokeWidth="1.5"/>
     <path d="m92 110 53-25 60 29-53 27Z" fill={top} stroke="#8db2c4"/><path d="m92 110 60 31v45l-60-30Z" fill={metal} stroke="#6693ac"/><path d="m152 141 53-27v44l-53 28Z" fill={side} stroke="#6693ac"/>
     {[0,1,2,3,4,5].map(i=><path key={i} d={`M${100+i*8} ${122+i*4}v26`} stroke="#88bfd2" opacity=".7"/>)}
     {[115,142,170].map((x,i)=><g key={x} transform={`translate(${x} ${94+i*2})`}><path d="M0 0v-29" stroke="#b2d6e5" strokeWidth="4"/>{[0,1,2,3].map(n=><ellipse key={n} cx="0" cy={-7-n*5} rx="7" ry="2.5" fill="#73a6bc" stroke="#b4d7e5"/>)}</g>)}
     <path d="m222 133 30-15 21 11v33l-30 15-21-11Z" fill="#274b63" stroke="#72a0b7"/><path d="m231 141 12 6 20-10v13l-20 10-12-6Z" fill="#63d8d6" opacity=".7"/>
     <g stroke="#82b4c6" strokeWidth="1.1" fill="none"><path d="m56 93 30 15 27-13m56-12 32 16 30-15M68 100v35m146-45v39M86 108v25m114-34v35"/>
       {[58,86,199,229].map((x,i)=><g key={x} transform={`translate(${x} ${92+i%2*12})`}><path d="M0 0v-28" strokeWidth="2.3"/>{[0,1,2].map(n=><ellipse key={n} cx="0" cy={-10-n*5} rx="5" ry="2" fill="#9dced3"/>)}</g>)}
     </g>
     <g transform="translate(43 122)"><path d="m0 0 24-11 27 13-24 12Z" fill={top} stroke="#83a9ba"/><path d="m0 0 27 14v31L0 31Z" fill={metal} stroke="#5f8ca5"/><path d="m27 14 24-12v31L27 45Z" fill={side} stroke="#5f8ca5"/>{[0,1,2,3].map(i=><path key={i} d={`m${5+i*5} ${9+i*2.5}v21`} stroke="#93b6c7"/>)}<path d="M13-5v-15m15 13v-15" stroke="#b0d1dc" strokeWidth="3"/></g>
     <g transform="translate(90 142)">{[0,1,2].map(i=><g key={i} transform={`translate(${i*17} ${i*8})`}><ellipse cx="5" cy="5" rx="6" ry="8" fill="#18384d" stroke="#a4c4d0"/><path d="m2 0 6 10M8 0 2 10M0 5h10" stroke="#729eb4"/></g>)}</g>
     <path d="m158 151 31-15v32l-31 15Z" fill="#122b3f" stroke="#54839d"/>{[0,1,2,3].map(i=><path key={i} d={`m163 ${153+i*6} 21-10`} stroke="#749fb2"/>)}
     <path d="m240 143 12-6v11l-12 6Z" fill="#152d41" stroke="#9ec0cb"/><path d="m247 139-3 7h4l-1 6 7-11h-5l1-4" fill="#e1c17d"/>
     {[36,78,206,263].map((x,i)=><ellipse key={x} cx={x} cy={161+i%2*11} rx="2" ry="1" fill="#b1ced7"/>)}
   </>:kind==='ev'?<>
     <ellipse cx="150" cy="171" rx="145" ry="29" fill="#49e2d2" opacity=".07"/>
     <path d="m4 142 120-56 174 63-121 63Z" fill="#142e42" stroke="#3d6c83"/>
     {[0,1,2].map(i=><g key={i} transform={`translate(${15+i*69} ${121+i*7})`}><path d="m0 3 29-14 39 16-29 15Z" fill="#234157" stroke="#608ca2"/><path d="M9 1v-11l20-12 25 10 7 12-22 15Z" fill={i===1?'#3c9da5':'#58879e'} stroke="#a1cbd7"/><path d="m17-10 13-8 16 7-14 8Z" fill="#0b2236" stroke="#8bc2d4"/><path d="m32-3 16-8 8 10-21 10Z" fill="#173e57"/><path d="m9 1 26 10 26-11v9L35 23 9 12Z" fill="#234b65" stroke="#82b7c8"/><ellipse cx="19" cy="14" rx="5" ry="7" fill="#071423" stroke="#8bb6c9"/><ellipse cx="52" cy="12" rx="5" ry="7" fill="#071423" stroke="#8bb6c9"/><path d="m13 4 7 3m21 4 8-4" stroke="#bff8f6" strokeWidth="2"/></g>)}
     {[0,1,2].map(i=><g key={i} transform={`translate(${49+i*70} ${83+i*7})`}><path d="m0 0 13-7 11 5v47l-14 8L0 49Z" fill="#264a60" stroke="#8bbdcd"/><path d="m4 8 6 3 9-5v12l-9 5-6-3Z" fill="#6de0d3"/><path d="M24 22q18-3 12 17t-11 13" fill="none" stroke="#6de0d3" strokeWidth="2"/></g>)}
     <path d="M34 90V44m219 88V80M14 43l91-43 174 64-91 44Z" fill="#214a62" stroke="#76b3cb"/>
     {[0,1,2,3].map(i=><path key={i} d={`m${37+i*35} ${44+i*13} 67-32 23 9-66 32Z`} fill="#155b79" stroke="#60bfd6" strokeWidth=".8"/>)}
     <path d="m8 153 39 15m19-5 39 15m19-5 39 15m19-5 39 15" stroke="#7ba0ad" strokeWidth="1" opacity=".7"/>
     {[0,1,2].map(i=><g key={i} transform={`translate(${49+i*70} ${83+i*7})`}><path d="m4 28 6 3 9-5v5l-9 5-6-3Z" fill="#0b2539"/><path d="M22 18q17 1 14 20l-4 16" fill="none" stroke="#0a1727" strokeWidth="4"/><path d="M22 18q17 1 14 20l-4 16" fill="none" stroke="#83a9b9" strokeWidth="1.4"/><rect x="28" y="49" width="6" height="9" rx="2" fill="#172e40" stroke="#9bc5d0"/><path d="M5 42v5m5-2v5" stroke="#82aab9"/></g>)}
     {[0,1,2].map(i=><path key={i} d={`m${40+i*45} ${40+i*16} 60-28`} stroke="#a0d4df" strokeWidth=".6" opacity=".7"/>)}
   </>:kind==='home'?<>
     <ellipse cx="150" cy="170" rx="140" ry="28" fill="#60a5ed" opacity=".08"/>
     <path d="m8 147 138-60 148 65-140 62Z" fill="#152f43" stroke="#426d85"/>
     {[{x:28,y:56,scale:.82},{x:133,y:25,scale:1}].map(({x,y,scale})=><g key={x} transform={`translate(${x} ${y}) scale(${scale})`}>
       <path d="m0 69 45-27 58 27v64l-45 23L0 127Z" fill={metal} stroke="#9bb6c8"/><path d="m58 93 45-24v64l-45 23Z" fill={side} stroke="#7fa7bd"/>
       <path d="M-9 68 33 4l79 55-54 35Z" fill="#446782" stroke="#a2c2d1"/><path d="m33 4 19-10 70 52-10 13Z" fill="#244b64" stroke="#82b0c3"/>
       <path d="m24 38 19-24 39 28-22 24Z" fill="#14567a" stroke="#61b3d1"/><path d="m31 28 39 28M36 52l21-26m-9 35 22-26" stroke="#66b4d2"/>
       <path d="m11 85 19 9v22l-19-9Zm56 11 20-10v22l-20 10Z" fill="#8adbdc" opacity=".65" stroke="#b2dfe5"/><path d="m37 106 14 7v34l-14-7Z" fill="#102a41"/>
       <path d="m91 105 18-9 9 5v40l-18 9-9-5Z" fill="#bed8df" stroke="#7dacc0"/><path d="m97 115 6 3 10-5v5l-10 5-6-3Z" fill="#19a5a8"/>
       <path d="m1 127 56 25 45-23m-44-36v58M11 96l19 9m-9-15v22m46-5 20-10m-10-6v21" fill="none" stroke="#bbd5df" strokeWidth=".8"/>
       <path d="m42 119 2 1m15-108 0-17 12 8v18" fill="none" stroke="#a0becd" strokeWidth="2"/>
       <path d="m94 135 16-8m-16 12 16-8m-16 12 16-8" stroke="#5d859d"/>
       <path d="m26 38 34 24m-23-37 34 24m-41-5 18-23m-8 31 18-23" stroke="#8ec4d6" strokeWidth=".45"/>
     </g>)}
   </>:<>
     <ellipse cx="150" cy="171" rx="142" ry="28" fill="#73a7ff" opacity=".09"/>
     <path d="m4 145 137-64 155 69-140 65Z" fill="#142d45" stroke="#426f8b"/>
     {[{x:101,y:43},{x:25,y:88}].map(({x,y})=><g key={x} transform={`translate(${x} ${y})`}>
       <path d="m0 19 64-31 100 42-65 33Z" fill={top} stroke="#a7c6d6"/><path d="m0 19 99 44v60L0 79Z" fill={metal} stroke="#82aec4"/><path d="m99 63 65-33v60l-65 33Z" fill={side} stroke="#82aec4"/>
       {[0,1,2,3,4,5,6,7,8].map(i=><path key={i} d={`M${8+i*10} ${27+i*4.4}v45`} stroke="#6e9bb5" opacity=".7"/>)}
       <path d="m110 67 17-9v39l-17 8Zm23-12 18-9v39l-18 9Z" fill="#132f48" stroke="#507e9a"/>
       {[0,1,2,3,4].map(i=><path key={i} d={`m112 ${71+i*6} 13-7m10-5 14-7`} stroke="#7aacc1"/>)}
       <path d="m9 22 88 39M3 77l94 41" stroke="#b0c7d2" strokeWidth=".8" opacity=".65"/>
       <path d="m7 33 17 7v34L7 67Zm69 30 16 7v34l-16-7Z" fill={side} stroke="#9bbdcd"/><path d="m19 45-1 0m69 33-1 0" stroke="#d3e5e9" strokeWidth="2"/>
       <path d="m108 71 20-10v34l-20 10Z" fill="#294b61" stroke="#96b6c5"/><ellipse cx="118" cy="82" rx="5" ry="9" fill="#112b40" stroke="#739caf"/><path d="m115 76 6 12m0-15-6 18" stroke="#91b3c4"/>
       <path d="m134 57 19-9v34l-19 9Z" fill="#294b61" stroke="#96b6c5"/><ellipse cx="143" cy="68" rx="5" ry="9" fill="#112b40" stroke="#739caf"/>
       <path d="m33 76 9 4v10l-9-4Z" fill="#d0b377"/><path d="m35 81 5 2" stroke="#28313b"/>
       {[9,89].map(x=><g key={x}><path d={`m${x} ${x*.44+23} 4 2v4l-4-2Z`} fill="#bfd1d9"/><path d={`m${x} ${x*.44+70} 4 2v4l-4-2Z`} fill="#bfd1d9"/></g>)}
       <path d="m28 45 42 18v14L28 59Z" fill="#75d5d1" opacity=".72"/><path d="m6 16 59-28m-18 36 56-28" stroke="#82b2c7"/>
     </g>)}
   </>}
 </g>;
});
export function EquipmentGraphic({kind}:{kind:'grid'|'ev'|'home'|'bess'}){
 const id=useId();
 return <svg viewBox="0 -10 305 245" role="img" aria-labelledby={id}><title id={id}>{kind==='grid'?'Electrical substation and transmission towers':kind==='ev'?'Electric cars at bidirectional charging stations':kind==='home'?'Solar homes with residential batteries':'Commercial battery storage containers'}</title><Equipment kind={kind}/></svg>;
}
