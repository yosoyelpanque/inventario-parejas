const test=require('node:test'),assert=require('node:assert/strict');
const suggestions=require('../src/description-suggestions.js'),data=require('../src/data.js'),JSZip=require('../vendor/jszip.js');
const sample=()=>({inventory:[{DESCRIPCION:'  silla   de oficina '},{DESCRIPCION:'SILLA DE OFICINA'},{DESCRripcion:'Mesa'}],additionalItems:[{descripcion:'silla\tde oficina'},{descripcion:'Monitor'}],perfilesMagicos:[{desc:'MONITOR'},{desc:'Teléfono'}]});
test('normaliza y unifica las descripciones de inventario, adicionales y perfiles',()=>{
 assert.deepEqual(suggestions.catalog(sample()),['MESA','MONITOR','SILLA DE OFICINA','TELÉFONO']);
 assert.equal(suggestions.normalize('  Tele\u0301fono\n  fijo '),'TELÉFONO FIJO');
 assert.deepEqual(suggestions.catalog({inventory:null}),[]);
});
test('eliminar y restaurar una sugerencia no altera bienes ni perfiles',()=>{
 const state=sample(),before=structuredClone(state),excluded=suggestions.dismiss(state,'  silla DE oficina ');
 assert.deepEqual(state,before);assert.deepEqual(excluded,['SILLA DE OFICINA']);
 const hidden={...state,dismissedDescriptions:excluded};
 assert.deepEqual(suggestions.available(hidden),['MESA','MONITOR','TELÉFONO']);
 assert.deepEqual(suggestions.dismiss(hidden,'SILLA   DE OFICINA'),excluded);
 assert.deepEqual(suggestions.restore(hidden,'silla de oficina'),[]);
 assert.deepEqual(hidden.dismissedDescriptions,excluded);
 assert.deepEqual(state.inventory,before.inventory);assert.deepEqual(state.additionalItems,before.additionalItems);assert.deepEqual(state.perfilesMagicos,before.perfilesMagicos);
});
test('las exclusiones persisten en clean, serialización y respaldo ZIP',async()=>{
 const state={...sample(),dismissedDescriptions:suggestions.dismiss(sample(),'Monitor')};
 const zip=new JSZip();zip.file('data.json',JSON.stringify(data.clean(state)));
 const reopened=await JSZip.loadAsync(await zip.generateAsync({type:'nodebuffer'})),restored=data.clean(JSON.parse(await reopened.file('data.json').async('string')));
 assert.deepEqual(restored.dismissedDescriptions,['MONITOR']);assert(!suggestions.available(restored).includes('MONITOR'));
 assert.equal(restored.additionalItems[1].descripcion,'Monitor');assert.equal(restored.perfilesMagicos[0].desc,'MONITOR');
 restored.inventory.push({DESCRIPCION:'  monitor  '});assert(!suggestions.available(restored).includes('MONITOR'));
});
test('las exclusiones antiguas pueden restaurarse sin depender del catálogo actual',()=>{
 const state={dismissedDescriptions:['  anterior ','ANTERIOR',null,'']};
 assert.deepEqual(suggestions.dismissed(state),['ANTERIOR']);assert.deepEqual(suggestions.restore(state,'anterior'),[]);
 assert.deepEqual(suggestions.dismissed({dismissedDescriptions:'no-es-lista'}),[]);
});
