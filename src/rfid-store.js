(function(root){
 'use strict';const core=root.InventoryRFIDCore;
 function row(record){return {...record,keys:record.links.map(l=>l.key),conflict:record.links.length>1&&!record.selectedKey?1:0};}
 function enqueue(tx,pack){
  const store=tx.objectStore('rfidTags');store.clear();for(const r of pack.records)store.put(row(r),r.tag);
  tx.objectStore('appData').put({format:pack.format,version:pack.version,sources:pack.sources,issues:pack.issues,stats:pack.stats,summary:core.summarize(pack),updatedAt:new Date().toISOString()},'rfidCatalog');
 }
 function exportPack(storage){return storage.transaction(['appData','rfidTags'],'readonly',tx=>{const meta=tx.objectStore('appData').get('rfidCatalog'),tags=tx.objectStore('rfidTags').getAll();return ()=>meta.result?{...meta.result,records:tags.result.map(r=>{const {keys,conflict,...v}=r;return v;})}:core.empty();});}
 async function save(storage,pack){core.validate(pack);await storage.flush();await storage.track(new Promise((resolve,reject)=>{const tx=storage.db.transaction(['rfidTags','appData'],'readwrite');tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||Error('No se guardó el catálogo. Se conserva el anterior.'));const req=tx.objectStore('appData').get('rfidCatalog');req.onsuccess=()=>{try{if('baseRevision' in pack&&(req.result?.updatedAt||null)!==pack.baseRevision)throw Error('El catálogo cambió en otra operación. Vuelve a importar para comparar los datos actuales.');enqueue(tx,pack);}catch(e){tx.abort();reject(e);}};}),'rfidCatalog');}
 function search(storage,value,conflicts=false){return new Promise((resolve,reject)=>{
  const store=storage.db.transaction('rfidTags').objectStore('rfidTags');let req;
  if(conflicts)req=store.index('conflict').getAll(1,51);
  else if(core.validTag(core.tag(value)))req=store.get(core.tag(value));
  else req=store.index('keys').getAll(core.key(value),51);
  req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:req.result?[req.result]:[]);req.onerror=()=>reject(req.error);
 });}
 async function resolveTag(storage,t,k){
  await storage.flush();await storage.track(new Promise((resolve,reject)=>{const tx=storage.db.transaction(['rfidTags','appData'],'readwrite');tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||Error('No se pudo guardar la resolución'));
   const req=tx.objectStore('rfidTags').get(t);req.onsuccess=()=>{try{const r=req.result;if(!r||!r.links.some(l=>l.key===k)&&k!=='')throw Error('La asociación ya no existe');const old=r.conflict;r.selectedKey=k;r.decisions=[...(r.decisions||[]),{key:k,at:new Date().toISOString()}];const next=row(r);tx.objectStore('rfidTags').put(next,t);const m=tx.objectStore('appData').get('rfidCatalog');m.onsuccess=()=>{const meta=m.result;meta.summary.pending+=next.conflict-old;meta.updatedAt=new Date().toISOString();tx.objectStore('appData').put(meta,'rfidCatalog');};}catch(e){tx.abort();reject(e);}};
  }),'rfidCatalog');
 }
 root.InventoryRFIDStore={enqueue,exportPack,save,search,resolveTag};
})(globalThis);
