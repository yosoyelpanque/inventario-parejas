(function(root){
 'use strict';
 const norm=value=>String(value??'').trim().toUpperCase();
 const generated=item=>item.personal!=='Si'&&['Cámara','Arrendamiento'].includes(item.posesion)&&(!item.claveAsignada||item.claveAutogenerada===true||(item.posesion==='Cámara'&&item.claveAutogenerada===undefined&&/^CD[-|]/.test(item.claveAsignada)));
 function renumber(state){
  const counters={},changes=[];
  const reserved=new Set(state.additionalItems.filter(i=>!generated(i)).map(i=>i.claveAsignada));
  [...state.additionalItems].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).forEach(item=>{
   if(!generated(item))return;
   const user=state.resguardantes.find(u=>item.resguardanteId?u.id===item.resguardanteId:u.name===item.usuario);
   const area=user?.area||'0000000';
   const group=item.posesion==='Arrendamiento'?'ARR':'CD-'+area;let key;
   do {key=group+'-'+String(counters[group]=(counters[group]||0)+1).padStart(3,'0');}while(reserved.has(key));
   if(item.claveAsignada&&item.claveAsignada!==key)changes.push([item.claveAsignada,key]);
   item.claveAsignada=key;item.claveAutogenerada=true;
  });
  for(const field of ['notes','archivedNotes','noteDetails','archivedNoteDetails'])if(state[field]){
   const old={...state[field]};for(const [from] of changes)delete state[field][from];
   for(const [from,to] of changes)if(old[from])state[field][to]=old[from];
  }
 }
 function linkDraft(state,id,key){
  const next=structuredClone(state),adic=next.additionalItems.find(i=>i.id===id),item=next.inventory.find(i=>i['CLAVE UNICA']===key);
  if(!adic||!item)throw Error('No se encontró el bien');
  if(adic.posesion!=='Cámara'||adic.personal==='Si')throw Error('Solo pueden vincularse adicionales de Cámara');
  if(item.UBICADO==='SI')throw Error('El bien ya no está pendiente');
  const users=next.resguardantes.filter(u=>adic.resguardanteId?u.id===adic.resguardanteId:u.name===adic.usuario);
  if(users.length!==1)throw Error('Revisa el resguardante del adicional');
  const user=users[0],location=adic.ubicacionEspecifica;
  if(!location||!(user.locations||[user.locationWithId]).includes(location))throw Error('La ubicación del adicional ya no pertenece al resguardante');
  Object.assign(item,{UBICADO:'SI',RE_ETIQUETADO:'SI','NOMBRE DE USUARIO':user.name,ubicacionEspecifica:location,...(root.InventoryTeam || require('./team.js')).attribution(state),areaIncorrecta:item.areaOriginal!==user.area});
  const review=root.InventoryNotes||(typeof module!=='undefined'?require('./structured-notes.js'):null);review?.normalizeItem(item,true);
  const note=['Adicional vinculado: '+(adic.claveAsignada||'Sin clave'),'Descripción: '+(adic.descripcion||'Sin dato'),'Marca: '+(adic.marca||'Sin dato'),'Modelo: '+(adic.modelo||'Sin dato'),'Serie: '+(adic.serie||'Sin dato')].join(' | ');
  next.notes=next.notes||{};next.notes[key]=[next.notes[key],note].filter(Boolean).join('\n');
  next.additionalItems=next.additionalItems.filter(i=>i.id!==id);
  renumber(next);
  return next;
 }
 root.InventoryAdditional={norm,generated,renumber,linkDraft};
 if(typeof module!=='undefined')module.exports=root.InventoryAdditional;
})(globalThis);
