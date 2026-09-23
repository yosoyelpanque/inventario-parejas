const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function api(saved){const ctx={document:{addEventListener(){},getElementById(){return null}},localStorage:{getItem(){return JSON.stringify(saved)}}};vm.runInNewContext(fs.readFileSync(require.resolve('../src/camera.js'),'utf8'),ctx);return ctx.InventoryCamera;}
test('selección automática y dispositivo exacto',async()=>{
 await api(null).use(async c=>assert.equal(c.facingMode,'environment'));
 await api({id:'back'}).use(async c=>assert.equal(c.deviceId.exact,'back'));
});
test('cámara ausente usa automática, permiso denegado no se reintenta',async()=>{
 let calls=0;await api({id:'missing'}).use(async c=>{calls++;if(c.deviceId)throw new DOMException('not found','NotFoundError');assert.equal(c.facingMode,'environment');});assert.equal(calls,2);
 calls=0;await assert.rejects(api({id:'back'}).use(async()=>{calls++;throw new DOMException('denied','NotAllowedError');}),{name:'NotAllowedError'});assert.equal(calls,1);
});
