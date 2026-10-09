(function(root){
 'use strict';
 const nameKey=name=>String(name||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleUpperCase('es').replace(/[ÁÉÍÓÚÜ]/g,c=>({'Á':'A','É':'E','Í':'I','Ó':'O','Ú':'U','Ü':'U'}[c]));
 const findName=(state,name,exceptId)=>state.resguardantes.find(u=>u.id!==exceptId&&nameKey(u.name)===nameKey(name));
 function owns(state,item,user){if(item.resguardanteId)return item.resguardanteId===user.id;if(nameKey(item['NOMBRE DE USUARIO']||item.usuario)!==nameKey(user.name))return false;const peers=state.resguardantes.filter(u=>nameKey(u.name)===nameKey(user.name));if(peers.length===1)return true;const candidates=peers.filter(u=>(u.locations||[u.locationWithId]).includes(item.ubicacionEspecifica));return candidates.length===1?candidates[0].id===user.id:true;}
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function editUser(state,id,values,removedAction){
  const next=structuredClone(state),u=next.resguardantes.find(u=>u.id===id);if(!u)throw Error('Usuario no encontrado');
  const name=values.name.trim();if(!name)throw Error('El nombre es obligatorio');if(!values.area)throw Error('Selecciona un área');
  if(findName(next,name,id))throw Error('Ya existe un usuario con ese nombre. Usa un nombre que permita distinguirlo.');
  const oldName=u.name,removed=(u.locations||[]).filter(l=>!values.locations.includes(l));
  const inv=next.inventory.filter(i=>i['NOMBRE DE USUARIO']===oldName),adic=next.additionalItems.filter(i=>i.resguardanteId?i.resguardanteId===id:i.usuario===oldName);
  if(next.resguardantes.filter(v=>v.name===oldName).length>1&&inv.length)throw Error('Hay usuarios con el mismo nombre. Revisa sus asignaciones antes de editar.');
  for(const i of [...inv,...adic])if(removed.includes(i.ubicacionEspecifica)){
   if(!removedAction)throw Error('Elige qué hacer con los bienes de las ubicaciones eliminadas');
   if(removedAction==='pending'){if(inv.includes(i)){Object.assign(i,{UBICADO:'NO',RE_ETIQUETADO:'NO','NOMBRE DE USUARIO':'',ubicacionEspecifica:'',ubicadoPor:'',ubicadoPorNumero:'',auxiliadoPor:'',auxiliadoPorNumero:'',areaIncorrecta:false});delete i.resguardanteId;}else throw Error('Transfiere los adicionales a una ubicación antes de eliminarla.');}
   else {if(!values.locations.includes(removedAction))throw Error('Ubicación de destino inválida');i.ubicacionEspecifica=removedAction;}
  }
  for(const i of inv)if(i['NOMBRE DE USUARIO']){i['NOMBRE DE USUARIO']=name;i.resguardanteId=id;i.areaIncorrecta=i.areaOriginal!==values.area;}
  for(const i of adic){i.usuario=name;i.resguardanteId=id;}
  Object.assign(u,{name,area:values.area,locations:[...values.locations],locationWithId:values.locations[0]||'',locationDetails:structuredClone(values.locationDetails)});
  if(next.activeResguardante?.id===id)next.activeResguardante=u;
  next.suggestedNames=[...new Set([...(next.suggestedNames||[]),name])];return next;
 }
 function removeUser(state,id){
  const next=structuredClone(state),u=next.resguardantes.find(u=>u.id===id);if(!u)throw Error('Usuario no encontrado');
  if(next.inventory.some(i=>owns(next,i,u))||next.additionalItems.some(i=>owns(next,i,u)))throw Error('Este usuario tiene bienes asignados. Transfiere sus ubicaciones o quita las asignaciones antes de eliminarlo.');
  next.resguardantes=next.resguardantes.filter(u=>u.id!==id);if(next.activeResguardante?.id===id)next.activeResguardante=null;return next;
 }
 function merge(state,incoming){
  const next=structuredClone(state),source=structuredClone(incoming),conflicts=[],idMap={};
  const conflict=(label,target,key,value)=>{if(!same(target[key],value)){const local=structuredClone(target[key]);conflicts.push({label,local,incoming:structuredClone(value),apply:useImported=>{target[key]=structuredClone(useImported?value:local);}});}};
  next.resguardantes=next.resguardantes||[];
  for(const u of source.resguardantes||[]){const old=next.resguardantes.find(v=>v.id===u.id)||next.resguardantes.find(v=>v.name===u.name&&v.area===u.area);if(!old){if(findName(next,u.name))throw Error('El respaldo contiene un usuario con nombre repetido en otra área. Revisa su asignación antes de fusionar.');next.resguardantes.push(u);continue;}idMap[u.id]=old.id;for(const k of ['name','area'])if(u[k]!==undefined)conflict('Usuario '+old.name+' · '+k,old,k,u[k]);old.locations=[...new Set([...(old.locations||[]),...(u.locations||[])])];old.locationDetails=old.locationDetails||{};for(const [k,v] of Object.entries(u.locationDetails||{})){if(!old.locationDetails[k])old.locationDetails[k]=v;else conflict('Infraestructura '+old.name+' · '+k,old.locationDetails,k,v);}}
  for(const k of ['inventory','additionalItems'])for(const i of source[k]||[])if(idMap[i.resguardanteId])i.resguardanteId=idMap[i.resguardanteId];
  for(const [field,getKey] of [['inventory',i=>i['CLAVE UNICA']],['additionalItems',i=>i.id],['responsablesList',i=>i.area],['loadedListings',i=>JSON.stringify([i.areaId,i.bookType])],['perfilesMagicos',i=>i.regexStr]]){
   next[field]=next[field]||[];for(const i of source[field]||[]){const index=next[field].findIndex(v=>getKey(v)===getKey(i));if(index<0)next[field].push(i);else conflict(field+' · '+getKey(i),next[field],index,i);}
  }
  for(const field of ['notes','archivedNotes']){next[field]={...next[field]};for(const [k,v] of Object.entries(source[field]||{})){const old=next[field][k];if(!old)next[field][k]=v;else if(old!==v&&!old.includes(v))next[field][k]=old+'\n\n'+v;}}
  for(const field of ['areaNames']){next[field]={...next[field]};for(const [k,v] of Object.entries(source[field]||{})){if(next[field][k]===undefined)next[field][k]=v;else conflict(field+' · '+k,next[field],k,v);}}
  next.suggestedNames=[...new Set([...(next.suggestedNames||[]),...(source.suggestedNames||[])])];
  return {next,conflicts,idMap};
 }
 root.InventorySafeChanges={editUser,removeUser,merge,nameKey,findName,owns};if(typeof module!=='undefined')module.exports=root.InventorySafeChanges;
})(globalThis);
