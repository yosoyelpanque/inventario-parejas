Warning: truncated output (original token count: 45703)
Total output lines: 1486



const NOMBRES_AREAS = { "131100": "Dirección de Almacén e Inventarios", "131000": "Dirección de Almacén e Inventarios", "1": "Dirección General", "2": "Finanzas", "3": "Recursos Humanos", "4": "Operaciones", "5": "Sistemas", "CONTRATO": "Arrendamiento" };
const defaultPerfilesMagicos = [ { regexStr: '^MZ01', desc: 'CPU', marca: 'LENOVO', modelo: 'THINK CENTRE M75s GEN 5', posesion: 'Arrendamiento' }, { regexStr: '^VR00', desc: 'MONITOR', marca: 'LENOVO', modelo: 'S22I-30', posesion: 'Arrendamiento' }, { regexStr: '^8SSD51', desc: 'TECLADO', marca: 'LENOVO', modelo: 'KU1601', posesion: 'Arrendamiento' }, { regexStr: '^8SSM51', desc: 'MOUSE', marca: 'LENOVO', modelo: 'MOJUUO', posesion: 'Arrendamiento' }, { regexStr: '^PF[A-Z0-9]{6}', desc: 'LAPTOP', marca: 'LENOVO', modelo: 'THINKPAD', posesion: 'Arrendamiento' }, { regexStr: '^12240', desc: 'REGULADOR DE VOLTAJE', marca: 'SMARTBITT', modelo: 'SBNB500', posesion: 'Arrendamiento' }, { regexStr: '^22WZ', desc: 'TELÉFONO', marca: 'AVAYA', modelo: 'VANTAGE 12', posesion: 'Cámara' }, { regexStr: '^17WZ[A-Z0-9]{8,}', desc: 'TELÉFONO', marca: 'AVAYA', modelo: '9611G', posesion: 'Cámara' } ];

