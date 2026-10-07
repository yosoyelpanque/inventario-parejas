(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const legal='Quedo enterado que los Bienes Muebles que se encuentran listados en el presente resguardo, están a partir de la firma bajo mi buen uso, custodia, vigilancia y conservación, en caso de daño, robo o extravio, se deberá notificar de inmediato a la Área Administrativa o Comisión para realizar el trámite administrativo correspondiente, por ningún motivo se podra cambiar o intercambiar los bienes sin previa solicitud y autorización de la Área Administrativa o Comisión.';
 function date(value){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);return m?`${m[3]}/${m[2]}/${m[1]}`:value;}
 function signature(name,title,label){return `<div class="official-signature"><div>${esc(name)}</div><div>${esc(title)}</div><div>${esc(label)}</div></div>`;}
 function page(report,options,continuation=false){
  const personal=report.type==='resguardo',pending=report.type==='pendientes';
  const title=personal?'RESGUARDO INDIVIDUAL DE BIENES':pending?'MOBILIARIO Y EQUIPO PENDIENTE DE UBICAR Y ACLARAR':'MOBILIARIO Y EQUIPO UBICADO DE MANERA ADICIONAL';
  const headers=personal?['No.','CLAVE UNICA','DESCRIPCION DEL BIEN','MARCA','MODELO','SERIE','ÁREA']:pending?['N°','CLAVE UNICA','DESCRIPCION','MARCA','MODELO','SERIE']:['No.','AREA DE PROCEDENCIA','CLAVE UNICA','DESCRIPCION','MARCA','MODELO','SERIE','USUARIO Y/O UBICACIÓN'];
  const widths=personal?[5,13,31,12,13,15,11]:pending?[5,18,24,11,18,24]:[4,13,12,17,8,13,15,18];
  const el=document.createElement('section');el.className=`official-page ${pending?'official-portrait':'official-landscape'} ${options.paper==='A4'?'official-a4':''} ${personal?'official-resguardo':''}`;
  el.innerHTML=`<header class="official-header"><img src="logo.png" alt="Cámara de Diputados"><div>DIRECCIÓN GENERAL DE RECURSOS MATERIALES Y SERVICIOS<br>DIRECCIÓN DE ALMACÉN E INVENTARIOS<br>SUBDIRECCIÓN DE INVENTARIOS${personal?'':'.'}</div></header>`+
  (!personal?`<p class="official-exercise">RESULTADO DEL EJERCICIO DE LA PRACTICA DEL INVENTARIO CORRESPONDIENTE AL ${esc(options.year)}</p>`:'')+`<h2>${title}</h2>`+
  (personal?`<div class="official-fields"><div><b>RESPONSABLE</b><span>${esc(report.responsible)}</span></div><div><b>NOMBRE DEL AREA</b><span>${esc(report.areaName)}</span></div></div><div class="official-fields official-four"><div><b>UBICACIÓN DE LOS BIENES:</b><span>${esc(report.location)}</span></div><div><b>CENTRO DE COSTO</b><span>${esc(report.area)}</span></div><div><b>USUARIO</b><span>${esc(report.user)}</span></div><div><b>FECHA:</b><span>${esc(date(options.date))}</span></div></div>`:`<p class="official-area">${esc(report.areaName)}</p>`)+
  `<table class="official-table"><colgroup>${widths.map(w=>`<col style="width:${w}%">`).join('')}</colgroup><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody></tbody></table>`+
  `<div class="official-bottom">${personal?`<p class="official-legal">${legal}</p>`:''}<div class="official-signatures">`+
  (options.signature1?signature(report.responsible,report.responsibleTitle,personal?'RESPONSABLE':''):'')+
  (options.signature2?(personal?signature(report.user,'','USUARIO · NOMBRE COMPLETO Y FIRMA'):signature(options.areaVerifier,'','Verificación Física por el Área')):'')+
  (!personal&&!pending&&options.signature3?signature(options.inventoryVerifier,'','Verificación Física por la Dirección de Almacén e Inventarios'):'')+
  `</div><footer><span class="official-total"></span><span class="official-page-number"></span><span>${personal?'':esc(date(options.date))}</span></footer></div>`;
  if(continuation)el.querySelectorAll('.official-header,.official-exercise,h2,.official-fields,.official-area').forEach(n=>n.remove());
  return el;
 }
 function values(item,report,index){const extra=item._type==='adic';const key=extra?item.claveAsignada:item['CLAVE UNICA'];const common=[key,item.descripcion||item.DESCRIPCION||item.DESCRripcion,item.marca||item.MARCA,item.modelo||item.MODELO,item.serie||item.SERIE];
  if(report.type==='resguardo')return [index,...common,item.areaOriginal||item.areaProcedencia||report.area];
  if(report.type==='pendientes')return [index,...common];
  let origin=item.areaProcedencia||'';if(item.posesion==='Arrendamiento')origin=(!item.numContrato||String(item.numContrato).replace(/\s/g,'').toUpperCase()==='LXVIDGAJ-070/2024')?'LXVIDGAJ- 070/2024':item.numContrato;else if(item.personal==='Si')origin='Bien personal';else if(item.posesion==='Propiedad del Grupo')origin=item.grupoParlamentario||'Grupo parlamentario';
  return [index,origin,...common,[item.usuario||report.user,item.ubicacionEspecifica].filter(Boolean).join(' / ')];
 }
 async function render(reports,options){
  const host=document.createElement('div');host.className='official-measure';document.body.append(host);
  const pages=[];
  try {
   for(const report of reports){
    let current;let count=0;let ending;
    const start=()=>{
     current=page(report,options,count>0);host.append(current);pages.push(current);
     const parts=[...current.querySelectorAll('.official-legal,.official-signatures')];
     if(!ending){ending=document.createElement('div');ending.className='official-ending';parts.forEach(n=>ending.append(n));}else parts.forEach(n=>n.remove());
     count++;
    };
    const overflow=()=>current.scrollHeight>current.clientHeight+1;
    start();
    for(let i=0;i<report.items.length;i++){
     const row=document.createElement('tr');row.innerHTML=values(report.items[i],report,i+1).map((v,index)=>`<td${index===(report.type==='adicionales'?2:1)&&/^CD-/i.test(String(v))?' class="inventory-key-nowrap"':''}>${esc(v)}</td>`).join('');
     let body=current.querySelector('tbody');body.append(row);
     if(body.children.length>1&&overflow()){row.remove();start();current.querySelector('tbody').append(row);}
     if(overflow())throw Error('Un bien contiene más texto del que cabe en una página. Revisa su descripción antes de imprimir.');
    }
    current.querySelector('.official-bottom').prepend(ending);
    if(overflow()){
     const carry=[],body=current.querySelector('tbody');
     while(overflow()&&body.children.length){const row=body.lastElementChild;row.remove();carry.unshift(row);}
     ending.remove();
     if(!body.children.length){if(count===1)throw Error('El texto del bien no deja espacio para el encabezado y las firmas. Revisa su descripción.');current.remove();pages.pop();}
     start();current.querySelector('tbody').append(...carry);current.querySelector('.official-bottom').prepend(ending);
     if(overflow())throw Error('El texto del último bien no deja espacio para las firmas. Revisa su descripción.');
    }
    const ownPages=pages.filter(p=>!p.dataset.numbered);
    ownPages.forEach((p,i)=>{p.querySelector('.official-page-number').textContent=`Página ${i+1} de ${ownPages.length}`;p.querySelector('.official-total').textContent=`Total de bienes: ${report.items.length}`;p.dataset.numbered='true';});
   }
   return pages.map(p=>p.outerHTML).join('');
  } finally {host.remove();}
 }
 root.InventoryOfficialReports={render,date};
})(globalThis);
