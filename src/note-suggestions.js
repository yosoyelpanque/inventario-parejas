(function(root){
  'use strict';
  const display=value=>root.InventoryNotes?.description(value)??value;
  const normalize=value=>typeof value==='string'?display(value).normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es'):'';
  const official=()=>typeof module!=='undefined'?require('./official-descriptions.js'):root.InventoryOfficialDescriptions;
  function dismissed(state){
    return [...new Set((Array.isArray(state?.dismissedNoteSuggestions)?state.dismissedNoteSuggestions:[]).map(normalize).filter(Boolean))];
  }
  const plain=value=>normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function kind(description){
    const words=plain(description).replace(/[^a-z0-9 ]/g,' ').trim().split(/\s+/);
    let word=words[0]||'';
    if(word==='juego'||word==='equipo')word=words.find(w=>!['juego','equipo','de','para'].includes(w))||word;
    if(word==='no'&&words[1]==='break')return 'no break';
    if((word.endsWith('ores')||word.endsWith('ones')))word=word.slice(0,-2);else if(word.endsWith('s')&&!word.endsWith('sis'))word=word.slice(0,-1);
    return word;
  }
  function related(description,context){return !context||context.some(value=>kind(value)&&kind(value)===kind(description));}
  function noteRelated(items,key,note,context){
    if(!context)return true;
    const item=items.get(key);
    return related(item?.DESCRIPCION||item?.DESCRripcion||item?.descripcion||note,context);
  }
  function list(state,query='',context){
    const excluded=new Set(dismissed(state)),seen=new Set(),search=normalize(query),result=[];
    const items=context?new Map([...(state.additionalItems||[]).map(i=>[String(i.claveAsignada||'ADICIONAL:'+i.id),i]),...(state.inventory||[]).map(i=>[String(i['CLAVE UNICA']),i])]):null;
    for(const [itemKey,note] of [...Object.entries(state.notes||{}),...Object.entries(state.archivedNotes||{})]){
      const key=normalize(note);
      if(!noteRelated(items,itemKey,note,context)||!key||seen.has(key)||excluded.has(key)||key===search||(search&&!key.includes(search)))continue;
      seen.add(key);result.push(display(note));
      if(result.length===5)break;
    }
    return result;
  }
  function dismiss(state,note){return [...new Set([...dismissed(state),normalize(note)].filter(Boolean))];}
  function officialRecords(state){
    const ids=new Set((official()?.catalog||[]).map(t=>t.id));
    return (Array.isArray(state.officialNoteDescriptions)?state.officialNoteDescriptions:[]).filter(r=>r&&typeof r.text==='string'&&ids.has(r.templateId));
  }
  function entries(state,query='',context){
    const records=new Map(officialRecords(state).map(r=>[normalize(r.text),r]));
    return list(state,query,context).map(text=>({text,templateId:records.get(normalize(text))?.templateId||null}));
  }
  function templates(state,query='',context){
    const excluded=new Set(dismissed(state)),search=normalize(query).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return (official()?.catalog||[]).filter(t=>related(t.label,context)&&!excluded.has(normalize('official-template:'+t.id))&&search.split(/\s+/).every(word=>normalize(t.label+' '+t.preview).normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(word)));
  }
  function remember(state,record){
    const records=officialRecords(state);
    if(!record||!official()?.catalog.some(t=>t.id===record.templateId)||!normalize(record.text))return records;
    return [...records.filter(r=>normalize(r.text)!==normalize(record.text)),{text:record.text,templateId:record.templateId}];
  }
  const api={list,dismiss,entries,templates,remember,key:normalize,kind};root.InventoryNoteSuggestions=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
