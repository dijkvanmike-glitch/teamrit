import type { Config } from '@netlify/functions';
import { dutyBlocks, dutyRoles, dutyCapacity, rolesForBlock, validDutyRows } from '../../lib/hall-duties.mjs';
export default async (req: Request) => {
  const headers={'content-type':'application/json','cache-control':'no-store'};
  const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(!['GET','POST'].includes(req.method))return reply({error:'Methode niet toegestaan'},405);
  if(req.method==='POST'&&req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Ongeldige herkomst'},403);
  const base=Netlify.env.get('SUPABASE_URL'),key=Netlify.env.get('SUPABASE_ANON_KEY');
  if(!base||!key)return reply({error:'Inschrijven is tijdelijk niet beschikbaar.'},503);
  const storageHeaders={apikey:key,Authorization:`Bearer ${key}`,'content-type':'application/json'};
  try {
    if(req.method==='GET'){
      const match=new URL(req.url).searchParams.get('match');
      if(!dutyBlocks.has(match))return reply({error:'Geen zaaldiensten voor dit blok.'},400);
      const res=await fetch(`${base}/rest/v1/hall_duty_slots?match_id=eq.${encodeURIComponent(match)}&select=match_id,role,slot_no,parent_name,revision&order=role,slot_no`,{headers:storageHeaders,signal:AbortSignal.timeout(8000)});
      if(!res.ok)throw Error();const rows=await res.json();if(!validDutyRows(rows,match))throw Error();return reply(rows);
    }
    let body;try{body=await req.json()}catch{return reply({error:'Ongeldige aanvraag'},400)}
    const {matchId,role,slot,name,revision,claim}=body||{};
    if(!dutyBlocks.has(matchId)||!Object.hasOwn(dutyRoles,role)||![1,2].includes(slot)||typeof name!=='string'||!name.trim()||name.length>120||!Number.isInteger(revision)||revision<0||typeof claim!=='boolean')return reply({error:'Controleer je naam en de gekozen plek.'},400);
    if(!rolesForBlock(matchId).some(([key])=>key===role))return reply({error:'Bij dit uitzaalblok kun je alleen voor scheidsrechter inschrijven.'},400);
    if(claim&&slot>dutyCapacity[role])return reply({error:'Voor dit blok is één scheidsrechter nodig. Deze extra plek is gesloten.'},400);
    const res=await fetch(`${base}/rest/v1/rpc/set_hall_duty`,{method:'POST',headers:storageHeaders,body:JSON.stringify({p_match:matchId,p_role:role,p_slot:slot,p_name:name,p_revision:revision,p_claim:claim}),signal:AbortSignal.timeout(8000)});
    if(!res.ok){const err=await res.json().catch(()=>({}));if(err.code==='23505')return reply({error:'Je staat al ingeschreven voor deze taak.'},409);if(err.code==='22023')return reply({error:'Kies je naam uit de ouderlijst.'},400);throw Error()}
    const rows=await res.json();if(!Array.isArray(rows)||rows.length!==1)return reply({error:'Deze plek is net gewijzigd. Bekijk de actuele inschrijvingen.'},409);
    return reply({ok:true});
  }catch{return reply({error:'Inschrijvingen laden of opslaan is niet gelukt. Probeer opnieuw.'},502)}
};
export const config:Config={path:'/api/hall-duties'};
