(function(root){
 'use strict';
 function areas(state={}){
  const inventory=Array.isArray(state.inventory)?state.inventory:[];
  const keys=new Set([
   ...Object.keys(state.areaNames||{}),
   ...(state.loadedListings||[]).map(row=>String(row.areaId||'').trim()),
   ...inventory.map(item=>String(item.areaOriginal||'').trim())
  ]);
  keys.delete('');
  return [...keys].sort((a,b)=>a.localeCompare(b,'es',{numeric:true})).map(id=>{
   const items=inventory.filter(item=>String(item.areaOriginal||'').trim()===id);
   const located=items.filter(item=>item.UBICADO==='SI').length,total=items.length;
   return {id,name:String(state.areaNames?.[id]||'').trim(),located,total,pending:total-located,percent:total?Math.round(located*100/total):0};
  });
 }
 const api={areas};root.InventoryProgress=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

