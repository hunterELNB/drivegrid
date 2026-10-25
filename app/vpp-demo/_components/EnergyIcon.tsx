export function EnergyIcon({kind,className}:{kind:number;className?:string}){
 const paths=['M4 9 12 3l8 6v11H4ZM9 20v-7h6v7','M13 2 5 14h6l-1 8 9-13h-7Z','M4 7h16v12H4ZM8 3v4m8-4v4M8 12h2m4 0h2','M4 7h15v13H4ZM19 11h3v5h-3M8 11v5m4-5v5','M3 16 7 9l4 4 4-8 6 3','M12 2v20m5-16H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6','M12 2 5 22m7-20 7 20M8 12h8M6 18h12M7 7h10M4 10h16M12 2v20M8 7l8 5-10 6m10-11-8 5 10 6','M3 17v-6l3-6h12l3 6v6ZM3 11h18M6 17v3m12-3v3M6 14h2m8 0h2'];
 return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind%paths.length]}/></svg>;
}
