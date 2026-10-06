(function(root){
 'use strict';
 const lists={inventory:'inventory',additional:'additionalItems',user:'resguardantes'};
 const flags={inventory:'photos',additional:'additionalPhotos',user:'userPhotos',location:'locationPhotos'};
 const norm=value=>String(value??'').normalize('NFC').trim().toLocaleUpperCase('es');
 const key=value=>String(value??'').normalize('NFC').trim();
 const forbidden=new Set(['__proto__','prototype','constructor']);
 const serial=item=>{const value=norm(item.serie);return /^(?:|0|-|N\s*\/\s*A|NA|S\s*\/\s*N|SN|SIN SERIE|SIN N[ÚU]MERO(?: DE SERIE)?|NO TIENE|NO LEGIBLE|ILEGIBLE|NO APLICA)$/.test(value)?'':value;};
 const manualKey=item=>!item.claveAutogenerada&&!/^(?:CD|ARR)(?:[-|\s]|\d)/i.test(key(item.claveAsignada))?key(item.claveAsignada):'';
 const fields=['descripcion','marca','modelo','serie','tipoBien','posesion','personal','areaProcedencia','numContrato','grupoParlamentario'];
 const sameIdentity=(a,b)=>!!norm(a.descripcion)&&fields.every(field=>norm(a[field])===norm(b[field]))&&manualKey(a)===manualKey(b);
 const compatible=(a,b)=>['descripcion','marca','modelo','serie'].every(field=>!norm(a[field])||!norm(b[field])||norm(a[field])===norm(b[field]));
 const employee=user=>key(user.employeeNumber||user.numeroEmpleado||user.numEmpleado||'');
 function result(matches,label){
  if(matches.length>1)return {status:'ambiguous',reason:'Hay más de una coincidencia. No se eligió ningún destino.'};
  if(!matches.length)return {status:'unmatched',reason:'No hay una coincidencia segura en esta sesión.'};
  return {target:matches[0],label};
 }
 function userMatch(user,source,current){
  const number=employee(user),area=key(user.area),name=norm(user.name);
  if(number&&area){
   const same=u=>employee(u)===number&&key(u.area)===area;
   if(source.filter(same).length!==1)return {status:'ambiguous',reason:'El número de empleado está duplicado en el respaldo.'};
   const matches=current.filter(same);if(matches.length)return result(matches);
  }
  if(!key(user.id)||!name||!area)return result([]);
  return result(current.filter(u=>key(u.id)===key(user.id)&&norm(u.name)===name&&key(u.area)===area));
 }
 function resolve(current,source,sourceKey){
  const match=/^(inventory|additional|user|location)-(.*)$/.exec(String(sourceKey));
  if(!match||!match[2])return {status:'unsupported',reason:'Este archivo no corresponde a una fotografía compatible.'};
  const kind=match[1],sourceId=key(match[2]);
  let id=sourceId,location='';
  if(kind==='location'){
   const separator=sourceId.indexOf('|');if(separator<1)return result([]);
   id=sourceId.slice(0,separator);location=sourceId.slice(separator+1);
  }
  const sourceList=source[lists[kind==='location'?'user':kind]]||[],currentList=current[lists[kind==='location'?'user':kind]]||[];
  const records=sourceList.filter(item=>key(kind==='inventory'?item['CLAVE UNICA']:item.id)===id);
  if(records.length!==1)return records.length?{status:'ambiguous',reason:'El identificador está duplicado en el respaldo.'}:result([]);
  const item=records[0];let found;
  if(kind==='inventory')found=result(currentList.filter(target=>key(target['CLAVE UNICA'])===id));
  else if(kind==='additional'){
   const byId=currentList.filter(target=>key(target.id)===id&&sameIdentity(item,target));
   if(byId.length)found=result(byId);
   else if(serial(item)){
    if(sourceList.filter(target=>serial(target)===serial(item)).length>1)return {status:'ambiguous',reason:'La serie está duplicada en el respaldo.'};
    found=result(currentList.filter(target=>serial(target)===serial(item)));
   }else if(manualKey(item)){
    if(sourceList.filter(target=>manualKey(target)===manualKey(item)).length>1)return {status:'ambiguous',reason:'La clave manual está duplicada en el respaldo.'};
    const candidates=currentList.filter(target=>manualKey(target)===manualKey(item));
    found=candidates.length>1?result(candidates):result(candidates.filter(target=>compatible(item,target)));
   }else found={status:'unmatched',reason:'El adicional no tiene una identidad compartida, serie única o clave manual verificable. Las claves CD y ARR no identifican bienes entre dispositivos.'};
  }else found=userMatch(item,sourceList,currentList);
  if(!found.target)return found;
  const target=found.target;
  if(kind!=='inventory'&&currentList.filter(candidate=>key(candidate.id)===key(target.id)).length!==1)return {status:'ambiguous',reason:'El identificador del destino está duplicado.'};
  let targetId=String(kind==='inventory'?target['CLAVE UNICA']:target.id),label=kind==='inventory'?target['CLAVE UNICA']+' · '+(target.DESCRIPCION||target['DESCRIPCION DEL BIEN']||'Bien'):kind==='additional'?(target.claveAsignada||target.serie||'Adicional')+' · '+target.descripcion:target.name;
  if(!targetId||forbidden.has(targetId))return {status:'invalid',reason:'El identificador del destino no es válido.'};
  if(kind==='location'){
   const sourceLocations=(item.locations||[]).filter(value=>norm(value)===norm(location));
   const targetLocations=(target.locations||[]).filter(value=>norm(value)===norm(location));
   if(sourceLocations.length!==1||targetLocations.length!==1)return sourceLocations.length>1||targetLocations.length>1?{status:'ambiguous',reason:'La ubicación está duplicada.'}:result([]);
   const sourceDetail=item.locationDetails?.[sourceLocations[0]]||{},targetDetail=target.locationDetails?.[targetLocations[0]]||{};
   if(['edificio','piso'].some(field=>norm(sourceDetail[field])&&norm(targetDetail[field])&&norm(sourceDetail[field])!==norm(targetDetail[field])))return {status:'unmatched',reason:'El edificio o piso de la ubicación no coincide.'};
   targetId+='|'+targetLocations[0];label+=' · '+targetLocations[0];
  }
  return {kind,id:targetId,targetKey:kind+'-'+targetId,label};
 }
 async function isImage(blob){
  if(!blob||typeof blob.arrayBuffer!=='function'||typeof blob.slice!=='function'||!blob.size)return false;
  const bytes=new Uint8Array(await blob.slice(0,32).arrayBuffer());
  const text=String.fromCharCode(...bytes),signature=bytes[0]===255&&bytes[1]===216&&bytes[2]===255||text.startsWith('\x89PNG\r\n\x1a\n')||/^GIF8[79]a/.test(text)||text.startsWith('RIFF')&&text.slice(8,12)==='WEBP'||text.startsWith('BM');
  if(!signature)return false;
  // Backups do not always retain the Blob MIME type; inspect actual bytes.
  if(typeof root.createImageBitmap==='function'){
   try{const image=await root.createImageBitmap(blob);const valid=image.width>0&&image.height>0;image.close();return valid;}catch{return false;}
  }
  return true;
 }
 async function sameBytes(a,b){
  if(a.size!==b.size)return false;
  const left=new Uint8Array(await a.arrayBuffer()),right=new Uint8Array(await b.arrayBuffer());
  return left.every((value,index)=>value===right[index]);
 }
 async function plan(currentState,sourceState,images,existingPhotos=[]){
  const rows=[],existing=new Map(existingPhotos.map(image=>[String(image.key),image.value])),destinations=new Map();
  for(const image of images){
   const row={sourceKey:String(image.key),value:image.value};rows.push(row);
   if(image.store!=='photos'){Object.assign(row,{status:'unsupported',reason:'Los planos no se importan con las fotografías.'});continue;}
   if(!await isImage(image.value)){Object.assign(row,{status:'invalid',reason:'El archivo está vacío, dañado o no es una fotografía compatible.'});continue;}
   Object.assign(row,resolve(currentState,sourceState,image.key));
   if(row.status)continue;
   const previous=destinations.get(row.targetKey);
   if(previous){
    if(await sameBytes(previous.value,row.value)){row.status='duplicate';row.reason='Fotografía repetida para el mismo destino.';}
    else{row.status=previous.status='ambiguous';row.reason=previous.reason='Varias fotografías diferentes apuntan al mismo destino.';}
    continue;
   }
   destinations.set(row.targetKey,row);
   // Preserve any nonempty local file unless replacement is explicitly requested.
   row.status=existing.get(row.targetKey)?.size?'existing':'new';
   row.reason=row.status==='existing'?'Esta sesión ya tiene una fotografía. Se conservará salvo que elijas reemplazarla.':'Se agregará la fotografía.';
  }
  const counts={new:0,existing:0,unmatched:0,ambiguous:0,invalid:0,duplicate:0,unsupported:0};
  for(const row of rows)counts[row.status]++;
  return {rows,counts,sourceState:structuredClone(sourceState)};
 }
 async function apply(storage,currentState,importPlan,{replaceExisting=false,recoveryPoint=null}={}){
  await storage.flush();
  const rows=importPlan.rows.filter(row=>row.status==='new'||row.status==='existing');
  for(const row of rows){
   const match=resolve(currentState,importPlan.sourceState,row.sourceKey);
   if(match.status||match.targetKey!==row.targetKey)throw Error('El inventario cambió desde la vista previa. Vuelve a seleccionar el respaldo.');
  }
  const next=structuredClone(currentState);let imported=0,replaced=0,skipped=0,callbackError;
  if(!rows.length)return {next,imported,replaced,skipped};
  try{
   return await storage.transaction(['photos','appData'],'readwrite',tx=>{
    const photos=tx.objectStore('photos'),app=tx.objectStore('appData');let pending=rows.length+(recoveryPoint?1:0),points=[];
    const fail=error=>{callbackError=error;tx.abort();};
    const finish=()=>{
     if(--pending)return;
     if(imported){
      const clean=root.InventoryData?.clean||((state)=>{const copy={...state};for(const name of ['loggedIn','currentUser','companion','serialNumberCache','accessToken','refreshToken','idToken'])delete copy[name];return copy;});
      app.put(clean(next),'mainState');
      if(recoveryPoint)app.put([recoveryPoint,...points].slice(0,root.InventoryRecovery?.LIMIT||3),'recoveryPoints');
     }
    };
    if(recoveryPoint){const request=app.get('recoveryPoints');request.onsuccess=()=>{try{points=Array.isArray(request.result)?request.result:[];finish();}catch(error){fail(error);}};}
    for(const row of rows){
     const request=photos.get(row.targetKey);
     request.onsuccess=()=>{
      try{
       // Recheck inside the write transaction so a newly saved photograph cannot be overwritten accidentally.
       const hasPhoto=!!request.result?.size;
       if(hasPhoto&&!replaceExisting)skipped++;
       else{
        photos.put(row.value,row.targetKey);imported++;if(hasPhoto)replaced++;
        const map=flags[row.kind];next[map]={...next[map],[row.id]:true};
       }
       finish();
      }catch(error){fail(error);}
     };
    }
    return ()=>({next,imported,replaced,skipped});
   });
  }catch(error){throw callbackError||error;}
 }
 const api={plan,apply,isImage};root.InventoryPhotoImport=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
