const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../src/listings.js');
const state={inventory:[{areaOriginal:'1',listadoOriginal:'C'},{areaOriginal:'1',listadoOriginal:'BM'},{areaOriginal:'2',listadoOriginal:'C'}],responsablesList:[{area:'1',name:'Ana',title:'Jefa'}],additionalItems:[{id:'x'}],notes:{a:'Nota'}};
test('cambios de metadatos sin cambios de bienes y sin mutar origen',()=>{const result=L.metadata(state,[{areaId:'1',bookType:'C',dates:['01/09/2026'],responsible:{area:'1',name:'Luis',title:'Director'}}]);assert.equal(result.changes.length,2);assert.equal(result.next.responsablesList[0].name,'Luis');assert.deepEqual(result.next.inventory,state.inventory);assert.equal(state.responsablesList[0].name,'Ana');assert.equal(L.metadata(result.next,[{areaId:'1',bookType:'C',dates:['01/09/2026'],responsible:{area:'1',name:'Luis',title:'Director'}}]).changes.length,0);const missing=L.metadata(result.next,[{areaId:'1',bookType:'C'}]).next;assert.equal(missing.responsablesList[0].name,'Luis');assert.deepEqual(missing.loadedListings[0].dates,['01/09/2026']);});
test('eliminar solo el libro seleccionado conserva otras áreas, notas y adicionales',()=>{const next=L.remove(state,'1','C');assert.equal(next.inventory.length,2);assert.equal(next.inventory[0].listadoOriginal,'BM');assert.deepEqual(next.notes,state.notes);assert.deepEqual(next.additionalItems,state.additionalItems);assert.equal(state.inventory.length,3);});
test('responsables contradictorios en el mismo lote se rechazan',()=>assert.throws(()=>L.metadata(state,[{areaId:'1',bookType:'C',responsible:{name:'Ana'}},{areaId:'1',bookType:'BM',responsible:{name:'Luis'}}]),/distintos/));

const fixture=()=>({
 inventory:[
  {'CLAVE UNICA':'001',areaOriginal:'0604500',listadoOriginal:'Cámara',UBICADO:'SI'},
  {'CLAVE UNICA':'002',areaOriginal:'0604500',listadoOriginal:'Bienes muebles',UBICADO:'NO'},
  {'CLAVE UNICA':'003',areaOriginal:'0700000',listadoOriginal:'Cámara',UBICADO:'SI'}
 ],
 loadedListings:[
  {areaId:'0604500',bookType:'Cámara',filename:'centro-c.xlsx'},
  {areaId:'0604500',bookType:'Bienes muebles',filename:'centro-bm.xlsx'},
  {areaId:'0700000',bookType:'Cámara',filename:'archivo-c.xlsx'}
 ],
 areas:['0604500','0700000','0999999'],areaNames:{'0604500':'Centro','0700000':'Archivo','0999999':'Área histórica'},
 resguardantes:[{id:'u1',name:'ANA',area:'0604500'},{id:'u2',name:'ANA',area:'0700000'}],
 additionalItems:[{id:'a1',resguardanteId:'u1',usuario:'ANA',descripcion:'Adicional centro'},{id:'a2',resguardanteId:'u2',usuario:'ANA',descripcion:'Adicional archivo'}],
 notes:{'001':'Revisar etiqueta'},archivedNotes:{'002':'Verificado antes'},photos:{'001':true},additionalPhotos:{a1:true},
 responsablesList:[{area:'0604500',name:'RESPONSABLE'}],locations:{OFICINA:{count:1}},activeResguardante:{id:'u1',name:'ANA',area:'0604500'}
});

test('áreas cargadas salen de listados o bienes y conservan ceros iniciales',()=>{
 const input={loadedListings:[{areaId:' 0604500 '},{areaId:9},{areaId:''}],inventory:[{areaOriginal:'0604500'},{areaOriginal:' 0700000 '},{areaOriginal:9}],areaNames:{'0999999':'Histórica'},resguardantes:[{area:'0888888'}],areas:['0777777']};
 const before=structuredClone(input);
 assert.deepEqual(L.areas(input),['0604500','9','0700000']);
 assert.deepEqual(L.areas({areaNames:input.areaNames,resguardantes:input.resguardantes,areas:input.areas}),[]);
 assert.deepEqual(input,before);
});

