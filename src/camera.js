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
 root.InventoryCamera={use,preference};
})(globalThis);
