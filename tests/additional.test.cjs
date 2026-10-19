const test=require('node:test'),assert=require('node:assert/strict');const R=require('../src/additional-rules.js');
const base=()=>({currentUser:{name:'Auditor'},resguardantes:[{id:'u1',name:'Ana',area:'001',locations:['Oficina']}],inventory:[{'CLAVE UNICA':'100001',DESCRIPCION:'Original',UBICADO:'NO',areaOriginal:'002'}],additionalItems:[{id:'a1',posesion:'Cámara',personal:'No',usuario:'Ana',resguardanteId:'u1',ubicacionEspecifica:'Oficina',descripcion:'Observada',marca:'Marca',modelo:'Modelo',serie:'S001',claveAsignada:'CD-001-001',claveAutogenerada:true}],notes:{'100001':'Nota anterior'},photos:{},additionalPhotos:{}});
test('renumera claves automáticas y conserva manuales, incluso con prefijo CD',()=>{
 const s=base();s.additionalItems=[{...s.additionalItems[0],claveAsignada:'CD-001-003'}, {...s.additionalItems[0],id:'manual',claveAsignada:'CD-001-001',claveAutogenerada:false}];R.renumber(s);
 assert.equal(s.additionalItems[0].claveAsignada,'CD-001-002');assert.equal(s.additionalItems[1].claveAsignada,'CD-001-001');
});
test('vincular conserva campos originales y añade toda la evidencia a las notas',()=>{
 const s=base(),n=R.linkDraft(s,'a1','100001'),item=n.inventory[0];
 assert.equal(s.additionalItems.length,1);assert.equal(n.additionalItems.length,0);assert.equal(item.DESCRIPCION,'ORIGINAL');assert.equal(item._reviewOriginal.DESCRIPCION,'Original');
 assert.equal(item.UBICADO,'SI');assert.equal(item.RE_ETIQUETADO,'SI');assert.equal(item['NOMBRE DE USUARIO'],'Ana');assert.equal(item.ubicacionEspecifica,'Oficina');assert.equal(item.areaIncorrecta,true);
 for(const text of ['Nota anterior','Observada','Marca','Modelo','S001'])assert.ok(n.notes['100001'].includes(text));
});
test('no vincula personales, arrendamiento, ubicados ni ubicaciones inválidas',()=>{
 for(const change of [s=>s.additionalItems[0].personal='Si',s=>s.additionalItems[0].posesion='Arrendamiento',s=>s.inventory[0].UBICADO='SI',s=>s.additionalItems[0].ubicacionEspecifica='Otra']){const s=base();change(s);assert.throws(()=>R.linkDraft(s,'a1','100001'));}
});
test('arrendamiento usa un contador independiente, conserva claves manuales y migra los vacíos',()=>{
 const s=base();s.additionalItems.push(
  {id:'r1',posesion:'Arrendamiento',personal:'No',claveAsignada:'',claveAutogenerada:false,createdAt:1},
  {id:'r2',posesion:'Arrendamiento',personal:'No',claveAsignada:'',createdAt:2},
  {id:'manual',posesion:'Arrendamiento',personal:'No',claveAsignada:'ARR-002',claveAutogenerada:false}
 );
 R.renumber(s);
 assert.equal(s.additionalItems[0].claveAsignada,'CD-001-001');
 assert.equal(s.additionalItems[1].claveAsignada,'ARR-001');assert.equal(s.additionalItems[2].claveAsignada,'ARR-003');assert.equal(s.additionalItems[3].claveAsignada,'ARR-002');
 assert.equal(s.additionalItems[1].claveAutogenerada,true);
 s.additionalItems=s.additionalItems.filter(i=>i.id!=='r1');R.renumber(s);
 assert.equal(s.additionalItems.find(i=>i.id==='r2').claveAsignada,'ARR-001');
});
