const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function api(saved){const ctx={navigator:{mediaDevices:{getSupportedConstraints:()=>({pointsOfInterest:true})}},getComputedStyle:()=>({objectFit:"cover"}),document:{addEventListener(){},getElementById(){return null}},localStorage:{getItem(){return JSON.stringify(saved)}}};vm.runInNewContext(fs.readFileSync(require.resolve('../src/camera.js'),'utf8'),ctx);return ctx.InventoryCamera;}
test('selección automática y dispositivo exacto',async()=>{
 await api(null).use(async c=>assert.equal(c.facingMode,'environment'));
 await api({id:'back'}).use(async c=>assert.equal(c.deviceId.exact,'back'));
});
test('cámara ausente usa automática, permiso denegado no se reintenta',async()=>{
 let calls=0;await api({id:'missing'}).use(async c=>{calls++;if(c.deviceId)throw new DOMException('not found','NotFoundError');assert.equal(c.facingMode,'environment');});assert.equal(calls,2);
 calls=0;await assert.rejects(api({id:'back'}).use(async()=>{calls++;throw new DOMException('denied','NotAllowedError');}),{name:'NotAllowedError'});assert.equal(calls,1);
});

test('enfoque conserva resolución y solicita punto normalizado',async()=>{
 let received;const track={readyState:'live',getCapabilities:()=>({focusMode:['continuous','single-shot']}),getConstraints:()=>({width:1280}),applyConstraints:async c=>{received=c;}};
 assert.equal(await api().focus(track,{x:.2,y:.7}),'point');assert.equal(received.width,1280);assert.equal(received.advanced[0].focusMode,'single-shot');assert.equal(received.advanced[0].pointsOfInterest[0].x,.2);
});
test('cámara sin enfoque y cámara cerrada no reciben restricciones',async()=>{
 let calls=0;const track={getCapabilities:()=>({focusMode:['manual']}),applyConstraints:async()=>calls++};assert.equal(await api().focus(track,{x:.5,y:.5}),'unsupported');track.readyState='ended';assert.equal(await api().focus(track,{x:.5,y:.5}),'unsupported');assert.equal(calls,0);
});
test('error de enfoque se propaga para avisar sin cerrar la cámara',async()=>{
 await assert.rejects(api().focus({getCapabilities:()=>({focusMode:['continuous']}),applyConstraints:async()=>{throw Error('camera busy');}},{x:.5,y:.5}),/camera busy/);
});
test('punto contempla el recorte de object-cover',()=>{
 const video={videoWidth:1600,videoHeight:900,getBoundingClientRect:()=>({left:10,top:20,width:300,height:300})};const p=api().focusPoint(video,160,170);assert.equal(p.x,.5);assert.equal(p.y,.5);assert.ok(api().focusPoint(video,10,170).x>0);
});
