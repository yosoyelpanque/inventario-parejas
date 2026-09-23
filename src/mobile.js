/* Compact controls apply only to small screens; desktop contents remain expanded. */
document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id),mobile=matchMedia('(max-width:600px)');
 function collapsible(container,heading,children,key,collapsed=false){
  const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
  details.id=key+'-panel';details.className='mobile-collapsible';body.id=key+'-content';body.className='mobile-collapse-content';
  children.forEach(node=>body.append(node));container.prepend(details);summary.append(heading);details.append(summary,body);
  const render=()=>{details.open=!mobile.matches||!collapsed;};
  summary.addEventListener('click',event=>{event.preventDefault();if(mobile.matches){collapsed=details.open;render();}});
  mobile.addEventListener('change',render);render();
 }
 const users=$('user-name').closest('.space-y-4'),userPanel=users.parentElement;
 collapsible(userPanel,userPanel.querySelector('h3'),[users],'register-user');
 const form=$('adicional-form'),panel=form.parentElement;
 collapsible(panel,panel.querySelector('h3'),[...panel.children].filter(n=>n.tagName!=='H3'),'register-additional');
 const filters=document.querySelector('.inventory-filters'),controls=filters.parentElement,heading=controls.querySelector('h3');
 // Insert before action buttons, preserving their visibility when filters are collapsed.
 collapsible(controls,heading,[controls.querySelector('.inventory-history'),filters],'inventory-filters',true);
 controls.querySelector('.inventory-heading').remove();
 const actions=$('nav-inventory-actions'),actionMarker=document.createComment('inventory-actions-position');actions.before(actionMarker);
 const top=$('backup-status'),version=$('device-status'),topMarker=document.createComment('status-position');top.before(topMarker);
 const footer=document.createElement('footer');footer.id='mobile-status-footer';$('app-container').after(footer);
 const rfid=$('rfid-panel'),recovery=$('recovery-points').closest('section'),marker=document.createComment('settings-position');rfid.before(marker);
 function position(){if(mobile.matches){document.querySelector('.sticky-header').append(actions);footer.append(top,version);$('settings-tab').append(rfid,recovery);}else{actionMarker.after(actions);topMarker.after(top,version);marker.after(rfid,recovery);}}
 mobile.addEventListener('change',position);position();
});
