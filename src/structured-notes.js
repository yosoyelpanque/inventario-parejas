(function(root){
 'use strict';
 const text=v=>String(v??'');
 const plain=v=>text(v).normalize('NFD').replace(/n\u0303/g,'ñ').replace(/N\u0303/g,'Ñ').replace(/[\u0300-\u036f]/g,'').normalize('NFC');
 // Only explicitly labelled centimetres are converted; unlabelled numbers may be quantities or identifiers.
 const description=v=>plain(v).toUpperCase().replace(/(\d+(?:[.,]\d+)?|[.,]\d+)(?:\s*[X×*]\s*(?:\d+(?:[.,]\d+)?|[.,]\d+)){0,2}\s*CM\b/g,match=>match.replace(/\s*CM$/,'').split(/\s*[X×*]\s*/).map(n=>(Number(n.replace(',','.'))/100).toFixed(2).replace(/^0\./,'.')).join(' X '));
 const missing=v=>!text(v).trim()||/^(?:-|N\/?A|S\/D|SIN (?:DATO[S]?|MARCA|MODELO|SERIE))$/i.test(text(v).trim());
 const placeholderVariant=v=>/^SIN\s+(?:MARCA|MODELO|SERIE)\b.+$/i.test(text(v).trim());
 const names=['marca','modelo','serie'];
 function storedValue(name,value){const raw=text(value).trim();return missing(raw)?'SIN '+name.toUpperCase():name==='serie'?raw:plain(raw);}
 function specValue(name,value){return placeholderVariant(value)?'SIN '+name.toUpperCase():storedValue(name,value);}
 function suggestions(state,name,query=''){
  if(!names.includes(name))return [];
  const values=['SIN '+name.toUpperCase(),...(state.inventory||[]).map(i=>i[name.toUpperCase()]),...(state.additionalItems||[]).map(i=>i[name]),...Object.values(state.noteDetails||{}).map(r=>r[name]),...Object.values(state.archivedNoteDetails||{}).map(r=>r[name])];
  const key=v=>plain(v).trim().toUpperCase(),excluded=new Set((state.dismissedNoteSuggestions||[]).map(key)),seen=new Set();
  return values.filter(v=>typeof v==='string'&&v.trim()).map(v=>specValue(name,v)).filter(v=>{const k=key(v);if(seen.has(k)||excluded.has(key('field:'+name+':'+v))||!k.includes(key(placeholderVariant(query)?specValue(name,query):query)))return false;seen.add(k);return true;}).sort((a,b)=>a.localeCompare(b,'es',{numeric:true})).slice(0,8);
 }
 function item(state,key){return (state.inventory||[]).find(i=>text(i['CLAVE UNICA'])===key)||(state.additionalItems||[]).find(i=>(text(i.claveAsignada)||'ADICIONAL:'+i.id)===key);}
 function field(i,name){return Object.hasOwn(i,'CLAVE UNICA')?name.toUpperCase():name;}
 function set(i,name,value){const key=field(i,name),before=i[key];if(text(before)!==text(value)){i._reviewOriginal??={};if(!Object.hasOwn(i._reviewOriginal,key))i._reviewOriginal[key]=before??'';i[key]=value;}}
 function normalizeItem(i,located){const desc=Object.hasOwn(i,'CLAVE UNICA')?'DESCRIPCION':'descripcion';if(i[desc]!=null)set(i,desc.toLowerCase(),description(i[desc]));if(i.DESCRripcion!=null)i.DESCRripcion=description(i.DESCRripcion);for(const name of names){const key=field(i,name);let value=i[key];if(located&&missing(value))value='SIN '+name.toUpperCase();else if(name!=='serie'&&value!=null)value=plain(value);if(value!=null)set(i,name,value);}return i;}
 // Undo only the automatic placeholder substitutions whose imported value is preserved.
 // A saved correction (including corrections made before confirmation flags existed) takes precedence.
 function restoreImportedPlaceholders(state,i){const key=text(i['CLAVE UNICA']??i.claveAsignada)||'ADICIONAL:'+i.id;
  for(const name of names){const f=field(i,name),original=i._reviewOriginal?.[f];
   if(!placeholderVariant(original)||i[f]!=='SIN '+name.toUpperCase()||i._reviewConfirmed?.[name])continue;
   if([state.noteDetails?.[key],state.archivedNoteDetails?.[key]].some(r=>r&&r[name]===i[f]))continue;
   i[f]=original;
  }
 }
 function normalizeState(state){const before=JSON.stringify([state.inventory,state.additionalItems]);for(const i of state.inventory||[]){restoreImportedPlaceholders(state,i);normalizeItem(i,i.UBICADO==='SI');}for(const i of state.additionalItems||[]){restoreImportedPlaceholders(state,i);normalizeItem(i,!!i.usuario);}return before!==JSON.stringify([state.inventory,state.additionalItems]);}
 function get(state,key,archived=false){const source=archived?state.archivedNotes:state.notes,records=archived?state.archivedNoteDetails:state.noteDetails,record=records?.[key],old=text(source?.[key]);return {...record,description1:description(record?.description1??old.slice(0,80)),description2:description(record?.description2??old.slice(80,226)),createdAt:record?.createdAt||null,legacyOriginal:record?.legacyOriginal||(!record&&old.length>226?old:'')};}
 function save(state,keys,values,archived=false,now=new Date().toISOString()){
  const d1=description(values.description1),d2=description(values.description2);if(d1.length>80||d2.length>146)throw Error('Descripción 1 admite 80 caracteres y descripción 2, 146.');
  const next=structuredClone(state),bucket=archived?'archivedNotes':'notes',meta=archived?'archivedNoteDetails':'noteDetails';next[bucket]={...next[bucket]};next[meta]={...next[meta]};
  for(const key of keys){const i=item(next,key);if(!i)throw Error('No se encontró el bien '+key);const existed=Object.hasOwn(next[bucket],key),previous=get(next,key,archived),record={...previous,description1:d1,description2:d2,createdAt:existed?previous.createdAt:now,updatedAt:now,legacyOriginal:values.legacyOriginal||previous.legacyOriginal||''};
   for(const name of names){const input=values[name];if(input!==null&&input!==undefined){const value=name==='serie'?text(input).trim():plain(input).trim();const corrected=storedValue(name,value);if(text(i[field(i,name)])!==corrected){i._reviewConfirmed??={};i._reviewConfirmed[name]=true;}set(i,name,corrected);}record[name]=i[field(i,name)]||'';}
   normalizeItem(i,Object.hasOwn(i,'CLAVE UNICA')?i.UBICADO==='SI':!!i.usuario);next[bucket][key]=[d1,d2].filter(Boolean).join(' ');next[meta][key]=record;
  }return next;
 }
 function localDate(value){if(!value)return '';const d=new Date(value);return Number.isNaN(+d)?'':[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
 function filter(state,keys,archived,from='',to='',order='newest'){return keys.filter(key=>{const date=localDate(get(state,key,archived).createdAt);return order==='undated'?!date:(!from&&!to)||!!date&&(!from||date>=from)&&(!to||date<=to);}).sort((a,b)=>{const x=get(state,a,archived).createdAt,y=get(state,b,archived).createdAt;if(!x||!y)return x?-1:y?1:a.localeCompare(b,'es',{numeric:true});return order==='oldest'?x.localeCompare(y):y.localeCompare(x);});}
 function exported(state,key){const active=Object.hasOwn(state.notes||{},key),archived=!active&&Object.hasOwn(state.archivedNotes||{},key);if(!active&&!archived)return {'Descripción 1':'','Descripción 2':'','Fecha de creación de nota':'','Estado de nota':''};const r=get(state,key,archived);return {'Descripción 1':r.description1,'Descripción 2':r.description2,'Fecha de creación de nota':r.createdAt||'Sin fecha','Estado de nota':archived?'Archivada':'Activa'};}
 function printRow(state,key,archived=false){const i=item(state,key),r=get(state,key,archived),values={'Clave Única':key,'Descripción original':i?.DESCRIPCION||i?.DESCRripcion||i?.descripcion||'','Descripción 1':r.description1,'Descripción 2':r.description2},colors={'Descripción 1':archived?'green':'yellow','Descripción 2':archived?'green':'yellow'};
  for(const name of names){const label=name[0].toUpperCase()+name.slice(1),f=i&&field(i,name);values[label]=i?.[f]??r[name]??'';if(i&&Object.hasOwn(i._reviewOriginal||{},f)&&text(i[f])!==text(i._reviewOriginal[f]))colors[label]='yellow';}
  return {values,colors};
 }
 function styleWorkbook(book,state){book.InventoryCellColors={};for(const name of book.SheetNames){const sheet=book.Sheets[name],rows=root.XLSX.utils.sheet_to_json(sheet,{header:1,defval:''}),headers=rows[0]||[],keyCol=headers.indexOf('Clave Única'),colors={};if(keyCol<0)continue;for(let r=1;r<rows.length;r++){const key=text(sheet['!noteKeys']?.[r-1]||rows[r][keyCol]),i=item(state,key),active=Object.hasOwn(state.notes||{},key),archived=!active&&Object.hasOwn(state.archivedNotes||{},key);headers.forEach((h,c)=>{let color;if((active||archived)&&['Descripción 1','Descripción 2','Fecha de creación de nota','Estado de nota'].includes(h))color=archived?'green':'yellow';const n={Marca:'marca',Modelo:'modelo',Serie:'serie','Descripción':'descripcion'}[h];if(i&&n){const k=field(i,n);if(Object.hasOwn(i._reviewOriginal||{},k)&&text(i[k])!==text(i._reviewOriginal[k]))color='yellow';}if(color)colors[root.XLSX.utils.encode_cell({r,c})]=color;});}book.InventoryCellColors[name]=colors;}return book;}
 const api={description,plain,missing,storedValue,specValue,suggestions,item,field,normalizeItem,normalizeState,get,save,localDate,filter,exported,printRow,styleWorkbook};root.InventoryNotes=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
