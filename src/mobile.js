/* Compact controls apply only to small screens; desktop contents remain expanded. */
document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id),mobile=matchMedia('(max-width:600px)');
 function collapsible(container,heading,children,key,collapsed=false){
  const body=document.createElement('div');body.id=key+'-content';body.className='mobile-collapse-content';
  children.forEach(node=>body.append(node));container.append(body);
  const button=document.createElement('button');button.type='button';button.className='mobile-collapse-toggle';button.dataset.action='neutral';button.setAttribute('aria-controls',body.id);
  const render=()=>{const shut=mobile.matches&&collapsed;body.hidden=shut;button.setAttribute('aria-expanded',String(!shut));button.setAttribute('aria-label',(shut?'Expandir ':'Contraer ')+heading.textContent.trim());button.innerHTML='<span class="collapse-triangle" aria-hidden="true"></span>';};
  heading.classList.add('mobile-collapse-heading');heading.append(button);button.onclick=()=>{collapsed=!collapsed;render();};mobile.addEventListener('change',render);render();
 }
 const users=$('user-name').closest('.space-y-4'),userPanel=users.parentElement;
 collapsible(userPanel,userPanel.querySelector('h3'),[users],'register-user');
 const form=$('adicional-form'),panel=form.parentElement;
 collapsible(panel,panel.querySelector('h3'),[...panel.children].filter(n=>n.tagName!=='H3'),'register-additional');
 const filters=document.querySelector('.inventory-filters'),controls=filters.parentElement,heading=controls.querySelector('h3');
 // Insert before action buttons, preserving their visibility when filters are collapsed.
 collapsible(controls,heading,[controls.querySelector('.inventory-history'),filters],'inventory-filters',true);
 controls.insertBefore($('inventory-filters-content'),$('nav-inventory-actions'));
 const actions=$('nav-inventory-actions'),actionMarker=document.createComment('inventory-actions-position');actions.before(actionMarker);
 const top=$('backup-status'),version=$('device-status'),topMarker=document.createComment('status-position');top.before(topMarker);
 const footer=document.createElement('footer');footer.id='mobile-status-footer';$('app-container').after(footer);
 const rfid=$('rfid-panel'),recovery=$('recovery-points').closest('section'),marker=document.createComment('settings-position');rfid.before(marker);
 function position(){if(mobile.matches){document.querySelector('.sticky-header').append(actions);footer.append(top,version);$('settings-tab').append(rfid,recovery);}else{actionMarker.after(actions);topMarker.after(top,version);marker.after(rfid,recovery);}}
 mobile.addEventListener('change',position);position();
});
