(function(){
 'use strict';
 window.addEventListener('DOMContentLoaded',()=>{
  const $=id=>document.getElementById(id),core=InventoryRFIDCore,store=InventoryRFIDStore,storage=InventoryStorage;
  const panel=$('rfid-panel');let prepared=null,worker=null,searchId=0;
  const number=n=>Number(n||0).toLocaleString('es-MX');
  const message=s=>{$('rfid-message').textContent=s;};
  function busy(value){window.InventoryRFIDBusy=value;panel.querySelectorAll('button,input').forEach(el=>el.disabled=value);$('rfid-cancel').disabled=false;}
  async function refresh(){if(!storage.db)return;const meta=await storage.getItem('appData','rfidCatalog'),s=meta?.summary; $('rfid-summary').textContent=s?number(s.tags)+' tags · '+number(s.keys)+' claves · '+number(s.pending)+' tags pendientes de revisión. Actualizado: '+new Date(meta.updatedAt).toLocaleString('es-MX'):'Aún no hay catálogo RFID en este equipo.';}
  function cancel(){if(worker)worker.terminate();worker=null;prepared=null;$('rfid-preview').hidden=true;busy(false);message('Importación cancelada. El catálogo guardado se conserva.');}
  $('rfid-cancel').onclick=cancel;
  $('rfid-files').onchange=async e=>{
   const files=[...e.target.files];e.target.value='';if(!files.length)return;
   prepared=null;$('rfid-preview').hidden=false;$('rfid-preview-content').replaceChildren();$('rfid-apply').hidden=true;busy(true);
   message('Leyendo archivos en este equipo…');
   const thisWorker=new Worker('src/rfid-worker.js');worker=thisWorker;
   thisWorker.onerror=()=>{if(worker!==thisWorker)return;thisWorker.terminate();worker=null;busy(false);message('No se pudo analizar el archivo. El catálogo anterior se conserva.');};
   thisWorker.onmessage=e=>{if(worker!==thisWorker)return;if(e.data.progress){message(e.data.progress);return;}thisWorker.terminate();worker=null;busy(false);
    if(e.data.error){message(e.data.error);return;}prepared=e.data.pack;const s=prepared.importSummary,total=prepared.summary;
    $('rfid-preview-content').textContent='Archivos: '+files.map(f=>f.name).join(', ')+'. '+number(s.rows)+' filas revisadas. '+number(s.tags)+' tags reconocidos en esta importación. '+number(prepared.added)+' asociaciones nuevas. '+number(s.invalid)+' celdas para revisar. El catálogo resultante tendrá '+number(total.tags)+' tags y '+number(total.pending)+' conflictos pendientes. Hojas omitidas: '+(s.skippedSheets?.join(', ')||'ninguna')+'.';
    $('rfid-apply').hidden=false;message('Revisa el resumen y confirma para guardar. Todavía no se han cambiado datos.');
   };
   try{const current=await store.exportPack(storage),payload=[];for(const file of files)payload.push({name:file.name,data:await file.arrayBuffer()});if(worker===thisWorker)thisWorker.postMessage({current,files:payload},payload.map(f=>f.data));}catch(e){cancel();message(e.message);}
  };
  $('rfid-apply').onclick=async()=>{if(!prepared)return;busy(true);$('rfid-cancel').disabled=true;message('Guardando catálogo. Conserva esta página abierta…');try{await store.save(storage,prepared);prepared=null;$('rfid-preview').hidden=true;$('rfid-results').replaceChildren();await refresh();message('Catálogo guardado. No se modificaron bienes, áreas ni notas.');}catch(e){message(e.message);}finally{busy(false);}};
  function download(content,name,type){return InventoryOutput.save(new Blob([content],{type}),name);}
  $('rfid-export').onclick=async()=>{busy(true);try{const p=await store.exportPack(storage);if(!p.records.length)throw Error('No hay catálogo para respaldar');core.validate(p);await download(JSON.stringify(p),'Catalogo_RFID_'+new Date().toISOString().slice(0,10)+'.json','application/json');message('Respaldo del catálogo generado. Puedes importarlo en otro equipo desde este panel.');}catch(e){message(e.message);}finally{busy(false);}};
  $('rfid-issues').onclick=async()=>{try{const meta=await storage.getItem('appData','rfidCatalog'),issues=meta?.issues||[];if(!issues.length){message('No hay celdas excluidas registradas.');return;}await download(JSON.stringify(issues,null,2),'Revision_RFID.json','application/json');message(number(issues.length)+' celdas excluidas exportadas con archivo, hoja y fila.');}catch(e){message(e.message);}};
  function el(type,text){const n=document.createElement(type);if(text!=null)n.textContent=text;return n;}
  async function search(conflicts=false){const id=++searchId;$('rfid-results').replaceChildren();try{
   const value=$('rfid-query').value;if(!conflicts&&!value.trim()){message('Escribe una clave única o un tag completo.');return;}
   const records=await store.search(storage,value,conflicts),meta=await storage.getItem('appData','rfidCatalog'),state=await storage.getItem('appData','mainState');if(id!==searchId)return;
   const inventory=new Map((state?.inventory||[]).map(i=>[core.key(i['CLAVE UNICA']),i]));
   const sources=new Map((meta?.sources||[]).map(s=>[s.id,s]));message(records.length?'Resultados de consulta. Las áreas y descripciones del catálogo son referencias históricas.':'Sin coincidencias.');
   if(records.length>50)$('rfid-results').append(el('p','Se muestran 50 resultados. Resuelve los pendientes y vuelve a consultar.'));
   for(const r of records.slice(0,50)){
    const card=el('article');card.className='rfid-card';card.append(el('strong',r.tag),el('p',r.links.length>1?(r.selectedKey?'Asociación elegida: '+r.selectedKey:'Pendiente: este tag tiene varias claves'):'Clave identificada: '+r.links[0].key));
    for(const link of r.links){const detail=el('details'),summary=el('summary',link.key+' · '+link.description),item=inventory.get(link.key);detail.append(summary,el('p',item?'En inventario cargado: '+item.DESCRIPCION+' · Área '+(item.areaOriginal||'sin indicar')+' · Ubicado: '+(item.UBICADO||'NO'):'Esta clave no está en los listados cargados.'),el('p','Área de referencia: '+(link.area||'No indicada')),el('p','Claves originales: '+link.originals.join(', ')));for(const ref of link.sources){const s=sources.get(ref);if(s)detail.append(el('p',s.file+' / '+s.sheet+' / '+s.column));}card.append(detail);}
    if(r.links.length>1){const label=el('label','Clave correcta tras revisar el bien: '),select=el('select');select.setAttribute('aria-label','Resolver '+r.tag);select.append(new Option('Mantener pendiente',''));for(const l of r.links)select.append(new Option(l.key,l.key));select.value=r.selectedKey||'';label.append(select);const confirm=el('label'),check=el('input');check.type='checkbox';confirm.append(check,document.createTextNode(' He verificado esta asociación'));const button=el('button','Guardar revisión');button.dataset.action='save';button.type='button';button.onclick=async()=>{if(!check.checked){message('Confirma que verificaste la asociación antes de guardarla.');return;}busy(true);try{await store.resolveTag(storage,r.tag,select.value);await refresh();await search(conflicts);}catch(e){message(e.message);}finally{busy(false);}};card.append(label,confirm,button);}
    $('rfid-results').append(card);
   }
  }catch(e){message(e.message);}}
  $('rfid-search').onclick=()=>search();$('rfid-conflicts').onclick=()=>search(true);$('rfid-query').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search();}};
  document.querySelector('.tab-btn[data-tab="settings"]').addEventListener('click',()=>refresh().catch(e=>message(e.message)));
  window.addEventListener('beforeunload',e=>{if(window.InventoryRFIDBusy||prepared){e.preventDefault();e.returnValue='';}});
 });
})();
