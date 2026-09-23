window.addEventListener('DOMContentLoaded', () => {
  const label = document.getElementById('device-status');
  let saving = 'Almacenamiento local';
  const render = () => { label.textContent = 'v1.4.4 · ' + (navigator.onLine ? 'Con conexión' : 'Sin conexión') + ' · ' + saving; };
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  window.addEventListener('inventory-save', e => { saving=e.detail; render(); });
  render();
  if (!window.InventoryOutput?.native && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').then(registration=>{
    let applying=false;
    const offer=()=>{
      if(!registration.waiting||document.getElementById('app-update-button'))return;
      const button=document.createElement('button');button.id='app-update-button';
      button.textContent='Nueva versión disponible · Actualizar';
      button.style.cssText='display:block;margin:8px auto;padding:10px 16px;background:#03564B;color:white;border-radius:10px;font-weight:bold';
      label.after(button);
      button.onclick=async()=>{
        const form=document.getElementById('adicional-form');
        const editing=document.getElementById('edit-adicional-modal')?.classList.contains('show');
        if(document.getElementById('location-edit-modal')?.classList.contains('show')||document.getElementById('edit-user-modal')?.classList.contains('show')||window.InventoryRFIDBusy||!document.getElementById('rfid-preview')?.hidden||document.getElementById('notes-modal')?.classList.contains('show')||document.querySelector('dialog.import-review[open]')||editing||[...(form?.querySelectorAll('input[type="text"]')||[])].some(input=>input.value.trim())){
          button.textContent='Guarda o vacía el formulario antes de actualizar';return;
        }
        try{await window.InventoryStorage?.flush();applying=true;registration.waiting?.postMessage({type:'ACTIVATE_UPDATE'});}
        catch{button.textContent='Hay un error de guardado. Conserva la app abierta.';}
      };
    };
    offer();registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',offer));
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applying)location.reload();});
    registration.update().catch(()=>{});
  }).catch(() => {
    saving = 'No se pudo preparar la aplicación para abrir sin conexión'; render();
  });
});
