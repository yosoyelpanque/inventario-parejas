(function(root){
 const area=(state,item,additional=false)=>{const users=state.resguardantes||[];const user=users.find(u=>item.resguardanteId?u.id===item.resguardanteId:u.name===(additional?item.usuario:item['NOMBRE DE USUARIO']));return String((additional||item.UBICADO==='SI'?user?.area:null)||(additional?item.areaProcedencia:item.areaOriginal)||'').trim();};
 const matches=(state,item,value,additional=false)=>value==='all'||area(state,item,additional)===String(value).trim();
 const scope=(state,value)=>({inventory:state.inventory.filter(i=>matches(state,i,value)),additionalItems:state.additionalItems.filter(i=>matches(state,i,value,true))});
 const areas=state=>[...new Set([...state.inventory.map(i=>area(state,i)),...state.additionalItems.map(i=>area(state,i,true)),...(state.resguardantes||[]).map(u=>String(u.area||'').trim())])].filter(Boolean).sort();
 root.InventoryExportScope={area,matches,scope,areas};if(typeof module!=='undefined')module.exports=root.InventoryExportScope;
})(globalThis);
