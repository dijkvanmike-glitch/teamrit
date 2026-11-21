import { dutyBlocks, dutySlotsHtml, dutySummary, validDutyRows } from './lib/hall-duties.mjs';
let active=null,rows=[],generation=0,busy=false;
const el=id=>document.getElementById(id);
export function buttonHtml(m){return dutyBlocks.has(m.id)?'<div class="dashSub" id="duty-summary-'+m.id+'" style="margin-top:16px">Zaaldiensten laden…</div><button class="secondary" style="margin-top:10px" onclick="trOpenDuties(\''+m.id+'\')">Zaaldienst &amp; scheidsrechters</button>':''}
export async function loadBadge(id){
  if(!dutyBlocks.has(id))return;
  const target=el('duty-summary-'+id);if(!target)return;
  try{const data=await read(id);if(target.isConnected)target.textContent=dutySummary(data)}catch{if(target.isConnected)target.textContent='Inschrijvingen niet beschikbaar. Open om opnieuw te proberen.'}
}
async function read(id){const res=await fetch('/api/hall-duties?match='+encodeURIComponent(id),{cache:'no-store'});if(!res.ok)throw Error();const data=await res.json();if(!validDutyRows(data,id))throw Error();return data}
function render(){el('dutySlots').innerHTML=dutySlotsHtml(rows,el('dutyName').value)}
async function load(){const id=active,version=++generation;el('dutySlots').innerHTML='';el('dutyStatus').textContent='Inschrijvingen laden…';el('dutyRetry').hidden=true;
 try{const data=await read(id);if(version!==generation)return;rows=data;render();el('dutyStatus').textContent='Kies je naam om je in te schrijven. Je inschrijving geldt voor het hele zaalblok.'}
 catch{if(version!==generation)return;el('dutyStatus').textContent='Laden is niet gelukt. Probeer opnieuw.';el('dutyRetry').hidden=false}
}
export function open(m,roster,go,contextHtml){
 if(!dutyBlocks.has(m.id))return;active=m.id;rows=[];busy=false;
 el('dutyContext').innerHTML=contextHtml;
 el('dutyName').replaceChildren(new Option('Kies je naam',''),...roster.map(p=>new Option(p.name,p.name)));el('dutyName').disabled=false;
 try{const name=localStorage.getItem('lastDutyParent')||localStorage.getItem('lastSelectedParent');if(roster.some(p=>p.name===name))el('dutyName').value=name}catch{}
 el('dutyName').onchange=()=>{try{localStorage.setItem('lastDutyParent',el('dutyName').value)}catch{}render()};
 el('dutyRetry').onclick=load;
 el('dutySlots').onclick=async event=>{
  const btn=event.target.closest('button[data-duty-role]');if(!btn||busy)return;
  const name=el('dutyName').value;if(!name)return;
  const id=active,version=generation;busy=true;el('dutyName').disabled=true;el('dutySlots').querySelectorAll('button').forEach(b=>b.disabled=true);
  el('dutyStatus').textContent='Even opslaan…';let message;
  try{const res=await fetch('/api/hall-duties',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({matchId:id,name,role:btn.dataset.dutyRole,slot:Number(btn.dataset.dutySlot),revision:Number(btn.dataset.dutyRevision),claim:btn.dataset.dutyClaim==='true'})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Opslaan is niet gelukt.');message=btn.dataset.dutyClaim==='true'?'Je bent ingeschreven.':'Je bent afgemeld.';
  }catch(error){message=error.message||'Opslaan is niet gelukt. Probeer opnieuw.'}
  finally{if(version===generation){busy=false;el('dutyName').disabled=false;await load();if(active===id&&generation===version+1){el('dutyStatus').textContent=message;loadBadge(id)}}}
 };
 go('duties');load();
}
