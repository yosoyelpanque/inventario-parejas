(function(root) {
  'use strict';
  const SESSION = 'inventario-parejas-session';
  const DIRECTORY = 'inventario-parejas-directory';
  const person = value => {
    const employeeNumber = String(value?.employeeNumber || '').trim();
    const name = String(value?.name || '').trim().replace(/\s+/g, ' ');
    if (!/^\d{1,20}$/.test(employeeNumber) || name.length < 3 || name.length > 120) throw Error('Escribe un nombre completo y un número de empleado válido.');
    return {employeeNumber, name};
  };
  const retired = number => (root.InventoryRetiredPeople||[]).some(n=>String(n).replace(/^0+/, '')===String(number).replace(/^0+/, ''));
  function reconcileDirectory(entries,official=root.InventoryPeople||[]) {
    const merged=new Map();
    for(const p of [...validateDirectory(entries),...official])if(!retired(p.employeeNumber))merged.set(p.employeeNumber.replace(/^0+/, ''),p);
    return validateDirectory([...merged.values()]);
  }
  function pair(active, companion) {
    active = person(active); companion = companion == null ? null : person(companion);
    if(retired(active.employeeNumber)||retired(companion?.employeeNumber))throw Error('Un auditor seleccionado está dado de baja. Selecciona a una persona vigente.');
    if (companion && active.employeeNumber.replace(/^0+/, '') === companion.employeeNumber.replace(/^0+/, '')) throw Error('Elige a dos personas distintas.');
    return {active, companion};
  }
  const swap = team => team.companion ? pair(team.companion, team.active) : pair(team.active,null);
  const attribution = state => ({
    ubicadoPor: state.currentUser?.name || '',
    ubicadoPorNumero: state.currentUser?.employeeNumber || '',
    auxiliadoPor: state.companion?.name || '',
    auxiliadoPorNumero: state.companion?.employeeNumber || ''
  });
  const clear = () => ({ubicadoPor:'', ubicadoPorNumero:'', auxiliadoPor:'', auxiliadoPorNumero:''});
  const savedAttribution = item => Object.fromEntries(Object.keys(clear()).map(key => [key, item[key] || '']));
  const label = name => name || 'Sin registro';
  const excel = item => ({'Ubicado Por':item.ubicadoPor || '', 'Auxiliado Por':item.auxiliadoPor || ''});
  function remember(team) { localStorage.setItem(SESSION, JSON.stringify(pair(team.active, team.companion))); }
  function forget() { sessionStorage.removeItem(SESSION); localStorage.removeItem(SESSION); }
  function validateDirectory(entries) {
    if (!Array.isArray(entries)) throw Error('El catálogo de auditores no es válido.');
    const seen = new Set();
    return entries.map(entry => {
      const p = person(entry), key = p.employeeNumber.replace(/^0+/, '') || '0';
      if (seen.has(key)) throw Error('El catálogo contiene números de empleado duplicados.');
      seen.add(key); return p;
    });
  }
  async function exportDirectory() {
    return reconcileDirectory(await root.InventoryStorage.getItem('appData','auditorDirectory') || root.InventoryPeople);
  }
  async function mount(open) {
    const $ = id => document.getElementById(id), status = $('team-status');
    let directory = [...root.InventoryPeople];
    try {
      const saved = await root.InventoryStorage.getItem('appData','auditorDirectory');
      const custom = saved || JSON.parse(localStorage.getItem(DIRECTORY) || '[]');
      if (saved) directory = [];
      for (const entry of custom) { const p = person(entry); if (!directory.some(x => x.employeeNumber === p.employeeNumber)) directory.push(p); }
      directory = reconcileDirectory(directory);
      if (JSON.stringify(saved)!==JSON.stringify(directory)) await root.InventoryStorage.setItem('appData','auditorDirectory',directory);
    } catch { status.textContent = 'No se pudo recuperar el directorio local. Puedes registrar de nuevo a las personas.'; }
    const confirmed = {active:null, companion:null};
    const normalize = value => value.trim().replace(/^0+/, '') || '0';
    function lookup(role) {
      const value = $('team-'+role).value.trim();
      return /^\d{1,20}$/.test(value) ? directory.find(p => normalize(p.employeeNumber) === normalize(value)) : null;
    }
    function render() {
      $('team-companion').disabled = !confirmed.active;
      for (const role of ['active','companion']) {
        const candidate = lookup(role), name = $('team-'+role+'-name'), button = $('team-'+role+'-accept');
        const duplicate = role === 'companion' && candidate && confirmed.active && normalize(candidate.employeeNumber) === normalize(confirmed.active.employeeNumber);
        name.textContent = duplicate ? 'El compañero debe ser otra persona.' : candidate ? candidate.name : $('team-'+role).value ? 'Número de empleado no encontrado.' : '';
        button.hidden = !candidate || !!duplicate || (role === 'companion' && !confirmed.active);
        button.disabled = !!confirmed[role];
        button.textContent = confirmed[role] ? 'Aceptado ✓' : 'Aceptar';
      }
      $('team-start').disabled = !confirmed.active || (!!$('team-companion').value.trim() && !confirmed.companion);
    }
    function invalidate(role) {
      confirmed[role] = null;
      if (role === 'active') confirmed.companion = null;
      render();
    }
    function accept(role) {
      const candidate = lookup(role);
      if (!candidate || (role === 'companion' && !confirmed.active)) return;
      try {
        if (role === 'companion') pair(confirmed.active,candidate);
        confirmed[role] = candidate; status.textContent = ''; render();
        $(role === 'active' ? 'team-companion' : 'team-start').focus();
      } catch(error) { status.textContent = error.message; }
    }
    for (const role of ['active','companion']) {
      $('team-'+role).oninput = () => invalidate(role);
      $('team-'+role+'-accept').onclick = () => accept(role);
      $('team-'+role).onkeydown = event => { if(event.key === 'Enter') { event.preventDefault(); accept(role); } };
    }
    root.InventoryTeam.edit = team => {
      const current = pair(team.active,team.companion);
      for (const role of ['active','companion']) {
        confirmed[role]=current[role];$('team-'+role).value=current[role]?.employeeNumber||'';
      }
      status.textContent='';render();
    };
    $('team-solo').onclick=()=>{$('team-companion').value='';invalidate('companion');};
    $('register-person').onsubmit = async event => {
      event.preventDefault(); const form = event.target, button = form.querySelector('button'); button.disabled = true;
      try {
        const entry = person({name:$('person-name').value, employeeNumber:$('person-number').value});
        if(retired(entry.employeeNumber))throw Error('Ese número de empleado está dado de baja.');
        if (directory.some(p => normalize(p.employeeNumber) === normalize(entry.employeeNumber))) throw Error('Ese número de empleado ya está registrado. Escríbelo para confirmar el nombre.');
        const next = [...directory,entry];
        await root.InventoryStorage.setItem('appData','auditorDirectory',next);
        directory = next;
        const role = $('register-target').value;
        $('team-'+role).value = entry.employeeNumber;
        invalidate(role); form.reset(); $('register-details').open = false;
        status.textContent = 'Persona registrada. Confirma su nombre con Aceptar.';
      } catch(error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    };
    $('team-form').onsubmit = async event => {
      event.preventDefault(); $('team-start').disabled = true;
      try {
        if (!confirmed.active || ($('team-companion').value.trim() && !confirmed.companion)) throw Error('Confirma el nombre con Aceptar o deja vacío el compañero para trabajar solo.');
        const team = pair(confirmed.active,$('team-companion').value.trim()?confirmed.companion:null);
        await open(team); remember(team);
      } catch(error) { status.textContent = 'No se pudo iniciar: ' + error.message; }
      finally { render(); }
    };
    render();
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION) || sessionStorage.getItem(SESSION) || 'null');
      if (saved) { const team=pair(saved.active,saved.companion); await open(team); remember(team); }
    } catch(error) { forget(); status.textContent = 'Selecciona la pareja para continuar. ' + error.message; }
  }
  root.InventoryTeam = {person, pair, swap, attribution, clear, savedAttribution, label, excel, remember, forget, mount, validateDirectory, exportDirectory, reconcileDirectory};
  if (typeof module !== 'undefined') module.exports = root.InventoryTeam;
})(globalThis);
