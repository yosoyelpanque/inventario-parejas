const test = require('node:test'), assert = require('node:assert/strict');
const T = require('../src/team.js'), D = require('../src/data.js'), A = require('../src/additional-rules.js');
const active = {name:'Persona Uno',employeeNumber:'00123'}, companion = {name:'Persona Dos',employeeNumber:'00456'};
test('un auditor conserva autoría y deja vacío auxiliado por, incluso en Excel',()=>{
 const team=T.pair(active,null);assert.equal(team.companion,null);
 assert.deepEqual(T.swap(team),team);
 const attribution=T.attribution({currentUser:active,companion:null});
 assert.equal(attribution.ubicadoPor,'Persona Uno');assert.equal(attribution.auxiliadoPor,'');
 assert.equal(T.excel(attribution)['Auxiliado Por'],'');
});
test('catálogo portable valida identidades y rechaza duplicados con ceros iniciales', () => {
  assert.deepEqual(T.validateDirectory([active, companion]), [active, companion]);
  assert.throws(() => T.validateDirectory({}));
  assert.throws(() => T.validateDirectory([active, {...companion, employeeNumber:'123'}]));
  assert.throws(() => T.validateDirectory([{name:'Persona',employeeNumber:'abc'}]));
});
test('requiere nombres y empleados distintos, conservando ceros iniciales', () => {
  assert.equal(T.pair(active,companion).active.employeeNumber,'00123');
  assert.throws(() => T.pair(active,{...companion,employeeNumber:'123'}));
  assert.throws(() => T.pair(active,{name:'',employeeNumber:'4'}));
  assert.throws(() => T.person({name:'Persona',employeeNumber:'abc'}));
});
test('intercambiar solo cambia la autoría de capturas posteriores', () => {
  const first = T.pair(active,companion);
  const state = {currentUser:first.active,companion:first.companion};
  const previous = T.attribution(state), next = T.swap(first);
  state.currentUser=next.active; state.companion=next.companion;
  assert.equal(previous.ubicadoPor,'Persona Uno'); assert.equal(previous.auxiliadoPorNumero,'00456');
  assert.equal(T.attribution(state).ubicadoPor,'Persona Dos');
  assert.equal(T.attribution(state).auxiliadoPorNumero,'00123');
  assert.deepEqual(T.swap(next),first);
});
test('respaldo conserva atribución, excluye pareja activa y no inventa compañero histórico', () => {
  const item=T.attribution({currentUser:active,companion});
  const saved=D.clean({inventory:[item],currentUser:active,companion});
  assert.deepEqual(saved,{inventory:[item]});
  assert.equal(T.savedAttribution({ubicadoPor:'Anterior'}).auxiliadoPor,'');
  assert.deepEqual(Object.keys(T.excel(item)),['Ubicado Por','Auxiliado Por']);
  assert.equal(T.label(active.name,active.employeeNumber),'Persona Uno');
  assert.equal(T.excel(item)['Auxiliado Por'],'Persona Dos');
  assert.ok(Object.values(T.clear()).every(v=>v===''));
});
test('vincular un adicional captura la pareja completa de esa verificación', () => {
  const state={currentUser:active,companion,resguardantes:[{id:'u',name:'Usuario',area:'1',locations:['Oficina']}],inventory:[{'CLAVE UNICA':'1',UBICADO:'NO',areaOriginal:'1'}],additionalItems:[{id:'a',posesion:'Cámara',personal:'No',resguardanteId:'u',ubicacionEspecifica:'Oficina'}]};
  const result=A.linkDraft(state,'a','1');
  assert.deepEqual(T.savedAttribution(result.inventory[0]),T.attribution(state));
  assert.equal(state.inventory[0].UBICADO,'NO');
});
test('actualiza directorios previos, conserva altas locales y bloquea baja sin cambiar historial',()=>{
 const fs=require('fs'),vm=require('vm'),ctx={};ctx.window=ctx;vm.runInNewContext(fs.readFileSync(require.resolve('../src/people.js'),'utf8'),ctx);vm.runInNewContext(fs.readFileSync(require.resolve('../src/team.js'),'utf8'),ctx);
 const old=[{employeeNumber:'11885',name:'ESTRADA HERNÁNDEZ ROBERTO'},{employeeNumber:'09999',name:'Auditor Local'}],before=JSON.stringify(old),t=ctx.InventoryTeam;
 const next=t.reconcileDirectory(old);assert.equal(JSON.stringify(old),before);assert.equal(next.length,15);assert.ok(next.some(p=>p.employeeNumber==='09999'));assert.ok(next.some(p=>p.employeeNumber==='46955'));assert.ok(next.some(p=>p.employeeNumber==='46965'));assert.ok(!next.some(p=>p.employeeNumber==='11885'));assert.throws(()=>t.pair(old[0],null),/baja/);assert.equal(t.excel({ubicadoPor:old[0].name})['Ubicado Por'],old[0].name);
});
