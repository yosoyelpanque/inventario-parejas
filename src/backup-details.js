(function(root){
 function filename(state,date=new Date()){
  const area=state.loadedListings?.[0]?.areaId||state.inventory?.find(i=>i.areaOriginal)?.areaOriginal||state.areas?.[0]||'Sin-area';
  const safe=String(area).replace(/[^a-zA-Z0-9_-]/g,'_');
  const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  return safe+'_'+day+'.zip';
 }
 async function images(entries){
  const types={'Fotos de bienes':0,'Fotos de adicionales':0,'Fotos de usuarios':0,'Fotos de ubicaciones':0,'Planos':0,'Otros archivos':0},hashes=new Set();let empty=0;
  for(const entry of entries){
   const key=String(entry.key),type=entry.store==='layoutImages'?'Planos':key.startsWith('inventory-')?'Fotos de bienes':key.startsWith('additional-')?'Fotos de adicionales':key.startsWith('user-')?'Fotos de usuarios':key.startsWith('location-')?'Fotos de ubicaciones':'Otros archivos';types[type]++;
   const bytes=await entry.value.arrayBuffer();if(!bytes.byteLength){empty++;continue;}
   const hash=await crypto.subtle.digest('SHA-256',bytes);hashes.add(Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''));
  }
  return {total:entries.length,unique:hashes.size,duplicates:entries.length-empty-hashes.size,empty,types};
 }
 const api={filename,images};root.InventoryBackupDetails=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
