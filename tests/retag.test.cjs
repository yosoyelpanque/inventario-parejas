const {test}=require('node:test'),assert=require('node:assert/strict');
const r=require('../src/retag.js'),{clean}=require('../src/data.js');
test('etiquetar archiva sin alterar notas, autoría de ubicación ni el estado original',()=>{
 const state={inventory:[{'CLAVE UNICA':'1',DESCRIPCION:'Cámara',RE_ETIQUETADO:'SI',ubicadoPor:'Auditor A'}],notes:{1:'Conservar'}};
 const next=r.complete(state,'1','Auditor B','2026-09-22T10:00:00Z');
 assert.equal(state.inventory[0].RE_ETIQUETADO,'SI');assert.equal(next.inventory[0].ubicadoPor,'Auditor A');assert.deepEqual(next.notes,state.notes);
 assert.equal(r.list(next,false).length,0);assert.equal(r.list(next,true,'camara').length,1);
 assert.equal(clean(JSON.parse(JSON.stringify(next))).inventory[0].etiquetadoCompletado.por,'Auditor B');
 const reopened=r.reopen(next,'1');assert.equal(r.list(reopened,true).length,0);assert.equal(r.list(reopened,false).length,1);
 assert.throws(()=>r.complete(next,'1','B'));assert.throws(()=>r.reopen(state,'1'));
});
