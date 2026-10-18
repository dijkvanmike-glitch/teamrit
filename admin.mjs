import { editableFields, validateFields, displayMatch } from '/lib/matches.mjs';
const $ = id => document.getElementById(id);
let code = '', matches = [], active = null, dirty = false, busy = false;
const fields = ['isoDate','home','opponent','time','gathering','location','note'];
function status(message, success = false) { $('status').textContent = message; $('status').className = success ? 'success' : ''; }
function read() { return Object.fromEntries(fields.map(key => [key,key==='home'?$('home').value==='true':$(key).value])); }
function preview() {
  const data = read();
  try { const m = displayMatch(validateFields(data)); $('preview').textContent = m.date+'\n'+m.teams+'\n'+m.meta; }
  catch { $('preview').textContent = 'Vul de datum en tegenstander in om de voorvertoning te zien.'; }
}
function discard() { return !dirty || confirm('Je hebt nog niet opgeslagen. Wil je deze invoer verlaten?'); }
function edit(match) {
  active = match || { id:'match-'+crypto.randomUUID(), revision:0 };
  const data = match ? editableFields(match) : { isoDate:'',home:true,opponent:'',time:'',gathering:'',location:'',note:'' };
  for (const key of fields) $(key).value = String(data[key]);
  $('pick').value = match?.id || '';
  $('formTitle').textContent = match ? 'Wedstrijd wijzigen' : 'Nieuwe wedstrijd';
  $('editor').hidden = false; dirty = false; preview();
}
async function load() {
  const res = await fetch('/api/matches', { cache:'no-store' });
  if (!res.ok) throw Error('Het actuele programma kon niet worden geladen. Probeer opnieuw.');
  matches = await res.json();
  $('pick').replaceChildren(new Option('Kies een wedstrijd',''));
  for (const m of matches.filter(m=>m.type!=='info')) {
    const d = displayMatch(m);
    $('pick').add(new Option(d.isoDate+' · '+d.teams,m.id));
  }
}
function controls(disabled) {
  busy = disabled;
  for (const el of document.querySelectorAll('#workspace button,#workspace input,#workspace select,#workspace textarea')) el.disabled = disabled;
  $('save').textContent = disabled ? 'Bezig…' : 'Wedstrijd opslaan';
}
$('loginForm').onsubmit = async e => {
  e.preventDefault(); $('unlock').disabled = true; status('Beheer openen…');
  const candidate = $('code').value;
  try {
    const res = await fetch('/api/admin/matches', { headers:{ Authorization:'Bearer '+candidate }, cache:'no-store' });
    if (!res.ok) { const data = await res.json().catch(()=>({})); throw Error(data.error || (res.status===429?'Te veel pogingen. Probeer over een minuut opnieuw.':'Beheer openen is niet gelukt.')); }
    await load(); code = candidate; $('code').value = ''; $('login').hidden = true; $('workspace').hidden = false; status('Beheer geopend. Kies een wedstrijd of voeg er een toe.',true);
  } catch (err) { status(err.message); } finally { $('unlock').disabled = false; }
};
$('newMatch').onclick = () => { if (discard()) { edit(null); status('Nieuwe wedstrijd.'); $('isoDate').focus(); } };
$('pick').onchange = () => {
  const selected = $('pick').value;
  if (!discard()) { $('pick').value = active?.id || ''; return; }
  const match = matches.find(m=>m.id===selected);
  if (match) { edit(match); status('Wijzig de gegevens en sla op.'); } else { $('editor').hidden=true; dirty=false; }
};
$('editor').oninput = () => { dirty=true; preview(); };
$('editor').onsubmit = async e => {
  e.preventDefault();
  if (busy) return;
  let data; try { data=validateFields(read()); } catch (err) { status(err.message); return; }
  controls(true); status('Wedstrijd opslaan…');
  try {
    const res = await fetch('/api/admin/matches', { method:'PUT',headers:{ 'content-type':'application/json', Authorization:'Bearer '+code },body:JSON.stringify({ id:active.id,revision:active.revision,data }) });
    const result = await res.json().catch(()=>({}));
    if (!res.ok) throw Error(result.error || (res.status===429?'Te veel verzoeken. Wacht een minuut.':'Opslaan mislukt. Je invoer blijft staan.'));
    active = { ...active,...data,revision:result.revision }; dirty=false;
    try { await load(); edit(matches.find(m=>m.id===active.id) || active); status('Opgeslagen. Ouders zien de wijziging na openen of vernieuwen van TeamRit.',true); }
    catch { status('Opgeslagen, maar opnieuw laden lukte niet. Probeer “Programma opnieuw laden”.',true); }
  } catch (err) { status(err.message); } finally { controls(false); }
};
$('reloadMatch').onclick = async () => {
  if (!discard()) return;
  const id=active?.id; controls(true);
  try { await load(); const m=matches.find(m=>m.id===id); if(m) edit(m); else { $('editor').hidden=true; dirty=false; } status('Actueel programma geladen.',true); }
  catch (err) { status(err.message); } finally { controls(false); }
};
$('logout').onclick = () => { if(discard()) { code='';active=null;dirty=false;$('editor').reset();$('editor').hidden=true;$('workspace').hidden=true;$('login').hidden=false;status('Beheer afgesloten.'); } };
addEventListener('beforeunload',e=>{ if(dirty || busy){ e.preventDefault();e.returnValue=''; } });
