(function(root){
 'use strict';
 function owner(state,item){return state.resguardantes.find(u=>item.resguardanteId?u.id===item.resguardanteId:u.name===(item['NOMBRE DE USUARIO']||item.usuario));}
 function review(item){const ad=root.InventoryAdditional||(typeof module!=='undefined'?require('./additional-rules.js'):null);if(!String(item.claveAsignada||'').trim()||ad.generated(item))return '';return String(item.areaProcedencia||'').trim()?'Verifica si el bien será traspasado o estará a préstamo.':'Revisar a qué área pertenece este bien.';}
 function assign(state,keys,userId,location,retag=false){
  const user=state.resguardantes.find(u=>u.id===userId);if(!user||(user.locations||[user.locationWithId]).filter(Boolean).indexOf(location)<0)throw Error('Selecciona un usuario y una ubicación válida.');
  if(!keys.length||keys.some(key=>!state.inventory.some(i=>i['CLAVE UNICA']===key)))throw Error('No se encontraron todos los bienes seleccionados.');
  const next=structuredClone(state),team=root.InventoryTeam||(typeof module!=='undefined'?require('./team.js'):null);
  for(const item of next.inventory)if(keys.includes(item['CLAVE UNICA']))Object.assign(item,{UBICADO:'SI',RE_ETIQUETADO:retag?'SI':'NO','NOMBRE DE USUARIO':user.name,ubicacionEspecifica:location,areaIncorrecta:String(item.areaOriginal)!==String(user.area),...team.attribution(state)});
  return next;
 }
 root.InventoryAssignment={owner,review,assign};if(typeof module!=='undefined')module.exports=root.InventoryAssignment;
})(globalThis);
