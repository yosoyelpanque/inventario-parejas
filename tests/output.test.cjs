const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../src/output.js'),'utf8');
function setup(plugin){const window={Capacitor:{isNativePlatform:()=>true,registerPlugin:()=>plugin}};vm.runInNewContext(source,{window,Blob,Uint8Array,btoa});return window.InventoryOutput;}
test('Android exporta fragmentos íntegros y espera la escritura antes de confirmar',async()=>{
 const chunks=[],calls=[];const api=setup({beginExport:async()=>({id:'one'}),appendExport:async p=>chunks.push(Buffer.from(p.data,'base64')),finishExport:async p=>calls.push(p.name),cancelExport:async()=>calls.push('clean')});
 const bytes=Buffer.alloc(800000,123);await api.save(new Blob([bytes]),'respaldo.zip');
 assert.deepEqual(Buffer.concat(chunks),bytes);assert.equal(chunks.length,4);assert.deepEqual(calls,['respaldo.zip','clean']);
});
test('Cancelar guardado rechaza y libera la siguiente exportación',async()=>{
 let starts=0,cleaned=0;const api=setup({beginExport:async()=>({id:String(++starts)}),appendExport:async()=>{},finishExport:async()=>{throw Error('Guardado cancelado');},cancelExport:async()=>{cleaned++;}});
 await assert.rejects(api.save(new Blob(['a']),'a'),/cancelado/);await assert.rejects(api.save(new Blob(['b']),'b'),/cancelado/);assert.equal(cleaned,2);
});
test('puente Android inyectado sin registerPlugin permite guardar e imprimir',async()=>{
 const calls=[],window={Capacitor:{isNativePlatform:()=>true,Plugins:{InventoryFiles:{beginExport:async()=>({id:'native'}),appendExport:async()=>calls.push('chunk'),finishExport:async()=>calls.push('saved'),cancelExport:async()=>{},print:async()=>calls.push('printed')}}}};
 vm.runInNewContext(source,{window,Blob,Uint8Array,btoa});assert.ok(window.InventoryOutput);
 await window.InventoryOutput.save(new Blob(['respaldo']),'a.zip');await window.InventoryOutput.print();assert.deepEqual(calls,['chunk','saved','printed']);
});
test('módulo permanece definido si falta el plugin y explica el fallo al guardar',async()=>{
 const window={Capacitor:{isNativePlatform:()=>true}};vm.runInNewContext(source,{window,Blob,Uint8Array,btoa});
 assert.ok(window.InventoryOutput);await assert.rejects(window.InventoryOutput.save(new Blob(['a']),'a.zip'),/guardado nativo/);
});
