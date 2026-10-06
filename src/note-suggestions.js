(function(root){
  'use strict';
  const normalize=value=>typeof value==='string'?value.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es'):'';
  function dismissed(state){
    return [...new Set((Array.isArray(state?.dismissedNoteSuggestions)?state.dismissedNoteSuggestions:[]).map(normalize).filter(Boolean))];
  }
  function list(state,query=''){
    const excluded=new Set(dismissed(state)),seen=new Set(),search=normalize(query),result=[];
    for(const note of [...Object.values(state.notes||{}),...Object.values(state.archivedNotes||{})]){
      const key=normalize(note);
      if(!key||seen.has(key)||excluded.has(key)||key===search||(search&&!key.includes(search)))continue;
      seen.add(key);result.push(note);
      if(result.length===5)break;
    }
    return result;
  }
  function dismiss(state,note){return [...new Set([...dismissed(state),normalize(note)].filter(Boolean))];}
  const api={list,dismiss};root.InventoryNoteSuggestions=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
