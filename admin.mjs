import teamConfig from '/lib/team-config.mjs';
import { within48Hours, outstanding, reminder } from '/lib/admin-alerts.mjs';
import { editableFields, validateFields, displayMatch } from '/lib/matches.mjs';
import { gatheringTime, routeKey } from '/lib/timing.mjs';
const $ = id => document.getElementById(id);
let alertsVersion=0;
let code = '', matches = [], active = null, dirty = false, busy = false;
const fields = ['isoDate','home','opponent','time','gathering','location','note'];
function status(message, success = false) { $('status').textContent = message; $('status').className = success ? 'success' : ''; }
let route = null, routeRequest = null, routeVersion = 0, timingTimer, ongoingCalculation;
function startCalculation(){ongoingCalculation=calculateRoute();return ongoingCalculation;}
function read() {
  const data=Object.fromEntries(fields.map(key => [key,key==='home'?$('home').value==='true':$(key).value]));
  data.gatheringMode=$('gatheringMode').value;
  if(route && routeKey(route.location)===routeKey(data.location)) Object.assign(data,{travelMinutes:route.travelMinutes,travelLocation:route.location});
  return data;
}
function cancelRoute(){clearTimeout(timingTimer);routeVersion++;routeRequest?.abort();routeRequest=null;}
function timingLocal(){
  const data=read(), auto=data.gatheringMode==='auto';
  $('gathering').readOnly=auto;
  if(!auto){$('timingStatus').textContent='Handmatige verzameltijd. Deze afspraak gaat voor.';$('retryTiming').hidden=true;return;}
  $('gathering').value='';$('retryTiming').hidden=true;
  if(!data.time){$('timingStatus').textContent='Vul de wedstrijdtijd in om de verzameltijd te berekenen.';return;}
  if(!data.home&&!data.location.trim()){$('timingStatus').textContent='Vul het adres in: straat, huisnummer en plaats.';return;}
  if(!data.home&&data.travelMinutes===undefined){$('timingStatus').textContent='Autorijtijd nog berekenen…';return;}
  try{$('gathering').value=gatheringTime(data.time,data.home,data.travelMinutes);$('timingStatus').textContent=data.home?'Automatisch: één uur voor de wedstrijd bij WFHC.':'Automatisch: '+data.travelMinutes+' min rijden → verzamelen '+$('gathering').value+' bij WFHC. Geschatte reistijd zonder files.';}
  catch(err){$('timingStatus').textContent=err.message;}
}
async function calculateRoute(){
  cancelRoute();timingLocal();const data=read();
  if(data.gatheringMode!=='auto'||data.home||!data.time||!data.location.trim()||data.travelMinutes!==undefined){preview();return;}
  const version=routeVersion;const controller=new AbortController();routeRequest=controller;
  $('timingStatus').textContent='Autorijtijd berekenen…';
  try{
    const res=await fetch('/api/admin/timing',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+code},body:JSON.stringify({location:data.location}),signal:controller.signal});
    const result=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(result.error||(res.status===429?'Wacht even en probeer opnieuw.':'Autorijtijd berekenen mislukt. Probeer opnieuw of kies handmatig.'));
    if(version!==routeVersion)return;
    route={location:data.location,travelMinutes:result.travelMinutes};timingLocal();preview();
  }catch(err){if(version===routeVersion&&err.name!=='AbortError'){$('gathering').value='';$('timingStatus').textContent=err.message;$('retryTiming').hidden=false;}}
  finally{if(version===routeVersion)routeRequest=null;}
}
function preview() {
  const data = read();
  try { const m = displayMatch(validateFields({...data,gatheringMode:'manual'})); $('preview').textContent = m.date+'\n'+m.teams+'\n'+m.meta; }
  catch { $('preview').textContent = 'Vul de datum en tegenstander in om de voorvertoning te zien.'; }
}
function discard() { return !dirty || confirm('Je hebt nog niet opgeslagen. Wil je deze invoer verlaten?'); }
function edit(match) {
  cancelRoute();route=null;
  active = match || { id:'match-'+crypto.randomUUID(), revision:0 };
  const data = match ? editableFields(match) : { isoDate:'',home:true,opponent:'',time:'',gathering:'',location:'',note:'' };
  for (const key of fields) $(key).value = String(data[key]);
  $('gatheringMode').value=match?.gatheringMode || (data.gathering||!teamConfig.routeOrigin?'manual':'auto');
  if(match?.gatheringMode==='auto'&&Number.isInteger(match.travelMinutes)&&routeKey(match.travelLocation||'')===routeKey(data.location))route={location:data.location,travelMinutes:match.travelMinutes};
  timingLocal();
  $('pick').value = match?.id || '';
  $('formTitle').textContent = match ? 'Wedstrijd wijzigen' : 'Nieuwe wedstrijd';
  $('editor').hidden = false; dirty = false; preview();
  if($('gatheringMode').value==='auto')startCalculation();
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
async function loadAlerts() {
  if(!code)return;
  const version=++alertsVersion;
  $('alertsList').replaceChildren();
  $('alertsStatus').textContent='Openstaande punten controleren…';
  const upcoming=matches.filter(m=>within48Hours(m));
  let failed=0, count=0;
  await Promise.all(upcoming.map(async raw=>{
    const m=displayMatch(raw);
    try {
      const results=await Promise.all(['overview','fruit'].map(async api=>{
        if(api==='fruit'&&!teamConfig.fruitEnabled)return {parentName:null};
        const res=await fetch('/api/'+api+'?match='+encodeURIComponent(m.id),{cache:'no-store',signal:AbortSignal.timeout(15000)});
        if(!res.ok)throw Error('Status niet beschikbaar');
        return res.json();
      }));
      if(version!==alertsVersion||!code)return;
      const issues=outstanding(m,...results);
      if(!issues.length)return;
      count++;
      const card=document.createElement('article'); card.className='alert-card';
      const title=document.createElement('h3');title.textContent=m.teams;
      const date=document.createElement('p');date.textContent=m.date+' · '+(m.time||'Tijd volgt');
      const list=document.createElement('ul');
      for(const issue of issues){const li=document.createElement('li');li.textContent=issue;list.append(li);}
      const button=document.createElement('button');button.type='button';button.textContent='Maak WhatsApp-reminder';
      button.onclick=()=>{
        button.hidden=true;
        const label=document.createElement('label');label.textContent='Jouw reminder';
        const message=document.createElement('textarea');message.rows=10;message.value=reminder(m,issues,location.origin);
        const link=document.createElement('a');link.className='whatsapp-link';link.textContent='Open WhatsApp met dit bericht';link.target='_blank';link.rel='noopener noreferrer';
        const update=()=>{link.href='https://wa.me/?text='+encodeURIComponent(message.value);};update();message.oninput=update;
        label.append(message);card.append(label,link);message.focus();
      };
      card.append(title,date,list,button);$('alertsList').append(card);
    } catch { if(version===alertsVersion)failed++; }
  }));
  if(version!==alertsVersion||!code)return;
  $('alertsStatus').textContent=failed?`Bij ${failed} wedstrijd(en) kon de status niet worden gecontroleerd. Probeer opnieuw. Andere waarschuwingen staan hieronder.`:count?'Alleen wedstrijden met openstaande punten staan hieronder.':'Geen openstaande punten bij wedstrijden binnen 48 uur.';
}
$('refreshAlerts').onclick=async()=>{
  $('refreshAlerts').disabled=true;
  try{await load();await loadAlerts();}catch(err){$('alertsList').replaceChildren();$('alertsStatus').textContent=err.message;}
  finally{$('refreshAlerts').disabled=false;}
};
setInterval(()=>{if(code&&!document.hidden)loadAlerts();},60000);
addEventListener('visibilitychange',()=>{if(code&&!document.hidden)loadAlerts();});
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
    await load(); code = candidate; loadAlerts(); $('code').value = ''; $('login').hidden = true; $('workspace').hidden = false; status('Beheer geopend. Kies een wedstrijd of voeg er een toe.',true);
  } catch (err) { status(err.message); } finally { $('unlock').disabled = false; }
};
$('newMatch').onclick = () => { if (discard()) { edit(null); status('Nieuwe wedstrijd.'); $('isoDate').focus(); } };
$('pick').onchange = () => {
  const selected = $('pick').value;
  if (!discard()) { $('pick').value = active?.id || ''; return; }
  const match = matches.find(m=>m.id===selected);
  if (match) { edit(match); status('Wijzig de gegevens en sla op.'); } else { $('editor').hidden=true; dirty=false; }
};
$('editor').oninput = e => {
  dirty=true;
  if(['time','home','location','gatheringMode'].includes(e.target.id)){
    cancelRoute();if(e.target.id==='location')route=null;
    timingLocal();
    if(e.target.id==='gatheringMode'&&$('gatheringMode').value==='manual')$('gathering').focus();
    else timingTimer=setTimeout(startCalculation,1200);
  }
  preview();
};
$('retryTiming').onclick=()=>{route=null;startCalculation();};
$('editor').onsubmit = async e => {
  e.preventDefault();
  if (busy) return;
  const pending=read();
  if(pending.gatheringMode==='auto'&&!pending.home&&pending.time&&pending.location.trim()&&pending.travelMinutes===undefined){
    controls(true);try{if(routeRequest)await ongoingCalculation;else await startCalculation();}finally{controls(false);}
  }
  let data; try { data=validateFields(read()); } catch (err) { status(err.message); return; }
  cancelRoute();
  controls(true); status('Wedstrijd opslaan…');
  try {
    const res = await fetch('/api/admin/matches', { method:'PUT',headers:{ 'content-type':'application/json', Authorization:'Bearer '+code },body:JSON.stringify({ id:active.id,revision:active.revision,data }) });
    const result = await res.json().catch(()=>({}));
    if (!res.ok) throw Error(result.error || (res.status===429?'Te veel verzoeken. Wacht een minuut.':'Opslaan mislukt. Je invoer blijft staan.'));
    active = { ...active,...data,revision:result.revision }; dirty=false;
    try { await load(); loadAlerts(); edit(matches.find(m=>m.id===active.id) || active); status('Opgeslagen. Ouders zien de wijziging na openen of vernieuwen van TeamRit.',true); }
    catch { status('Opgeslagen, maar opnieuw laden lukte niet. Probeer “Programma opnieuw laden”.',true); }
  } catch (err) { status(err.message); } finally { controls(false); }
};
$('reloadMatch').onclick = async () => {
  if (!discard()) return;
  const id=active?.id; controls(true);
  try { await load(); loadAlerts(); const m=matches.find(m=>m.id===id); if(m) edit(m); else { $('editor').hidden=true; dirty=false; } status('Actueel programma geladen.',true); }
  catch (err) { status(err.message); } finally { controls(false); }
};
$('logout').onclick = () => { if(discard()) { cancelRoute();route=null;code='';alertsVersion++;$('alertsList').replaceChildren();$('alertsStatus').textContent='';active=null;dirty=false;$('editor').reset();$('editor').hidden=true;$('workspace').hidden=true;$('login').hidden=false;status('Beheer afgesloten.'); } };
addEventListener('beforeunload',e=>{ if(dirty || busy){ e.preventDefault();e.returnValue=''; } });
