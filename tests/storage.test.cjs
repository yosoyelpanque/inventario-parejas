const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 let opens=0,starts=0,closed=false,last;
 const window={addEventListener(){},dispatchEvent(){}};
 const db=()=>({close(){this.closed=true;},transaction(){starts++;if(this.closed)throw new DOMException('The database connection is closing.','InvalidStateError');const tx={abort(){queueMicrotask(()=>tx.onabort());}};queueMicrotask(()=>tx.oncomplete?.());return tx;}});
 const indexedDB={open(){opens++;const req={};queueMicrotask(()=>{last=db();req.result=last;req.onsuccess();});return req;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/storage.js'),'utf8'),{window,indexedDB,navigator:{},CustomEvent:class{},Date,Set,Map,Error});
 return {api:window.InventoryStorage,get opens(){return opens},get starts(){return starts}};
}
test('reabre una conexión cerrada y comparte apertura entre lecturas concurrentes',async()=>{
 const s=setup();await s.api.init('test');s.api.db.close();let calls=0;
 const r=await Promise.all([s.api.transaction('appData','readonly',()=>{calls++;return 1}),s.api.transaction('photos','readonly',()=>{calls++;return 2})]);
 assert.deepEqual(r,[1,2]);assert.equal(s.opens,2);assert.equal(calls,2);
});
test('cierre inesperado invalida la referencia y permite guardar nuevamente',async()=>{
 const s=setup();await s.api.init('test');s.api.db.onclose();assert.equal(s.api.db,null);
 await s.api.transaction('appData','readwrite',()=>{});assert.equal(s.opens,2);
});
test('no reintenta una escritura abortada ni oculta otros errores',async()=>{
 const s=setup();await s.api.init('test');let calls=0;
 await assert.rejects(s.api.transaction('appData','readwrite',()=>{calls++;throw Error('Sin espacio');}),/Sin espacio/);
 assert.equal(calls,1);assert.equal(s.opens,1);
 s.api.db.transaction=()=>{throw new DOMException('Missing store','NotFoundError');};
 await assert.rejects(s.api.transaction('missing','readonly',()=>{}),{name:'NotFoundError'});assert.equal(s.opens,1);
});
