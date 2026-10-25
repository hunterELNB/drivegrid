import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
function sources(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sources(join(directory,entry.name)):/\.(tsx?|css)$/.test(entry.name)?[join(directory,entry.name)]:[]);}
test('VPP runtime provides no file controls, file APIs, printing or persistent storage',()=>{
  const forbidden=[/\b(?:FileReader|Blob)\b/,/\b(?:createObjectURL|revokeObjectURL|showOpenFilePicker|showSaveFilePicker|showDirectoryPicker|getDirectory|createWritable)\s*\(/,/\b(?:window|globalThis)\s*\.\s*print\s*\(/,/\b(?:localStorage|sessionStorage|indexedDB|caches)\b/,/\btype\s*=\s*['"]file['"]/,/\bdownload\s*(?:=|\b)/,/@media\s+print/,/\bprocess\.env\b/,/[A-Z]:\\(?:business|Users)\\/];
  for(const file of [...sources(join(root,'app/vpp-demo')),...sources(join(root,'lib/vpp'))]){
    const content=readFileSync(file,'utf8');for(const pattern of forbidden)assert.doesNotMatch(content,pattern,file);
  }
  assert.equal(existsSync(join(root,'lib/vpp/analytics-csv.ts')),false);
  assert.equal(existsSync(join(root,'app/vpp-demo/analytics/AnalyticsReport.tsx')),false);
});
