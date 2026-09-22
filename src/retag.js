(function(root){
  function complete(state,key,actor,at=new Date().toISOString()) {
    const item=state.inventory.find(i=>i['CLAVE UNICA']===key);
    if(!item || item.RE_ETIQUETADO!=='SI') throw Error('El bien ya no está pendiente de reetiquetar.');
    return {...state,inventory:state.inventory.map(i=>i!==item?i:{...i,RE_ETIQUETADO:'NO',etiquetadoCompletado:{at,por:actor||''}})};
  }
  function reopen(state,key) {
    const item=state.inventory.find(i=>i['CLAVE UNICA']===key);
    if(!item?.etiquetadoCompletado || item.RE_ETIQUETADO==='SI') throw Error('El bien no está en el archivo de etiquetados.');
    return {...state,inventory:state.inventory.map(i=>i!==item?i:{...i,RE_ETIQUETADO:'SI'})};
  }
  function list(state,archived,query='') {
    const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const words=norm(query).trim().split(/\s+/);
    return state.inventory.filter(i=>(archived ? i.RE_ETIQUETADO!=='SI'&&!!i.etiquetadoCompletado : i.RE_ETIQUETADO==='SI')&&words.every(w=>norm([i['CLAVE UNICA'],i.DESCRIPCION,i.DESCRripcion,i.SERIE,i['NOMBRE DE USUARIO'],i.ubicacionEspecifica].join(' ')).includes(w)));
  }
  const api={complete,reopen,list};root.InventoryRetag=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
