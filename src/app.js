

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

    let cameraRequest=0;
    async function startCamera() { stopCamera(); const request=cameraRequest; try { const stream = await InventoryCamera.use(video=>navigator.mediaDevices.getUserMedia({video,audio:false})); if(request!==cameraRequest){stream.getTracks().forEach(t=>t.stop());return;} cameraStream=stream; const videoEl = document.getElementById('camera-stream'); videoEl.srcObject = cameraStream; videoEl.setAttribute('playsinline', true); await videoEl.play(); } catch (err) { showToast('Error de cámara.', 'error'); } }
    function stopCamera() { ++cameraRequest; if(cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; } const videoEl = document.getElementById('camera-stream'); if(videoEl) { videoEl.pause(); videoEl.srcObject = null; } }
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
            const card=document.createElement('article'),title=document.createElement('strong'),detail=document.createElement('p'),button=document.createElement('button');
            title.textContent=(row.key||'Sin clave')+' · '+(row.description||'Sin descripción');
            detail.textContent=(row.kind==='additional'?'Adicional':'Inventario')+' · Área '+(row.area||'Sin área')+' · '+(row.reasons?.join(' · ')||'Pendiente de ubicar');
            button.dataset.action='info';button.textContent='Abrir bien';button.disabled=!row.id;button.onclick=()=>row.kind==='additional'?showAdicDetail(row.id):showInvDetail(row.id);
            card.append(title,detail,button);box.append(card);
        }
        document.getElementById('review-more').hidden=rows.length<=reviewLimit;
    }
    document.getElementById('review-area').onchange=document.getElementById('review-type').onchange=()=>{reviewLimit=30;renderAreaReview();};
    document.getElementById('review-refresh').onclick=()=>{reviewLimit=30;populateReviewAreas();};
    document.getElementById('review-more').onclick=()=>{reviewLimit+=30;renderAreaReview();};

    function reviewImport(batches, result) {
        const dialog=document.createElement('dialog');dialog.className='import-review';
        const areas=[...new Set(batches.map(b=>b.areaId))];
        dialog.innerHTML='<h2>Revisar listados antes de cargar</h2>'+areas.map(area=>{
            const group=batches.filter(b=>b.areaId===area);
            const books=[...new Set(group.map(b=>b.bookType))];
            return `<section><h3>Área ${escapeHTML(area)} — ${escapeHTML(group[0].areaName)}</h3><p><b>${books.length} libro(s) · ${new Set(group.flatMap(b=>b.items.map(i=>i['CLAVE UNICA']))).size} bienes únicos</b></p>`+group.map(b=>`<p><b>${escapeHTML(b.bookType)}</b> · ${b.items.length} registros<br>Archivo: ${escapeHTML(b.filename)}<br>Fecha del listado: ${escapeHTML(b.dates?.join(', ')||'No indicada')}<br>Responsable: ${escapeHTML(b.responsible?.name||'No indicado')}<br>Ubicación del área: ${escapeHTML(b.location||'No indicada')}</p>`).join('')+'</section>';
        }).join('')+`<p>Se agregarán <b>${result.added}</b> bienes. Duplicados omitidos: <b>${result.duplicates}</b>. Con diferencias: <b>${result.conflicts.length}</b>; se conservarán los datos existentes.</p>`+
        (batches.some(b=>b.warnings.length)?'<p>Hay advertencias en los archivos:</p><ul>'+batches.flatMap(b=>b.warnings.map(w=>`<li>${escapeHTML(w)}</li>`)).join('')+'</ul>':'')+
        '<p>¿Son correctos estos listados?</p><div class="review-actions"><button data-action="neutral" type="button" data-cancel>Cancelar</button><button data-action="save" type="button" data-confirm>Confirmar carga</button></div>';
        document.body.append(dialog);dialog.showModal();
        return new Promise(resolve=>{const done=value=>{dialog.close();dialog.remove();resolve(value);};dialog.querySelector('[data-cancel]').onclick=()=>done(false);dialog.querySelector('[data-confirm]').onclick=()=>done(true);dialog.oncancel=e=>{e.preventDefault();done(false);};});
    }

    document.getElementById('upload-btn').onclick = () => document.getElementById('file-input').click();
    document.getElementById('file-input').onchange = async e => {
        const files = [...e.target.files]; if (!files.length) return;
        const overlay=document.getElementById('loading-overlay');
        overlay.classList.add('show');
        try {
            const batches=[];
            for (const file of files) {
                document.getElementById('loading-text').textContent='Leyendo '+file.name;
                batches.push(InventoryExcel.parse(await file.arrayBuffer(),file.name,XLSX));
            }
            const result=InventoryExcel.merge(state.inventory,batches);
            overlay.classList.remove('show');
            if(!await reviewImport(batches,result))return;
            overlay.classList.add('show');
            const areaNames={...state.areaNames};
            for(const batch of batches)if(batch.areaName)areaNames[batch.areaId]=batch.areaName;
            const responsablesList=[...(state.responsablesList||[])];
            for(const batch of batches)if(batch.responsible){const index=responsablesList.findIndex(r=>r.area===batch.areaId);if(index>=0)responsablesList[index]=batch.responsible;else responsablesList.push(batch.responsible);}
            const suggestedNames=[...new Set([...(state.suggestedNames||[]),...batches.filter(b=>b.responsible).map(b=>b.responsible.name)])];
            const next=InventoryListings.metadata({...state,inventory:result.items,areaNames,responsablesList,suggestedNames},batches).next;
            await photoDB.setItem('appData','mainState',InventoryData.clean(next));
            saveSnapshot('Cargar listados Excel');state=next;Object.assign(NOMBRES_AREAS,areaNames);renderBackupStatus();
            populateFilters();renderDashboard();filterAndRenderInventory();updateHeaderArea();
            const summary='Cargados: '+result.added+'. Duplicados omitidos: '+result.duplicates+'.';
            document.getElementById('import-summary').textContent=summary+(result.conflicts.length?' '+result.conflicts.length+' duplicados tienen diferencias; se conservó el inventario existente. Revísalos con el conciliador.':'');
            document.getElementById('import-summary').hidden=false;
            const warnings=batches.flatMap(batch=>batch.warnings.map(w=>batch.filename+': '+w));
            const detail=result.conflicts.map(c=>c.key+' · '+c.file+'\n'+c.changes.map(v=>v.field+': actual ['+v.current+'] / archivo ['+v.incoming+']').join('\n'));
            document.getElementById('import-details-text').textContent=[...warnings,...detail].join('\n\n');
            document.getElementById('import-details').hidden=!warnings.length&&!detail.length;
            showToast(summary,result.conflicts.length?'warning':'success');
        } catch(error) {
            document.getElementById('import-details').hidden=true;
            document.getElementById('import-summary').textContent=error.message+'. No se modificó el inventario.';
            document.getElementById('import-summary').hidden=false;
            showToast('No se pudo completar la carga. Revisa el mensaje del archivo.','error');
        } finally {overlay.classList.remove('show');e.target.value='';}
    };

    function changeTab(tab) {
        localStorage.setItem('inventario-last-tab',tab);
        document.body.classList.toggle('editing-additional',tab==='adicionales');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); document.getElementById(`${tab}-tab`).classList.add('active'); document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        const globalSearch = document.getElementById('global-search-input'); globalSearch.value = ''; const invActions = document.getElementById('nav-inventory-actions');
        if (tab === 'users') { globalSearch.placeholder = 'Buscar usuario...'; globalSearch.disabled = false; invActions.classList.add('hidden'); }
        else if (tab === 'inventory') { globalSearch.placeholder = 'CLAVE, serie o desc...'; globalSearch.disabled = false; invActions.classList.remove('hidden'); }
        else if (tab === 'adicionales') { globalSearch.placeholder = 'Buscar adicional...'; globalSearch.disabled = false; invActions.classList.add('hidden'); }
        else if (tab === 'notas') { globalSearch.placeholder = 'Nota, clave o descripción...'; globalSearch.disabled = false; window.currentNotesPage=1; invActions.classList.add('hidden'); renderNotasTab(); }
        else if (tab === 'reportes') { globalSearch.placeholder = 'Reporte, área o resguardante...'; globalSearch.disabled = false; invActions.classList.add('hidden'); populateReportFilters();populateReviewAreas();renderReportSearch(); }
        else if (tab === 'settings') { globalSearch.placeholder = 'No disponible aquí'; globalSearch.disabled = true; invActions.classList.add('hidden'); renderResponsablesSettings(); renderLoadedListings(); renderRecoveryPoints(); renderMagicProfiles();renderSessionHistory(); }
        const activeNav=document.querySelector('.tab-btn.active'),nav=document.getElementById('tabs-container');
        if(activeNav && nav.scrollWidth>nav.clientWidth)nav.scrollLeft=activeNav.offsetLeft-nav.offsetLeft-12;
        updateBanner(); if(tab==='inventory') filterAndRenderInventory(); if(tab==='users') {renderUsers();populateTransferUsers();} if(tab==='adicionales') { populateFilters(); renderAdicionales(); toggleAdicFormFields('ad'); document.getElementById('ad-serie').focus(); } else focusSearch();
    }
    document.getElementById('tabs-container').onclick = e => { if(e.target.closest('#toggle-header-btn') || e.target.closest('#nav-inventory-actions') || e.target.closest('#global-search-input')) return; const btn = e.target.closest('.tab-btn'); if(btn) { changeTab(btn.dataset.tab); window.scrollTo(0,0); } };
    document.getElementById('toggle-header-btn').onclick = () => { document.getElementById('main-header').classList.toggle('hidden'); document.getElementById('dashboard-stats').classList.toggle('hidden'); const i = document.getElementById('toggle-header-icon'); if(document.getElementById('main-header').classList.contains('hidden')) { i.classList.replace('fa-minus', 'fa-plus'); } else { i.classList.replace('fa-plus', 'fa-minus'); } };

    document.getElementById('global-search-input').addEventListener('input', (e) => {
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab; const term = e.target.value.trim().toUpperCase();
        if (activeTab === 'users') renderUsers();
        else if (activeTab === 'inventory') { const exactMatchInv = state.inventory.find(i => String(i['CLAVE UNICA']).toUpperCase() === term); const exactMatchAdic = state.additionalItems.find(a => String(a.claveAsignada).toUpperCase() === term); if (term !== '') { if (exactMatchInv) showInvDetail(exactMatchInv['CLAVE UNICA']); else if (exactMatchAdic) showAdicDetail(exactMatchAdic.id); } currentPage = 1; filterAndRenderInventory(); } else if (activeTab === 'adicionales') renderAdicionales();
        else if(activeTab==='notas'){window.currentNotesPage=1;selectedNotes.clear();renderNotasTab();}
        else if(activeTab==='reportes')renderReportSearch();
    });

    function renderDashboard() { document.getElementById('total-items').textContent = state.inventory.length; document.getElementById('located-items').textContent = state.inventory.filter(i=>i.UBICADO==='SI').length; document.getElementById('pending-items').textContent = state.inventory.filter(i=>i.UBICADO!=='SI').length; updateHeaderArea(); }

    function populateFilters() {
        const areas = [...new Set([...state.inventory.map(i=>i.areaOriginal), ...state.resguardantes.map(u=>u.area)])].sort();
        const opts = '<option value="all">Todas las áreas</option>' + areas.map(a => `<option value="${escapeHTML(a)}">Área ${escapeHTML(a)} - ${escapeHTML(cleanAreaName(a, NOMBRES_AREAS[a]||''))}</option>`).join('');
        document.getElementById('area-filter-inventory').innerHTML = opts; document.getElementById('ad-area-filter').innerHTML = opts;
        document.getElementById('user-area-select').innerHTML = '<option value="">Seleccione un área...</option>' + areas.map(a => `<option value="${escapeHTML(a)}">Área ${escapeHTML(a)} - ${escapeHTML(cleanAreaName(a, NOMBRES_AREAS[a]||''))}</option>`).join('');
        document.getElementById('edit-user-area').innerHTML = opts; document.getElementById('ad-user-filter').innerHTML = '<option value="all">Todos los usuarios</option>' + state.resguardantes.map(u => `<option value="${escapeHTML(u.name)}">${escapeHTML(u.name)}</option>`).join('');
        const bookTypes = [...new Set(state.inventory.map(i => i.listadoOriginal))].filter(Boolean).sort(); document.getElementById('book-type-filter').innerHTML = '<option value="all">Todos los tipos de libro</option>' + bookTypes.map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('');
    }

    function renderLocChips(container, arr, detailsMap) { container.innerHTML = arr.length ? arr.map((l,i) => { const d = detailsMap[l] || {edificio: 'N/A', piso: 'N/A'}; return `<div class="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg p-2 relative"><div><span class="block font-black text-indigo-900 text-sm">${escapeHTML(l)}</span><span class="block text-[10px] text-indigo-600 font-bold uppercase"><i class="fa-solid fa-building mr-1"></i>${escapeHTML(d.edificio)} | <i class="fa-solid fa-layer-group mr-1"></i>${escapeHTML(d.piso)}</span></div><button data-action="danger" type="button" class="rm-loc w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm border" data-idx="${i}"><i class="fa-solid fa-trash pointer-events-none"></i></button></div>`; }).join('') : '<p class="text-gray-400 p-2 text-sm italic border-2 border-dashed border-gray-200 rounded-lg text-center">Ninguna ubicación añadida.</p>'; }

    document.getElementById('user-edificio-select').onchange = e => document.getElementById('user-edificio-manual').classList.toggle('hidden', e.target.value !== 'OTRO MANUAL'); document.getElementById('user-piso-select').onchange = e => document.getElementById('user-piso-manual').classList.toggle('hidden', e.target.value !== 'OTRO MANUAL'); document.getElementById('edit-user-edificio-select').onchange = e => document.getElementById('edit-user-edificio-manual').classList.toggle('hidden', e.target.value !== 'OTRO MANUAL'); document.getElementById('edit-user-piso-select').onchange = e => document.getElementById('edit-user-piso-manual').classList.toggle('hidden', e.target.value !== 'OTRO MANUAL'); document.getElementById('user-location-select').onchange = e => document.getElementById('user-location-manual').classList.toggle('hidden', e.target.value !== 'OTRA'); document.getElementById('edit-user-location-type').onchange = e => document.getElementById('edit-user-location-manual').classList.toggle('hidden', e.target.value !== 'OTRA');

    document.getElementById('add-location-btn').onclick = () => { const eSelect = document.getElementById('user-edificio-select').value; const eMan = document.getElementById('user-edificio-manual').value.trim().toUpperCase(); const edificio = (eSelect === 'OTRO MANUAL' ? eMan : eSelect); const pSelect = document.getElementById('user-piso-select').value; const pMan = document.getElementById('user-piso-manual').value.trim().toUpperCase(); const piso = (pSelect === 'OTRO MANUAL' ? pMan : pSelect); if(!edificio || !piso) return showToast('Completa el edificio y piso', 'warning'); lastSelectedEdificio = eSelect; lastSelectedPiso = pSelect; const t = document.getElementById('user-location-select').value; const m = document.getElementById('user-location-manual').value.trim(); const base = (t === 'OTRA' ? m : t).trim().toUpperCase(); if (!base) return; let maxNum = 0; const checkMax = loc => { const match = loc.match(/^(.*?)\s+(\d+)$/); if(match && match[1].trim().toUpperCase() === base) { const num = parseInt(match[2], 10); if(num > maxNum) maxNum = num; } }; state.resguardantes.forEach(u => (u.locations||[]).forEach(checkMax)); tempUserLocations.forEach(checkMax); const newLocStr = `${base} ${String(maxNum + 1).padStart(2, '0')}`; tempUserLocations.push(newLocStr); tempUserLocationDetails[newLocStr] = { edificio, piso }; renderLocChips(document.getElementById('new-user-locations-list'), tempUserLocations, tempUserLocationDetails); };
    document.getElementById('new-user-locations-list').onclick = e => { if(e.target.classList.contains('rm-loc')) { showConfirm('Eliminar Ubicación', '¿Seguro que deseas eliminar esta ubicación de la lista?', () => { const strToRemove = tempUserLocations[e.target.dataset.idx]; tempUserLocations.splice(e.target.dataset.idx,1); delete tempUserLocationDetails[strToRemove]; renderLocChips(document.getElementById('new-user-locations-list'), tempUserLocations, tempUserLocationDetails); }); } };

    let tempEditUserLocations = []; let tempEditUserLocationDetails = {};
    document.getElementById('edit-add-location-btn').onclick = () => { const eSelect = document.getElementById('edit-user-edificio-select').value; const eMan = document.getElementById('edit-user-edificio-manual').value.trim().toUpperCase(); const edificio = (eSelect === 'OTRO MANUAL' ? eMan : eSelect); const pSelect = document.getElementById('edit-user-piso-select').value; const pMan = document.getElementById('edit-user-piso-manual').value.trim().toUpperCase(); const piso = (pSelect === 'OTRO MANUAL' ? pMan : pSelect); if(!edificio || !piso) return showToast('Completa el edificio y piso', 'warning'); lastSelectedEdificio = eSelect; lastSelectedPiso = pSelect; const t = document.getElementById('edit-user-location-type').value; const m = document.getElementById('edit-user-location-manual').value.trim(); const base = (t === 'OTRA' ? m : t).trim().toUpperCase(); if (!base) return; let maxNum = 0; const checkMax = loc => { const match = loc.match(/^(.*?)\s+(\d+)$/); if(match && match[1].trim().toUpperCase() === base) { const num = parseInt(match[2], 10); if(num > maxNum) maxNum = num; } }; state.resguardantes.forEach(u => (u.locations||[]).forEach(checkMax)); tempEditUserLocations.forEach(checkMax); const newLocStr = `${base} ${String(maxNum + 1).padStart(2, '0')}`; tempEditUserLocations.push(newLocStr); tempEditUserLocationDetails[newLocStr] = { edificio, piso }; renderLocChips(document.getElementById('edit-user-locations-list'), tempEditUserLocations, tempEditUserLocationDetails); };
    document.getElementById('edit-user-locations-list').onclick = e => { if(e.target.classList.contains('rm-loc')) { showConfirm('Eliminar Ubicación', '¿Seguro que deseas quitar esta ubicación? Los bienes asociados podrían quedar huérfanos.', () => { const strToRemove = tempEditUserLocations[e.target.dataset.idx]; tempEditUserLocations.splice(e.target.dataset.idx,1); delete tempEditUserLocationDetails[strToRemove]; renderLocChips(document.getElementById('edit-user-locations-list'), tempEditUserLocations, tempEditUserLocationDetails); }); } };

    document.getElementById('create-user-btn').onclick = () => {
        const n = document.getElementById('user-name').value.trim();
        const a = document.getElementById('user-area-select').value;
        if(!n || !a || !tempUserLocations.length) return showToast('Completa nombre, área y al menos una ubicación','error');

        const proceedCreate = () => {
            saveSnapshot();
            const u = { id: generateUUID(), name: n, area: a, locationWithId: tempUserLocations[0], locations: [...tempUserLocations], locationDetails: {...tempUserLocationDetails} };
            state.resguardantes.push(u); state.activeResguardante = u; recalculateLocationCounts(); state.suggestedNames = [...new Set([...(state.suggestedNames||[]), n])];
            saveState(); renderUsers(); updateBanner(); populateFilters();
            document.getElementById('user-name').value=''; document.getElementById('user-edificio-select').value = lastSelectedEdificio; document.getElementById('user-piso-select').value = lastSelectedPiso; document.getElementById('user-edificio-manual').classList.toggle('hidden', lastSelectedEdificio !== 'OTRO MANUAL'); document.getElementById('user-piso-manual').classList.toggle('hidden', lastSelectedPiso !== 'OTRO MANUAL'); tempUserLocations=[]; tempUserLocationDetails={}; renderLocChips(document.getElementById('new-user-locations-list'), [], {}); showToast(`Usuario ${escapeHTML(n)} creado.`); focusSearch();
        };

        const existingUser = state.resguardantes.find(u => u.name.toLowerCase() === n.toLowerCase());
        if (existingUser) {
            showConfirm('Usuario Duplicado', `El usuario "${escapeHTML(n)}" ya está registrado en el área ${existingUser.area}. ¿Deseas registrar otro usuario con el mismo nombre?`, proceedCreate);
        } else {
            proceedCreate();
        }
    };

    function renderUsers() {
        const term = document.getElementById('global-search-input').value.toLowerCase(); const list = document.getElementById('registered-users-list');
        const filtered = state.resguardantes.filter(u => u.name.toLowerCase().includes(term) || (u.locations||[]).join(' ').toLowerCase().includes(term));
        document.getElementById('user-count-badge').textContent = filtered.length;
        list.innerHTML = filtered.map(u => {
            const nombreArea = cleanAreaName(u.area, NOMBRES_AREAS[u.area] || 'Área Desconocida'); const isActive = state.activeResguardante?.id === u.id; const btnText = isActive ? '<i class="fa-solid fa-user-check mr-1"></i>Activo' : 'Activar';
            const userLocations=[...new Set((u.locations||[u.locationWithId]).filter(Boolean))];
            const locTags=userLocations.length?`<span class="user-location-summary" title="${escapeHTML(userLocations.join(' / '))}"><span>${escapeHTML(userLocations[0])}</span>${userLocations.length>1?`<b>+${userLocations.length-1} más</b>`:''}</span>`:'';
            return `<div class="flex flex-col md:flex-row justify-between items-start md:items-center p-3 border rounded-xl bg-white shadow-sm mb-2 ${isActive ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'hover:border-indigo-300'}"><div class="cursor-pointer mb-3 md:mb-0 w-full md:flex-1 min-w-0 pr-2" onclick="showUserDetail(${inlineValue(u.id)})"><p class="font-bold text-base text-gray-800 truncate" title="${escapeHTML(u.name)}">${escapeHTML(u.name)}</p><p class="text-sm text-gray-500 font-medium truncate"><i class="fa-solid fa-briefcase mr-1"></i>Área ${escapeHTML(u.area)} - ${escapeHTML(nombreArea)}</p><div class="mt-1 flex flex-col gap-0.5 w-full">${locTags}</div></div><div class="flex flex-shrink-0 flex-wrap gap-2 w-full md:w-auto grid grid-cols-4 md:flex items-center"><button data-action="save" class="w-full md:w-auto py-2.5 px-4 font-bold rounded-xl text-sm" data-user-active="${isActive}" onclick="activateUser(${inlineValue(u.id)})">${btnText}</button><button data-action="photo" class="w-full md:w-auto py-2.5 px-3 font-bold rounded-xl text-sm" title="Foto" onclick="showPhoto('user', ${inlineValue(u.id)})"><i class="fa-solid fa-camera"></i></button><button data-action="edit" class="w-full md:w-auto py-2.5 px-3 font-bold rounded-xl text-sm" title="Editar" onclick="openEditUser(${inlineValue(u.id)})"><i class="fa-solid fa-pencil"></i></button><button data-action="danger" class="w-full md:w-auto py-2.5 px-3 font-bold rounded-xl text-sm" title="Eliminar" onclick="deleteUser(${inlineValue(u.id)})"><i class="fa-solid fa-trash"></i></button></div></div>`
        }).join('');
    }

    window.activateUser = id => { captureAdditionalDraft();state.activeResguardante = state.resguardantes.find(u=>u.id===id); updateBanner(); renderUsers();restoreAdditionalDraft(); window.scrollTo(0,0); focusSearch(); };
    async function commitUserChange(next,label){
        await photoDB.setItem('appData','mainState',InventoryData.clean(next));saveSnapshot(label);state=next;recalculateLocationCounts();renderUsers();populateFilters();filterAndRenderInventory();renderAdicionales();updateBanner();updateDatalists();
    }
    window.deleteUser=id=>{let next;try{next=InventorySafeChanges.removeUser(state,id);}catch(e){return showToast(escapeHTML(e.message),'warning');}showConfirm('Eliminar usuario','Se eliminará el usuario sin bienes asignados. ¿Continuar?',async()=>{const overlay=document.getElementById('loading-overlay');overlay.classList.add('show');try{await commitUserChange(InventorySafeChanges.removeUser(state,id),'Eliminar usuario');showToast('Usuario eliminado','success');}catch(e){showToast(escapeHTML(e.message),'error');}finally{overlay.classList.remove('show');}});};


    function updateActiveUserLocationSelect() {
        const select = document.getElementById('active-user-location-select'); if(!state.activeResguardante) return;
        const uName = state.activeResguardante.name; const currentVal = select.value;
        select.innerHTML = (state.activeResguardante.locations||[state.activeResguardante.locationWithId]).map(l => { const invCount = state.inventory.filter(i => i.UBICADO==='SI' && i['NOMBRE DE USUARIO']===uName && i.ubicacionEspecifica===l).length; const adCount = state.additionalItems.filter(i => i.usuario===uName && i.ubicacionEspecifica===l).length; return `<option value="${escapeHTML(l)}">${escapeHTML(l)} (${invCount} + ${adCount})</option>`; }).join('');
        if(currentVal && Array.from(select.options).some(o=>o.value===currentVal)) select.value = currentVal;
        const updateBannerTag = () => { document.getElementById('active-user-banner-tag').textContent = getNomenclature(state.activeResguardante, select.value); }; select.onchange = updateBannerTag; updateBannerTag();
    }

    function updateBanner() {
        const b = document.getElementById('active-user-banner');
        if(state.activeResguardante) {
            document.getElementById('active-user-banner-name').textContent = state.activeResguardante.name;
            const areaName = cleanAreaName(state.activeResguardante.area, NOMBRES_AREAS[state.activeResguardante.area] || ''); document.getElementById('active-user-banner-area').textContent = `ÁREA ${state.activeResguardante.area} ${areaName ? '- ' + areaName : ''}`;
            updateActiveUserLocationSelect(); b.classList.remove('hidden');
        } else b.classList.add('hidden');
    }
    document.getElementById('deactivate-user-btn').onclick = () => { state.activeResguardante=null; updateBanner(); renderUsers(); };


    let editingLocation=null;
    window.openLocationEditor=(id,location)=>{
        const user=state.resguardantes.find(u=>u.id===id);if(!user)return;
        editingLocation={id,location};const d=user.locationDetails?.[location]||{};
        document.getElementById('location-edit-user').textContent=user.name+' · Área '+user.area;
        document.getElementById('location-edit-name').value=location;
        document.getElementById('location-edit-building').value=d.edificio||'';
        document.getElementById('location-edit-floor').value=d.piso||'';
        document.getElementById('location-edit-error').textContent='';
        document.getElementById('location-edit-modal').classList.add('show');document.getElementById('location-edit-name').focus();
    };
    document.getElementById('location-edit-form').onsubmit=async e=>{
        e.preventDefault();if(!editingLocation)return;
        const {id,location}=editingLocation,button=document.getElementById('location-edit-save'),overlay=document.getElementById('loading-overlay');button.disabled=true;overlay.classList.add('show');document.getElementById('location-edit-error').textContent='';
        try{
            const plan=InventoryLocationEdit.edit(state,id,location,{name:document.getElementById('location-edit-name').value,edificio:document.getElementById('location-edit-building').value,piso:document.getElementById('location-edit-floor').value});
            await photoDB.flush();const related=[];
            if(plan.sourcePhoto!==plan.targetPhoto){const photo=await photoDB.getItem('photos','location-'+plan.sourcePhoto),target=await photoDB.getItem('photos','location-'+plan.targetPhoto);if(target){let same=false;if(photo&&photo.size===target.size){const a=new Uint8Array(await photo.arrayBuffer()),b=new Uint8Array(await target.arrayBuffer());same=a.every((v,i)=>v===b[i]);}if(!same)throw Error('Ya existe una fotografía diferente con el nombre de destino. Elige otro nombre para conservar ambas.');}if(photo){related.push({store:'photos',key:'location-'+plan.targetPhoto,value:photo});plan.next.locationPhotos[plan.targetPhoto]=true;}}
            const nextDrafts=structuredClone(drafts);if(nextDrafts.additional[id]?.location===location)nextDrafts.additional[id].location=plan.name;
            related.push({store:'appData',key:'captureDrafts',value:nextDrafts});
            const activeSelect=document.getElementById('active-user-location-select'),activeValue=activeSelect.value;
            await photoDB.setItem('appData','mainState',InventoryData.clean(plan.next),related);
            saveSnapshot('Editar ubicación: '+location);state=plan.next;drafts=nextDrafts;recalculateLocationCounts();renderUsers();populateFilters();filterAndRenderInventory();renderAdicionales();renderDashboard();updateBanner();populateTransferUsers();updateReportLocations();
            if(state.activeResguardante?.id===id&&activeValue===location)activeSelect.value=plan.name;
            document.getElementById('location-edit-modal').classList.remove('show');showUserDetail(id);editingLocation=null;showToast('Ubicación actualizada y guardada','success');
        }catch(error){document.getElementById('location-edit-error').textContent=error.message;}
        finally{button.disabled=false;overlay.classList.remove('show');}
    };

    window.showUserDetail = id => {
        const u = state.resguardantes.find(x=>x.id===id); const areaName = cleanAreaName(u.area, NOMBRES_AREAS[u.area] || 'Área Desconocida');
        document.getElementById('user-detail-view-name').textContent = u.name; document.getElementById('user-detail-view-area').textContent = `${u.area} - ${areaName}`;

        document.getElementById('user-detail-view-location').innerHTML = (u.locations||[]).map(l => {
            const d = u.locationDetails && u.locationDetails[l] ? u.locationDetails[l] : {edificio:'N/A', piso:'N/A'};
            const photoId = `${u.id}|${l}`;
            const hasPhoto = state.locationPhotos && state.locationPhotos[photoId];
            const btnColor = hasPhoto ? 'bg-indigo-100 text-indigo-600 border border-indigo-200' : 'bg-white text-gray-400 border border-gray-300 hover:text-indigo-500';

            return `<div class="border-b border-gray-200 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0 flex justify-between items-center gap-3">
                <div class="flex-grow min-w-0">
                    <span class="font-black text-gray-800 text-base block"><i class="fa-solid fa-map-pin mr-2 text-indigo-500"></i>${escapeHTML(l)}</span>
                    <span class="text-xs font-bold text-gray-500 uppercase ml-5">${escapeHTML(d.edificio)} - ${escapeHTML(d.piso)}</span>
                    <span class="block text-[10px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 mt-1 truncate">${escapeHTML(getNomenclature(u, l))}</span>
                </div>
                <button data-action="edit" type="button" class="px-3 py-2 rounded-xl font-bold text-sm" onclick="openLocationEditor(${inlineValue(u.id)}, ${inlineValue(l)})" title="Editar ubicación">Editar</button>
                <button data-action="photo" class="w-11 h-11 flex items-center justify-center rounded-xl transition-colors shadow-sm ${btnColor} flex-shrink-0" onclick="showPhoto('location', ${inlineValue(photoId)})" title="${hasPhoto ? 'Ver Foto de Ubicación' : 'Tomar Foto de Ubicación'}">
                    <i class="fa-solid fa-camera text-lg"></i>
                </button>
            </div>`;
        }).join('');
        document.getElementById('user-detail-view-modal').classList.add('show');
    };

    window.openEditUser = id => {
        const u = state.resguardantes.find(x=>x.id===id); document.getElementById('edit-user-name').value = u.name; document.getElementById('edit-user-area').value = u.area;
        document.getElementById('edit-user-edificio-select').value = lastSelectedEdificio; document.getElementById('edit-user-piso-select').value = lastSelectedPiso; document.getElementById('edit-user-edificio-manual').classList.toggle('hidden', lastSelectedEdificio !== 'OTRO MANUAL'); document.getElementById('edit-user-piso-manual').classList.toggle('hidden', lastSelectedPiso !== 'OTRO MANUAL');
        tempEditUserLocations = [...(u.locations||[])]; tempEditUserLocationDetails = JSON.parse(JSON.stringify(u.locationDetails || {})); renderLocChips(document.getElementById('edit-user-locations-list'), tempEditUserLocations, tempEditUserLocationDetails); document.getElementById('edit-user-save-btn').dataset.id = id; document.getElementById('edit-user-modal').classList.add('show');
    };

    document.getElementById('edit-user-save-btn').onclick=()=>{
        const id=document.getElementById('edit-user-save-btn').dataset.id,u=state.resguardantes.find(u=>u.id===id);
        const values={name:document.getElementById('edit-user-name').value,area:document.getElementById('edit-user-area').value,locations:[...tempEditUserLocations],locationDetails:structuredClone(tempEditUserLocationDetails)};
        const removed=(u.locations||[]).filter(l=>!values.locations.includes(l));const affected=[...state.inventory.filter(i=>i['NOMBRE DE USUARIO']===u.name),...state.additionalItems.filter(i=>i.resguardanteId?i.resguardanteId===id:i.usuario===u.name)].filter(i=>removed.includes(i.ubicacionEspecifica));
        if(!values.name.trim())return showToast('El nombre es obligatorio','warning');
        const save=async action=>{const overlay=document.getElementById('loading-overlay');overlay.classList.add('show');try{const next=InventorySafeChanges.editUser(state,id,values,action);await commitUserChange(next,'Editar usuario y ubicaciones');document.getElementById('edit-user-modal').classList.remove('show');document.getElementById('migration-modal').classList.remove('show');showToast('Perfil actualizado y guardado','success');}catch(e){showToast(escapeHTML(e.message),'error');}finally{overlay.classList.remove('show');}};
        if(!affected.length)return save();
        document.getElementById('mig-count').textContent=affected.length;document.getElementById('mig-new-loc-select').replaceChildren(...values.locations.map(l=>new Option(l,l)));
        document.getElementById('migration-modal').classList.add('show');document.getElementById('mig-confirm-btn').onclick=()=>{const loc=document.getElementById('mig-new-loc-select').value;if(!loc)return showToast('Selecciona una ubicación de destino','warning');save(loc);};document.getElementById('mig-delete-btn').onclick=()=>save('pending');
    };


    let currentPage = 1; const itemsPerPage = 30; let filtered = [];
    function addToSearchHistory(item) { if (!item || item.trim() === '') return; searchHistory = searchHistory.filter(i => i !== item); searchHistory.unshift(item); if (searchHistory.length > 5) searchHistory.pop(); renderSearchHistory(); }
    function renderSearchHistory() { const container = document.getElementById('search-history-container'); if (!container) return; container.innerHTML = searchHistory.map(term => `<span class="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold cursor-pointer shadow-sm hover:bg-indigo-200 transition-colors" onclick="applySearch(${inlineValue(term)})"><i class="fa-solid fa-clock-rotate-left mr-1"></i>${escapeHTML(term)}</span>`).join(''); }
    window.applySearch = (term) => { document.getElementById('global-search-input').value = term; currentPage = 1; filterAndRenderInventory(); };

    function filterAndRenderInventory() {
        const term = document.getElementById('global-search-input').value.toLowerCase(); const stat = document.getElementById('status-filter').value; const area = document.getElementById('area-filter-inventory').value; const bookType = document.getElementById('book-type-filter').value; const userFilter = document.getElementById('user-filter-inventory') ? document.getElementById('user-filter-inventory').value : 'all'; const locFilter = document.getElementById('location-filter-inventory') ? document.getElementById('location-filter-inventory').value : 'all';
        let combinedInv = state.inventory.map(i => ({...i, _type: 'inv'}));
        let combinedAdic = state.additionalItems.map(a => { const adicUser = state.resguardantes.find(u => u.name === a.usuario); return { _type: 'adic', _id: a.id, 'CLAVE UNICA': a.claveAsignada || 'S/C', DESCRIPCION: a.descripcion, DESCRripcion: a.descripcion, MARCA: a.marca, MODELO: a.modelo, SERIE: a.serie, 'NOMBRE DE USUARIO': a.usuario, UBICADO: 'SI', areaOriginal: adicUser ? adicUser.area : 'ADICIONAL', ubicacionEspecifica: a.ubicacionEspecifica, listadoOriginal: 'Adicional', ...InventoryTeam.savedAttribution(a) }; });
        filtered = [...combinedInv, ...combinedAdic].filter(i => (!term || [i['CLAVE UNICA'], i.DESCRIPCION, i.DESCRripcion, i.SERIE].some(f=>String(f||'').toLowerCase().includes(term))) && (stat==='all' || i.UBICADO===stat) && (area==='all' || i.areaOriginal===area) && (bookType==='all' || i.listadoOriginal===bookType) && (userFilter==='all' || i['NOMBRE DE USUARIO'] === userFilter) && (locFilter==='all' || i.ubicacionEspecifica === locFilter));
        document.getElementById('inventory-table-body').innerHTML = filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage).map(i => {
            const isAdic = i._type === 'adic'; const c = isAdic ? i._id : i['CLAVE UNICA']; const assignedUser = state.resguardantes.find(u => u.name === i['NOMBRE DE USUARIO']); const userAreaText = assignedUser ? `(A${assignedUser.area})` : ''; const errorArea = !isAdic && InventoryAssetStatus.area(i, assignedUser).mismatch; const bgClass = isAdic ? 'bg-yellow-50' : (i.UBICADO==='SI' ? 'bg-green-50' : 'bg-white'); const tagAdicional = isAdic ? `<span class="px-1.5 py-0.5 bg-yellow-200 text-yellow-800 text-[10px] rounded font-bold ml-1">ADICIONAL</span>` : ''; const tagReetiquetado = !isAdic && i.RE_ETIQUETADO === 'SI' ? `<span class="px-1.5 py-0.5 bg-blue-200 text-blue-800 text-[10px] rounded font-bold ml-1"><i class="fa-solid fa-tags"></i> REETIQUETADO</span>` : '';
            return `<tr class="hover:bg-gray-100 transition-colors border-b ${bgClass}" data-clave="${escapeHTML(c)}"><td class="px-3 py-3 text-center">${isAdic ? `` : `<input type="checkbox" class="inv-cb">`}</td><td class="px-3 py-3 cursor-pointer" onclick="${isAdic ? `showAdicDetail(${inlineValue(i._id)})` : `showInvDetail(${inlineValue(c)})`}"><p class="font-extrabold text-base text-gray-800">${escapeHTML(i.DESCRIPCION||i.DESCRripcion).substring(0,40)}... ${tagAdicional} ${tagReetiquetado}</p><p class="font-mono text-sm text-indigo-600 font-bold mt-0.5">CLV: ${escapeHTML(isAdic ? i['CLAVE UNICA'] : c)}</p></td><td class="px-3 py-3 text-sm text-gray-600"><p><span class="font-bold">M:</span> ${escapeHTML(i.MARCA||'-')} <span class="mx-1">|</span> <span class="font-bold">Mod:</span> ${escapeHTML(i.MODELO||'-')}</p><p class="font-mono mt-0.5 break-all"><span class="font-bold font-sans">S:</span> ${escapeHTML(i.SERIE||'-')}</p></td><td class="px-3 py-3">${i.UBICADO==='SI' ? `<p class="font-bold text-green-700 text-sm"><i class="fa-solid fa-check-circle mr-1"></i>${escapeHTML(i['NOMBRE DE USUARIO'])} <span class="text-xs font-normal text-gray-500">${escapeHTML(userAreaText)}</span></p><p class="text-xs font-bold text-indigo-600 mt-0.5"><i class="fa-solid fa-location-dot mr-1"></i>${escapeHTML(i.ubicacionEspecifica||'')}</p>${i.ubicadoPor ? `<p class="text-[10px] text-gray-500 font-semibold mt-0.5 uppercase"><i class="fa-solid fa-user-check mr-1"></i>Ubicado por: ${escapeHTML(InventoryTeam.label(i.ubicadoPor,i.ubicadoPorNumero))}<br>Auxiliado por: ${escapeHTML(InventoryTeam.label(i.auxiliadoPor,i.auxiliadoPorNumero))}</p>` : ''}${errorArea ? `<span class="inline-block mt-0.5 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Fuera Área (${escapeHTML(i.areaOriginal)})</span>` : ''}` : `<span class="px-2 py-1 bg-gray-200 text-gray-600 font-bold rounded-md text-xs">Pendiente</span>`}</td><td class="px-3 py-3"><div class="flex justify-center space-x-2">${isAdic ? `<button data-action="photo" class="touch-icon ${state.additionalPhotos[i._id]?'bg-indigo-100':'bg-gray-100'}" onclick="showPhoto('additional',${inlineValue(i._id)})"><i class="fa-solid fa-camera"></i></button>` : `<button data-action="note" class="touch-icon ${state.notes[c]?'bg-yellow-100':'bg-gray-100'}" onclick="showNoteModal(${inlineValue(c)})"><i class="fa-solid fa-note-sticky"></i></button><button data-action="photo" class="touch-icon ${state.photos[c]?'bg-indigo-100':'bg-gray-100'}" onclick="showPhoto('inventory',${inlineValue(c)})"><i class="fa-solid fa-camera"></i></button>`}</div></td></tr>`;
        }).join('');
        document.getElementById('page-info').textContent = `Página ${currentPage} de ${Math.ceil(filtered.length/itemsPerPage)||1}`;
    }

    document.getElementById('status-filter').onchange = () => {currentPage=1; filterAndRenderInventory();}; document.getElementById('book-type-filter').onchange = () => {currentPage=1; filterAndRenderInventory();};
    document.getElementById('area-filter-inventory').onchange = (e) => { const selectedArea = e.target.value; const userSelect = document.getElementById('user-filter-inventory'); const locSelect = document.getElementById('location-filter-inventory'); if(userSelect && locSelect) { let usersToDisplay = selectedArea !== 'all' ? state.resguardantes.filter(u => u.area === selectedArea) : state.resguardantes; userSelect.innerHTML = '<option value="all">Todos los usuarios</option>' + usersToDisplay.map(u => `<option value="${escapeHTML(u.name)}">${escapeHTML(u.name)}</option>`).join(''); locSelect.innerHTML = '<option value="all">Todas las ubicaciones</option>'; } currentPage=1; filterAndRenderInventory(); };
    if(document.getElementById('user-filter-inventory')) { document.getElementById('user-filter-inventory').onchange = (e) => { const locSelect = document.getElementById('location-filter-inventory'); if (e.target.value === 'all') locSelect.innerHTML = '<option value="all">Todas las ubicaciones</option>'; else { const user = state.resguardantes.find(u => u.name === e.target.value); if (user && user.locations) locSelect.innerHTML = '<option value="all">Todas sus ubicaciones</option>' + user.locations.map(l => `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`).join(''); } currentPage=1; filterAndRenderInventory(); }; }
    if(document.getElementById('location-filter-inventory')) document.getElementById('location-filter-inventory').onchange = () => { currentPage=1; filterAndRenderInventory(); };

    document.getElementById('nav-clear-search-btn').onclick = () => { document.getElementById('global-search-input').value = ''; document.getElementById('status-filter').value = 'all'; document.getElementById('area-filter-inventory').value = 'all'; document.getElementById('book-type-filter').value = 'all'; if(document.getElementById('user-filter-inventory')) document.getElementById('user-filter-inventory').value = 'all'; if(document.getElementById('location-filter-inventory')) { document.getElementById('location-filter-inventory').innerHTML = '<option value="all">Todas las ubicaciones</option>'; document.getElementById('location-filter-inventory').value = 'all'; } currentPage = 1; filterAndRenderInventory(); };
    document.getElementById('prev-page-btn').onclick = () => {if(currentPage>1){currentPage--; filterAndRenderInventory();}}; document.getElementById('next-page-btn').onclick = () => {if(currentPage<Math.ceil(filtered.length/itemsPerPage)){currentPage++; filterAndRenderInventory();}}; document.getElementById('select-all-checkbox').onchange = e => document.querySelectorAll('.inv-cb').forEach(c=>c.checked=e.target.checked);

    function doAction(action) {
        const cbs = document.querySelectorAll('.inv-cb:checked'); if(!cbs.length) return showToast('Selecciona bienes', 'warning'); if(action!=='desubicar' && !state.activeResguardante) return showToast('¡Activa un usuario primero!', 'error');

        if (action === 'desubicar') {
            showConfirm('Desubicar Bienes', '¿Seguro que deseas quitar la asignación de estos bienes?', () => { executeGlobalAction('desubicar', cbs); });
        } else {
            const hasLocated = Array.from(cbs).some(cb => { const clv = cb.closest('tr').dataset.clave; const i = state.inventory.find(x=>x['CLAVE UNICA']===clv); return i && i.UBICADO === 'SI'; });
            if (hasLocated) { showConfirm('Reasignar Bienes', 'Algunos bienes ya están asignados a un usuario. ¿Deseas reasignarlos?', () => { executeGlobalAction(action, cbs); }); }
            else executeGlobalAction(action, cbs);
        }
    }

    function executeGlobalAction(action, cbs) {
        saveSnapshot();
        cbs.forEach(cb => { const claveElement = cb.closest('tr').dataset.clave; const i = state.inventory.find(x=>x['CLAVE UNICA'] === claveElement); if(i) { if(action==='desubicar') { i.UBICADO='NO'; i.RE_ETIQUETADO='NO'; i['NOMBRE DE USUARIO']=''; i.ubicacionEspecifica=''; Object.assign(i, InventoryTeam.clear()); } else { i.UBICADO='SI'; i.RE_ETIQUETADO='NO'; i['NOMBRE DE USUARIO']=state.activeResguardante.name; i.ubicacionEspecifica = document.getElementById('active-user-location-select').value || state.activeResguardante.locationWithId; i.areaIncorrecta = i.areaOriginal !== state.activeResguardante.area; Object.assign(i, InventoryTeam.attribution(state)); addToSearchHistory(i['CLAVE UNICA']); } } });
        saveState(); renderDashboard(); filterAndRenderInventory(); updateActiveUserLocationSelect(); document.getElementById('select-all-checkbox').checked = false; showToast(`Aplicado a ${cbs.length} bienes.`);
    }

    document.getElementById('nav-ubicado-btn').onclick = ()=>doAction('ubicar'); document.getElementById('nav-desubicar-btn').onclick = ()=>doAction('desubicar');

    document.getElementById('nav-bulk-note-btn').onclick = () => { const cbs = document.querySelectorAll('.inv-cb:checked'); if(!cbs.length) return showToast('Selecciona bienes para nota', 'warning'); document.getElementById('note-textarea').value = ''; document.getElementById('note-save-btn').dataset.c = 'BULK';document.getElementById('note-draft-status').textContent='Nota masiva: este borrador no se conserva al cerrar la app.'; renderNoteSuggestions(); document.getElementById('notes-modal').classList.add('show'); setTimeout(() => document.getElementById('note-textarea').focus(), 100); };
    document.getElementById('nav-bulk-photo-btn').onclick = () => { const cbs = document.querySelectorAll('.inv-cb:checked'); if(!cbs.length) return showToast('Selecciona bienes para foto', 'warning'); document.getElementById('photo-input').dataset.t = 'inventory-bulk'; document.getElementById('photo-input').dataset.bulkIds = Array.from(cbs).map(cb => cb.closest('tr').dataset.clave).join(','); document.getElementById('photo-view-container').classList.add('hidden'); document.getElementById('photo-upload-container').classList.add('hidden'); document.getElementById('camera-view-container').classList.remove('hidden'); document.getElementById('camera-view-container').classList.add('flex'); document.getElementById('photo-modal-title').textContent = `Foto Masiva (${cbs.length} bienes)`; document.getElementById('capture-photo-btn').disabled = false; document.getElementById('capture-photo-btn').innerHTML = '<i class="fa-solid fa-camera-retro mr-2"></i> Capturar a Todos'; startCamera(); document.getElementById('photo-modal').classList.add('show'); };
    document.getElementById('ad-bulk-autofill-btn').onclick = () => { if (!state.additionalItems || state.additionalItems.length === 0) return showToast('No hay adicionales.', 'warning'); saveSnapshot(); let updatedCount = 0; state.additionalItems.forEach(item => { if (item.serie) { const perfil = matchMagicProfile(String(item.serie).toUpperCase().trim()); if (perfil) { let changed = false; if (item.descripcion !== perfil.desc) { item.descripcion = perfil.desc; changed = true; } if (item.marca !== perfil.marca) { item.marca = perfil.marca; changed = true; } if (item.modelo !== perfil.modelo) { item.modelo = perfil.modelo; changed = true; } if (item.posesion !== (perfil.posesion||'Cámara')) { item.posesion = perfil.posesion||'Cámara'; if(item.posesion === 'Arrendamiento') item.numContrato = 'LXVIDG AJ- 070/2024'; changed = true; } if (changed) updatedCount++; } } }); if (updatedCount > 0) { recalculateAdicionalesKeys(); saveState(); renderAdicionales(); filterAndRenderInventory(); showToast(`Autocompletados ${updatedCount} bienes.`, 'success'); } else showToast('Sin coincidencias.', 'info'); };

    document.getElementById('adicional-form').onsubmit=e=>e.preventDefault();
    document.getElementById('add-adicional-btn').onclick=()=>{try{askEntryAndSave(readAdditional('ad'));}catch(error){showToast(error.message,'warning');}};
    window.saveAdic=item=>persistAdditional(item);

    function updateDatalists() { const descripciones = [...new Set([...state.additionalItems.map(i=>i.descripcion),...state.inventory.map(i=>i.DESCRIPCION||i.DESCRripcion),...state.perfilesMagicos.map(i=>i.desc)])].filter(Boolean); const marcas = [...new Set([...state.additionalItems.map(i=>i.marca),...state.inventory.map(i=>i.MARCA)])].filter(Boolean); const modelos = [...new Set([...state.additionalItems.map(i=>i.modelo),...state.inventory.map(i=>i.MODELO)])].filter(Boolean); let descDatalist = document.getElementById('lista-descripciones'); if (!descDatalist) { descDatalist = document.createElement('datalist'); descDatalist.id = 'lista-descripciones'; document.body.appendChild(descDatalist); } descDatalist.innerHTML = descripciones.map(d=>`<option value="${escapeHTML(d)}">`).join(''); let marcaDatalist = document.getElementById('lista-marcas'); if (!marcaDatalist) { marcaDatalist = document.createElement('datalist'); marcaDatalist.id = 'lista-marcas'; document.body.appendChild(marcaDatalist); } marcaDatalist.innerHTML = marcas.map(m=>`<option value="${escapeHTML(m)}">`).join(''); let modeloDatalist = document.getElementById('lista-modelos'); if (!modeloDatalist) { modeloDatalist = document.createElement('datalist'); modeloDatalist.id = 'lista-modelos'; document.body.appendChild(modeloDatalist); } modeloDatalist.innerHTML = modelos.map(m=>`<option value="${escapeHTML(m)}">`).join(''); let respDatalist = document.getElementById('lista-responsables'); if (!respDatalist) { respDatalist = document.createElement('datalist'); respDatalist.id = 'lista-responsables'; document.body.appendChild(respDatalist); } respDatalist.innerHTML = (state.suggestedNames||[]).map(n=>`<option value="${escapeHTML(n)}">`).join(''); }

    function renderAdicionales() {
        const areaFilter = document.getElementById('ad-area-filter').value; const userFilter = document.getElementById('ad-user-filter').value; const term = document.getElementById('global-search-input').value.toLowerCase().trim(); let list = state.additionalItems;
        if(areaFilter !== 'all') { const usersInArea = state.resguardantes.filter(u => u.area === areaFilter).map(u => u.name); list = list.filter(i => usersInArea.includes(i.usuario)); }
        if(userFilter !== 'all') list = list.filter(i => i.usuario === userFilter);
        if(term) { list = list.filter(i => String(i.descripcion||'').toLowerCase().includes(term) || String(i.claveAsignada||'').toLowerCase().includes(term) || String(i.serie||'').toLowerCase().includes(term) || String(i.marca||'').toLowerCase().includes(term) || String(i.modelo||'').toLowerCase().includes(term) ); }
        document.getElementById('additional-items-total').textContent = list.length;
        document.getElementById('adicionales-list').innerHTML = list.map(i => {
            const arrendamientoTag = i.posesion === 'Arrendamiento' ? `<span class="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded font-bold uppercase"><i class="fa-solid fa-file-contract mr-1"></i>Arrendamiento ${escapeHTML(i.numContrato ? '('+i.numContrato+')':'')}</span>` : '';
            const formatoTag=i.personal==='Si'?'<span class="entry-format '+(i.tieneFormatoEntrada?'entry-yes':'entry-no')+'" role="img" aria-label="'+(i.tieneFormatoEntrada?'Con formato de entrada':'Sin formato de entrada')+'" title="'+(i.tieneFormatoEntrada?'Con formato de entrada':'Sin formato de entrada')+'">'+(i.tieneFormatoEntrada?'✓':'!')+'</span>':'';
            const showMatchBtn = (i.posesion === 'Cámara' || !i.posesion) && i.personal !== 'Si'; const matchBtnHtml = showMatchBtn ? `<button data-action="edit" class="w-full md:w-auto py-2.5 px-3 font-bold rounded-xl text-sm" onclick="openMatchModal(${inlineValue(i.id)})"><i class="fa-solid fa-link"></i></button>` : '';
            let claveHtml = escapeHTML(i.claveAsignada || '-'); if (i.claveAsignada && i.claveAsignada.startsWith('CD-')) { claveHtml = `<span class="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200"><i class="fa-solid fa-tag mr-1"></i>${escapeHTML(i.claveAsignada)}</span>`; }
            return `<div class="p-3 border-l-4 rounded-xl bg-white shadow-sm flex flex-col md:flex-row justify-between items-center ${i.personal==='Si'?'border-yellow-400':(i.posesion==='Arrendamiento'?'border-blue-500':'border-green-400')} mb-2"><div class="mb-2 md:mb-0 cursor-pointer w-full md:flex-1 min-w-0 pr-2" onclick="showAdicDetail(${inlineValue(i.id)})"><p class="font-bold text-base text-gray-800 truncate">${escapeHTML(i.descripcion)} ${formatoTag}${arrendamientoTag}</p><p class="text-sm text-gray-500 font-medium leading-tight truncate mt-1"><span class="font-bold">Clv:</span> ${claveHtml} <span class="mx-1">|</span> <span class="font-bold">Mod:</span> ${escapeHTML(i.modelo||'-')} <span class="mx-1">|</span> <span class="font-bold">Ser:</span> ${escapeHTML(i.serie||'-')}</p><p class="text-xs text-indigo-700 font-bold leading-tight truncate mt-1"><i class="fa-solid fa-user mr-1"></i>${escapeHTML(i.usuario)} <span class="text-gray-400 font-normal ml-1">(${escapeHTML(i.ubicacionEspecifica||'')})</span></p></div><div class="flex flex-shrink-0 flex-wrap gap-2 w-full md:w-auto grid grid-cols-5 md:flex items-center"><button data-action="info" class="w-full md:w-auto py-2.5 px-3 font-bold rounded-xl text-sm" onclick="duplicateAdic(${inlineValue(i.id)})"><i class="fa-solid fa-copy"></i></button>${matchBtnHtml}<button data-action="photo" class="w-full md:w-auto py-2.5 px-3 font-bold rounded-xl text-sm" onclick="showPhoto('additional', ${inlineValue(i.id)})"><i class="fa-solid fa-camera"></i></button><button data-action="edit" class="w-full md:w-auto py-2.5 px-3 font-bold rounded-xl text-sm" onclick="editAdic(${inlineValue(i.id)})"><i class="fa-solid fa-pen-to-square"></i></button><button data-action="danger" class="w-full md:w-auto py-2.5 px-3 font-bold rounded-xl text-sm" onclick="delAdic(${inlineValue(i.id)})"><i class="fa-solid fa-trash"></i></button></div></div>`;
        }).join('');
    }
    document.getElementById('ad-area-filter').onchange = renderAdicionales; document.getElementById('ad-user-filter').onchange = renderAdicionales;

    window.duplicateAdic = id => {
        const i = state.additionalItems.find(x=>x.id===id); if(!i) return;
        document.getElementById('ad-clave').value = '';
        document.getElementById('ad-desc').value = i.descripcion || '';
        document.getElementById('ad-marca').value = i.marca || '';
        document.getElementById('ad-modelo').value = i.modelo || '';
        document.getElementById('ad-serie').value = ''; autoValues.ad={};

        if(document.getElementById('ad-posesion')) {
            document.getElementById('ad-posesion').value = i.posesion || 'Cámara';
            let dynVal = '';
            if(i.posesion === 'Cámara') dynVal = i.areaProcedencia || '';
            else if(i.posesion === 'Arrendamiento') dynVal = i.numContrato || 'LXVIDG AJ- 070/2024';
            else if(i.posesion === 'Propiedad del Grupo') dynVal = i.grupoParlamentario || '';
            document.getElementById('ad-dynamic-input').value = dynVal;
        }

        document.querySelectorAll('input[name="personal"]').forEach(r => r.checked = (r.value === (i.personal || 'No')));
        toggleAdicFormFields('ad');
        document.getElementById('serie-warning').classList.add('hidden');
        captureAdditionalDraft();

        showToast('Datos clonados.', 'info'); document.getElementById('adicional-form').scrollIntoView({behavior: 'smooth', block: 'start'});
    };

    let currentMatchAdicId = null;
    window.openMatchModal = (id) => { const adic = state.additionalItems.find(x => x.id === id); if (!adic || adic.posesion !== 'Cámara' || adic.personal === 'Si') return; currentMatchAdicId = id; document.getElementById('match-ad-desc').textContent = adic.descripcion; document.getElementById('match-ad-info').innerHTML = `<i class="fa-solid fa-user mr-1"></i>${adic.usuario} <span class="mx-2">|</span> <i class="fa-solid fa-location-dot mr-1"></i>${adic.ubicacionEspecifica}`; const firstWord = adic.descripcion.split(' ')[0] || ''; document.getElementById('match-search-input').value = firstWord; renderMatchResults(firstWord); document.getElementById('match-modal').classList.add('show'); };
    document.getElementById('match-search-input').addEventListener('input', (e) => { renderMatchResults(e.target.value); });
    function renderMatchResults(term) {
        const list = document.getElementById('match-results-list'); term = term.toLowerCase().trim(); const adic = state.additionalItems.find(x => x.id === currentMatchAdicId); const adicUser = adic ? state.resguardantes.find(u => u.name === adic.usuario) : null; const targetArea = adicUser ? adicUser.area : null; let pendings = state.inventory.filter(i => i.UBICADO !== 'SI');
        if (term) { pendings = pendings.filter(i => String(i.DESCRIPCION||i.DESCRripcion||'').toLowerCase().includes(term) || String(i['CLAVE UNICA']||'').toLowerCase().includes(term) || String(i.MARCA||'').toLowerCase().includes(term) || String(i.SERIE||'').toLowerCase().includes(term) ); }
        if (targetArea) { pendings.sort((a, b) => { const aIsSame = a.areaOriginal === targetArea; const bIsSame = b.areaOriginal === targetArea; if (aIsSame && !bIsSame) return -1; if (!aIsSame && bIsSame) return 1; return 0; }); } pendings = pendings.slice(0, 50);
        if (pendings.length === 0) { list.innerHTML = '<p class="text-center text-gray-500 font-bold">No hay bienes pendientes.</p>'; return; }
        list.innerHTML = pendings.map(i => { const isSameArea = targetArea && i.areaOriginal === targetArea; const areaTag = `<span class="inline-block px-2 py-0.5 mt-1 text-[10px] font-black rounded ${isSameArea ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">ÁREA: ${escapeHTML(i.areaOriginal || 'Desconocida')}</span>`; return `<div class="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border ${isSameArea ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-red-400'}"><div class="pr-3 w-full"><p class="font-bold text-gray-800">${escapeHTML(i.DESCRIPCION||i.DESCRripcion)}</p><p class="font-mono text-sm text-purple-700 font-bold mt-1">CLV: ${escapeHTML(i['CLAVE UNICA'])} ${areaTag}</p><p class="text-xs text-gray-500 font-medium">M: ${escapeHTML(i.MARCA||'-')} | S: ${escapeHTML(i.SERIE||'-')}</p></div><button data-action="edit" class="px-5 py-3 font-bold rounded-xl" onclick="confirmMatch(${inlineValue(i['CLAVE UNICA'])})">Vincular</button></div>`; }).join('');
    }

    window.confirmMatch = clave => {
        const adic=state.additionalItems.find(i=>i.id===currentMatchAdicId);if(!adic)return;
        showConfirm('Vincular con bien pendiente','Se agregarán descripción, marca, modelo y serie a las notas, conservando las anteriores. Se transferirán el resguardante y su ubicación; el bien quedará ubicado y pendiente de reetiquetar.',async()=>{
            const overlay=document.getElementById('loading-overlay');overlay.classList.add('show');
            try{
                await photoDB.flush();
                const next=InventoryAdditional.linkDraft(state,adic.id,clave);
                const source=await photoDB.getItem('photos','additional-'+adic.id);
                const destination=await photoDB.getItem('photos','inventory-'+clave);
                if(source&&!destination)next.photos[clave]=true;
                // Keep the source evidence as well, so Undo never loses a photograph.
                await new Promise((resolve,reject)=>{
                    const tx=photoDB.db.transaction(['appData','photos'],'readwrite');
                    tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||new Error('No se pudo guardar la vinculación'));
                    tx.objectStore('appData').put(InventoryData.clean(next),'mainState');
                    if(source&&!destination)tx.objectStore('photos').put(source,'inventory-'+clave);
                });
                saveSnapshot();state=next;renderAdicionales();filterAndRenderInventory();renderDashboard();updateActiveUserLocationSelect();renderNotasTab();
                document.getElementById('match-modal').classList.remove('show');showToast('Bien vinculado y marcado para reetiquetar.','success');
            }catch(error){showToast(error.message,'error');}finally{overlay.classList.remove('show');}
        });
    };

    window.showAdicDetail = id => {
        const i = state.additionalItems.find(x=>x.id===id); if(!i) return; document.getElementById('ad-det-desc').textContent = i.descripcion || '-'; document.getElementById('ad-det-clave').textContent = i.claveAsignada || 'Sin Clave'; document.getElementById('ad-det-marca').textContent = i.marca || '-'; document.getElementById('ad-det-modelo').textContent = i.modelo || '-'; document.getElementById('ad-det-serie').textContent = i.serie || '-';

        let dynHtml = '';
        if(i.personal !== 'Si') {
            if(i.posesion === 'Arrendamiento') dynHtml = `Contrato: ${i.numContrato || 'N/A'}`;
            else if(i.posesion === 'Cámara') dynHtml = `Área Procedencia: ${i.areaProcedencia || 'N/A'}`;
            else if(i.posesion === 'Propiedad del Grupo') dynHtml = `Grupo: ${i.grupoParlamentario || 'N/A'}`;
        }

        const dynContainer = document.getElementById('ad-det-dynamic-container');
        if(dynHtml) { document.getElementById('ad-det-dynamic-val').textContent = dynHtml; dynContainer.classList.remove('hidden'); } else { dynContainer.classList.add('hidden'); }

        document.getElementById('ad-det-posesion').textContent = i.posesion || '-';
        document.getElementById('ad-det-personal').innerHTML = i.personal === 'Si' ? `<span class="text-yellow-600 font-bold">Sí ${i.tieneFormatoEntrada ? '(Con Formato)' : '(Sin Formato)'}</span>` : 'No'; document.getElementById('ad-det-usuario').textContent = i.usuario || '-'; document.getElementById('ad-det-ubicacion').textContent = i.ubicacionEspecifica || '-';
        const adicUser = state.resguardantes.find(u => u.name === i.usuario); const locDetails = adicUser && adicUser.locationDetails && adicUser.locationDetails[i.ubicacionEspecifica] ? adicUser.locationDetails[i.ubicacionEspecifica] : {edificio:'N/A', piso:'N/A'}; document.getElementById('ad-det-infraestructura').innerHTML = `<i class="fa-solid fa-building mr-1"></i>${escapeHTML(locDetails.edificio)} | <i class="fa-solid fa-layer-group mr-1"></i>${escapeHTML(locDetails.piso)}`;
        if (i.ubicadoPor) { document.getElementById('ad-det-auditor').innerHTML = `<i class="fa-solid fa-user-check mr-1 text-green-600"></i> ${escapeHTML(InventoryTeam.label(i.ubicadoPor,i.ubicadoPorNumero))}<br><span class="text-sm">Auxiliado por: ${escapeHTML(InventoryTeam.label(i.auxiliadoPor,i.auxiliadoPorNumero))}</span>`; document.getElementById('ad-det-auditor-container').classList.remove('hidden'); } else document.getElementById('ad-det-auditor-container').classList.add('hidden');
        document.getElementById('ad-det-edit-btn').onclick = () => { document.getElementById('adicional-detail-view-modal').classList.remove('show'); editAdic(id); }; document.getElementById('ad-det-foto-btn').dataset.id = id; document.getElementById('ad-det-foto-btn').onclick = () => showPhoto('additional', id);
        document.getElementById('ad-det-photo').classList.add('hidden'); document.getElementById('ad-delete-photo-btn').classList.add('hidden'); document.getElementById('ad-det-no-photo').classList.remove('hidden');
        if(state.additionalPhotos[id]) { photoDB.getItem('photos', `additional-${id}`).then(b => { if(b) { document.getElementById('ad-det-photo').src = URL.createObjectURL(b); document.getElementById('ad-det-photo').classList.remove('hidden'); document.getElementById('ad-delete-photo-btn').classList.remove('hidden'); document.getElementById('ad-det-no-photo').classList.add('hidden'); } }); } document.getElementById('adicional-detail-view-modal').classList.add('show');
    };

    window.editAdic=id=>{
        const item=state.additionalItems.find(i=>i.id===id);if(!item)return;
        const $=field=>document.getElementById('edit-ad-'+field);
        document.getElementById('edit-adicional-save-btn').dataset.id=id;autoValues['edit-ad']={};
        $('clave').value=InventoryAdditional.generated(item)?'':item.claveAsignada||'';
        $('clave').placeholder=InventoryAdditional.generated(item)?'Automática: '+item.claveAsignada:'Clave opcional';
        $('desc').value=item.descripcion||'';$('marca').value=item.marca||'';$('modelo').value=item.modelo||'';$('serie').value=item.serie||'';
        const type=item.personal==='Si'?'personal':item.posesion==='Arrendamiento'?'rental':item.posesion==='Propiedad del Grupo'?'group':InventoryAdditional.generated(item)?'institutional':'external';
        toggleAdicFormFields('edit-ad',type);
        $('dynamic-input').value=type==='rental'?item.numContrato||'':type==='group'?item.grupoParlamentario||'':item.areaProcedencia||'';
        document.getElementById('edit-serie-warning').classList.add('hidden');
        document.getElementById('edit-adicional-modal').classList.add('show');
    };
    document.getElementById('edit-adicional-save-btn').onclick=()=>{
        const item=state.additionalItems.find(i=>i.id===document.getElementById('edit-adicional-save-btn').dataset.id);
        if(!item)return;try{askEntryAndSave(readAdditional('edit-ad',item),true);}catch(error){showToast(error.message,'warning');}
    };

    window.delAdic=id=>{
        showConfirm('Borrar adicional','Se eliminará el bien y se ajustarán las claves automáticas restantes.',async()=>{
            try{
                const next=structuredClone(state),item=next.additionalItems.find(i=>i.id===id);if(!item)return;
                next.additionalItems=next.additionalItems.filter(i=>i.id!==id);
                delete next.notes[item.claveAsignada];delete next.archivedNotes[item.claveAsignada];
                InventoryAdditional.renumber(next);
                await photoDB.setItem('appData','mainState',InventoryData.clean(next));
                saveSnapshot();state=next;renderAdicionales();updateDatalists();updateActiveUserLocationSelect();filterAndRenderInventory();showToast('Adicional eliminado.','success');
            }catch(error){showToast('No se pudo eliminar. Se conserva el bien.','error');}
        });
    };

    window.showInvDetail = c => {
        const i = state.inventory.find(x=>x['CLAVE UNICA']===c); if(!i) return; document.getElementById('detail-view-clave').textContent = i['CLAVE UNICA']; document.getElementById('detail-view-descripcion').textContent = i.DESCRripcion || i.DESCRIPCION; document.getElementById('detail-view-marca').textContent = i.MARCA||'-'; document.getElementById('detail-view-modelo').textContent = i.MODELO||'-'; document.getElementById('detail-view-serie').textContent = i.SERIE||'-'; document.getElementById('detail-view-usuario').textContent = i['NOMBRE DE USUARIO']||'Sin asignar'; document.getElementById('detail-view-ubicacion-especifica').textContent = i.ubicacionEspecifica||'-';
        const nombreAreaOriginal = cleanAreaName(i.areaOriginal, NOMBRES_AREAS[i.areaOriginal] || ''); document.getElementById('detail-view-area').textContent = i.areaOriginal + (nombreAreaOriginal ? ` - ${nombreAreaOriginal}` : '');
        const invUser = state.resguardantes.find(u => u.name === i['NOMBRE DE USUARIO']);
        document.getElementById('detail-retag-flag').hidden = i.RE_ETIQUETADO !== 'SI';
        const areaStatus = InventoryAssetStatus.area(i, invUser);
        document.getElementById('detail-area-flag').hidden = !areaStatus.mismatch;
        document.getElementById('detail-area-warning').textContent = areaStatus.message;
        const locDetails = invUser && invUser.locationDetails && invUser.locationDetails[i.ubicacionEspecifica] ? invUser.locationDetails[i.ubicacionEspecifica] : {edificio:'N/A', piso:'N/A'}; document.getElementById('detail-view-infraestructura').innerHTML = `<i class="fa-solid fa-building mr-1"></i>${escapeHTML(locDetails.edificio)} | <i class="fa-solid fa-layer-group mr-1"></i>${escapeHTML(locDetails.piso)}`;
        if (i.UBICADO === 'SI' && i.ubicadoPor) { document.getElementById('detail-view-auditor').innerHTML = `<i class="fa-solid fa-user-check mr-1 text-green-600"></i> ${escapeHTML(InventoryTeam.label(i.ubicadoPor,i.ubicadoPorNumero))}<br><span class="text-sm">Auxiliado por: ${escapeHTML(InventoryTeam.label(i.auxiliadoPor,i.auxiliadoPorNumero))}</span>`; document.getElementById('detail-view-auditor-container').classList.remove('hidden'); } else document.getElementById('detail-view-auditor-container').classList.add('hidden');
        document.getElementById('detail-view-photo').classList.add('hidden'); document.getElementById('delete-active-photo-btn').classList.add('hidden'); document.getElementById('detail-view-no-photo').classList.remove('hidden');
        if(state.photos[c]) { photoDB.getItem('photos', `inventory-${c}`).then(b => { if(b) { document.getElementById('detail-view-photo').src=URL.createObjectURL(b); document.getElementById('detail-view-photo').classList.remove('hidden'); document.getElementById('delete-active-photo-btn').classList.remove('hidden'); document.getElementById('detail-view-no-photo').classList.add('hidden'); } }); }

        document.getElementById('detail-btn-ubicar').onclick = () => {
            if(!state.activeResguardante) return showToast('Activa un usuario', 'error');
            const proceed = () => { saveSnapshot(); i.UBICADO='SI'; i.RE_ETIQUETADO='NO'; i['NOMBRE DE USUARIO']=state.activeResguardante.name; i.ubicacionEspecifica = document.getElementById('active-user-location-select').value || state.activeResguardante.locationWithId; i.areaIncorrecta = i.areaOriginal !== state.activeResguardante.area; Object.assign(i, InventoryTeam.attribution(state)); addToSearchHistory(c); saveState(); renderDashboard(); filterAndRenderInventory(); updateActiveUserLocationSelect(); showToast('Asignado'); document.getElementById('item-detail-view-modal').classList.remove('show'); focusSearch(); };
            if(i.UBICADO === 'SI') { showConfirm('Bien ya ubicado', 'Este bien ya está asignado a otro usuario. ¿Deseas reasignarlo?', proceed); } else proceed();
        };
        document.getElementById('detail-btn-reetiquetar').onclick = () => {
            if(!state.activeResguardante) return showToast('Activa un usuario', 'error');
            const proceed = () => { saveSnapshot(); i.UBICADO='SI'; i.RE_ETIQUETADO='SI'; i['NOMBRE DE USUARIO']=state.activeResguardante.name; i.ubicacionEspecifica = document.getElementById('active-user-location-select').value || state.activeResguardante.locationWithId; i.areaIncorrecta = i.areaOriginal !== state.activeResguardante.area; Object.assign(i, InventoryTeam.attribution(state)); addToSearchHistory(c); saveState(); renderDashboard(); filterAndRenderInventory(); updateActiveUserLocationSelect(); showToast('Reetiquetado'); document.getElementById('item-detail-view-modal').classList.remove('show'); focusSearch(); };
            if(i.UBICADO === 'SI') { showConfirm('Bien ya ubicado', 'Este bien ya está asignado. ¿Deseas reetiquetarlo y reasignarlo?', proceed); } else proceed();
        };
        document.getElementById('detail-btn-desubicar').onclick = () => {
            showConfirm('Quitar asignación', '¿Seguro que deseas quitar este bien del resguardo actual?', () => { saveSnapshot(); i.UBICADO='NO'; i.RE_ETIQUETADO='NO'; i['NOMBRE DE USUARIO']=''; i.ubicacionEspecifica=''; Object.assign(i, InventoryTeam.clear()); saveState(); renderDashboard(); filterAndRenderInventory(); updateActiveUserLocationSelect(); showToast('Asignación retirada'); showInvDetail(c); });
        };
        document.getElementById('detail-btn-nota').onclick = () => showNoteModal(c); document.getElementById('detail-btn-foto').onclick = () => showPhoto('inventory', c); document.getElementById('item-detail-view-modal').classList.add('show');
    };

    function renderNoteSuggestions() {
        const input=document.getElementById('note-textarea'),box=document.getElementById('note-suggestions');
        const query=input.value.trim().toLocaleLowerCase('es');
        const suggestions=[...new Set([...Object.values(state.notes||{}),...Object.values(state.archivedNotes||{})])].filter(n=>typeof n==='string'&&n.trim()&&n!==input.value&&(!query||n.toLocaleLowerCase('es').includes(query))).slice(0,5);
        box.replaceChildren();if(!suggestions.length)return;
        const label=document.createElement('p');label.textContent='Sugerencias de notas guardadas';box.append(label);
        for(const note of suggestions){const button=document.createElement('button');button.type='button';button.dataset.action='note';button.className='note-suggestion';button.textContent=note;button.onclick=()=>{input.value=note;box.replaceChildren();input.focus();};box.append(button);}
    }
    document.getElementById('note-textarea').oninput=renderNoteSuggestions;
    window.showNoteModal = c => { document.getElementById('note-textarea').value = drafts.notes[c]??state.notes[c]??'';document.getElementById('note-draft-status').textContent=Object.hasOwn(drafts.notes,c)?'Borrador recuperado de este bien':''; document.getElementById('note-save-btn').dataset.c = c; renderNoteSuggestions();document.getElementById('notes-modal').classList.add('show'); setTimeout(() => document.getElementById('note-textarea').focus(), 100); };
    document.getElementById('note-save-btn').onclick = async e => {
        const button=e.currentTarget,targetC=button.dataset.c,noteText=document.getElementById('note-textarea').value;
        const keys=targetC==='BULK'?[...document.querySelectorAll('.inv-cb:checked')].map(cb=>cb.closest('tr').dataset.clave):[targetC];
        const notes={...state.notes};for(const key of keys){if(noteText.trim())notes[key]=noteText;else delete notes[key];}
        button.disabled=true;
        try {
            await photoDB.setItem('appData','mainState',InventoryData.clean({...state,notes}));
            delete drafts.notes[targetC];await persistDrafts();saveSnapshot('Guardar nota');state.notes=notes;filterAndRenderInventory();renderNotasTab();document.getElementById('notes-modal').classList.remove('show');
            showToast('Nota guardada en este equipo','success');focusSearch();
        } catch {showToast('No se pudo guardar la nota. El texto sigue aquí; vuelve a intentarlo.','error');}
        finally {button.disabled=false;}
    };

    let retagArchived=false, retagLimit=30, retagSaving=false;
    function renderRetagList(){
        const items=InventoryRetag.list(state,retagArchived,document.getElementById('retag-search').value);
        document.getElementById('retag-pending').setAttribute('aria-pressed',String(!retagArchived));
        document.getElementById('retag-done').setAttribute('aria-pressed',String(retagArchived));
        document.getElementById('retag-count').textContent=items.length+' bienes '+(retagArchived?'etiquetados':'pendientes de reetiquetar');
        const list=document.getElementById('retag-list');list.replaceChildren();
        for(const item of items.slice(0,retagLimit)){
            const row=document.createElement('article'),info=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('p'),actions=document.createElement('div'),open=document.createElement('button'),done=document.createElement('button');
            const key=item['CLAVE UNICA'];title.textContent=key+' · '+(item.DESCRIPCION||item.DESCRripcion||'Sin descripción');
            detail.textContent=(item['NOMBRE DE USUARIO']||'Sin asignar')+' · '+(item.ubicacionEspecifica||'Sin ubicación')+' · Serie: '+(item.SERIE||'Sin serie');
            info.append(title,detail);
            if(retagArchived){const stamp=document.createElement('p');stamp.textContent='Etiquetado: '+new Date(item.etiquetadoCompletado.at).toLocaleString('es-MX')+' · '+item.etiquetadoCompletado.por;info.append(stamp);}
            actions.className='retag-actions';open.type=done.type='button';open.dataset.action='info';open.textContent='Ver bien';open.onclick=()=>showInvDetail(key);
            done.dataset.action=retagArchived?'edit':'save';done.textContent=retagArchived?'Volver a pendientes':'Ya etiquetado · Archivar';done.disabled=retagSaving;
            const reopen=retagArchived;
            done.onclick=async()=>{
                if(retagSaving)return;retagSaving=true;renderRetagList();document.getElementById('loading-overlay').classList.add('show');
                try{
                    const next=reopen?InventoryRetag.reopen(state,key):InventoryRetag.complete(state,key,state.currentUser?.name);
                    await photoDB.setItem('appData','mainState',InventoryData.clean(next));
                    saveSnapshot(reopen?'Reabrir reetiquetado':'Confirmar etiqueta colocada');state=next;
                    filterAndRenderInventory();showToast(reopen?'Bien devuelto a pendientes':'Etiquetado y archivado','success');
                }catch(error){showToast(error.message,'error');}
                finally{retagSaving=false;document.getElementById('loading-overlay').classList.remove('show');renderRetagList();}
            };
            actions.append(open,done);row.append(info,actions);list.append(row);
        }
        if(!items.length){const empty=document.createElement('p');empty.textContent='No hay bienes que coincidan en esta lista.';list.append(empty);}
        document.getElementById('retag-more').hidden=items.length<=retagLimit;
    }
    document.getElementById('retag-pending').onclick=()=>{retagArchived=false;retagLimit=30;renderRetagList();};
    document.getElementById('retag-done').onclick=()=>{retagArchived=true;retagLimit=30;renderRetagList();};
    document.getElementById('retag-search').oninput=()=>{retagLimit=30;renderRetagList();};
    document.getElementById('retag-more').onclick=()=>{retagLimit+=30;renderRetagList();};

    window.viewArchivedNotes = false;
    window.currentNotesPage = 1;
    const notesPerPage = 6;
    const selectedNotes=new Set();

    document.getElementById('filter-notas-active').onclick = () => { window.viewArchivedNotes=false; selectedNotes.clear();window.currentNotesPage=1; updateNotasTabUI(); renderNotasTab(); };
    document.getElementById('filter-notas-archived').onclick = () => { window.viewArchivedNotes=true;selectedNotes.clear(); window.currentNotesPage=1; updateNotasTabUI(); renderNotasTab(); };

    function updateNotasTabUI() {
        document.getElementById('filter-notas-active').setAttribute('aria-pressed', String(!window.viewArchivedNotes));
        document.getElementById('filter-notas-archived').setAttribute('aria-pressed', String(!!window.viewArchivedNotes));
    }

    function filteredNoteKeys(){
        const query=document.querySelector('.tab-btn.active')?.dataset.tab==='notas'?document.getElementById('global-search-input').value:'';
        return InventorySearch.notes(state,window.viewArchivedNotes,query);
    }
    window.renderNotasTab = function() {
        renderRetagList();
        const container = document.getElementById('notas-list-container'); const pagContainer = document.getElementById('notas-pagination-container'); if(!state.archivedNotes) state.archivedNotes = {};
        const targetObj = window.viewArchivedNotes ? state.archivedNotes : state.notes; const keys = filteredNoteKeys();
        for(const key of selectedNotes)if(!keys.includes(key))selectedNotes.delete(key);
        document.getElementById('notes-selection-count').textContent=selectedNotes.size+' de '+keys.length+' coincidencias seleccionadas (incluye todas las páginas filtradas).';
        document.getElementById('notes-bulk-move').textContent=window.viewArchivedNotes?'Desarchivar seleccionadas':'Archivar seleccionadas';
        document.getElementById('notes-bulk-move').disabled=!selectedNotes.size;

        if(keys.length === 0) { container.innerHTML = `<p class="col-span-2 text-center text-gray-500 font-bold py-10">No hay notas ${window.viewArchivedNotes ? 'archivadas' : 'activas'} que coincidan con la búsqueda.</p>`; pagContainer.innerHTML = ''; return; }

        const totalPages = Math.ceil(keys.length / notesPerPage) || 1;
        if (window.currentNotesPage > totalPages) window.currentNotesPage = totalPages;
        const paginatedKeys = keys.slice((window.currentNotesPage - 1) * notesPerPage, window.currentNotesPage * notesPerPage);

        container.innerHTML = paginatedKeys.map(clave => {
            const item = state.inventory.find(i => i['CLAVE UNICA'] === clave); const desc = item ? (item.DESCRIPCION || item.DESCRripcion) : 'Bien No Encontrado'; const texto = targetObj[clave];
            return `<div class="bg-white p-4 rounded-xl border shadow-sm flex flex-col h-48"><div class="flex justify-between items-start mb-2 border-b pb-2 shrink-0"><div class="min-w-0 pr-2"><label><input type="checkbox" class="note-select" data-key="${escapeHTML(clave)}" aria-label="Seleccionar nota ${escapeHTML(clave)}" ${selectedNotes.has(clave)?'checked':''}> <span class="font-black text-indigo-900">${escapeHTML(clave)}</span></label><p class="text-xs font-bold text-gray-500 truncate" title="${escapeHTML(desc)}">${escapeHTML(desc)}</p></div><div class="flex gap-2 shrink-0"><button data-action="note" class="w-8 h-8 rounded-md" onclick="showNoteModal(${inlineValue(clave)})"><i class="fa-solid fa-pen"></i></button>${window.viewArchivedNotes ? `<button data-action="edit" class="w-8 h-8 rounded-md" onclick="toggleArchiveNote(${inlineValue(clave)}, false)"><i class="fa-solid fa-box-open"></i></button>` : `<button data-action="edit" class="w-8 h-8 rounded-md" onclick="toggleArchiveNote(${inlineValue(clave)}, true)"><i class="fa-solid fa-box-archive"></i></button>`}</div></div><div class="text-sm text-gray-700 font-medium overflow-y-auto whitespace-pre-wrap flex-grow">${escapeHTML(texto)}</div></div>`;
        }).join('');

        pagContainer.innerHTML = `<button data-action="neutral" class="px-5 py-2 font-bold rounded-lg ${window.currentNotesPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-100'}" onclick="if(window.currentNotesPage > 1) { window.currentNotesPage--; renderNotasTab(); }">Anterior</button><span class="font-bold text-gray-600">Página ${window.currentNotesPage} de ${totalPages}</span><button data-action="neutral" class="px-5 py-2 font-bold rounded-lg ${window.currentNotesPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-100'}" onclick="if(window.currentNotesPage < ${totalPages}) { window.currentNotesPage++; renderNotasTab(); }">Siguiente</button>`;
    }

    document.getElementById('notas-list-container').addEventListener('change',e=>{if(!e.target.matches('.note-select'))return;if(e.target.checked)selectedNotes.add(e.target.dataset.key);else selectedNotes.delete(e.target.dataset.key);renderNotasTab();});
    document.getElementById('notes-select-all').onclick=()=>{filteredNoteKeys().forEach(k=>selectedNotes.add(k));renderNotasTab();};
    document.getElementById('notes-clear-selection').onclick=()=>{selectedNotes.clear();renderNotasTab();};
    async function moveSelectedNotes(keys,toArchive){
        const button=document.getElementById('notes-bulk-move');button.disabled=true;document.getElementById('loading-overlay').classList.add('show');
        try{const result=InventoryOperations.moveNotes(state,keys,toArchive);if(!result.count)return;await photoDB.setItem('appData','mainState',InventoryData.clean(result.next));saveSnapshot(toArchive?'Archivar notas':'Desarchivar notas');state=result.next;selectedNotes.clear();renderNotasTab();filterAndRenderInventory();showToast(result.count+' notas '+(toArchive?'archivadas':'desarchivadas'),'success');}
        catch{showToast('No se pudo guardar. Las notas y la selección se conservan.','error');}
        finally{document.getElementById('loading-overlay').classList.remove('show');button.disabled=!selectedNotes.size;}
    }
    document.getElementById('notes-bulk-move').onclick=()=>{const keys=[...selectedNotes],archive=!window.viewArchivedNotes;if(!keys.length)return;showConfirm(archive?'Archivar notas':'Desarchivar notas',`Se moverán ${keys.length} notas seleccionadas, incluidas las de otras páginas. Si ya existe otra nota del mismo bien en destino, se conservarán ambos textos.`,()=>moveSelectedNotes(keys,archive));};
    window.toggleArchiveNote=(clave,toArchive)=>moveSelectedNotes([clave],toArchive);


    document.getElementById('print-notas-btn').onclick = async () => {
        let html = `<div class="print-header"><img src="logo.png"><div class="print-header-text"><div class="print-header-line">DIRECCIÓN GENERAL DE RECURSOS MATERIALES Y SERVICIOS</div><div class="print-header-line">DIRECCIÓN DE ALMACÉN E INVENTARIOS</div><div class="print-header-line print-area-line">REPORTE DE NOTAS ${window.viewArchivedNotes ? 'ARCHIVADAS' : 'ACTIVAS'}</div></div><div class="print-date-abs">Fecha: ${new Date().toLocaleDateString()}</div></div><table class="print-table"><colgroup><col style="width: 16%;"><col style="width: 24%;"><col style="width: 60%;"></colgroup><thead><tr><th>CLAVE</th><th>DESCRIPCIÓN</th><th>NOTA</th></tr></thead><tbody>`;
        const targetObj = window.viewArchivedNotes ? state.archivedNotes : state.notes;
        filteredNoteKeys().forEach(c => { html += `<tr><td style="white-space:nowrap">${escapeHTML(c)}</td><td>${escapeHTML((state.inventory.find(i=>i['CLAVE UNICA']===c)||{}).DESCRIPCION||'')}</td><td>${escapeHTML(targetObj[c])}</td></tr>`; });
        document.getElementById('print-area').innerHTML = html + `</tbody></table>`; try { await InventoryOutput.print(); } catch(error) { showToast(error.message, 'error'); } document.getElementById('print-area').innerHTML = '';
    };

    window.showPhoto = (type, id) => {
        document.getElementById('photo-input').dataset.t = type; document.getElementById('photo-input').dataset.i = id; document.getElementById('photo-view-container').classList.add('hidden'); document.getElementById('photo-upload-container').classList.add('hidden'); document.getElementById('camera-view-container').classList.add('hidden'); document.getElementById('camera-view-container').classList.remove('flex');
        let titleText = 'Fotografía';
        if(type === 'inventory') { const item = state.inventory.find(x => x['CLAVE UNICA'] === id); if(item) titleText = `${id} - ${(item.DESCRripcion || item.DESCRIPCION).substring(0, 40)}...`; }
        else if(type === 'additional') { const item = state.additionalItems.find(x => x.id === id); if(item) titleText = `Adicional: ${item.descripcion.substring(0, 40)}...`; }
        else if(type === 'user') { const u = state.resguardantes.find(x => x.id === id); if(u) titleText = `Foto: ${u.name}`; }
        else if(type === 'location') { const [uid, loc] = id.split('|'); const u = state.resguardantes.find(x => x.id === uid); if(u) titleText = `Ubicación: ${loc}`; }

        document.getElementById('photo-modal-title').textContent = titleText; document.getElementById('capture-photo-btn').disabled = false; document.getElementById('capture-photo-btn').innerHTML = '<i class="fa-solid fa-circle-camera mr-2"></i> Capturar Foto';
        let exists = type==='inventory' ? state.photos[id] : (type==='user' ? (state.userPhotos && state.userPhotos[id]) : (type==='location' ? state.locationPhotos && state.locationPhotos[id] : state.additionalPhotos[id]));
        if(exists) { photoDB.getItem('photos', `${type}-${id}`).then(b => { if(b) { document.getElementById('item-photo-img').src=URL.createObjectURL(b); document.getElementById('photo-view-container').classList.remove('hidden'); } }); } else { document.getElementById('camera-view-container').classList.remove('hidden'); document.getElementById('camera-view-container').classList.add('flex'); startCamera(); } document.getElementById('photo-modal').classList.add('show');
    };

    document.getElementById('capture-photo-btn').onclick = function() {
        const btn = this; if(btn.disabled) return; const video = document.getElementById('camera-stream'); if (!video.videoWidth) return showToast('Enfocando...', 'warning');
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Procesando...';
        const canvas = document.getElementById('photo-canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(blob => {
            const t = document.getElementById('photo-input').dataset.t; const id = document.getElementById('photo-input').dataset.i;
            if (t === 'inventory-bulk') { const ids = document.getElementById('photo-input').dataset.bulkIds.split(','); ids.forEach(bulkId => { state.photos[bulkId] = true; }); saveState(); stopCamera(); document.getElementById('photo-modal').classList.remove('show'); document.getElementById('select-all-checkbox').checked = false; filterAndRenderInventory(); Promise.all(ids.map(bulkId => photoDB.setItem('photos', `inventory-${bulkId}`, blob))).then(() => showToast('Foto guardada', 'success')).finally(() => { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-camera"></i>'; }); return; }
            if(t==='inventory') state.photos[id]=true;
            else if (t==='user') { if(!state.userPhotos) state.userPhotos = {}; state.userPhotos[id]=true; }
            else if (t==='location') { if(!state.locationPhotos) state.locationPhotos = {}; state.locationPhotos[id]=true; }
            else state.additionalPhotos[id]=true;

            saveState(); const imgUrl = URL.createObjectURL(blob); stopCamera(); document.getElementById('photo-modal').classList.remove('show');
            if (t === 'inventory' && document.getElementById('item-detail-view-modal').classList.contains('show')) { document.getElementById('detail-view-photo').src = imgUrl; document.getElementById('detail-view-photo').classList.remove('hidden'); document.getElementById('delete-active-photo-btn').classList.remove('hidden'); document.getElementById('detail-view-no-photo').classList.add('hidden'); } else if (t === 'additional' && document.getElementById('adicional-detail-view-modal').classList.contains('show')) { document.getElementById('ad-det-photo').src = imgUrl; document.getElementById('ad-det-photo').classList.remove('hidden'); document.getElementById('ad-delete-photo-btn').classList.remove('hidden'); document.getElementById('ad-det-no-photo').classList.add('hidden'); }

            if (t === 'location' && document.getElementById('user-detail-view-modal').classList.contains('show')) { const [uid] = id.split('|'); showUserDetail(uid); }

            filterAndRenderInventory(); renderAdicionales(); renderUsers(); photoDB.setItem('photos', `${escapeHTML(t)}-${id}`, blob).then(() => showToast('Foto guardada', 'success')).finally(() => { btn.disabled = false; });
        }, 'image/jpeg', 0.8);
    };

    document.getElementById('delete-photo-btn').onclick = () => { const t = document.getElementById('photo-input').dataset.t; const id = document.getElementById('photo-input').dataset.i; photoDB.db.transaction(['photos'], 'readwrite').objectStore('photos').delete(`${escapeHTML(t)}-${id}`); if(t==='inventory') delete state.photos[id]; else if (t==='user') delete state.userPhotos[id]; else if (t==='location') delete state.locationPhotos[id]; else delete state.additionalPhotos[id]; saveState(); showToast('Foto eliminada'); document.getElementById('photo-modal').classList.remove('show'); if (t === 'location' && document.getElementById('user-detail-view-modal').classList.contains('show')) { const [uid] = id.split('|'); showUserDetail(uid); } filterAndRenderInventory(); renderAdicionales(); renderUsers(); };
    function deletePhotoFromModal(type, id) { showConfirm('Eliminar Foto', '¿Eliminar y tomar nueva?', () => { photoDB.db.transaction(['photos'], 'readwrite').objectStore('photos').delete(`${type}-${id}`); if(type === 'inventory') { delete state.photos[id]; document.getElementById('detail-view-photo').classList.add('hidden'); document.getElementById('delete-active-photo-btn').classList.add('hidden'); document.getElementById('detail-view-no-photo').classList.remove('hidden'); } else if (type === 'additional') { delete state.additionalPhotos[id]; document.getElementById('ad-det-photo').classList.add('hidden'); document.getElementById('ad-delete-photo-btn').classList.add('hidden'); document.getElementById('ad-det-no-photo').classList.remove('hidden'); } saveState(); filterAndRenderInventory(); renderAdicionales(); setTimeout(() => showPhoto(type, id), 200); }); }
    document.getElementById('delete-active-photo-btn').onclick = () => { deletePhotoFromModal('inventory', document.getElementById('detail-view-clave').textContent); }; document.getElementById('ad-delete-photo-btn').onclick = () => { deletePhotoFromModal('additional', document.getElementById('ad-det-foto-btn').dataset.id); };

    let scanSession = 0, scannerStarting = false;
    async function closeCodeScanner() {
        ++scanSession;
        document.getElementById('qr-modal').classList.remove('show');
        if (html5QrCode?.isScanning) await html5QrCode.stop().catch(() => {});
    }
    async function startCodeScanner(onRead) {
        if (scannerStarting || html5QrCode?.isScanning) return;
        const session = ++scanSession;
        scannerStarting = true;
        document.getElementById('qr-modal').classList.add('show');
        if (!html5QrCode) html5QrCode = new Html5Qrcode('qr-reader');
        let detected = false;
        try {
            await InventoryCamera.use(camera=>html5QrCode.start(camera, { fps:10 }, async text => {
                if (detected || session !== scanSession) return;
                detected = true;
                await closeCodeScanner();
                onRead(text.trim());
                showToast('Código detectado', 'success');
            }, () => {}));
            if (session !== scanSession && html5QrCode.isScanning) await html5QrCode.stop();
        } catch {
            if (session === scanSession) { await closeCodeScanner(); showToast('No se pudo abrir la cámara. Revisa el permiso o escribe la serie.', 'error'); }
        } finally { scannerStarting = false; }
    }
    document.getElementById('nav-qr-scan-btn').onclick = () => startCodeScanner(applySearch);
    document.getElementById('qr-close-btn').onclick = closeCodeScanner;
    for (const prefix of ['ad','edit-ad']) document.getElementById(prefix+'-scan-serie').onclick = () => startCodeScanner(text => {
        const input=document.getElementById(prefix+'-serie');input.value=text;
        input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();
    });


    // --- PESTAÑA REPORTES OPTIMIZADA CON ÁLBUM ---
    document.getElementById('rep-type-select').onchange = (e) => {
        const toggleAdic = document.getElementById('rep-adic-toggle-container');
        const locContainer = document.getElementById('rep-location-container');
        const firmasContainer = document.getElementById('rep-firmas-container');
        const generateBtn = document.getElementById('rep-generate-btn');

        if (e.target.value === 'resguardo') toggleAdic.classList.remove('hidden'); else toggleAdic.classList.add('hidden');
        if (e.target.value === 'album') {
            locContainer.classList.remove('hidden');
            firmasContainer.classList.add('hidden');
            generateBtn.innerHTML = '<i class="fa-solid fa-eye mr-2"></i>Generar Vista Previa';
        } else {
            locContainer.classList.add('hidden');
            firmasContainer.classList.remove('hidden');
            generateBtn.textContent='Generar vista previa';
        }
        updateReportUsers();
    };

    function renderReportSearch() {
        const query=document.getElementById('global-search-input').value.trim();
        const panel=document.getElementById('report-search-panel'),list=document.getElementById('report-search-results');
        list.replaceChildren();panel.hidden=!query;if(!query)return;
        const types=[...document.getElementById('rep-type-select').options].map(o=>({value:o.value,label:o.textContent}));
        const results=InventorySearch.reports(state,types,query,NOMBRES_AREAS);
        document.getElementById('report-search-status').textContent=results.length ? results.length+' opciones. Elige una para abrir su vista previa.'+(results.length>40?' Se muestran las primeras 40; escribe más para precisar.':'') : 'No hay reportes que coincidan. Prueba con un tipo, área o resguardante.';
        for(const result of results.slice(0,40)){
            const button=document.createElement('button');button.type='button';button.dataset.action='info';button.textContent=result.label;
            button.onclick=()=>{
                document.getElementById('rep-type-select').value=result.type;
                document.getElementById('rep-type-select').dispatchEvent(new Event('change'));
                document.getElementById('rep-area-select').value=result.area;updateReportUsers();
                document.getElementById('rep-user-select').value=result.user;
                document.getElementById('rep-user-select').dispatchEvent(new Event('change'));
                document.getElementById('rep-generate-btn').click();
            };
            list.append(button);
        }
    }
    function populateReportFilters() {
        const areas = [...new Set([...state.inventory.map(i=>i.areaOriginal), ...state.resguardantes.map(u=>u.area)])].sort();
        document.getElementById('rep-area-select').innerHTML = '<option value="all">TODAS LAS ÁREAS (Múltiples Páginas)</option>' + areas.map(a => `<option value="${escapeHTML(a)}">Área ${escapeHTML(a)} - ${escapeHTML(cleanAreaName(a, NOMBRES_AREAS[a]||''))}</option>`).join('');
        updateReportUsers();
    }

    function updateReportUsers() {
        const selArea = document.getElementById('rep-area-select').value;
        let users = state.resguardantes;
        if(selArea !== 'all') users = users.filter(u => u.area === selArea);
        const areaOption = document.getElementById('rep-type-select').value === 'adicionales' && selArea !== 'all' ? '<option value="__area__">TODA EL ÁREA — UN SOLO REPORTE</option>' : '';
        document.getElementById('rep-user-select').innerHTML = '<option value="all">TODOS LOS USUARIOS ASIGNADOS (UN REPORTE POR USUARIO)</option>' + areaOption + users.map(u => `<option value="${escapeHTML(u.name)}">${escapeHTML(u.name)}</option>`).join('');

        const r = state.responsablesList.find(resp => resp.area === selArea) || {};
        document.getElementById('rep-area-name').value = selArea !== 'all' ? `ÁREA ${selArea} ${cleanAreaName(selArea, NOMBRES_AREAS[selArea]||'')}` : '';
        document.getElementById('rep-resp-name').value = r.name || '';
        document.getElementById('rep-resp-title').value = r.title || '';

        updateReportLocations();
    }

    function updateReportLocations() {
        document.getElementById('rep-firma-2').disabled = false;
        document.getElementById('rep-user-select').disabled=document.getElementById('rep-type-select').value==='pendientes';
        document.getElementById('rep-firma-2').parentElement.title='';
        const selUser = document.getElementById('rep-user-select').value;
        const selArea = document.getElementById('rep-area-select').value;
        let locs = new Set();
        let users = state.resguardantes;
        if(selArea !== 'all') users = users.filter(u => u.area === selArea);
        if(selUser !== 'all' && selUser !== '__area__') users = users.filter(u => u.name === selUser);
        users.forEach(u => (u.locations||[]).forEach(l => locs.add(l)));
        document.getElementById('rep-location-select').innerHTML = '<option value="all">TODAS LAS UBICACIONES</option>' + [...locs].sort().map(l => `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`).join('');
    }

    document.getElementById('rep-area-select').onchange = updateReportUsers;
    document.getElementById('rep-user-select').onchange = () => {
        const u = state.resguardantes.find(x => x.name === document.getElementById('rep-user-select').value);
        if(u) {
            const r = state.responsablesList.find(resp => resp.area === u.area) || {};
            document.getElementById('rep-area-name').value = `ÁREA ${u.area} ${cleanAreaName(u.area, NOMBRES_AREAS[u.area]||'')}`; document.getElementById('rep-resp-name').value = r.name || ''; document.getElementById('rep-resp-title').value = r.title || '';
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
