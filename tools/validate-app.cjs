// Validate complete source files before tests, packaging, or publishing.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const truncated=/Warning: truncated output|Total output lines:|\u2026\d+ tokens truncated\u2026/;
function checkText(file){
 const text=fs.readFileSync(path.join(root,file),'utf8');
 if(truncated.test(text))throw new Error('Archivo incompleto: '+file);
 return text;
}
checkText('index.html');
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m=>m[1]);
for(const file of scripts){
 if(/^(?:https?:)?\/\//.test(file))throw new Error('Script externo no disponible sin conexión: '+file);
 new vm.Script(checkText(file),{filename:file});
}
for(const folder of ['src','styles'])for(const name of fs.readdirSync(path.join(root,folder))){
 if(/\.(js|css)$/.test(name)){
  const file=folder+'/'+name,text=checkText(file);
  if(name.endsWith('.js'))new vm.Script(text,{filename:file});
 }
}
const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
for(const id of ['main-app','team-page','global-search-input','tabs-container','settings-tab','area-progress-panel','area-progress-list','area-progress-summary']){
 if(ids.filter(value=>value===id).length!==1)throw new Error('Debe existir exactamente un elemento: '+id);
}
console.log('Archivos de la app íntegros: '+scripts.length+' scripts y controles de arranque verificados.');
