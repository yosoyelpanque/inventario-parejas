(function(){
  'use strict';
  function mount(){
    const dialog=document.createElement('dialog');dialog.id='photo-zoom-dialog';dialog.className='photo-zoom-dialog';
    const close=document.createElement('button');close.type='button';close.textContent='Cerrar ×';close.dataset.action='neutral';close.onclick=()=>dialog.close();
    const image=document.createElement('img');image.alt='Fotografía ampliada del bien';
    dialog.append(close,image);document.body.append(dialog);
    dialog.addEventListener('close',()=>image.removeAttribute('src'));
    for(const id of ['detail-view-photo','ad-det-photo','item-photo-img']){
      const thumbnail=document.getElementById(id);if(!thumbnail)continue;
      thumbnail.tabIndex=0;thumbnail.setAttribute('role','button');thumbnail.setAttribute('aria-label','Ampliar fotografía');thumbnail.title='Toca para ampliar la fotografía';
      function open(){if(!thumbnail.naturalWidth||!thumbnail.getClientRects().length)return;image.src=thumbnail.currentSrc||thumbnail.src;dialog.showModal();}
      thumbnail.addEventListener('click',open);thumbnail.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