test('agrupa libros equivalentes con espacios, acentos o mayúsculas sin confundir claves de área',()=>{
 const input={loadedListings:[{areaId:' 0604500 ',bookType:'  BIENES   CÁMARA '},{areaId:'0604500',bookType:'bienes camara'}],inventory:[
  {areaOriginal:'0604500',listadoOriginal:'Bienes Ca\u0301mara'},
  {areaOriginal:' 0604500 ',listadoOriginal:' BIENES   CAMARA '},
  {areaOriginal:'604500',listadoOriginal:'Bienes Cámara'}
 ]};
 const before=structuredClone(input),groups=L.list(input);
 assert.equal(groups.length,2);assert.equal(groups.find(group=>String(group.areaId).trim()==='0604500').count,2);
 assert.equal(groups.find(group=>String(group.areaId).trim()==='604500').count,1);
 const next=L.remove(input,' 0604500 ','bienES cámara');
 assert.deepEqual(next.inventory,[input.inventory[2]]);assert.deepEqual(L.areas(next),['604500']);
 assert.deepEqual(input,before);
});

test('quitar un libro conserva el otro y quitar ambos retira el área cargada sin borrar capturas',()=>{
 const input=fixture(),before=structuredClone(input);
 const first=L.remove(input,'0604500','camara');
 assert.deepEqual(first.inventory.map(item=>item['CLAVE UNICA']),['002','003']);
 assert.deepEqual(first.areas,['0604500','0700000']);
 assert.deepEqual(L.additionalInInventory(first).map(item=>item.id),['a1','a2']);
 const second=L.remove(first,'0604500','BIENES   MUEBLES');
 assert.deepEqual(second.inventory.map(item=>item['CLAVE UNICA']),['003']);
 assert.deepEqual(second.loadedListings,[input.loadedListings[2]]);assert.deepEqual(second.areas,['0700000']);
 assert.deepEqual(L.additionalInInventory(second).map(item=>item.id),['a2']);
 for(const field of ['additionalItems','notes','archivedNotes','photos','additionalPhotos','resguardantes','responsablesList','locations','activeResguardante','areaNames'])assert.deepEqual(second[field],before[field],field+' debe conservarse');
 const empty=L.remove(second,'0700000','Cámara');
 assert.deepEqual(empty.inventory,[]);assert.deepEqual(empty.loadedListings,[]);assert.deepEqual(empty.areas,[]);assert.deepEqual(L.additionalInInventory(empty),[]);
 assert.deepEqual(empty.additionalItems,before.additionalItems);assert.deepEqual(input,before);
});

test('adicionales usan identidad del resguardante antes que nombre y solo aparecen en áreas cargadas',()=>{
 const input={inventory:[],loadedListings:[{areaId:' 0604500 '}],resguardantes:[
  {id:'otro',name:'ANA',area:'0700000'},{id:'correcto',name:'ANA',area:'0604500'},{id:'legado',name:'LUIS',area:' 0604500 '}
 ],additionalItems:[
  {id:'por-id',resguardanteId:'correcto',usuario:'ANA'},
  {id:'fuera',resguardanteId:'otro',usuario:'LUIS'},
  {id:'sin-id',usuario:'LUIS'},
  {id:'id-inexistente',resguardanteId:'ausente',usuario:'LUIS'},
  {id:'sin-usuario',usuario:'NADIE'}
 ]};
 const before=structuredClone(input);
 assert.deepEqual(L.additionalInInventory(input).map(item=>item.id),['por-id','sin-id']);
 assert.deepEqual(input,before);
});

