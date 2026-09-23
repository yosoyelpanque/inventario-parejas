(function(root){
 'use strict';
 const KEY='inventario-camera-preference';
 const automatic=()=>({facingMode:'environment'});
 function preference(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
 function message(text){const box=document.getElementById('camera-setting-status');if(box)box.textContent=text;}
 async function use(start){
  const saved=preference();
  if(!saved?.id)return start(automatic());
  try{return await start({deviceId:{exact:saved.id}});}
  catch(error){
   const detail=String(error?.name||'')+' '+String(error?.message||error);
   if(!/NotFound|Overconstrained|DevicesNotFound|ConstraintNotSatisfied|device.*not found/i.test(detail))throw error;
   message('La cámara elegida no está disponible. Se usará la selección automática; puedes cambiarla aquí.');
   return start(automatic());
  }
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const select=document.getElementById('camera-default'),refresh=document.getElementById('camera-refresh');
  if(!select)return;
  function render(devices){
   const saved=preference();select.replaceChildren(new Option('Automática (preferir trasera)',''));
   devices.filter(d=>d.kind==='videoinput'&&d.deviceId).forEach((d,i)=>select.add(new Option(d.label||'Cámara '+(i+1),d.deviceId)));
   if(saved?.id&&!Array.from(select.options).some(o=>o.value===saved.id))select.add(new Option((saved.label||'Cámara guardada')+' — no detectada',saved.id));
   select.value=saved?.id||'';
  }
  async function detect(requestPermission=false){
   if(!navigator.mediaDevices?.enumerateDevices){select.disabled=true;refresh.disabled=true;message('Este dispositivo no permite elegir cámaras desde la aplicación.');return;}
   refresh.disabled=true;let stream;
   try{
    if(requestPermission)stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    const devices=await navigator.mediaDevices.enumerateDevices();render(devices);
    message(devices.some(d=>d.kind==='videoinput'&&d.label)?'Elige una cámara: se guarda en este dispositivo y se aplica a fotos, QR y códigos de barras.':'Pulsa Detectar cámaras y permite el acceso para ver sus nombres.');
   }catch(error){message(error?.name==='NotAllowedError'?'Permite el acceso a la cámara en los ajustes del dispositivo y vuelve a intentar.':'No se pudieron detectar las cámaras. La elección guardada se conserva.');}
   finally{stream?.getTracks().forEach(t=>t.stop());refresh.disabled=false;}
  }
  select.onchange=()=>{
   const previous=preference();
   try{if(select.value)localStorage.setItem(KEY,JSON.stringify({id:select.value,label:select.selectedOptions[0].textContent}));else localStorage.removeItem(KEY);message('Cámara predeterminada guardada. Se usará en la próxima foto o lectura de código.');}
   catch{select.value=previous?.id||'';message('No se pudo guardar la elección. Vuelve a intentarlo.');}
  };
  refresh.onclick=()=>detect(true);navigator.mediaDevices?.addEventListener?.('devicechange',()=>detect());render([]);detect();
 });
 // Coordinates refer to the full camera image, including any object-fit crop.
 function focusPoint(video,clientX,clientY){
  const r=video.getBoundingClientRect(),w=video.videoWidth,h=video.videoHeight;
  if(!r.width||!r.height||!w||!h)return null;
  const style=getComputedStyle(video),fit=style.objectFit;
  const scale=fit==='cover'?Math.max(r.width/w,r.height/h):Math.min(r.width/w,r.height/h);
  const rw=fit==='fill'?r.width:w*scale,rh=fit==='fill'?r.height:h*scale;
  const x=(clientX-r.left-(r.width-rw)/2)/rw,y=(clientY-r.top-(r.height-rh)/2)/rh;
  const mirrored=/matrix\(\s*-/.test(style.transform||'')||/scaleX\(-1\)/.test(style.transform||'');
  return x<0||x>1||y<0||y>1?null:{x:mirrored?1-x:x,y};
 }
 async function focus(track,point){
  const modes=track?.getCapabilities?.().focusMode||[];
  if(!track?.applyConstraints||track.readyState==='ended')return 'unsupported';
  const mode=modes.includes('single-shot')?'single-shot':modes.includes('continuous')?'continuous':null;
  if(!mode)return 'unsupported';
  const canPoint=!!navigator.mediaDevices?.getSupportedConstraints?.().pointsOfInterest;
  const setting={focusMode:mode};
  if(canPoint)setting.pointsOfInterest=[point];
  // Preserve existing resolution and frame-rate constraints.
  const previous=track.getConstraints?.()||{};
  await track.applyConstraints({...previous,advanced:[...(previous.advanced||[]).map(c=>{
   const next={...c};delete next.focusMode;delete next.pointsOfInterest;return next;
  }),setting]});
  return canPoint?'point':'auto';
 }
 function attachFocus(video,status){
  if(!video||!status)return ()=>{};
  let disposed=false,busy=false,timer,marker;
  const track=video.srcObject?.getVideoTracks()[0];
  const modes=track?.getCapabilities?.().focusMode||[];
  const available=modes.some(m=>m==='single-shot'||m==='continuous');
  status.textContent=available?'Toca la imagen para solicitar el enfoque.':'Esta cámara no permite ajustar el enfoque al tocar.';
  const onClick=async event=>{
   if(disposed||busy||!available)return;
   const point=focusPoint(video,event.clientX,event.clientY);if(!point)return;
   busy=true;status.textContent='Solicitando enfoque…';
   try{
    const result=await focus(track,point);if(disposed)return;
    status.textContent=result==='point'?'Enfoque solicitado en el punto indicado.':result==='auto'?'Enfoque automático solicitado; esta cámara no permite elegir un punto.':'Esta cámara no permite ajustar el enfoque al tocar.';
    if(result==='point'){
     clearTimeout(timer);marker?.remove();marker=document.createElement('span');marker.className='camera-focus-marker';marker.setAttribute('aria-hidden','true');
     const r=video.getBoundingClientRect();marker.style.left=(event.clientX-r.left)+'px';marker.style.top=(event.clientY-r.top)+'px';
     video.parentElement.append(marker);timer=setTimeout(()=>marker?.remove(),1200);
    }
   }catch{if(!disposed)status.textContent='No se pudo ajustar el enfoque. Puedes volver a tocar o acercar y alejar la cámara.';}
   finally{busy=false;}
  };
  video.classList.toggle('camera-touch-focus',available);video.addEventListener('click',onClick);
  return ()=>{disposed=true;clearTimeout(timer);marker?.remove();video.removeEventListener('click',onClick);video.classList.remove('camera-touch-focus');status.textContent='';};
 }
 root.InventoryCamera={use,preference,focus,focusPoint,attachFocus};
})(globalThis);
