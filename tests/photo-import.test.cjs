const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../src/photo-import.js');
const image=()=>new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZU8AAAAASUVORK5CYII=','base64')],{type:'application/octet-stream'});
const photo=(key,value=image(),store='photos')=>({key,value,store});
const state=()=>({inventory:[],additionalItems:[],resguardantes:[],photos:{},additionalPhotos:{},userPhotos:{},locationPhotos:{},notes:{a:'Conservar nota'},hiddenSuggestions:['VIEJA'],currentUser:{id:'auditor'},activeResguardante:{id:'active'}});
function storage(initial={},failOn){
 const data={photos:new Map(initial.photos||[]),appData:new Map(initial.appData||[])};
 return {data,async flush(){},async transaction(names,mode,operation){
  return new Promise((resolve,reject)=>{
   const draft={photos:new Map(data.photos),appData:new Map(data.appData)};let pending=0,aborted=false,result;
   const settle=()=>queueMicrotask(()=>{if(pending)return;if(aborted)return reject(Error('Transacción cancelada'));data.photos=draft.photos;data.appData=draft.appData;resolve(typeof result==='function'?result():result);});
   const tx={abort(){aborted=true;settle();},objectStore(name){return {
    get(key){pending++;const request={};queueMicrotask(()=>{request.result=draft[name].get(key);if(!aborted)request.onsuccess?.();pending--;settle();});return request;},
    put(value,key){if(failOn===key)throw Error('Sin espacio');draft[name].set(key,value);}
   };}};
   try{result=operation(tx);settle();}catch(error){reject(error);}
  });
 }};
}
test('identifica bienes por clave completa sin convertir ni perder ceros iniciales',async()=>{
 const current=state(),source=state();current.inventory=[{'CLAVE UNICA':'0012'},{'CLAVE UNICA':'12'}];source.inventory=[{'CLAVE UNICA':'0012'},{'CLAVE UNICA':'012'}];
 const plan=await P.plan(current,source,[photo('inventory-0012'),photo('inventory-012')]);
 assert.equal(plan.counts.new,1);assert.equal(plan.counts.unmatched,1);assert.equal(plan.rows[0].targetKey,'inventory-0012');
});
test('adicionales de otro dispositivo se asocian por serie única y no por claves CD/ARR',async()=>{
 const current=state(),source=state();
 current.additionalItems=[{id:'new',descripcion:'Laptop',serie:'ABC12',claveAsignada:'CD-1-001',claveAutogenerada:true},{id:'local2',descripcion:'Silla',claveAsignada:'CD-1-002',claveAutogenerada:true},{id:'local3',descripcion:'Mesa',claveAsignada:'ARR-001'}];
 source.additionalItems=[{id:'old',descripcion:'Laptop',serie:'ABC12',claveAsignada:'CD-2-001',claveAutogenerada:true},{id:'other2',descripcion:'Silla',claveAsignada:'CD-1-002',claveAutogenerada:true},{id:'other3',descripcion:'Mesa',claveAsignada:'ARR-001'}];
 const plan=await P.plan(current,source,[photo('additional-old'),photo('additional-other2'),photo('additional-other3')]);
 assert.equal(plan.counts.new,1);assert.equal(plan.counts.unmatched,2);assert.equal(plan.rows[0].targetKey,'additional-new');
});
test('identidad de adicional compartido permite foto; ID reutilizado para otro contenido no',async()=>{
 const current=state(),source=state();current.additionalItems=[{id:'same',descripcion:'Silla',marca:'M'},{id:'wrong',descripcion:'Mesa'}];source.additionalItems=[{id:'same',descripcion:'Silla',marca:'M'},{id:'wrong',descripcion:'Lámpara'}];
 const plan=await P.plan(current,source,[photo('additional-same'),photo('additional-wrong')]);assert.equal(plan.counts.new,1);assert.equal(plan.counts.unmatched,1);
});
test('no asocia claves ni series ambiguas y verifica las claves manuales',async()=>{
 const current=state(),source=state();
 current.inventory=[{'CLAVE UNICA':'1'},{'CLAVE UNICA':'1'}];source.inventory=[{'CLAVE UNICA':'1'}];
 current.additionalItems=[{id:'a',descripcion:'A',serie:'DUP'},{id:'b',descripcion:'B',serie:'DUP'},{id:'c',descripcion:'Monitor',claveAsignada:'MANUAL-001'}];source.additionalItems=[{id:'remote',descripcion:'A',serie:'DUP'},{id:'manual',descripcion:'Monitor',claveAsignada:'MANUAL-001'}];
 const plan=await P.plan(current,source,[photo('inventory-1'),photo('additional-remote'),photo('additional-manual')]);
 assert.equal(plan.counts.ambiguous,2);assert.equal(plan.rows[2].targetKey,'additional-c');
});
test('usuarios y ubicaciones requieren identidad verificada y distinguen edificios',async()=>{
 const current=state(),source=state();
 source.resguardantes=[{id:'old',name:'ANA',area:'01',employeeNumber:'0010',locations:['OFICINA 01','BODEGA 01'],locationDetails:{'BODEGA 01':{edificio:'A'}}},{id:'old2',name:'LUIS',area:'01'}];
 current.resguardantes=[{id:'new',name:'ANA',area:'01',employeeNumber:'0010',locations:['OFICINA 01','BODEGA 01'],locationDetails:{'BODEGA 01':{edificio:'B'}}},{id:'new2',name:'LUIS',area:'01'}];
 const plan=await P.plan(current,source,[photo('user-old'),photo('location-old|OFICINA 01'),photo('location-old|BODEGA 01'),photo('user-old2')]);
 assert.equal(plan.counts.new,2);assert.equal(plan.counts.unmatched,2);assert.equal(plan.rows[1].targetKey,'location-new|OFICINA 01');
});
test('omite archivos vacíos, texto que aparenta imagen, planos y fotografías repetidas',async()=>{
 const current=state(),source=state();current.inventory=source.inventory=[{'CLAVE UNICA':'1'}];
 const plan=await P.plan(current,source,[photo('inventory-1'),photo('inventory-1'),photo('inventory-2',new Blob([])),photo('inventory-3',new Blob(['bad'],{type:'image/png'})),photo('plan',image(),'layoutImages')]);
 assert.deepEqual(plan.counts,{new:1,existing:0,unmatched:0,ambiguous:0,invalid:2,duplicate:1,unsupported:1});
});
test('fotos distintas para un mismo destino se consideran ambiguas',async()=>{
 const current=state(),source=state();current.inventory=source.inventory=[{'CLAVE UNICA':'1'}];
 const other=new Blob([image(),new Uint8Array([1])]);
 const plan=await P.plan(current,source,[photo('inventory-1'),photo('inventory-1',other)]);assert.equal(plan.counts.new,0);assert.equal(plan.counts.ambiguous,2);
});
test('importa solo blobs y flags; conserva inventario, notas, equipo y resguardante activo',async()=>{
 const current=state(),source=state();current.inventory=[{'CLAVE UNICA':'1',UBICADO:'NO',ubicadoPor:'LOCAL'}];source.inventory=[{'CLAVE UNICA':'1',UBICADO:'SI',ubicadoPor:'REMOTO'}];source.notes={a:'NO COPIAR'};
 const before=structuredClone(current),plan=await P.plan(current,source,[photo('inventory-1')]),db=storage(),result=await P.apply(db,current,plan);
 assert.equal(result.imported,1);assert.equal(result.next.photos['1'],true);assert.deepEqual(current,before);assert.deepEqual(result.next.inventory,current.inventory);assert.deepEqual(result.next.notes,current.notes);assert.deepEqual(result.next.activeResguardante,current.activeResguardante);assert.deepEqual(result.next.currentUser,current.currentUser);assert.deepEqual(result.next.hiddenSuggestions,current.hiddenSuggestions);
 assert.equal(db.data.photos.get('inventory-1').size,image().size);assert.equal(db.data.appData.get('mainState').currentUser,undefined);
});
test('conserva fotos existentes incluso si se agregaron después de la vista previa',async()=>{
 const current=state(),source=state();current.inventory=source.inventory=[{'CLAVE UNICA':'1'}];const old=image(),db=storage({photos:[['inventory-1',old]]});
 const plan=await P.plan(current,source,[photo('inventory-1')]);assert.equal(plan.counts.new,1);
 const result=await P.apply(db,current,plan);assert.equal(result.imported,0);assert.equal(result.skipped,1);assert.equal(db.data.photos.get('inventory-1'),old);assert.equal(db.data.appData.has('mainState'),false);
});
test('reemplaza solo mediante opción explícita y guarda recuperación en la misma transacción',async()=>{
 const current=state(),source=state();current.inventory=source.inventory=[{'CLAVE UNICA':'1'}];const old=image(),incoming=image(),db=storage({photos:[['inventory-1',old]],appData:[['recoveryPoints',[{id:'prior'}]]]});
 const plan=await P.plan(current,source,[photo('inventory-1',incoming)],[{key:'inventory-1',value:old}]);assert.equal(plan.counts.existing,1);
 const result=await P.apply(db,current,plan,{replaceExisting:true,recoveryPoint:{id:'before-import'}});assert.equal(result.replaced,1);assert.equal(db.data.photos.get('inventory-1'),incoming);assert.deepEqual(db.data.appData.get('recoveryPoints').map(item=>item.id),['before-import','prior']);
});
test('error al guardar aborta fotografías, flags y punto de recuperación; el estado original queda intacto',async()=>{
 const current=state(),source=state();current.inventory=source.inventory=[{'CLAVE UNICA':'1'},{'CLAVE UNICA':'2'}];const before=structuredClone(current),old=image(),db=storage({photos:[['inventory-1',old]],appData:[['mainState',before],['recoveryPoints',[]]]},'mainState');
 const plan=await P.plan(current,source,[photo('inventory-1'),photo('inventory-2')]);
 await assert.rejects(P.apply(db,current,plan,{replaceExisting:true,recoveryPoint:{id:'before'}}),/Sin espacio/);
 assert.equal(db.data.photos.get('inventory-1'),old);assert.equal(db.data.photos.has('inventory-2'),false);assert.deepEqual(db.data.appData.get('mainState'),before);assert.deepEqual(db.data.appData.get('recoveryPoints'),[]);assert.deepEqual(current,before);
});
test('rechaza aplicar una vista previa si desapareció el destino',async()=>{
 const current=state(),source=state();current.inventory=source.inventory=[{'CLAVE UNICA':'1'}];const plan=await P.plan(current,source,[photo('inventory-1')]);current.inventory=[];
 await assert.rejects(P.apply(storage(),current,plan),/Vuelve a seleccionar/);
});
