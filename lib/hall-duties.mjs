import { escapeHtml } from './matches.mjs';
export const homeDutyBlocks = new Set(['match-db7c6d63-8bec-42b2-a1a6-01805adf1715','match-08152765-277a-415b-9d53-f69406fe9388']);
export const awayDutyBlocks = new Set(['match-c90e9736-79f2-4349-8b05-f8b894ef813a','match-2a247f9c-2087-473b-84d8-8891121fb1a9','match-00849cc8-26fc-4ef9-a0a4-f8b7ddcb8038']);
export const dutyBlocks = new Set([...homeDutyBlocks,...awayDutyBlocks]);
export function rolesForBlock(id){return homeDutyBlocks.has(id)?Object.entries(dutyRoles):awayDutyBlocks.has(id)?[['referee',dutyRoles.referee]]:[]}
export function dutyTitle(id){return homeDutyBlocks.has(id)?'Zaaldienst & scheidsrechters':'Scheidsrechter'}
export function dutyIntro(id){return (homeDutyBlocks.has(id)?'Voor dit zaalblok zoeken we 2 ouders voor zaaldienst en 1 scheidsrechter.':'Ook voor dit uitzaalblok leveren we 1 scheidsrechter. Zaaldienst wordt door de thuisorganisatie geregeld.')+' Je meldt je aan voor het hele blok, dus voor beide wedstrijden.'}
export const dutyRoles = {hall:'Zaaldienst',referee:'Scheidsrechter'};
export const dutyCapacity = {hall:2,referee:1};
export function validDutyRows(rows, matchId) {
  if(awayDutyBlocks.has(matchId))return Array.isArray(rows)&&rows.length===1&&rows[0].match_id===matchId&&rows[0].role==='referee'&&rows[0].slot_no===1&&Number.isInteger(rows[0].revision)&&rows[0].revision>=0&&(rows[0].parent_name===null||typeof rows[0].parent_name==='string');
  if(!homeDutyBlocks.has(matchId))return false;
  return Array.isArray(rows) && rows.length === 4 && new Set(rows.map(r=>r.role+':'+r.slot_no)).size===4 && rows.every(r=>r.match_id===matchId && Object.hasOwn(dutyRoles,r.role) && [1,2].includes(r.slot_no) && Number.isInteger(r.revision) && r.revision>=0 && (r.parent_name===null || typeof r.parent_name==='string'));
}
export function dutySummary(rows) {
  return rolesForBlock(rows[0]?.match_id).map(([role,label])=>`${label}: ${rows.filter(r=>r.role===role&&r.parent_name).length}/${dutyCapacity[role]}`).join(' · ');
}
export function dutySlotsHtml(rows,name='') {
  return rolesForBlock(rows[0]?.match_id).map(([role,label])=>'<div class="card"><h3>'+label+' · '+rows.filter(r=>r.role===role&&r.parent_name).length+'/'+dutyCapacity[role]+'</h3>'+rows.filter(r=>r.role===role&&(r.slot_no<=dutyCapacity[role]||r.parent_name)).sort((a,b)=>a.slot_no-b.slot_no).map(r=>{
    const mine=!!name&&r.parent_name===name, duplicate=rows.some(x=>x.role===role&&x.parent_name===name);
    return '<div class="dutySlot"><div><strong>Plek '+r.slot_no+'</strong><div>'+escapeHtml(r.parent_name||'Nog vrij')+'</div></div>'+((mine||(!r.parent_name&&name&&!duplicate&&rows.filter(x=>x.role===role&&x.parent_name).length<dutyCapacity[role]&&r.slot_no<=dutyCapacity[role]))?'<button class="secondary" data-duty-role="'+role+'" data-duty-slot="'+r.slot_no+'" data-duty-revision="'+r.revision+'" data-duty-claim="'+!mine+'">'+(mine?'Afmelden':'Inschrijven')+'</button>':'')+'</div>';
  }).join('')+'</div>').join('');
}