document.addEventListener('DOMContentLoaded', async () => {
    const gate = document.getElementById('workspace-gate');
    const waiting = setTimeout(() => {
        document.getElementById('workspace-message').textContent = 'El inventario está abierto en otra pestaña. Continúa allí o ciérrala: esta ventana se habilitará automáticamente con los datos más recientes.';
    }, 700);
    try {
        await InventoryStorage.acquireWorkspace();
        clearTimeout(waiting);
        await InventoryStorage.init('parejas-local-v1');
        gate.hidden = true; document.getElementById('app-container').inert = false;
    } catch(error) {
        clearTimeout(waiting); document.getElementById('workspace-message').textContent = error.message; return;
    }
    window.addEventListener('pageshow', event => { if(event.persisted) location.reload(); });



    let state = { loggedIn: false, currentUser: null, companion: null, inventory: [], additionalItems: [], resguardantes: [], activeResguardante: null, locations: {}, areas: [], areaNames: {}, responsablesList: [], additionalPhotos: {}, locationPhotos: {}, notes: {}, archivedNotes: {}, photos: {}, userPhotos: {}, suggestedNames: [], perfilesMagicos: [] };
    let stateHistory = []; let lastSelectedEdificio = 'EDIF. A'; let lastSelectedPiso = 'PLANTA BAJA'; let tempUserLocations = []; let tempUserLocationDetails = {}; let searchHistory = []; let cameraStream = null; let html5QrCode = null;

    function cleanAreaName(areaId, rawName) {
        if(!rawName) return '';
        let cleaned = rawName.replace(new RegExp(`^(ÁREA|AREA)\\s+${areaId}\\s*-?\\s*`, 'i'), '').trim();
        cleaned = cleaned.replace(new RegExp(`^(ÁREA|AREA)\\s+${areaId}\\s*-?\\s*`, 'i'), '').trim();
        return cleaned;
    }

    function renderSessionHistory(){
        const box=document.getElementById('session-history');box.replaceChildren();
        if(!stateHistory.length)box.textContent='Todavía no hay cambios recuperables guardados.';
        for(const entry of [...stateHistory].reverse()){
            const row=document.createElement('p');row.textContent=new Date(entry.at).toLocaleString('es-MX')+' · '+entry.label;box.append(row);
        }
        document.getElementById('history-undo').disabled=!stateHistory.length;
        document.getElementById('undo-btn').classList.toggle('hidden',!stateHistory.length);
    }
    function saveSnapshot(label='Cambio en los datos') {
        const snap=structuredClone({inventory:state.inventory,additionalItems:state.additionalItems,resguardantes:state.resguardantes,notes:state.notes,archivedNotes:state.archivedNotes,locations:state.locations,activeResguardante:state.activeResguardante,locationPhotos:state.locationPhotos,perfilesMagicos:state.perfilesMagicos,areaNames:state.areaNames,responsablesList:state.responsablesList,suggestedNames:state.suggestedNames,loadedListings:state.loadedListings||[]});
        stateHistory.push({snap,at:Date.now(),label});if(stateHistory.length>10)stateHistory.shift();renderSessionHistory();photoDB.setItem('appData','changeHistory',structuredClone(stateHistory)).catch(()=>showToast('No se pudo guardar el historial. Genera un respaldo ZIP.','error'));
    }
    document.getElementById('undo-btn').onclick = async () => {
        const entry=stateHistory.at(-1);if(!entry)return;
        const button=document.getElementById('undo-btn'),historyButton=document.getElementById('history-undo');button.disabled=historyButton.disabled=true;
        try {
            const next={...state,...structuredClone(entry.snap)};
            await photoDB.setItem('appData','mainState',InventoryData.clean(next),[{store:'appData',key:'changeHistory',value:stateHistory.slice(0,-1)}]);
            state=next;stateHistory.pop();recalculateLocationCounts();Object.assign(NOMBRES_AREAS,state.areaNames);populateFilters();updateDatalists();renderDashboard();renderUsers();filterAndRenderInventory();renderAdicionales();renderNotasTab();updateBanner();restoreAdditionalDraft();renderSessionHistory();renderResponsablesSettings();renderLoadedListings();populateReportFilters();
            showToast('Cambio revertido y guardado en este equipo','success');
        } catch {showToast('No se pudo deshacer. El historial y los datos se conservan; vuelve a intentarlo.','error');}
        finally {button.disabled=false;historyButton.disabled=!stateHistory.length;}
    };
    document.getElementById('history-undo').onclick=()=>document.getElementById('undo-btn').click();

    async function renderRecoveryPoints(){
        const box=document.getElementById('recovery-points');box.replaceChildren();
        try{const points=await photoDB.getItem('appData','recoveryPoints')||[];if(!points.length)box.textContent='Aún no hay puntos de recuperación.';
        for(const point of points){const card=document.createElement('section');card.className='area-review';const text=document.createElement('p');text.textContent=new Date(point.at).toLocaleString('es-MX')+' · '+point.label+' · '+point.state.inventory.length+' bienes · '+(point.state.additionalItems||[]).length+' adicionales · '+point.images.length+' imágenes';const button=document.createElement('button');button.dataset.action='edit';button.textContent='Restaurar este punto';button.onclick=()=>showConfirm('Restaurar punto de recuperación','Se reemplazarán los datos, fotografías, planos y borradores actuales por los del '+new Date(point.at).toLocaleString('es-MX')+'. Primero se guardará un punto del estado actual. ¿Continuar?',async()=>{
            const overlay=document.getElementById('loading-overlay');overlay.classList.add('show');try{const restored=await InventoryRecovery.restore(photoDB,point.id,state);state={...InventoryData.clean(restored.state),loggedIn:state.loggedIn,currentUser:state.currentUser,companion:state.companion};drafts=structuredClone(restored.drafts);stateHistory=[];pendingConcilData=null;document.getElementById('conciliador-results').classList.add('hidden');recalculateLocationCounts();refreshListingViews();renderUsers();renderAdicionales();renderNotasTab();updateBanner();restoreAdditionalDraft();renderSessionHistory();await renderRecoveryPoints();showToast('Punto restaurado y guardado en este equipo','success');location.reload();}catch(e){showToast('No se pudo restaurar. '+escapeHTML(e.message),'error');}finally{overlay.classList.remove('show');}
        });card.append(text,button);box.append(card);}}
        catch{box.textContent='No se pudieron leer los puntos de recuperación.';}
    }
    document.getElementById('recovery-create').onclick=async()=>{const overlay=document.getElementById('loading-overlay');overlay.classList.add('show');try{await InventoryRecovery.create(photoDB,state,'Punto manual');await renderRecoveryPoints();showToast('Punto de recuperación guardado','success');}catch(e){showToast('No se pudo crear el punto. '+escapeHTML(e.message),'error');}finally{overlay.classList.remove('show');}};

    function matchMagicProfile(val) { return state.perfilesMagicos ? state.perfilesMagicos.find(p => { try { return new RegExp(p.regexStr, 'i').test(val); } catch(e) { return false; } }) : null; }
    function focusSearch() { const input = document.getElementById('global-search-input'); if(input && !input.disabled) { input.focus(); input.select(); setTimeout(() => { input.focus(); input.select(); }, 150); } }
    window.copyRespText = (text) => { navigator.clipboard.writeText(text).then(() => showToast('Nombre copiado', 'success')).catch(() => showToast('Error al copiar', 'error')); };
    function escapeHTML(str) { return String(str||'').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
    function inlineValue(value){return escapeHTML(JSON.stringify(String(value??'')).replace(/'/g,'\\u0027'));}
    function generateUUID() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }); }
    function showToast(message, type = 'info') { const toast = document.createElement('div'); toast.className = `px-6 py-3 rounded-xl text-white shadow-xl font-bold text-lg mb-2 transition-all transform pointer-events-auto ${type==='error'?'bg-red-600':type==='warning'?'bg-yellow-500':'bg-gray-800'}`; toast.innerHTML = `<i class="fa-solid ${type==='error'?'fa-circle-exclamation':'fa-circle-check'} mr-2"></i> ${message}`; document.getElementById('toast-container').appendChild(toast); while(document.getElementById('toast-container').children.length>2)document.getElementById('toast-container').firstElementChild.remove(); setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000); }

    const photoDB = window.InventoryStorage;

    function recalculateLocationCounts() { state.locations = {}; state.resguardantes.forEach(user => { let locs = user.locations?.length ? user.locations : [user.locationWithId]; locs.forEach(loc => { if(!loc) return; let base = (loc.match(/^(.*?)\s*(\d+)$/) ? RegExp.$1 : loc).trim().toUpperCase(); state.locations[base] = (state.locations[base] || 0) + 1; }); }); }
    function saveState() { const s = window.InventoryData.clean(state); photoDB.setItem('appData', 'mainState', s).catch(e => { console.error("Error saving state", e); showToast('No se pudo guardar. Exporta un respaldo antes de cerrar.', 'error'); }); updateDatalists(); }
    function showConfirm(title, text, onConfirm) { document.getElementById('modal-confirm').dataset.action = /^(Eliminar|Borrar|Quitar|Desubicar|Descartar|¡PELIGRO!)/.test(title) ? 'danger' : (document.activeElement?.closest('button')?.dataset.action || 'save'); document.getElementById('modal-title').textContent = title; document.getElementById('modal-text').textContent = text; document.getElementById('confirmation-modal').classList.add('show'); document.getElementById('modal-confirm').onclick = () => { onConfirm(); document.getElementById('confirmation-modal').classList.remove('show'); }; document.getElementById('modal-cancel').onclick = () => document.getElementById('confirmation-modal').classList.remove('show'); }
    function getNomenclature(user, locStr) { if(!user || !locStr) return ''; const dets = user.locationDetails && user.locationDetails[locStr] ? user.locationDetails[locStr] : {edificio:'N/A', piso:'N/A'}; const areaName = cleanAreaName(user.area, NOMBRES_AREAS[user.area]); return `${dets.edificio}/${dets.piso}-${user.name}-${locStr}-A:${user.area}-${areaName}`.toUpperCase(); }

    let drafts={additional:{},notes:{}};
    const draftFields=['serie','clave','desc','marca','modelo','type','dynamic-input'];
    function persistDrafts(){
        return photoDB.setItem('appData','captureDrafts',structuredClone(drafts)).then(()=>true).catch(()=>{
            document.getElementById('capture-draft-status').textContent='No se pudo guardar el borrador. Conserva esta pantalla abierta.';document.getElementById('note-draft-status').textContent='No se pudo guardar el borrador. Conserva el texto abierto.';return false;
        });
    }
    function captureAdditionalDraft(){
        const id=state.activeResguardante?.id;if(!id)return;
        const fields=Object.fromEntries(draftFields.map(key=>[key,document.getElementById('ad-'+key).value]));
        if(['serie','clave','desc','marca','modelo'].some(key=>fields[key].trim())){
            drafts.additional[id]={fields,location:document.getElementById('active-user-location-select').value};
            document.getElementById('capture-draft-status').textContent='Borrador de '+state.activeResguardante.name+' · guardando…';
        }else {delete drafts.additional[id];document.getElementById('capture-draft-status').textContent='';}
        const name=state.activeResguardante.name;return persistDrafts().then(saved=>{if(saved&&state.activeResguardante?.id===id&&drafts.additional[id])document.getElementById('capture-draft-status').textContent='Borrador conservado en este equipo para '+name;});
    }
    function restoreAdditionalDraft(){
        const draft=drafts.additional[state.activeResguardante?.id];
        document.getElementById('adicional-form').reset();autoValues.ad={};
        toggleAdicFormFields('ad','institutional');
        document.getElementById('serie-warning').classList.add('hidden');
        if(draft){
            for(const key of draftFields)document.getElementById('ad-'+key).value=draft.fields[key]||'';
            toggleAdicFormFields('ad',draft.fields.type);
            const select=document.getElementById('active-user-location-select');
            if([...select.options].some(o=>o.value===draft.location))select.value=draft.location;
        }
        document.getElementById('capture-draft-status').textContent=draft?'Borrador recuperado para '+state.activeResguardante.name:'';
    }
    document.getElementById('adicional-form').addEventListener('input',captureAdditionalDraft);
    document.getElementById('adicional-form').addEventListener('change',captureAdditionalDraft);
    document.getElementById('active-user-location-select').addEventListener('change',captureAdditionalDraft);
    document.getElementById('discard-capture-draft').onclick=()=>showConfirm('Descartar borrador','Se vaciará el formulario del usuario activo. Los bienes guardados se conservan.',async()=>{
        delete drafts.additional[state.activeResguardante?.id];await persistDrafts();restoreAdditionalDraft();
    });
    document.getElementById('note-textarea').addEventListener('input',()=>{
        const key=document.getElementById('note-save-btn').dataset.c;if(!key||key==='BULK')return;
        drafts.notes[key]=document.getElementById('note-textarea').value;
        persistDrafts();document.getElementById('note-draft-status').textContent='Borrador local: se recuperará al abrir este bien.';
    });
    document.getElementById('discard-note-draft').onclick=()=>{
        const key=document.getElementById('note-save-btn').dataset.c;
        delete drafts.notes[key];persistDrafts();document.getElementById('note-textarea').value=state.notes[key]||'';
        document.getElementById('note-draft-status').textContent='';renderNoteSuggestions();
    };

    function populateTransferUsers(){
        for(const id of ['transfer-from','transfer-to']){const select=document.getElementById(id),old=select.value;select.replaceChildren(new Option('Selecciona un usuario',''),...state.resguardantes.map(u=>new Option(u.name+' · Área '+u.area,u.id)));if(state.resguardantes.some(u=>u.id===old))select.value=old;}
        updateTransferLocations();
    }
    function updateTransferLocations(){
        const user=state.resguardantes.find(u=>u.id===document.getElementById('transfer-from').value),select=document.getElementById('transfer-location');
        select.replaceChildren(new Option('Selecciona una ubicación',''),...(user?.locations||[]).map(l=>new Option(l,l)));document.getElementById('transfer-name').value='';updateTransferSummary();
    }
    function getTransfer(){return InventoryOperations.transfer(state,document.getElementById('transfer-from').value,document.getElementById('transfer-to').value,document.getElementById('transfer-location').value,document.getElementById('transfer-name').value);}
    function updateTransferSummary(){
        const box=document.getElementById('transfer-summary');
        try{const plan=getTransfer();box.textContent=(plan.crossArea?'ATENCIÓN: usuarios de distintas áreas ('+plan.from.area+' → '+plan.to.area+'). ':'')+plan.inventoryCount+' bienes de inventario y '+plan.additionalCount+' adicionales pasarán a '+plan.to.name+'.';box.style.color=plan.crossArea?'#A35C2B':'';}
        catch(error){box.textContent=error.message;box.style.color='';}
    }
    document.getElementById('transfer-from').onchange=updateTransferLocations;
    document.getElementById('transfer-to').onchange=updateTransferSummary;
    document.getElementById('transfer-location').onchange=()=>{document.getElementById('transfer-name').value='';updateTransferSummary();};
    document.getElementById('transfer-name').oninput=updateTransferSummary;

    document.getElementById('transfer-submit').onclick=()=>{
        let plan;try{plan=getTransfer();}catch(e){return showToast(e.message,'warning');}
        showConfirm(plan.crossArea?'Transferencia entre áreas diferentes':'Transferir ubicación',`${plan.from.name} (área ${plan.from.area}) → ${plan.to.name} (área ${plan.to.area}). Ubicación: ${plan.location} → ${plan.name}. Se transferirán ${plan.inventoryCount} bienes de inventario y ${plan.additionalCount} adicionales, con su fotografía e infraestructura.`,async()=>{
            const button=document.getElementById('transfer-submit');button.disabled=true;document.getElementById('loading-overlay').classList.add('show');
            try{
                plan=getTransfer();await photoDB.flush();
                const photo=await photoDB.getItem('photos','location-'+plan.sourcePhoto);
                if(await photoDB.getItem('photos','location-'+plan.targetPhoto))throw Error('Existe una fotografía previa en el destino. Usa otro nombre de ubicación.');
                if(photo)plan.next.locationPhotos[plan.targetPhoto]=true;
                await new Promise((resolve,reject)=>{const tx=photoDB.db.transaction(['appData','photos'],'readwrite');tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('No se pudo guardar la transferencia'));tx.objectStore('appData').put(InventoryData.clean(plan.next),'mainState');if(photo)tx.objectStore('photos').put(photo,'location-'+plan.targetPhoto);});
                saveSnapshot('Transferir ubicación: '+plan.location);state=plan.next;recalculateLocationCounts();updateBanner();renderUsers();populateFilters();renderDashboard();filterAndRenderInventory();renderAdicionales();populateTransferUsers();
                showToast('Ubicación y bienes transferidos','success');
            }catch(e){showToast(e.message,'error');}finally{button.disabled=false;document.getElementById('loading-overlay').classList.remove('show');}
        });
    };

    function recalculateAdicionalesKeys() { InventoryAdditional.renumber(state); }
    function toggleAdicFormFields(prefix, requestedType) {
        const $=id=>document.getElementById(prefix+'-'+id);
        const personal=document.querySelector('input[name="'+(prefix==='ad'?'personal':'edit-personal')+'"]:checked')?.value==='Si';
        const possession=$('posesion').value;
        const type=requestedType||(personal?'personal':possession==='Arrendamiento'?'rental':possession==='Propiedad del Grupo'?'group':$('clave').value.trim()?'external':'institutional');
        $('type').value=type;
        $('posesion').value=type==='rental'?'Arrendamiento':type==='group'?'Propiedad del Grupo':'Cámara';
        document.querySelectorAll('input[name="'+(prefix==='ad'?'personal':'edit-personal')+'"]').forEach(r=>r.checked=r.value===(type==='personal'?'Si':'No'));
        const visible=type==='external'||type==='rental'||type==='group';
        $('dynamic-container').classList.toggle('hidden',!visible);
        $('dynamic-input').disabled=!visible;
        $('dynamic-label').textContent=type==='rental'?'Área de procedencia / número de contrato':type==='group'?'Grupo parlamentario (opcional)':'Área de procedencia (opcional)';
        $('dynamic-input').placeholder=type==='rental'?'Número de contrato':type==='group'?'Nombre del grupo':'Área de origen, si se conoce';
        $('clave-hint').textContent=type==='institutional'?'Se genera CD-ÁREA-001 y se renumera al eliminar un adicional.':type==='rental'?'No es obligatoria: al guardar se asigna ARR-001, ARR-002… con un contador exclusivo de arrendamiento.':type==='external'?'Clave escrita: adicional procedente de otra área.':'Clave opcional para este tipo de bien.';
        $('clave').placeholder=type==='rental'?'Vacío: contador automático ARR-001…':type==='institutional'?'Vacío: clave automática CD-ÁREA-001':type==='external'?'Escribe la clave del bien':'Clave opcional';
    }
    const autoValues={ad:{},'edit-ad':{}};
    function recognizeAdditional(prefix) {
        const $=id=>document.getElementById(prefix+'-'+id),value=InventoryAdditional.norm($('serie').value);
        const warning=document.getElementById(prefix==='ad'?'serie-warning':'edit-serie-warning');
        warning.replaceChildren();warning.classList.add('hidden');
        const old=autoValues[prefix];
        for(const [field,val] of Object.entries(old))if($(field).value===val)$(field).value='';
        autoValues[prefix]={};
        const editing=prefix==='edit-ad'?document.getElementById('edit-adicional-save-btn').dataset.id:null;
        const inv=value&&state.inventory.find(i=>InventoryAdditional.norm(i.SERIE)===value);
        const additional=value&&state.additionalItems.find(i=>i.id!==editing&&InventoryAdditional.norm(i.serie)===value);
        const profile=value&&matchMagicProfile(value);
        const data=inv?{desc:inv.DESCRIPCION||inv.DESCRripcion||'',marca:inv.MARCA||'',modelo:inv.MODELO||''}:additional?{desc:additional.descripcion||'',marca:additional.marca||'',modelo:additional.modelo||''}:profile?{desc:profile.desc||'',marca:profile.marca||'',modelo:profile.modelo||''}:null;
        if(data)for(const [field,val] of Object.entries(data)){ $(field).value=String(val);autoValues[prefix][field]=String(val); }
        if(inv||additional){
            warning.append(document.createTextNode(inv?'Esta serie ya existe en el inventario principal. ':'Esta serie ya existe en adicionales. '));
            const button=document.createElement('button');button.type='button';button.dataset.action='info';button.textContent='Ver '+(inv?inv['CLAVE UNICA']:additional.claveAsignada||'bien');
            button.onclick=()=>inv?showInvDetail(inv['CLAVE UNICA']):showAdicDetail(additional.id);warning.append(button);warning.classList.remove('hidden');
        }else if(profile){
            const type=profile.posesion==='Arrendamiento'?'rental':profile.posesion==='Propiedad del Grupo'?'group':$('clave').value.trim()?'external':'institutional';
            toggleAdicFormFields(prefix,type);
            if(type==='rental'){
                const contract=profile.numContrato||profile.contrato||'LXVIDG AJ- 070/2024';
                $('dynamic-input').value=contract;autoValues[prefix]['dynamic-input']=contract;
            }
            warning.textContent='Serie reconocida: datos completados. Puedes corregirlos antes de guardar.';warning.classList.remove('hidden');
        }else{
            if(Object.keys(old).length&&$('type').value==='rental')toggleAdicFormFields(prefix,$('clave').value.trim()?'external':'institutional');
            if(value){warning.textContent='Sin coincidencias. Completa los datos y elige si es institucional o personal.';warning.classList.remove('hidden');}
        }
    }
    for(const prefix of ['ad','edit-ad']){
        const $=id=>document.getElementById(prefix+'-'+id);
        $('type').onchange=()=>{
            const before=$('posesion').value;
            toggleAdicFormFields(prefix,$('type').value);
            if(before!==$('posesion').value)$('dynamic-input').value='';
            if($('type').value==='external'&&!$('clave').value)$('clave').focus();
        };
        $('clave').oninput=()=>toggleAdicFormFields(prefix);
        $('serie').oninput=()=>recognizeAdditional(prefix);
        $('posesion').onchange=()=>toggleAdicFormFields(prefix);
        document.getElementById(prefix==='ad'?'autofill-serie-btn':'edit-autofill-serie-btn').onclick=()=>recognizeAdditional(prefix);
    }
    function readAdditional(prefix,existing) {
        const $=id=>document.getElementById(prefix+'-'+id),type=$('type').value;
        const key=$('clave').value.trim(),serial=$('serie').value.trim(),description=$('desc').value.trim();
        if(!description)throw Error('La descripción es obligatoria');
        if(type==='external'&&!key)throw Error('Escribe la clave del adicional de otra área');
        if(key&&state.additionalItems.some(i=>i.id!==existing?.id&&InventoryAdditional.norm(i.claveAsignada)===InventoryAdditional.norm(key)))throw Error('La clave ya existe en adicionales');
        if(key&&state.inventory.some(i=>InventoryAdditional.norm(i['CLAVE UNICA'])===InventoryAdditional.norm(key)))throw Error('La clave ya existe en el inventario principal; revisa ese bien');
        if(serial&&state.inventory.some(i=>InventoryAdditional.norm(i.SERIE)===InventoryAdditional.norm(serial)))throw Error('La serie ya existe en el inventario principal; abre el bien encontrado');
        if(serial&&state.additionalItems.some(i=>i.id!==existing?.id&&InventoryAdditional.norm(i.serie)===InventoryAdditional.norm(serial)))throw Error('La serie ya existe en adicionales');
        const user=existing?state.resguardantes.find(u=>existing.resguardanteId?u.id===existing.resguardanteId:u.name===existing.usuario):state.activeResguardante;
        if(!user)throw Error('Activa un resguardante antes de registrar el bien');
        const dyn=$('dynamic-input').value.trim();
        return {...existing,id:existing?.id||generateUUID(),descripcion:description,marca:$('marca').value.trim(),modelo:$('modelo').value.trim(),serie:serial,claveAsignada:key,claveAutogenerada:(['institutional','external','rental'].includes(type))&&!key,tipoBien:type,posesion:type==='rental'?'Arrendamiento':type==='group'?'Propiedad del Grupo':'Cámara',personal:type==='personal'?'Si':'No',areaProcedencia:type==='external'?dyn:'',numContrato:type==='rental'?dyn:'',grupoParlamentario:type==='group'?dyn:'',usuario:user.name,resguardanteId:user.id,ubicacionEspecifica:existing?.ubicacionEspecifica||document.getElementById('active-user-location-select').value||user.locationWithId,...(existing ? InventoryTeam.savedAttribution(existing) : InventoryTeam.attribution(state)),createdAt:existing?.createdAt||Date.now()};
    }
    async function persistAdditional(item,editing=false) {
        const overlay=document.getElementById('loading-overlay');overlay.classList.add('show');
        try{
            const next=structuredClone(state);
            if(editing)next.additionalItems=next.additionalItems.map(i=>i.id===item.id?item:i);else next.additionalItems.unshift(item);
            InventoryAdditional.renumber(next);
            await photoDB.setItem('appData','mainState',InventoryData.clean(next));
            saveSnapshot(editing?'Editar bien adicional':'Registrar bien adicional');state=next;updateDatalists();renderAdicionales();updateActiveUserLocationSelect();filterAndRenderInventory();
            document.getElementById('edit-adicional-modal').classList.remove('show');
            if(!editing){delete drafts.additional[item.resguardanteId];await persistDrafts();document.getElementById('capture-draft-status').textContent='';document.getElementById('adicional-form').reset();autoValues.ad={};toggleAdicFormFields('ad','institutional');document.getElementById('serie-warning').classList.add('hidden');document.getElementById('ad-serie').focus();}
            showToast('Adicional guardado.','success');
        }catch(error){showToast(error.message,'error');}finally{overlay.classList.remove('show');}
    }
    function askEntryAndSave(item,editing=false){
        if(item.personal!=='Si'){delete item.tieneFormatoEntrada;return persistAdditional(item,editing);}
        const modal=document.getElementById('formato-entrada-modal');modal.classList.add('show');
        for(const [suffix,answer] of [['si',true],['no',false]])document.getElementById('formato-entrada-'+suffix).onclick=()=>{modal.classList.remove('show');item.tieneFormatoEntrada=answer;persistAdditional(item,editing);};
    }

    let cameraRequest=0, releasePhotoFocus=()=>{}, releaseScanFocus=()=>{};
    async function startCamera() { stopCamera(); const request=cameraRequest; try { const stream = await InventoryCamera.use(video=>navigator.mediaDevices.getUserMedia({video,audio:false})); if(request!==cameraRequest){stream.getTracks().forEach(t=>t.stop());return;} cameraStream=stream; const videoEl = document.getElementById('camera-stream'); videoEl.srcObject = cameraStream; videoEl.setAttribute('playsinline', true); await videoEl.play(); if(request===cameraRequest)releasePhotoFocus=InventoryCamera.attachFocus(videoEl,document.getElementById("photo-focus-status")); } catch (err) { showToast('Error de cámara.', 'error'); } }
    function stopCamera() { ++cameraRequest; releasePhotoFocus(); if(cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; } const videoEl = document.getElementById('camera-stream'); if(videoEl) { videoEl.pause(); videoEl.srcObject = null; } }
    document.getElementById('change-team-btn').onclick = async () => {
        try {
            await photoDB.flush();
            InventoryTeam.edit({active:state.currentUser,companion:state.companion});
            document.getElementById('main-app').classList.add('hidden');
            document.getElementById('team-page').classList.remove('hidden');
            document.getElementById('team-back').hidden=false;
            document.getElementById('team-back').focus();
        }
        catch { showToast('No se pudo guardar. Conserva esta pantalla abierta.', 'error'); }
    };
    document.getElementById('team-back').onclick=()=>{
        document.getElementById('team-page').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('change-team-btn').focus();
    };
    let swapped = false;
    function renderTeam() {
        document.getElementById('current-user-name').textContent = 'Ubicado por: ' + InventoryTeam.label(state.currentUser.name,state.currentUser.employeeNumber);
        document.getElementById('current-companion-name').textContent = state.companion ? 'Auxiliado por: ' + InventoryTeam.label(state.companion.name) : 'Sin compañero';
        document.getElementById('swap-team-btn').hidden=!state.companion;
        document.getElementById('swap-team-btn').setAttribute('aria-checked', String(swapped));
    }
    document.getElementById('swap-team-btn').onclick = () => {
        if(!state.companion)return;
        if(document.querySelector('.modal-overlay.show')) return showToast('Termina o cierra el formulario antes de intercambiar.', 'warning');
        try {
            const team = InventoryTeam.swap({active:state.currentUser,companion:state.companion});
            InventoryTeam.remember(team);
            state.currentUser = team.active; state.companion = team.companion; swapped = !swapped;
            renderTeam(); showToast('Ahora captura ' + escapeHTML(state.currentUser.name));
        } catch(error) { showToast(escapeHTML(error.message),'error'); }
    };

    function updateHeaderArea() {
        const areasLoaded = Object.keys(state.areaNames || {}).sort();
        const infoDiv = document.getElementById('header-area-info'); const progSpan = document.getElementById('header-progress');
        if(areasLoaded.length > 0) { const baseArea = areasLoaded[0]; infoDiv.textContent = `Área Base: ${baseArea} - ${cleanAreaName(baseArea, state.areaNames[baseArea])}`; infoDiv.classList.remove('hidden'); } else { infoDiv.classList.add('hidden'); }
        if (state.inventory && state.inventory.length > 0) { const ubicados = state.inventory.filter(i => i.UBICADO === 'SI').length; const pct = Math.round((ubicados / state.inventory.length) * 100) || 0; if(progSpan) { progSpan.innerHTML = `<progress max="100" value="${pct}" aria-label="Avance de verificación"></progress><span>${pct}% verificado</span>`; progSpan.classList.remove('hidden'); } } else if(progSpan) { progSpan.classList.add('hidden'); }
    }

    function renderResponsablesSettings() {
        const container=document.getElementById('settings-responsables-list'),term=document.getElementById('responsables-search').value.toLocaleLowerCase('es');container.replaceChildren();
        const people=(state.responsablesList||[]).filter(r=>[r.name,r.area,r.areaName,r.title].join(' ').toLocaleLowerCase('es').includes(term));
        if(!people.length)container.textContent='No hay responsables que mostrar.';
        for(const r of people){const card=document.createElement('section');card.className='area-review';const title=document.createElement('h3');title.textContent=r.name;const detail=document.createElement('p');detail.textContent='Área '+r.area+' · '+(r.areaName||state.areaNames?.[r.area]||'')+' · '+(r.title||'Cargo no indicado');const copy=document.createElement('button');copy.dataset.action='info';copy.textContent='Copiar nombre';copy.onclick=()=>copyRespText(r.name);card.append(title,detail,copy);container.append(card);}
    }
    document.getElementById('responsables-search').oninput=renderResponsablesSettings;
    function refreshListingViews(){Object.assign(NOMBRES_AREAS,state.areaNames);populateFilters();populateReportFilters();updateDatalists();renderDashboard();filterAndRenderInventory();updateHeaderArea();renderResponsablesSettings();renderLoadedListings();}
    function renderLoadedListings(){
        const box=document.getElementById('settings-listings');box.replaceChildren();const groups=InventoryListings.list(state);
        if(!groups.length)box.textContent='No hay listados cargados.';
        for(const b of groups){const row=document.createElement('section');row.className='area-review';const text=document.createElement('p');text.textContent='Área '+b.areaId+' · '+b.bookType+' · '+b.count+' bienes. Fecha: '+(b.dates?.join(', ')||'No registrada')+(b.filename?' · '+b.filename:'');const button=document.createElement('button');button.dataset.action='danger';button.textContent='Eliminar listado';button.onclick=()=>showConfirm('Eliminar listado', 'Área '+b.areaId+' · '+b.bookType+': se quitarán '+b.count+' bienes del inventario. Se conservarán usuarios, adicionales, notas y fotografías. ¿Continuar?',async()=>{
            document.getElementById('loading-overlay').classList.add('show');
            try{const next=InventoryListings.remove(state,b.areaId,b.bookType);await InventoryRecovery.create(photoDB,state,'Antes de eliminar listado: '+b.areaId+' / '+b.bookType);await photoDB.setItem('appData','mainState',InventoryData.clean(next));saveSnapshot('Eliminar listado: '+b.areaId+' / '+b.bookType);state=next;pendingConcilData=null;document.getElementById('conciliador-results').classList.add('hidden');refreshListingViews();renderRecoveryPoints();showToast('Listado eliminado. Puedes deshacerlo en el historial.','success');}catch{showToast('No se pudo eliminar. Los datos se conservan.','error');}finally{document.getElementById('loading-overlay').classList.remove('show');}
        });row.append(text,button);box.append(row);}
    }

    function renderMagicProfiles() {
        const container = document.getElementById('settings-magic-list'); if(!container) return; if(state.perfilesMagicos.length === 0) { container.innerHTML = '<p class="text-gray-400 text-sm italic py-2">No hay perfiles.</p>'; return; }
        container.innerHTML = state.perfilesMagicos.map((p, i) => `<div class="flex justify-between items-center p-3 border-2 border-indigo-50 rounded-xl bg-white shadow-sm mb-2"><div class="flex-1 overflow-hidden pr-2"><div class="flex items-center gap-2 mb-1"><span class="font-mono text-xs font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">${escapeHTML(p.regexStr)}</span><span class="text-[10px] font-bold text-gray-400 uppercase border border-gray-200 px-1.5 rounded">${escapeHTML(p.posesion)}</span></div><p class="font-bold text-sm text-gray-800 truncate">${escapeHTML(p.desc)} <span class="font-medium text-gray-500 ml-1">(${escapeHTML(p.marca)} ${escapeHTML(p.modelo)})</span></p></div><button data-action="danger" onclick="deleteMagicProfile(${i})" class="w-10 h-10 hover:text-white rounded-lg transition-colors"><i class="fa-solid fa-trash"></i></button></div>`).join('');
    }
    window.deleteMagicProfile = (i) => { showConfirm('Eliminar Perfil', '¿Eliminar este perfil mágico?', () => { saveSnapshot(); state.perfilesMagicos.splice(i, 1); saveState(); renderMagicProfiles(); }); };
    document.getElementById('add-magic-btn').onclick = () => { let regexStr = document.getElementById('new-magic-regex').value.trim().toUpperCase(); const desc = document.getElementById('new-magic-desc').value.trim().toUpperCase(); const marca = document.getElementById('new-magic-marca').value.trim().toUpperCase(); const modelo = document.getElementById('new-magic-modelo').value.trim().toUpperCase(); const posesion = document.getElementById('new-magic-posesion').value; if(!regexStr || !desc) return showToast('Prefijo y descripción obligatorios', 'warning'); if(!regexStr.startsWith('^')) regexStr = '^' + regexStr; saveSnapshot(); state.perfilesMagicos.push({ regexStr, desc, marca, modelo, posesion }); saveState(); renderMagicProfiles(); showToast('Perfil guardado', 'success'); document.getElementById('new-magic-regex').value = ''; document.getElementById('new-magic-desc').value = ''; document.getElementById('new-magic-marca').value = ''; document.getElementById('new-magic-modelo').value = ''; };

    let reviewLimit=30;
    function populateReviewAreas(){
        const select=document.getElementById('review-area'),old=select.value;
        const areas=[...new Set([...state.inventory.map(i=>i.areaOriginal),...state.resguardantes.map(u=>u.area),'Sin área asignada'].filter(Boolean))].sort();
        select.replaceChildren(new Option('Todas las áreas','all'),...areas.map(a=>new Option(a+' '+(NOMBRES_AREAS[a]||''),a)));
        if(areas.includes(old))select.value=old;
        renderAreaReview();
    }
    function renderAreaReview(){
        const result=InventoryReview.review(state,document.getElementById('review-area').value),type=document.getElementById('review-type').value;
        document.getElementById('review-summary').textContent=`${result.total} bienes · ${result.located} del inventario ubicados · ${result.pending.length} pendientes · ${result.additional} adicionales · ${result.issues.length} bienes con observaciones.`;
        const rows=type==='pending'?result.pending:result.issues.filter(r=>type==='all'||r.types.includes(type));
        const box=document.getElementById('review-results');box.replaceChildren();
        if(!rows.length){const p=document.createElement('p');p.textContent=type==='pending'?'No hay pendientes de ubicar en esta selección.':'No hay observaciones en esta selección. Esto no sustituye la revisión física de los bienes.';box.append(p);}
        for(const row of rows.slice(0,reviewLimit)){
            const card=document.createElement('article'),title=document.createElement('strong'),detail=document.createElement('p'),button=docum…25703 tokens truncated…| ''; document.getElementById('rep-resp-title').value = r.title || '';
        }
        updateReportLocations();
    };

    document.getElementById('rep-generate-btn').onclick = async () => {
        const type = document.getElementById('rep-type-select').value;
        const targetArea = document.getElementById('rep-area-select').value;
        const targetUser = document.getElementById('rep-user-select').value;
        const consolidated = type === 'adicionales' && targetArea !== 'all' && targetUser === '__area__';
        const targetLoc = document.getElementById('rep-location-select').value;
        const incAdic = document.querySelector('input[name="rep-inc-adic"]:checked').value === 'Si';
        const globalDate = document.getElementById('rep-date').value || new Date().toLocaleDateString();
        const globalArea = document.getElementById('rep-area-name').value;
        const globalRespName = document.getElementById('rep-resp-name').value;
        const globalRespTitle = document.getElementById('rep-resp-title').value;
        const prF1 = document.getElementById('rep-firma-1').checked;
        const prF2 = document.getElementById('rep-firma-2').checked;

        let usersToPrint = state.resguardantes;
        if(targetArea !== 'all') usersToPrint = usersToPrint.filter(u => u.area === targetArea);
        if(targetUser !== 'all' && !consolidated) usersToPrint = usersToPrint.filter(u => u.name === targetUser);

        if(type==='pendientes')usersToPrint=[...new Set(state.inventory.map(i=>i.areaOriginal))].filter(a=>targetArea==='all'||a===targetArea).map(area=>({area,name:''}));
        if(usersToPrint.length === 0) return showToast('No hay usuarios para imprimir', 'error');
        const areaUsers = usersToPrint;
        if(consolidated) usersToPrint = [{area: targetArea, name: ''}];
        const additionalOwner = item => state.resguardantes.find(owner => item.resguardanteId ? owner.id === item.resguardanteId : owner.name === item.usuario);

        document.getElementById('loading-overlay').classList.add('show');
        document.getElementById('loading-text').textContent = type === 'album' ? "Preparando Vista..." : "Generando PDF...";

        const officialReports=[];
        let fullPrintHTML = '';
        let fullPreviewHTML = '';

        for (let index = 0; index < usersToPrint.length; index++) {
            const u = usersToPrint[index];

            if (type === 'album') {
                let locsToPrint = targetLoc === 'all' ? (u.locations || []) : [targetLoc];
                if (locsToPrint.length === 0) continue;

                let albumPrintHtml = `
                <div class="print-header">
                    <img src="logo.png">
                    <div class="print-header-text">
                        <div class="print-header-line">DIRECCIÓN GENERAL DE RECURSOS MATERIALES Y SERVICIOS</div>
                        <div class="print-header-line">DIRECCIÓN DE ALMACÉN E INVENTARIOS</div>
                        <div class="print-header-line print-area-line">${escapeHTML(globalArea || `ÁREA ${u.area}`)}</div>
                    </div>
                    <div class="print-date-abs">Fecha: ${globalDate}</div>
                </div>
                <div class="print-album-title">ÁLBUM FOTOGRÁFICO DE EVIDENCIAS</div>
                <div class="print-paragraph" style="text-align:center; font-weight:bold; font-size:12px;">USUARIO RESPONSABLE: ${escapeHTML(u.name)}</div>`;

                let albumPreviewHtml = `
                <div class="preview-page">
                    <div class="flex justify-between items-center border-b-4 border-indigo-500 pb-2 mb-4">
                        <div class="font-bold text-gray-500 text-sm">
                            <span class="block">DIR. GRAL. DE RECURSOS MATERIALES</span>
                            <span class="block">DIR. DE ALMACÉN E INVENTARIOS</span>
                        </div>
                        <div class="text-right font-black text-indigo-900">${escapeHTML(globalArea || `ÁREA ${u.area}`)}<br><span class="text-xs text-gray-500 font-bold">Fecha: ${globalDate}</span></div>
                    </div>
                    <h2 class="preview-album-title">ÁLBUM FOTOGRÁFICO DE EVIDENCIAS</h2>
                    <p class="text-center font-bold text-xl text-gray-700 bg-gray-100 py-2 rounded-lg mb-6"><i class="fa-solid fa-user-check text-indigo-500 mr-2"></i>USUARIO: ${escapeHTML(u.name)}</p>`;

                let printedSomethingForUser = false;

                for(let loc of locsToPrint) {
                    let hasContent = false;
                    let gridPrintHtml = `<div class="print-album-grid">`;
                    let gridPreviewHtml = `<div class="preview-album-grid">`;

                    const locPhotoKey = `location-${u.id}|${loc}`;
                    const locBlob = await photoDB.getItem('photos', locPhotoKey);
                    if (locBlob) {
                        hasContent = true;
                        const objectUrl = URL.createObjectURL(locBlob);
                        gridPrintHtml += `<div class="print-photo-card print-loc-photo"><div class="print-photo-title">PANORÁMICA UBICACIÓN</div><img src="${objectUrl}"><div class="print-photo-desc"><i class="fa-solid fa-map-pin"></i> ${escapeHTML(loc)}</div></div>`;
                        gridPreviewHtml += `<div class="preview-photo-card preview-loc-photo"><div class="preview-photo-title">PANORÁMICA UBICACIÓN</div><img src="${objectUrl}"><div class="preview-photo-desc"><i class="fa-solid fa-map-pin mr-1 text-indigo-500"></i> ${escapeHTML(loc)}</div></div>`;
                    }

                    const invItems = state.inventory.filter(inv => inv.UBICADO === 'SI' && inv['NOMBRE DE USUARIO'] === u.name && inv.ubicacionEspecifica === loc);
                    for(let inv of invItems) {
                        if(state.photos[inv['CLAVE UNICA']]) {
                            const invBlob = await photoDB.getItem('photos', `inventory-${inv['CLAVE UNICA']}`);
                            if(invBlob) {
                                hasContent = true;
                                const objectUrl = URL.createObjectURL(invBlob);
                                gridPrintHtml += `<div class="print-photo-card"><div class="print-photo-title">${escapeHTML(inv['CLAVE UNICA'])}</div><img src="${objectUrl}"><div class="print-photo-desc">${escapeHTML((inv.DESCRIPCION||inv.DESCRripcion).substring(0, 45))}...<br><b>Marca:</b> ${escapeHTML(inv.MARCA||'-')} | <b>Serie:</b> ${escapeHTML(inv.SERIE||'-')}</div></div>`;
                                gridPreviewHtml += `<div class="preview-photo-card"><div class="preview-photo-title text-indigo-700">${escapeHTML(inv['CLAVE UNICA'])}</div><img src="${objectUrl}"><div class="preview-photo-desc font-bold">${escapeHTML((inv.DESCRIPCION||inv.DESCRripcion).substring(0, 45))}...<br><span class="text-gray-500 font-medium"><b>M:</b> ${escapeHTML(inv.MARCA||'-')} | <b>S:</b> ${escapeHTML(inv.SERIE||'-')}</span></div></div>`;
                            }
                        }
                    }

                    const adicItems = state.additionalItems.filter(ad => ad.usuario === u.name && ad.ubicacionEspecifica === loc);
                    for(let ad of adicItems) {
                        if(state.additionalPhotos[ad.id]) {
                            const adBlob = await photoDB.getItem('photos', `additional-${ad.id}`);
                            if(adBlob) {
                                hasContent = true;
                                const objectUrl = URL.createObjectURL(adBlob);
                                gridPrintHtml += `<div class="print-photo-card border-yellow-500"><div class="print-photo-title">${escapeHTML(ad.claveAsignada || 'ADICIONAL')}</div><img src="${objectUrl}"><div class="print-photo-desc">${escapeHTML((ad.descripcion).substring(0, 45))}...<br><b>Marca:</b> ${escapeHTML(ad.marca||'-')} | <b>Serie:</b> ${escapeHTML(ad.serie||'-')}</div></div>`;
                                gridPreviewHtml += `<div class="preview-photo-card border-yellow-400 bg-yellow-50"><div class="preview-photo-title text-yellow-700">${escapeHTML(ad.claveAsignada || 'ADICIONAL')}</div><img src="${objectUrl}"><div class="preview-photo-desc font-bold">${escapeHTML((ad.descripcion).substring(0, 45))}...<br><span class="text-gray-500 font-medium"><b>M:</b> ${escapeHTML(ad.marca||'-')} | <b>S:</b> ${escapeHTML(ad.serie||'-')}</span></div></div>`;
                            }
                        }
                    }

                    gridPrintHtml += `</div>`;
                    gridPreviewHtml += `</div>`;

                    if (hasContent) {
                        albumPrintHtml += `<div style="margin-top: 15px; font-weight: bold; background: #eee; padding: 4px; border: 1px solid #ccc; font-size: 10px;">UBICACIÓN REVISADA: ${escapeHTML(loc)}</div>`;
                        albumPrintHtml += gridPrintHtml;

                        albumPreviewHtml += `<div class="mt-8 bg-gray-800 text-white font-bold p-2 px-4 rounded-lg inline-block shadow"><i class="fa-solid fa-location-dot mr-2 text-indigo-400"></i>UBICACIÓN: ${escapeHTML(loc)}</div>`;
                        albumPreviewHtml += gridPreviewHtml;
                        printedSomethingForUser = true;
                    }
                }

                albumPreviewHtml += `</div>`; // Cerrar .preview-page

                if (printedSomethingForUser) {
                     fullPrintHTML += albumPrintHtml;
                     fullPreviewHTML += albumPreviewHtml;
                     if (index < usersToPrint.length - 1) fullPrintHTML += `<div class="page-break"></div>`;
                }
            } else {

                let userItems = [];
                if(type === 'resguardo') { userItems = [...state.inventory.filter(i => i.UBICADO==='SI' && i['NOMBRE DE USUARIO'] === u.name).map(i=>({...i, _type:'inv'}))]; if(incAdic) userItems = [...userItems, ...state.additionalItems.filter(a => a.usuario === u.name).map(a=>({...a, _type:'adic'}))]; }
                else if (type === 'pendientes') { userItems = state.inventory.filter(i => i.UBICADO !== 'SI' && i.areaOriginal === u.area).map(i=>({...i, _type:'inv'})); if(userItems.length === 0) continue; }
                else if (type === 'adicionales') { userItems = state.additionalItems.filter(a => { const owner = additionalOwner(a); return consolidated ? areaUsers.includes(owner) : owner?.id === u.id; }).map(a=>({...a, usuario: additionalOwner(a)?.name || a.usuario, _type:'adic'})); if(userItems.length === 0) continue; }

                if (userItems.length === 0) continue;

                const areaName = targetArea === 'all' ? `ÁREA ${u.area} ${cleanAreaName(u.area, NOMBRES_AREAS[u.area]||'')}` : (globalArea || `ÁREA ${u.area}`);
                const respObj = state.responsablesList.find(r => r.area === u.area) || {}; const respName = targetArea === 'all' ? (respObj.name||'') : globalRespName; const respTitle = targetArea === 'all' ? (respObj.title||'') : globalRespTitle;

                officialReports.push({type,items:userItems,area:u.area,areaName:areaName||`ÁREA ${u.area}`,responsible:respName,responsibleTitle:respTitle,user:u.name,location:(()=>{const locations=[...new Set(userItems.map(i=>i.ubicacionEspecifica).filter(Boolean))];return locations[0]?locations[0]+(locations.length>1?' +'+(locations.length-1)+' más':''):'';})()});

            }
        }

        if(type!=='album'){
            const year=document.getElementById('rep-year').value;
            if(!/^\d{4}$/.test(year)||Number(year)<2000||Number(year)>2100){document.getElementById('loading-overlay').classList.remove('show');return showToast('Indica un ejercicio entre 2000 y 2100','warning');}
            try{fullPrintHTML=await InventoryOfficialReports.render(officialReports,{year,date:document.getElementById('rep-date').value||globalDate,paper:document.getElementById('rep-paper').value,signature1:prF1,signature2:prF2,signature3:document.getElementById('rep-firma-3').checked,areaVerifier:document.getElementById('rep-area-verifier').value,inventoryVerifier:document.getElementById('rep-inventory-verifier').value});}
            catch(error){document.getElementById('loading-overlay').classList.remove('show');return showToast(error.message,'error');}
        }
        document.getElementById('loading-overlay').classList.remove('show');
        if(!fullPrintHTML && type !== 'album') return showToast('No hay datos o fotos para generar este reporte', 'warning');
        if(!fullPreviewHTML && type === 'album') return showToast('No hay fotos capturadas para generar este álbum', 'warning');

        document.getElementById('report-preview-content').innerHTML=type==='album'?fullPreviewHTML:fullPrintHTML;
        document.getElementById('report-preview-modal').classList.add('show');
        document.getElementById('preview-print-btn').onclick=async()=>{
            const print=document.getElementById('print-area');print.innerHTML=fullPrintHTML;
            await Promise.all([...print.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
            try { await InventoryOutput.print(); } catch(error) { showToast(error.message, 'error'); }
        };

    };

    document.getElementById('export-reetiquetado-btn').onclick = async () => { const items = state.inventory.filter(i => i.RE_ETIQUETADO === 'SI'); if(items.length === 0) return showToast('No hay bienes para reetiquetar', 'warning'); const rows = items.map(i => ({ 'Clave Única': String(i['CLAVE UNICA']), 'Descripción': i.DESCRIPCION || i.DESCRripcion, 'Usuario': i['NOMBRE DE USUARIO'], 'Ubicación': i.ubicacionEspecifica, ...InventoryTeam.excel(i) })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Reetiquetado"); try { await InventoryOutput.excel(wb, `Reetiquetado_${new Date().toISOString().slice(0,10)}.xlsx`); showToast('Excel generado', 'success'); } catch(error) { showToast(error.message,'error'); } };

    // --- CONCILIADOR TOTAL ---
    let pendingConcilData = null;

    document.getElementById('conciliador-upload-btn').onclick = () => document.getElementById('conciliador-file').click();
    document.getElementById('conciliador-file').onchange = async (e) => {
        const files = e.target.files; if(!files.length) return;
        pendingConcilData=null;
        document.getElementById('concil-aplicar-btn').classList.add('hidden');
        document.getElementById('conciliador-results').classList.add('hidden');
        const pBarContainer = document.getElementById('loading-progress-bar-container');
        const pBar = document.getElementById('loading-progress-bar');
        pBarContainer.classList.remove('hidden'); pBar.style.width = '0%';
        document.getElementById('loading-overlay').classList.add('show');
        document.getElementById('loading-text').textContent = "Conciliando...";
        let newItemsMap = {};
        try {
            const batches=[];
            for(const file of files) batches.push(InventoryExcel.parse(await file.arrayBuffer(),file.name,XLSX));
            const result=InventoryExcel.merge([],batches);
            if(batches.some(b=>b.bookType==='Sin Tipo'))throw new Error('No se identificó el libro a conciliar');
            if(result.conflicts.length)throw new Error('Los archivos contienen claves repetidas con datos distintos');
            newItemsMap=Object.fromEntries(result.items.map(item=>[item['CLAVE UNICA'],item]));
            pBar.style.width = '100%';
            await new Promise(r => setTimeout(r, 200));

            const metadata=InventoryListings.metadata(state,batches);
            let bajas = [], altas = [], mod = [];
            state.inventory.forEach(oldItem => {
                if(!batches.some(b=>b.areaId===oldItem.areaOriginal&&b.bookType===oldItem.listadoOriginal))return;
                const c = oldItem['CLAVE UNICA']; const newItem = newItemsMap[c];
                if(!newItem) bajas.push(oldItem);
                else {
                    let cambios = [];
                    if (oldItem.SERIE != newItem.SERIE) cambios.push(`Serie`);
                    if (oldItem.MARCA != newItem.MARCA) cambios.push(`Marca`);
                    if (oldItem.MODELO != newItem.MODELO) cambios.push(`Modelo`);
                    if (oldItem.DESCRIPCION != newItem.DESCRIPCION && oldItem.DESCRripcion != newItem.DESCRIPCION) cambios.push(`Desc`);
                    if (oldItem.listadoOriginal != newItem.listadoOriginal && newItem.listadoOriginal !== 'Sin Tipo') cambios.push(`TipoLibro`);
                    if (oldItem.areaOriginal !== newItem.areaOriginal && newItem.areaOriginal !== 'Sin Área') cambios.push(`Área`);

                    if(cambios.length > 0) mod.push({ clave: c, desc: oldItem.DESCRIPCION||oldItem.DESCRripcion, cambios, newItem });
                    delete newItemsMap[c];
                }
            });
            Object.keys(newItemsMap).forEach(c => altas.push({ clave: c, ...newItemsMap[c] }));

            document.getElementById('concil-bajas-num').textContent = bajas.length; document.getElementById('concil-altas-num').textContent = altas.length; document.getElementById('concil-mods-num').textContent = mod.length;
            let resHtml = metadata.changes.map(change=>'<p class="area-review">'+escapeHTML(change)+'</p>').join('');
            if(altas.length) resHtml += altas.map(a => `<div class="mb-2 p-2 bg-green-100 border-l-4 border-green-500 rounded"><span class="font-bold text-green-800">[NUEVO]</span> ${escapeHTML(a.clave)} - ${escapeHTML(a.DESCRIPCION)}</div>`).join('');
            if(bajas.length) resHtml += bajas.map(b => `<div class="mb-2 p-2 bg-red-100 border-l-4 border-red-500 rounded"><span class="font-bold text-red-800">[YA NO APARECE]</span> ${escapeHTML(b['CLAVE UNICA'])} - ${escapeHTML(b.DESCRIPCION||b.DESCRripcion)}</div>`).join('');
            if(mod.length) resHtml += mod.map(m => `<div class="mb-2 p-2 bg-orange-100 border-l-4 border-orange-500 rounded"><span class="font-bold text-orange-800">[MODIFICADO]</span> ${escapeHTML(m.clave)} - ${escapeHTML(m.desc)}<br><span class="text-xs text-orange-700">${m.cambios.join(', ')}</span></div>`).join('');
            if(resHtml === '') resHtml = '<p class="text-center text-gray-500 font-bold py-4">Los listados son idénticos al inventario actual.</p>';

            document.getElementById('conciliador-details-list').innerHTML = resHtml;
            document.getElementById('conciliador-results').classList.remove('hidden');

            pendingConcilData = { bajas, altas, mod, batches, metadataChanges:metadata.changes };
            if(bajas.length > 0 || altas.length > 0 || mod.length > 0 || metadata.changes.length > 0) document.getElementById('concil-aplicar-btn').classList.remove('hidden');
            else document.getElementById('concil-aplicar-btn').classList.add('hidden');

            showToast('Lectura terminada. Revisa los cambios.', 'info');
        } catch(e) { showToast(escapeHTML(e.message||'Error procesando archivos'), 'error'); } finally { document.getElementById('loading-overlay').classList.remove('show'); pBarContainer.classList.add('hidden'); e.target.value = ''; }
    };

    document.getElementById('concil-export-btn').onclick = async () => {
        if(!pendingConcilData) return showToast('No hay datos para exportar.', 'warning');
        let txt = `REPORTE DE CONCILIACIÓN DE INVENTARIO\nFecha: ${new Date().toLocaleString()}\n\nRESUMEN:\n- NUEVOS (ALTAS): ${pendingConcilData.altas.length}\n- BAJAS (FALTANTES): ${pendingConcilData.bajas.length}\n- MODIFICADOS: ${pendingConcilData.mod.length}\n\n`;
        if(pendingConcilData.altas.length > 0) { txt += `--- NUEVOS (ALTAS) ---\n`; pendingConcilData.altas.forEach(a => txt += `${a.clave} - ${a.DESCRIPCION}\n`); }
        if(pendingConcilData.bajas.length > 0) { txt += `\n--- BAJAS (FALTANTES) ---\n`; pendingConcilData.bajas.forEach(b => txt += `${b['CLAVE UNICA']} - ${b.DESCRIPCION||b.DESCRripcion}\n`); }
        if(pendingConcilData.mod.length > 0) { txt += `\n--- MODIFICADOS ---\n`; pendingConcilData.mod.forEach(m => txt += `${m.clave} - ${m.desc} (Cambios: ${m.cambios.join(', ')})\n`); }
        txt+='\n--- DATOS DEL LISTADO ---\n'+(pendingConcilData.metadataChanges||[]).join('\n');
        try { await InventoryOutput.save(new Blob([txt], {type:'text/plain;charset=utf-8'}), `Resumen_Conciliacion_${new Date().toISOString().slice(0,10)}.txt`); } catch(error) { showToast(error.message,'error'); }
    };

    document.getElementById('concil-aplicar-btn').onclick = () => {
        if(!pendingConcilData)return;
        showConfirm('Aplicar conciliación', 'Se agregarán '+pendingConcilData.altas.length+' bienes, se quitarán '+pendingConcilData.bajas.length+' y se modificarán '+pendingConcilData.mod.length+'. También se actualizarán las fechas y los responsables indicados en la revisión.',async()=>{
            document.getElementById('loading-overlay').classList.add('show');
            try{
                await InventoryRecovery.create(photoDB,state,'Antes de conciliar listados');const plan=pendingConcilData,next=InventoryListings.metadata(state,plan.batches).next,removed=new Set(plan.bajas.map(b=>b['CLAVE UNICA']));next.inventory=next.inventory.filter(i=>!removed.has(i['CLAVE UNICA']));
                for(const m of plan.mod){const item=next.inventory.find(i=>i['CLAVE UNICA']===m.clave);if(item)for(const field of ['SERIE','MARCA','MODELO','DESCRIPCION','listadoOriginal','areaOriginal'])item[field]=m.newItem[field];}
                for(const item of plan.altas){const {clave,...data}=item;next.inventory.push(data);}
                await photoDB.setItem('appData','mainState',InventoryData.clean(next));saveSnapshot('Conciliar inventario y datos de listados');state=next;refreshListingViews();pendingConcilData=null;document.getElementById('concil-aplicar-btn').classList.add('hidden');document.getElementById('conciliador-details-list').textContent='Inventario, fechas y responsables actualizados.';showToast('Conciliación guardada','success');
            }catch(error){showToast(escapeHTML(error.message),'error');}finally{document.getElementById('loading-overlay').classList.remove('show');}
        });
    };

    document.getElementById('merge-session-btn').onclick = () => document.getElementById('merge-file-input').click();
    document.getElementById('merge-file-input').onchange=async e=>{
        const file=e.target.files[0];if(!file)return;const overlay=document.getElementById('loading-overlay');overlay.classList.add('show');
        try{
            const info=await InventoryBackups.inspect(file),plan=InventorySafeChanges.merge(state,info.state),images=[];
            const rfid=info.rfid?InventoryRFIDCore.merge(await InventoryRFIDStore.exportPack(photoDB),info.rfid):null;
            for(const image of info.images){let key=image.key;
                for(const [oldId,newId] of Object.entries(plan.idMap)){if(key==='user-'+oldId)key='user-'+newId;else if(key.startsWith('location-'+oldId+'|'))key='location-'+newId+key.slice(('location-'+oldId).length);}
                const entry={...image,key},old=await photoDB.getItem(entry.store,key);images.push(entry);
                if(old){const a=new Uint8Array(await old.arrayBuffer()),b=new Uint8Array(await entry.value.arrayBuffer());if(a.length!==b.length||a.some((v,i)=>v!==b[i])){entry.value=old;plan.conflicts.push({label:'Imagen '+entry.store+' / '+key,local:'Imagen guardada',incoming:'Imagen del respaldo',apply:useImported=>{entry.value=useImported?image.value:old;}});}}
            }
            const box=document.getElementById('conflict-list');box.replaceChildren();const intro=document.createElement('p');intro.textContent='Las notas diferentes se conservan juntas. Revisa las diferencias; por defecto se mantiene el dato actual. Se incluyen fotos, planos y el catálogo RFID del respaldo; las asociaciones ambiguas quedan para revisar en Ajustes. Los puntos de recuperación no revierten el catálogo RFID. Cancelar no modifica datos. Al aplicar se reinicia el historial de deshacer de esta sesión.';box.append(intro);
            plan.conflicts.forEach((item,index)=>{const section=document.createElement('section');section.className='area-review';const title=document.createElement('h4');title.textContent=item.label;section.append(title);for(const [value,text] of [['local',item.local],['imported',item.incoming]]){const label=document.createElement('label'),radio=document.createElement('input'),pre=document.createElement('pre');radio.type='radio';radio.name='conflict-'+index;radio.value=value;radio.checked=value==='local';pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px';pre.textContent=(value==='local'?'Actual: ':'Importado: ')+JSON.stringify(text,null,2);label.append(radio,pre);section.append(label);}box.append(section);});
            document.getElementById('conflict-modal').classList.add('show');
            document.getElementById('resolve-conflicts-btn').onclick=async()=>{overlay.classList.add('show');try{
                // The dialog blocks other edits; apply choices to an isolated copy, then commit all stores together.
                plan.conflicts.forEach((item,index)=>{item.apply(document.querySelector('input[name="conflict-'+index+'"]:checked')?.value==='imported');});
                for(const image of images)if(image.store==='photos'){const m=/^(inventory|additional|user|location)-(.*)$/.exec(image.key);if(m){const field={inventory:'photos',additional:'additionalPhotos',user:'userPhotos',location:'locationPhotos'}[m[1]];plan.next[field]={...plan.next[field],[m[2]]:true};}}
                if(plan.next.activeResguardante)plan.next.activeResguardante=plan.next.resguardantes.find(u=>u.id===plan.next.activeResguardante.id)||null;
                InventoryAdditional.renumber(plan.next);await photoDB.flush();await InventoryRecovery.create(photoDB,state,'Antes de fusionar sesión ZIP');
                await new Promise((resolve,reject)=>{const tx=photoDB.db.transaction(['appData','photos','layoutImages','rfidTags'],'readwrite');tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||Error('No se pudo guardar la fusión'));tx.objectStore('appData').put(InventoryData.clean(plan.next),'mainState');tx.objectStore('appData').put([],'changeHistory');for(const image of images)tx.objectStore(image.store).put(image.value,image.key);if(rfid)InventoryRFIDStore.enqueue(tx,rfid);});
                state=plan.next;stateHistory=[];renderSessionHistory();renderRecoveryPoints();recalculateLocationCounts();refreshListingViews();renderUsers();renderAdicionales();renderNotasTab();updateBanner();document.getElementById('conflict-modal').classList.remove('show');showToast('Fusión guardada con fotos y planos','success');
            }catch(error){showToast('No se pudo completar la fusión. '+escapeHTML(error.message),'error');}finally{overlay.classList.remove('show');}};
        }catch(error){showToast('No se pudo leer el respaldo. '+escapeHTML(error.message),'error');}finally{overlay.classList.remove('show');e.target.value='';}
    };


    document.getElementById('export-excel-btn').onclick = () => {
        document.getElementById('loading-overlay').classList.add('show'); document.getElementById('loading-text').textContent = "Generando Excel...";
        setTimeout(async () => {
            try {
                const getLoc = (i) => { const u = state.resguardantes.find(r => r.name === (i['NOMBRE DE USUARIO'] || i.usuario)); return (u && u.locationDetails && u.locationDetails[i.ubicacionEspecifica]) ? u.locationDetails[i.ubicacionEspecifica] : { edificio: 'N/A', piso: 'N/A' }; };
                const mapRow = (i) => { const loc = getLoc(i); const isAdic = i._type === 'adic'; const c = isAdic ? i.claveAsignada : i['CLAVE UNICA']; return { 'Clave Única': c || '', 'Descripción': i.DESCRripcion || i.DESCRIPCION || i.descripcion || '', 'Marca': i.MARCA || i.marca || '', 'Modelo': i.MODELO || i.modelo || '', 'Serie': i.SERIE || i.serie || '', 'Área Original': i.areaOriginal || '', 'Usuario Asignado': i['NOMBRE DE USUARIO'] || i.usuario || '', 'Ubicación': i.ubicacionEspecifica || '', 'Edificio': loc.edificio || '', 'Piso': loc.piso || '', ...InventoryTeam.excel(i), 'Requiere Etiqueta': isAdic ? 'N/A' : (i.RE_ETIQUETADO === 'SI' ? 'SÍ' : 'NO'), 'Tiene Foto': (isAdic ? state.additionalPhotos[i.id] : state.photos[c]) ? 'SÍ' : 'NO', 'Nota': state.notes[c] || '' }; };
                const invRows = state.inventory.map(i => { return mapRow({...i,_type:'inv'}); }); const adicCamara = state.additionalItems.filter(i => i.posesion === 'Cámara' && i.personal !== 'Si').map(i => { return mapRow({...i,_type:'adic'}); }); const adicArrend = state.additionalItems.filter(i => i.posesion === 'Arrendamiento').map(i => { return mapRow({...i,_type:'adic'}); }); const adicPers = state.additionalItems.filter(i => i.personal === 'Si').map(i => { return mapRow({...i,_type:'adic'}); });
                const adicGrupo=state.additionalItems.filter(i=>(i.tipoBien==='group'||i.posesion==='Propiedad del Grupo')).map(i=>mapRow({...i,_type:'adic'}));const wb = XLSX.utils.book_new();if(adicGrupo.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(adicGrupo),'Grupos Parlamentarios'); if(invRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invRows), "Bienes Inventario"); if(adicCamara.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(adicCamara), "Adicionales Cámara"); if(adicArrend.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(adicArrend), "Adic. Arrendamiento"); if(adicPers.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(adicPers), "Bienes Personales"); await InventoryOutput.excel(wb, `Inventario_Completo_${new Date().toISOString().slice(0,10)}.xlsx`); showToast('Exportado con éxito', 'success');
            } catch (error) { showToast('Error al exportar Excel', 'error'); } finally { document.getElementById('loading-overlay').classList.remove('show'); }
        }, 150);
    };

    async function renderBackupStatus() {
        const box=document.getElementById('backup-status');
        if(!state.inventory.length&&!state.additionalItems.length){box.hidden=true;return;}
        const last=await photoDB.getItem('appData','lastBackupGenerated');
        box.hidden=false;box.textContent=last?'Último respaldo generado: '+new Date(last).toLocaleString('es-MX')+'. Conserva el ZIP fuera de este navegador.':'Aún no has generado un respaldo en este equipo. Guarda uno al terminar tu jornada.';
        const button=document.createElement('button');button.dataset.action='info';button.textContent=' Generar respaldo';button.className='font-bold text-indigo-900';button.onclick=()=>document.getElementById('export-session-btn').click();box.append(button);
    }
    document.getElementById('export-session-btn').onclick = async () => {
        const overlay=document.getElementById('loading-overlay');overlay.classList.add('show');
        document.getElementById('loading-text').textContent='Generando y comprobando respaldo…';
        try {
            // Capture the in-memory state even when a previous persistence attempt failed.
            const session=JSON.stringify(InventoryData.clean(state));
            const zip=new JSZip();zip.file('session.json',session);
            const rfidBackup=await InventoryRFIDStore.exportPack(photoDB);zip.file('rfid-catalog.json',JSON.stringify(rfidBackup));
            const auditors=await InventoryTeam.exportDirectory();zip.file('auditors.json',JSON.stringify(auditors));
            let images=0;
            for(const store of ['photos','layoutImages'])for(const entry of await photoDB.getAllItems(store)){zip.file(store+'/'+entry.key,entry.value);images++;}
            const timestamp=new Date().toISOString(),snapshot=JSON.parse(session);
            zip.file('backup-manifest.json',JSON.stringify({version:3,createdAt:timestamp,inventory:snapshot.inventory.length,additional:(snapshot.additionalItems||[]).length,images,rfidTags:rfidBackup.records.length,auditors:auditors.length}));
            const content=await zip.generateAsync({type:'blob'});
            await InventoryBackups.inspect(content);
            await InventoryOutput.save(content,InventoryBackupDetails.filename(state));
            await photoDB.setItem('appData','lastBackupGenerated',timestamp);await renderBackupStatus();
            showToast(InventoryOutput.native ? 'Respaldo guardado en la ubicación elegida.' : 'Respaldo comprobado. Revisa que el ZIP esté en Descargas.','success');
        } catch(error) {showToast('No se pudo completar el respaldo: '+error.message,'error');}
        finally {overlay.classList.remove('show');}
    };
    document.getElementById('import-session-btn').onclick = () => document.getElementById('import-file-input').click();
    document.getElementById('import-file-input').onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        document.getElementById('loading-overlay').classList.add('show');
        try {
            const info = await InventoryBackups.inspect(file);
            const modal = document.getElementById('restore-backup-dialog');
            document.getElementById('restore-file-name').textContent = file.name;
            const currentImages=[];for(const store of ['photos','layoutImages'])for(const item of await photoDB.getAllItems(store))currentImages.push({store,...item});
            const currentMedia=await InventoryBackupDetails.images(currentImages),nextMedia=await InventoryBackupDetails.images(info.images);
            const rows = [
                ['Bienes',state.inventory.length,info.state.inventory.length],
                ['Adicionales',state.additionalItems.length,(info.state.additionalItems||[]).length],
                ['Resguardantes',state.resguardantes.length,info.state.resguardantes.length],
                ['Archivos de imagen guardados',currentMedia.total,nextMedia.total],
                ['Contenido distinto (sin copias idénticas)',currentMedia.unique,nextMedia.unique],
                ['Copias idénticas',currentMedia.duplicates,nextMedia.duplicates],
                ['Archivos vacíos',currentMedia.empty,nextMedia.empty],
                ...Object.keys(nextMedia.types).map(type=>[type,currentMedia.types[type],nextMedia.types[type]]),
                ['Auditores',(await InventoryTeam.exportDirectory()).length,info.auditors ? info.auditors.length : 'Se conservan'],
                ['Etiquetas RFID',(await InventoryRFIDStore.exportPack(photoDB)).records.length,info.rfid ? info.rfid.records.length : 'Se conservan']
            ];
            document.getElementById('restore-summary').replaceChildren(...rows.map(([label,current,next]) => {
                const row=document.createElement('tr');
                for(const value of [label,current,next]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}return row;
            }));
            document.getElementById('restore-image-explanation').textContent='El total cuenta archivos del ZIP, no fotos tomadas. Una foto aplicada a varios bienes se guarda bajo varias claves. También puede haber fotos conservadas de bienes retirados. Restaurar conserva todos los archivos; no se eliminan por este conteo.';
            document.getElementById('restore-error').textContent='';
            modal.showModal();
            document.getElementById('restore-confirm').onclick = async () => {
                const button=document.getElementById('restore-confirm');button.disabled=true;
                document.getElementById('restore-cancel').disabled=true;
                button.textContent='Restaurando…';
                try { await InventoryBackups.restore(file,photoDB,state); location.reload(); }
                catch(error){document.getElementById('restore-error').textContent='No se pudo restaurar. Se conservan los datos anteriores. '+error.message;}
                finally{button.disabled=false;button.textContent='Restaurar respaldo';document.getElementById('restore-cancel').disabled=false;}
            };
        }
        catch (error) { showToast('No se pudo restaurar el respaldo. Se conservan los datos anteriores.', 'error'); }
        finally { document.getElementById('loading-overlay').classList.remove('show'); e.target.value=''; }
    };
    document.getElementById('restore-cancel').onclick=()=>document.getElementById('restore-backup-dialog').close();
    document.getElementById('restore-backup-dialog').addEventListener('cancel',event=>{if(document.getElementById('restore-confirm').disabled)event.preventDefault();});
    document.getElementById('clear-session-btn').onclick = () => { showConfirm('¡PELIGRO! Borrar Todo', 'Esto eliminará todo el inventario, FOTOS y el catálogo RFID de este navegador.', () => { document.getElementById('loading-overlay').classList.add('show'); try { if(photoDB.db) { photoDB.db.close(); } const req = indexedDB.deleteDatabase(photoDB.name); req.onsuccess = () => window.location.reload(); req.onerror = () => { window.location.reload(); }; req.onblocked = () => { window.location.reload(); }; } catch(e) { window.location.reload(); } }); };
    document.querySelectorAll('.modal-overlay .fa-xmark, button[id$="-cancel-btn"], button[id$="-close-btn"]').forEach(b => { if(b.id==='qr-close-btn') return; b.onclick = e => { e.target.closest('.modal-overlay').classList.remove('show'); stopCamera(); if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().catch(err => {}); } focusSearch(); }; });

    async function openWorkspace(team) {
        if(state.loggedIn){
            state.currentUser=team.active;state.companion=team.companion;swapped=false;
            document.getElementById('team-page').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');renderTeam();return;
        }
        await photoDB.init('parejas-local-v1');stateHistory=await photoDB.getItem('appData','changeHistory')||[];
        drafts=await photoDB.getItem('appData','captureDrafts')||{additional:{},notes:{}};
        const stored = await photoDB.getItem('appData', 'mainState');
        if (stored) state = {...state, ...window.InventoryData.clean(stored)};
        state.loggedIn = true;
        state.currentUser = team.active;
        state.companion = team.companion;
        if (state.areaNames) Object.assign(NOMBRES_AREAS, state.areaNames);
        recalculateLocationCounts();
        state.resguardantes.forEach(u => { if (!u.locationDetails) u.locationDetails = {}; });
        if (!state.perfilesMagicos?.length) state.perfilesMagicos = defaultPerfilesMagicos;
        if(state.additionalItems.some(i=>i.posesion==='Arrendamiento'&&i.personal!=='Si'&&!i.claveAsignada)){
            InventoryAdditional.renumber(state);
            await photoDB.setItem('appData','mainState',InventoryData.clean(state));
        }
        showMain();restoreAdditionalDraft();renderSessionHistory();
    }
    window.InventoryTeam.mount(openWorkspace);

    function showMain() {
        document.getElementById('team-page').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden'); renderTeam();
        const today=new Date();document.getElementById('rep-date').value=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');document.getElementById('rep-year').value=today.getFullYear();
        renderBackupStatus();updateHeaderArea(); populateFilters(); renderDashboard(); const lastTab=localStorage.getItem('inventario-last-tab');changeTab(['users','inventory','adicionales','notas','reportes','settings'].includes(lastTab)?lastTab:'users'); updateDatalists(); populateReportFilters(); toggleAdicFormFields('ad');
    }
});

