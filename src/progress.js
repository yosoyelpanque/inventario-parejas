(function(root){
 'use strict';
 const listings=typeof module!=='undefined'?require('./listings.js'):root.InventoryListings;
 function areas(state={}){
  const inventory=Array.isArray(state.inventory)?state.inventory:[];
  const keys=new Set(listings.areas(state));
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

