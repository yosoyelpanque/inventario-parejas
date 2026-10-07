(function(root){
 'use strict';
 const text=value=>String(value??'').trim();
 const bookKey=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
 const key=(area,book)=>JSON.stringify([text(area),bookKey(book)]);
 function list(state){
  const groups=new Map((state.loadedListings||[]).map(b=>[key(b.areaId,b.bookType),{...b,count:0}]));
  for(const i of state.inventory){const id=key(i.areaOriginal,i.listadoOriginal);if(!groups.has(id))groups.set(id,{areaId:i.areaOriginal,bookType:i.listadoOriginal,dates:[],count:0});groups.get(id).count++;}
  return [...groups.values()];
 }
 // Names and users are retained after unloading; only listings and inventory imply a loaded area.
 function areas(state){return [...new Set([...(state.loadedListings||[]).map(b=>text(b.areaId)),...(state.inventory||[]).map(i=>text(i.areaOriginal))])].filter(Boolean);}
 function additionalOwner(state,item){return (state.resguardantes||[]).find(u=>item.resguardanteId?u.id===item.resguardanteId:u.name===item.usuario);}
 function additionalInInventory(state){const loaded=new Set(areas(state));return (state.additionalItems||[]).filter(item=>loaded.has(text(additionalOwner(state,item)?.area)));}
 function metadata(state,batches){
  const next=structuredClone(state),groups=new Map(list(state).map(b=>[key(b.areaId,b.bookType),b])),changes=[];
  next.responsablesList=next.responsablesList||[];next.areaNames=next.areaNames||{};
  const responsibleByArea=new Map();
  for(const b of batches){
   const id=key(b.areaId,b.bookType),old=groups.get(id)||{},label='Área '+b.areaId+' · '+b.bookType;
   const dates=b.dates?.length?b.dates:(old.dates||[]),responsible=b.responsible||old.responsible;
   if(b.dates?.length&&JSON.stringify(old.dates||[])!==JSON.stringify(dates))changes.push(label+' — Fecha: '+((old.dates||[]).join(', ')||'No registrada')+' → '+dates.join(', '));
   if(b.responsible){
    const previous=responsibleByArea.get(b.areaId);if(previous&&JSON.stringify(previous)!==JSON.stringify(b.responsible))throw Error('Los nuevos libros del área '+b.areaId+' indican responsables distintos. Revisa los archivos.');
    responsibleByArea.set(b.areaId,b.responsible);
    const index=next.responsablesList.findIndex(r=>r.area===b.areaId),r=next.responsablesList[index];
    if(!r||r.name!==b.responsible.name||r.title!==b.responsible.title)changes.push(label+' — Responsable: '+(r?.name||'No registrado')+' / '+(r?.title||'Sin cargo')+' → '+b.responsible.name+' / '+(b.responsible.title||'Sin cargo'));
    if(index<0)next.responsablesList.push(b.responsible);else next.responsablesList[index]={...r,...b.responsible};
   }
   if(b.areaName)next.areaNames[b.areaId]=b.areaName;
   groups.set(id,{...old,areaId:b.areaId,bookType:b.bookType,areaName:b.areaName||old.areaName,filename:b.filename,dates,responsible,location:b.location||old.location||'',updatedAt:Date.now()});
  }
  next.loadedListings=[...groups.values()].map(({count,...b})=>b);
  next.suggestedNames=[...new Set([...(next.suggestedNames||[]),...next.responsablesList.map(r=>r.name).filter(Boolean)])];
  return {next,changes};
 }
 function remove(state,area,book){
  const next=structuredClone(state);next.inventory=next.inventory.filter(i=>key(i.areaOriginal,i.listadoOriginal)!==key(area,book));
  next.loadedListings=list(state).filter(b=>key(b.areaId,b.bookType)!==key(area,book)).map(({count,...b})=>b);
  next.areas=areas(next);
  return next;
 }
 root.InventoryListings={list,metadata,remove,areas,additionalOwner,additionalInInventory};if(typeof module!=='undefined')module.exports=root.InventoryListings;
})(globalThis);
