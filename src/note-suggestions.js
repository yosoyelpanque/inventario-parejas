(function(root){
  'use strict';
  const normalize=value=>typeof value==='string'?value.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es'):'';
  const official=()=>typeof module!=='undefined'?require('./official-descriptions.js'):root.InventoryOfficialDescriptions;
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
  function officialRecords(state){
    const ids=new Set((official()?.catalog||[]).map(t=>t.id));
    return (Array.isArray(state.officialNoteDescriptions)?state.officialNoteDescriptions:[]).filter(r=>r&&typeof r.text==='string'&&ids.has(r.templateId));
  }
  function entries(state,query=''){
    const records=new Map(officialRecords(state).map(r=>[normalize(r.text),r]));
    return list(state,query).map(text=>({text,templateId:records.get(normalize(text))?.templateId||null}));
  }
  function templates(state,query=''){
    const excluded=new Set(dismissed(state)),search=normalize(query).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return (official()?.catalog||[]).filter(t=>!excluded.has(normalize('official-template:'+t.id))&&search.split(/\s+/).every(word=>normalize(t.label+' '+t.preview).normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(word)));
  }
  function remember(state,record){
    const records=officialRecords(state);
    if(!record||!official()?.catalog.some(t=>t.id===record.templateId)||!normalize(record.text))return records;
    return [...records.filter(r=>normalize(r.text)!==normalize(record.text)),{text:record.text,templateId:record.templateId}];
  }
  const api={list,dismiss,entries,templates,remember,key:normalize};root.InventoryNoteSuggestions=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
