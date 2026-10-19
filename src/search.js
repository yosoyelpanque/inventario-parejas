(function(root){
 'use strict';
 const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function matches(query,...values){const text=normalize(values.join(' '));return normalize(query).split(/\s+/).every(word=>text.includes(word));}
 function notes(state,archived,query){
  const source=archived?state.archivedNotes:state.notes;
  const items=new Map([...state.inventory.map(item=>[String(item['CLAVE UNICA']),item]),...(state.additionalItems||[]).map(item=>[String(item.claveAsignada||'ADICIONAL:'+item.id),item])]);
  return Object.keys(source||{}).filter(key=>{const item=items.get(key);return matches(query,key,source[key],item?.DESCRIPCION,item?.descripcion,item?.['NOMBRE DE USUARIO'],item?.usuario,item?.SERIE,item?.serie);});
 }
 function reports(state,types,query,areaNames){
  const areas=[...new Set([...state.inventory.map(i=>String(i.areaOriginal||'')),...state.resguardantes.map(u=>String(u.area||''))])].filter(Boolean).sort();
  const results=[];
  for(const type of types){
   const add=(area,user,label)=>{if(matches(query,type.label,label))results.push({type:type.value,area,user,label:type.label+' · '+label});};
   add('all','all','Todas las áreas');
   for(const area of areas)add(area,type.value==='adicionales'?'__area__':'all','Área '+area+' '+(areaNames[area]||''));
   if(type.value!=='pendientes')for(const user of state.resguardantes)add(String(user.area),user.name,user.name+' · Área '+user.area+' '+(areaNames[user.area]||''));
  }
  return results;
 }
 root.InventorySearch={normalize,matches,notes,reports};
 if(typeof module!=='undefined')module.exports=root.InventorySearch;
})(globalThis);
