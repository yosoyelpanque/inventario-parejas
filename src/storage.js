(function () {
  'use strict';
  let opening = null;
  const pending = new Set();
  const failures = new Map();
  window.addEventListener('beforeunload',e=>{if(pending.size||failures.size){e.preventDefault();e.returnValue='';}});
  const api = {
    db: null, name: null,
    acquireWorkspace() {
      // One writer for the entire workspace, including photos, drafts and RFID.
      // The browser releases this lock when the document closes or reloads.
      return new Promise((resolve,reject) => {
        if (!navigator.locks) return reject(new Error('Actualiza el navegador para proteger el inventario entre pestañas.'));
        navigator.locks.request('inventario-parejas-workspace', async () => {
          resolve();
          await new Promise(() => {});
        }).catch(reject);
      });
    },
    async init(accountId) {
      if (!accountId) throw new Error('Falta el espacio de trabajo local');
      api.name = 'InventarioPro-vNext-' + accountId;
      await api.connect();
    },
    async connect() {
      if (api.db) return api.db;
      if (!api.name) throw new Error('Almacenamiento no disponible');
      if (opening) return opening;
      opening = new Promise((resolve,reject) => {
        let blocked=false;
        const req = indexedDB.open(api.name, 2);
        req.onupgradeneeded = () => {
          for (const store of ['photos','layoutImages','appData']) if(!req.result.objectStoreNames.contains(store))req.result.createObjectStore(store);
          if(!req.result.objectStoreNames.contains('rfidTags')){const tags=req.result.createObjectStore('rfidTags');tags.createIndex('keys','keys',{multiEntry:true});tags.createIndex('conflict','conflict');}
        };
        req.onsuccess = () => {
          const db=req.result;
          if(blocked){db.close();return;}
          const forget=()=>{if(api.db===db)api.db=null;};
          db.onclose=forget;
          db.onversionchange=()=>{forget();db.close();};
          api.db=db;resolve(db);
        };
        req.onerror = () => reject(req.error);
        req.onblocked = () => {blocked=true;reject(new Error('Cierra otras ventanas de la aplicación para abrir el almacenamiento'));};
      });
      try { return await opening; } finally { opening=null; }
    },
    async transaction(stores,mode,operation) {
      let tx;
      for(let attempt=0;attempt<2;attempt++) {
        const db=await api.connect();
        try { tx=db.transaction(stores,mode);break; }
        catch(error) {
          // Retry only failure to START: never replay an aborted or committed write.
          if(error.name!=='InvalidStateError'||attempt)throw error;
          if(api.db===db)api.db=null;
          db.close();
        }
      }
      return new Promise((resolve,reject)=>{
        let result;
        tx.oncomplete=()=>{try{resolve(typeof result==='function'?result():result);}catch(error){reject(error);}};
        tx.onabort=tx.onerror=()=>reject(tx.error||new Error('No se pudo completar la operación de almacenamiento'));
        try { result=operation(tx); } catch(error) { tx.abort();reject(error); }
      });
    },
    setItem(store,key,value,related=[]) {
      const task = api.transaction([...new Set([store,...related.map(item=>item.store)])],'readwrite',tx=>{
        tx.objectStore(store).put(value,key);
        for(const item of related)tx.objectStore(item.store).put(item.value,item.key);
      });
      pending.add(task);
      window.dispatchEvent(new CustomEvent('inventory-save', {detail:'Guardando en este equipo…'}));
      task.then(() => {
        pending.delete(task);failures.delete(store+'|'+key);
        if (!pending.size && !failures.size) window.dispatchEvent(new CustomEvent('inventory-save', {detail:'Guardado en este equipo a las '+new Date().toLocaleTimeString('es-MX')+' · Almacenamiento local'}));
      }, error => {
        pending.delete(task);failures.set(store+'|'+key,error);
        window.dispatchEvent(new CustomEvent('inventory-save', {detail:'Error de guardado: conserva la aplicación abierta y exporta un respaldo'}));
      });
      return task;
    },
    getItem(store,key) {
      return api.transaction(store,'readonly',tx=>{
        const req=tx.objectStore(store).get(key);
        return ()=>req.result;
      });
    },
    getAllItems(store) {
      return api.transaction(store,'readonly',tx=>{
        const objectStore=tx.objectStore(store);
        const keys=objectStore.getAllKeys(),values=objectStore.getAll();
        return ()=>keys.result.map((key,i)=>({key,value:values.result[i]}));
      });
    },
    track(task,key) {
      pending.add(task);window.dispatchEvent(new CustomEvent('inventory-save',{detail:'Guardando catálogo RFID…'}));
      task.then(()=>{pending.delete(task);window.dispatchEvent(new CustomEvent('inventory-save',{detail:'Catálogo RFID guardado en este equipo'}));},()=>{pending.delete(task);window.dispatchEvent(new CustomEvent('inventory-save',{detail:'No se guardó el catálogo RFID. Se conserva el anterior'}));});return task;
    },
    async flush() { await Promise.all([...pending]);if(failures.size)throw new Error('Hay cambios que no se pudieron guardar'); }
  };
  window.InventoryStorage = api;
})();
