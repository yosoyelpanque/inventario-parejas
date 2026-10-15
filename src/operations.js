(function(root){
 'use strict';
 function transfer(state,fromId,toId,location,newName,useExisting=false){
  if(fromId===toId)throw Error('Selecciona dos usuarios diferentes.');
  const next=structuredClone(state),from=next.resguardantes.find(u=>u.id===fromId),to=next.resguardantes.find(u=>u.id===toId);
  if(!from||!to)throw Error('Selecciona los usuarios de origen y destino.');
  if(!(from.locations||[]).includes(location))throw Error('Selecciona una ubicación del usuario de origen.');
  let name=(newName||location).trim();if(!name)throw Error('Indica el nombre de la ubicación de destino.');
  const existing=(to.locations||[]).find(l=>l.trim().toLocaleUpperCase('es')===name.toLocaleUpperCase('es'));
  if(useExisting&&!existing)throw Error('Selecciona una ubicación cargada del usuario de destino.');
  if(existing&&!useExisting)throw Error('El destino ya tiene una ubicación con ese nombre. Escribe otro nombre para conservar ambas.');
  const merged=!!existing;if(merged)name=existing;
  const owned=i=>Object.hasOwn(i,'NOMBRE DE USUARIO')?i['NOMBRE DE USUARIO']===from.name:(i.resguardanteId?i.resguardanteId===from.id:i.usuario===from.name);
  const inv=next.inventory.filter(i=>owned(i)&&i.ubicacionEspecifica===location),adic=next.additionalItems.filter(i=>owned(i)&&i.ubicacionEspecifica===location);
  if(next.resguardantes.filter(u=>u.name===from.name).length>1&&(inv.length>0||adic.some(i=>!i.resguardanteId)))throw Error('Hay usuarios con el mismo nombre y bienes sin identificador de usuario. Diferencia sus nombres antes de transferir.');
  if(next.resguardantes.filter(u=>u.name===to.name).length>1)throw Error('El nombre del usuario destino está repetido. Diferencia sus nombres antes de transferir.');
  from.locations=from.locations.filter(l=>l!==location);from.locationWithId=from.locations[0]||'';
  if(!merged){to.locations=[...(to.locations||[]),name];to.locationDetails={...to.locationDetails,[name]:structuredClone(from.locationDetails?.[location]||{})};}to.locationWithId=to.locations[0];if(from.locationDetails)delete from.locationDetails[location];
  inv.forEach(i=>{i['NOMBRE DE USUARIO']=to.name;i.resguardanteId=to.id;i.ubicacionEspecifica=name;i.areaIncorrecta=i.areaOriginal!==to.area;});
  adic.forEach(i=>{i.usuario=to.name;i.resguardanteId=to.id;i.ubicacionEspecifica=name;});
  const sourcePhoto=from.id+'|'+location,targetPhoto=to.id+'|'+name;
  next.locationPhotos={...next.locationPhotos};if(next.locationPhotos[sourcePhoto])next.locationPhotos[targetPhoto]=true;delete next.locationPhotos[sourcePhoto];
  if(next.activeResguardante)next.activeResguardante=next.resguardantes.find(u=>u.id===next.activeResguardante.id)||null;
  return {next,merged,inventoryCount:inv.length,additionalCount:adic.length,crossArea:from.area!==to.area,from,to,location,name,sourcePhoto,targetPhoto};
 }
 function moveNotes(state,keys,archive){
  const next=structuredClone(state),source=archive?'notes':'archivedNotes',target=archive?'archivedNotes':'notes';next[source]={...next[source]};next[target]={...next[target]};let count=0;
  for(const key of new Set(keys)){if(!Object.hasOwn(next[source],key))continue;const text=next[source][key],previous=next[target][key];next[target][key]=previous&&previous!==text?previous+'\n\n'+text:text;delete next[source][key];count++;}
  return {next,count};
 }
 root.InventoryOperations={transfer,moveNotes};if(typeof module!=='undefined')module.exports={transfer,moveNotes};
})(globalThis);
