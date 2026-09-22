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
