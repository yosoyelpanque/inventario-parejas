(function(root){
 'use strict';
 let dialog,form,fields,preview,error,title,active,apply;
 function ensure(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='official-description-dialog';dialog.className='official-description-dialog';
  dialog.innerHTML='<form novalidate><header><h2>Completar descripción oficial</h2><p class="official-template-name"></p></header><p>Escribe el color y las características del bien. Las cantidades se escribirán en letra y las medidas en centímetros.</p><div class="official-description-fields"></div><p class="official-example-hint">Las medidas de ejemplo son editables. Revisa las medidas reales del bien antes de usar la descripción.</p><label class="official-preview-label">Vista previa</label><p class="official-description-preview" aria-live="polite"></p><p class="official-description-error" role="alert"></p><footer><button type="button" data-action="neutral" id="official-description-cancel">Regresar a la nota</button><button type="submit" data-action="save" id="official-description-apply">Usar en nota</button></footer></form>';
  document.body.append(dialog);form=dialog.querySelector('form');fields=dialog.querySelector('.official-description-fields');preview=dialog.querySelector('.official-description-preview');error=dialog.querySelector('.official-description-error');title=dialog.querySelector('.official-template-name');
  dialog.querySelector('#official-description-cancel').onclick=()=>dialog.close();
  form.addEventListener('input',()=>{error.textContent='';update();});
  form.onsubmit=event=>{event.preventDefault();try{const text=root.InventoryOfficialDescriptions.render(active.id,values());apply(text);dialog.close();}catch(e){error.textContent=e.message;}};
 }
 function values(){return Object.fromEntries([...fields.querySelectorAll('input')].map(input=>[input.name,input.value]));}
 function update(){try{preview.textContent=root.InventoryOfficialDescriptions.render(active.id,values());}catch{preview.textContent='Completa los campos para ver la descripción.';}}
 function open(id,onApply){
  ensure();active=root.InventoryOfficialDescriptions.catalog.find(t=>t.id===id);if(!active)return;
  apply=onApply;title.textContent=active.label;error.textContent='';fields.replaceChildren();
  for(const field of active.fields){
   const label=document.createElement('label'),caption=document.createElement('span'),input=document.createElement('input');
   caption.textContent=field.label+(field.required?'':' (opcional)');input.name=field.key;input.id='official-field-'+field.key;input.value=field.defaultValue??'';input.autocomplete='off';input.required=field.required;
   if(field.kind==='quantity'){input.type='number';input.min='0';input.max='999';input.step='1';input.inputMode='numeric';input.placeholder='Ejemplo: 3';}
   else {input.type='text';input.placeholder=field.kind==='measure'?'Ejemplo: 150 x 60':'Escribe aquí';}
   label.append(caption,input);fields.append(label);
  }
  update();dialog.showModal();fields.querySelector('input')?.focus();
 }
 root.InventoryOfficialNoteEditor={open};
})(globalThis);
