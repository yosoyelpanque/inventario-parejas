(function(root) {
  'use strict';
  const normalize=value=>typeof value==='string'?value.normalize('NFC').trim().replace(/\s+/g,' ').toUpperCase():'';
  const unique=values=>[...new Set(values.map(normalize).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  const array=value=>Array.isArray(value)?value:[];
  const dismissed=state=>unique(array(state?.dismissedDescriptions));
  function catalog(state={}) {
    return unique([
      ...array(state.inventory).map(item=>item?.DESCRIPCION||item?.DESCRripcion),
      ...array(state.additionalItems).map(item=>item?.descripcion),
      ...array(state.perfilesMagicos).map(item=>item?.desc)
    ]);
  }
  function available(state) {
    const excluded=new Set(dismissed(state));
    return catalog(state).filter(value=>!excluded.has(value));
  }
  function dismiss(state,value) { return unique([...dismissed(state),normalize(value)]); }
  function restore(state,value) { const key=normalize(value);return dismissed(state).filter(entry=>entry!==key); }

  let panelState;
  const inlineInputs=new Map();
  let inlineState,inlineChange,inlineBusy=false;
  function bindInputs(state,onChange){
    inlineState=state;inlineChange=onChange;
    for(const input of root.document.querySelectorAll('input[list="lista-descripciones"],input[data-description-source]')){
      if(inlineInputs.has(input))continue;
      input.removeAttribute('list');input.dataset.descriptionSource='true';input.autocomplete='off';
      const wrapper=document.createElement('div'),popup=document.createElement('div'),message=document.createElement('p');
      wrapper.className='description-autocomplete';input.before(wrapper);wrapper.append(input,popup,message);
      popup.className='description-popup';popup.id=input.id+'-suggestions';popup.hidden=true;popup.setAttribute('role','grid');popup.setAttribute('aria-label','Sugerencias de descripciones');
      message.className='description-inline-message';message.setAttribute('role','status');
      input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-haspopup','grid');input.setAttribute('aria-controls',popup.id);input.setAttribute('aria-expanded','false');
      const ui={input,popup,wrapper,message,values:[],active:-1};inlineInputs.set(input,ui);
      const choose=value=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));hide(ui);input.focus({preventScroll:true});hide(ui);};
      ui.choose=choose;
      input.addEventListener('focus',()=>drawInline(ui));
      input.addEventListener('input',()=>{ui.active=-1;ui.message.textContent='';drawInline(ui);});
      input.addEventListener('keydown',event=>{
        if(event.key==='Escape'){hide(ui);event.preventDefault();return;}
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){
          if(popup.hidden)drawInline(ui);if(!ui.values.length)return;
          event.preventDefault();ui.active=(ui.active+(event.key==='ArrowDown'?1:-1)+ui.values.length)%ui.values.length;highlight(ui);return;
        }
        if(event.key==='Enter'&&!popup.hidden&&ui.active>=0){event.preventDefault();choose(ui.values[ui.active]);}
      });
      wrapper.addEventListener('focusout',()=>setTimeout(()=>{if(!wrapper.contains(document.activeElement))hide(ui);},0));
      document.addEventListener('pointerdown',event=>{if(!wrapper.contains(event.target))hide(ui);});
    }
    for(const ui of inlineInputs.values())if(!ui.popup.hidden)drawInline(ui);
  }
  function hide(ui){ui.popup.hidden=true;ui.input.setAttribute('aria-expanded','false');ui.input.removeAttribute('aria-activedescendant');ui.active=-1;}
  function highlight(ui){
    const rows=[...ui.popup.querySelectorAll('[role="row"]')];rows.forEach((row,index)=>row.classList.toggle('active',index===ui.active));
    if(ui.active>=0&&rows[ui.active]){const cell=rows[ui.active].querySelector('[role="gridcell"]');ui.input.setAttribute('aria-activedescendant',cell.id);rows[ui.active].scrollIntoView({block:'nearest'});}
    else ui.input.removeAttribute('aria-activedescendant');
  }
  function drawInline(ui){
    const query=normalize(ui.input.value);ui.values=available(inlineState).filter(value=>!query||value.includes(query)).slice(0,40);
    ui.popup.replaceChildren();ui.active=Math.min(ui.active,ui.values.length-1);
    for(const [index,value] of ui.values.entries()){
      const row=document.createElement('div'),cell=document.createElement('div'),actionCell=document.createElement('div'),choice=document.createElement('button'),remove=document.createElement('button');
      row.setAttribute('role','row');cell.setAttribute('role','gridcell');cell.id=ui.popup.id+'-'+index;actionCell.setAttribute('role','gridcell');
      choice.type=remove.type='button';choice.textContent=value;choice.className='description-choice';choice.disabled=remove.disabled=inlineBusy;
      remove.textContent='×';remove.className='description-remove';remove.title='Eliminar sugerencia';remove.setAttribute('aria-label','Eliminar sugerencia: '+value);
      for(const button of [choice,remove])button.addEventListener('pointerdown',event=>event.preventDefault());
      choice.onclick=()=>ui.choose(value);
      remove.onclick=async()=>{
        if(inlineBusy)return;inlineBusy=true;ui.message.textContent='Eliminando sugerencia…';drawInline(ui);
        try{await inlineChange(dismiss(inlineState,value));ui.message.textContent='Sugerencia eliminada. Puedes corregir el texto del campo.';}
        catch{ui.message.textContent='No se pudo eliminar. La sugerencia se conserva.';}
        finally{inlineBusy=false;for(const current of inlineInputs.values())if(!current.popup.hidden||current===ui)drawInline(current);ui.input.focus({preventScroll:true});}
      };
      cell.append(choice);actionCell.append(remove);row.append(cell,actionCell);ui.popup.append(row);
    }
    ui.popup.hidden=!ui.values.length;ui.input.setAttribute('aria-expanded',String(!ui.popup.hidden));highlight(ui);
  }
  function renderPanel(state,onChange) {
    if(root.document)bindInputs(state,onChange);
    const panel=root.document?.getElementById('description-suggestions-panel');
    if(!panel)return;
    if(!panelState||panelState.panel!==panel) {
      const $=id=>panel.querySelector('#'+id);
      panelState={panel,search:$('description-suggestions-search'),filter:$('description-suggestions-filter'),list:$('description-suggestions-list'),status:$('description-suggestions-status'),message:$('description-suggestions-message'),more:$('description-suggestions-more'),limit:60,busy:false};
      for(const element of [panelState.search,panelState.filter])element.addEventListener(element===panelState.search?'input':'change',()=>{panelState.limit=60;if(!panelState.busy)panelState.message.textContent='';draw();});
      panelState.more.onclick=()=>{panelState.limit+=60;draw();};
    }
    panelState.state=state;panelState.onChange=onChange;panelState.available=available(state);panelState.dismissed=dismissed(state);draw();
  }
  function draw() {
    const ui=panelState,removed=ui.filter.value==='removed',source=removed?ui.dismissed:ui.available,query=normalize(ui.search.value);
    const results=source.filter(value=>value.includes(query)),shown=results.slice(0,ui.limit);
    ui.status.textContent=`${shown.length} de ${results.length} sugerencias ${removed?'eliminadas':'disponibles'}${query?' que coinciden con la búsqueda':''}.`;
    ui.list.replaceChildren();
    if(!shown.length){const empty=document.createElement('li');empty.className='description-suggestions-empty';empty.textContent=query?'No hay coincidencias.':removed?'No hay sugerencias eliminadas.':'Todavía no hay sugerencias disponibles.';ui.list.append(empty);}
    shown.forEach((value,index)=>{
      const row=document.createElement('li'),label=document.createElement('span'),button=document.createElement('button');
      label.textContent=value;button.type='button';button.dataset.action=removed?'save':'danger';button.textContent=removed?'Restaurar':'Eliminar';button.setAttribute('aria-label',`${button.textContent} sugerencia: ${value}`);button.disabled=ui.busy;
      button.onclick=async()=>{
        if(ui.busy)return;
        ui.busy=true;ui.message.textContent='Guardando…';draw();
        try{
          await ui.onChange(removed?restore(ui.state,value):dismiss(ui.state,value));
          ui.message.textContent=removed?'Sugerencia restaurada.':'Sugerencia eliminada. Los bienes conservan su descripción.';
        }catch{ui.message.textContent='No se pudo guardar el cambio. La sugerencia se conserva; vuelve a intentarlo.';}
        finally{
          ui.busy=false;draw();
          const buttons=ui.list.querySelectorAll('button');(buttons[Math.min(index,buttons.length-1)]||ui.search).focus({preventScroll:true});
        }
      };
      row.append(label,button);ui.list.append(row);
    });
    ui.more.hidden=shown.length>=results.length;ui.more.disabled=ui.busy;
  }
  const api={normalize,catalog,dismissed,available,dismiss,restore,renderPanel};
  root.InventoryDescriptionSuggestions=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
