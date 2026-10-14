const test=require('node:test'),assert=require('node:assert/strict');
const suggestions=require('../src/note-suggestions.js'),data=require('../src/data.js'),JSZip=require('../vendor/jszip.js');
const sample=()=>({inventory:[{'CLAVE UNICA':'01'}],notes:{'01':'Nota con error','02':'REVISAR SERIE','03':'  revisar   serie  '},archivedNotes:{'04':'Nota con error','05':'Ya revisado'}});
test('sugerencias de notas se filtran sin duplicados y conservan el texto original',()=>{
 const state=sample();assert.deepEqual(suggestions.list(state),['Nota con error','REVISAR SERIE','Ya revisado']);
 assert.deepEqual(suggestions.list(state,'Revis'),['REVISAR SERIE','Ya revisado']);
 assert.deepEqual(suggestions.list(state,'revisar serie'),[]);
 assert.deepEqual(suggestions.list({notes:{a:null,b:42,c:''}}),[]);
});
test('eliminar sugerencia no elimina ni modifica notas de bienes o archivadas',()=>{
 const state=sample(),before=structuredClone(state),values=suggestions.dismiss(state,'  NOTA CON ERROR ');
 assert.deepEqual(state,before);assert.deepEqual(values,['nota con error']);
 const next={...state,dismissedNoteSuggestions:values};
 assert.deepEqual(suggestions.list(next),['REVISAR SERIE','Ya revisado']);
 assert.deepEqual(suggestions.dismiss(next,'Nota con error'),values);
 assert.deepEqual(next.notes,before.notes);assert.deepEqual(next.archivedNotes,before.archivedNotes);
});
test('sugerencias eliminadas persisten al serializar y restaurar el ZIP',async()=>{
 const state=sample();state.dismissedNoteSuggestions=suggestions.dismiss(state,'Nota con error');
 const zip=new JSZip();zip.file('session.json',JSON.stringify(data.clean(state)));
 const archive=await JSZip.loadAsync(await zip.generateAsync({type:'nodebuffer'}));
 const restored=data.clean(JSON.parse(await archive.file('session.json').async('string')));
 assert.deepEqual(restored.notes,state.notes);assert.deepEqual(restored.archivedNotes,state.archivedNotes);
 assert.deepEqual(suggestions.list(restored),['REVISAR SERIE','Ya revisado']);
});

test('sugerencias por tipo usan el bien de origen, incluyendo archivadas y notas masivas',()=>{
 const state={inventory:[{'CLAVE UNICA':'s',DESCRIPCION:'SILLA SECRETARIAL'},{'CLAVE UNICA':'l',DESCRIPCION:'LIBRERO DE MADERA'}],notes:{s:'REVISAR RESPALDO',l:'TIENE DOS ENTREPAÑOS'},archivedNotes:{old:'SILLA CON BRAZOS'},additionalItems:[]};
 assert.deepEqual(suggestions.list(state,'',['SILLAS']),['REVISAR RESPALDO','SILLA CON BRAZOS']);
 assert.deepEqual(suggestions.list(state,'',['LIBRERO']),['TIENE DOS ENTREPAÑOS']);
 assert.equal(suggestions.list(state,'',['SILLA','LIBRERO']).length,3);
 assert.equal(suggestions.list(state,'',[]).length,0);
 const templates=suggestions.templates(state,'',['SILLA SECRETARIAL']);
 assert.ok(templates.length>0);assert.ok(templates.every(t=>suggestions.kind(t.label)==='silla'));
 assert.equal(suggestions.templates(state,'',['TIPO DESCONOCIDO']).length,0);
});