test('directorio muestra responsables solo de áreas cargadas y conserva ceros iniciales',()=>{
 const input={loadedListings:[{areaId:' 0604500 '},{areaId:9}],inventory:[{areaOriginal:' 0700000 '}],
  areas:['0999999'],areaNames:{'0999999':'Histórica'},resguardantes:[{area:'0888888'}],
  responsablesList:[
   {area:'0604500',name:'CENTRO'},{area:'604500',name:'OTRA CLAVE'},
   {area:' 0700000 ',name:'ARCHIVO'},{area:'9',name:'NUEVE'},
   {area:'0999999',name:'HISTÓRICO'},{area:'0888888',name:'CON CAPTURAS'},{area:'',name:'SIN ÁREA'}
  ]};
 const before=structuredClone(input);
 assert.deepEqual(L.responsibles(input).map(person=>person.name),['CENTRO','ARCHIVO','NUEVE']);
 assert.deepEqual(L.responsibles({responsablesList:input.responsablesList,areas:input.areas,areaNames:input.areaNames,resguardantes:input.resguardantes}),[]);
 assert.deepEqual(L.responsibles({inventory:[],loadedListings:[]}),[]);
 assert.deepEqual(input,before);
});

test('responsable permanece al quitar un libro, se oculta al quitar el último y reaparece al deshacer o recargar',()=>{
 const input=fixture();
 input.responsablesList.push({area:'0700000',name:'RESPONSABLE ARCHIVO'},{area:'0999999',name:'HISTÓRICO'});
 const before=structuredClone(input),first=L.remove(input,'0604500','Cámara');
 assert.deepEqual(L.responsibles(first).map(person=>person.area),['0604500','0700000']);
 const second=L.remove(first,'0604500','Bienes muebles');
 assert.deepEqual(L.responsibles(second).map(person=>person.area),['0700000']);
 assert.deepEqual(second.responsablesList,before.responsablesList);
 const serialized=JSON.parse(JSON.stringify(second));
 assert.deepEqual(L.responsibles(serialized).map(person=>person.area),['0700000']);
 const undone=structuredClone(first);
 assert.deepEqual(L.responsibles(undone).map(person=>person.area),['0604500','0700000']);
 const reloaded=L.metadata(second,[{areaId:'0604500',bookType:'Cámara',areaName:'Centro'}]).next;
 assert.deepEqual(L.responsibles(reloaded).map(person=>person.area),['0604500','0700000']);
 assert.deepEqual(reloaded.responsablesList,before.responsablesList);
 const empty=L.remove(second,'0700000','Cámara');
 assert.deepEqual(L.responsibles(empty),[]);
 for(const field of ['responsablesList','additionalItems','notes','archivedNotes','photos','additionalPhotos','resguardantes','locations','activeResguardante','areaNames'])assert.deepEqual(empty[field],before[field],field+' debe conservarse');
 assert.deepEqual(input,before);
});

test('quitar listados persiste en JSON y ZIP; recargarlos vuelve a mostrar los adicionales conservados',async()=>{
 const data=require('../src/data.js'),JSZip=require('../vendor/jszip.js'),input=fixture();
 const removed=L.remove(L.remove(input,'0604500','Cámara'),'0604500','Bienes muebles');
 const jsonState=data.clean(JSON.parse(JSON.stringify(data.clean(removed))));
 assert.deepEqual(L.areas(jsonState),['0700000']);assert.deepEqual(L.additionalInInventory(jsonState).map(item=>item.id),['a2']);
 const zip=new JSZip();zip.file('session.json',JSON.stringify(data.clean(removed)));
 const archive=await JSZip.loadAsync(await zip.generateAsync({type:'nodebuffer'}));
 const restored=data.clean(JSON.parse(await archive.file('session.json').async('string')));
 assert.deepEqual(L.areas(restored),['0700000']);assert.deepEqual(restored.additionalItems,input.additionalItems);assert.deepEqual(restored.notes,input.notes);
 const reloaded=L.metadata({...restored,inventory:[...restored.inventory,input.inventory[0]]},[{areaId:'0604500',bookType:'Cámara',areaName:'Centro'}]).next;
 assert.deepEqual(new Set(L.areas(reloaded)),new Set(['0700000','0604500']));
 assert.deepEqual(L.additionalInInventory(reloaded).map(item=>item.id),['a1','a2']);assert.deepEqual(reloaded.additionalItems,input.additionalItems);
});
