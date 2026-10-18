import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { validateFields, mergeMatches, displayMatch, safeDisplayMatch, editableFields } from '../lib/matches.mjs';
import admin from '../netlify/functions/admin-matches.mts';
import publicMatches from '../netlify/functions/matches.mts';
const seed = JSON.parse(fs.readFileSync(new URL('../matches-seed.json',import.meta.url)));
const code='test-only-strong-admin-code';
let rows, env, requests;
const sample={ isoDate:'2026-11-28', home:false, opponent:'Test JO14-1',time:'',gathering:'',location:'Teststraat 1',note:'' };
globalThis.Netlify={ env:{ get:key=>env[key] } };
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,init={})=>{
  requests.push([String(url),init.method||'GET']);
  const u=new URL(url);
  assert.equal(u.hostname,'storage.test'); assert.equal(u.pathname,'/rest/v1/matches');
  if (env.failStorage) return new Response('{}',{status:500});
  if (!init.method || init.method==='GET') return Response.json(rows);
  const body=JSON.parse(init.body);
  if(init.method==='POST') {
    if(rows.some(r=>r.id===body.id)) return Response.json([]);
    rows.push(body); return Response.json([body]);
  }
  const row=rows.find(r=>'eq.'+r.id===u.searchParams.get('id') && 'eq.'+r.revision===u.searchParams.get('revision'));
  if(!row)return Response.json([]);
  Object.assign(row,body);return Response.json([row]);
};
beforeEach(()=>{ rows=[];requests=[];env={TEAMRIT_ADMIN_CODE:code,SUPABASE_URL:'https://storage.test',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'server-test'}; });
const request=(body,token=code,origin='https://teamrit.test')=>new Request('https://teamrit.test/api/admin/matches',{method:'PUT',headers:{Authorization:'Bearer '+token,'content-type':'application/json',Origin:origin},body:JSON.stringify(body)});
test('five agreed games, old IDs and special metadata retained',()=>{
  assert.equal(new Set(seed.map(m=>m.id)).size,seed.length);
  assert.deepEqual(seed.filter(m=>/^m(9|10|11)$/.test(m.id)).map(m=>m.time),[undefined,undefined,undefined]);
  assert.equal(seed.find(m=>m.id==='m8').time,'14:25');
  assert.match(seed.find(m=>m.id==='m8').meta,/Veld 2/);
  assert.equal(seed.find(m=>m.id==='m12').departOverride,'09:55');
  assert.equal(seed.find(m=>m.id==='m12').time,'11:45');
  assert.equal(seed.find(m=>m.id==='m2').selectedDriverKeys.length,4);
  const before=JSON.parse(fs.readFileSync(new URL('./original-matches.json',import.meta.url)));
  for(const m of before)assert.deepEqual(seed.find(s=>s.id===m.id),m);
});
test('validation handles optional times, invalid dates, lengths and types',()=>{
  assert.equal(validateFields(sample).time,'');
  for(const change of [{time:'24:01'},{time:null},{gathering:'9:55'},{isoDate:'2026-02-30'},{home:'false'},{opponent:''},{note:'x'.repeat(501)}]) assert.throws(()=>validateFields({...sample,...change}));
});
test('HTML is escaped at render boundary; route string remains plain text',()=>{
  const m=safeDisplayMatch({...sample,id:'match-00000000-0000-4000-8000-000000000001',opponent:'<img onerror=alert(1)>',note:'<script>bad()</script>'});
  assert.ok(!m.teams.includes('<'));assert.ok(!m.meta.includes('<'));assert.equal(m.mapsQuery,'Teststraat 1');
});
test('create and edit retain ID, reactions keyed by that ID, and seed metadata',async()=>{
  const reactions=new Map([['m2',{present:'Ja',drive:'Ja'}]]);const before=structuredClone(reactions);
  const fields={...editableFields(seed.find(m=>m.id==='m2')),time:''};
  let res=await admin(request({id:'m2',revision:0,data:fields}));assert.equal(res.status,200);
  res=await admin(request({id:'m2',revision:1,data:{...fields,note:'Gewijzigd'}}));assert.equal(res.status,200);
  const m=mergeMatches(seed,rows).find(m=>m.id==='m2');
  assert.equal(m.revision,2);assert.equal(displayMatch(m).time,undefined);assert.ok(displayMatch(m).meta.includes('Tijd volgt'));
  assert.equal(m.selectedDriverKeys.length,4);assert.deepEqual(reactions,before);
  assert.ok(requests.every(([url])=>new URL(url).pathname==='/rest/v1/matches'));
});
test('new match ID is stable and duplicate retries cannot duplicate games',async()=>{
  const body={id:'match-00000000-0000-4000-8000-000000000002',revision:0,data:sample};
  assert.equal((await admin(request(body))).status,200);
  assert.equal((await admin(request(body))).status,409);assert.equal(rows.length,1);
});
test('concurrent edits are rejected instead of overwriting newer data',async()=>{
  await admin(request({id:'m8',revision:0,data:sample}));
  const a=await admin(request({id:'m8',revision:1,data:{...sample,note:'first'}}));
  const b=await admin(request({id:'m8',revision:1,data:{...sample,note:'stale'}}));
  assert.equal(a.status,200);assert.equal(b.status,409);assert.equal(rows[0].data.note,'first');
});
test('auth fails closed, cross-origin and malformed edits never reach storage',async()=>{
  const body={id:'m8',revision:0,data:sample};
  assert.equal((await admin(request(body,'bad'))).status,401);
  assert.equal((await admin(request(body,code,'https://evil.test'))).status,403);
  assert.equal((await admin(request({...body,id:"m8');alert(1)//"}))).status,400);
  assert.equal((await admin(request({...body,id:'a1'}))).status,400);
  assert.equal((await admin(request({...body,data:{...sample,time:'25:00'}}))).status,400);
  delete env.TEAMRIT_ADMIN_CODE; assert.equal((await admin(request(body))).status,503);
  assert.equal(requests.length,0);
});
test('storage failures report an error and public read never pretends to be current',async()=>{
  env.failStorage=true;
  assert.equal((await admin(request({id:'m8',revision:0,data:sample}))).status,502);
  assert.equal((await publicMatches(new Request('https://teamrit.test/api/matches'))).status,503);
});
test('public API overlays edits and sorts by date',async()=>{
  rows=[{id:'m8',data:{...sample,isoDate:'2026-10-25'},revision:1}];
  const res=await publicMatches(new Request('https://teamrit.test/api/matches'));assert.equal(res.status,200);
  const list=await res.json();assert.equal(list.length,seed.length);assert.equal(list.find(m=>m.id==='m8').isoDate,'2026-10-25');
});
test('timing shows gathering without start time/travel and preserves existing travel info',()=>{
  const script=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
  const sandbox={document:{getElementById:()=>({}),querySelectorAll:()=>[]},addEventListener:()=>{},init:()=>{},console};
  const context=vm.createContext(sandbox);
  vm.runInContext(script.replace('init();',''),context);
  for(const [opponent,time,gathering,arrival,travelMinutes] of [['Alkmaar','14:25','13:05','13:40',undefined],['Magnus','14:10','12:55','13:25',30],['Overbos','11:45','09:55','11:00',undefined]]){
  context.m={home:false,teams:opponent+' · WFHC JO14-1',date:'zaterdag',time,departOverride:gathering,travelMinutes};
  for(const render of ['trTimingHtml(m)','trMatchContextHtml(m)','trCoachCardShell(m)']){
   const html=vm.runInContext(render,context);
   assert.ok(html.includes('Verzamelen bij WFHC · '+gathering));
   assert.ok(html.includes('Aanwezig bij '+opponent+' · '+arrival));
   assert.ok(html.includes('Wedstrijd · '+time));
  }
 }
 const m=seed.find(m=>m.id==='m12');context.m=m;
  assert.match(vm.runInContext('trTimingHtml(m)',context),/09:55/);
  assert.match(vm.runInContext('trMatchContextHtml(m)',context),/09:55/);
  context.m={...m,time:undefined};assert.match(vm.runInContext('trMatchContextHtml(m)',context),/Tijd volgt/);assert.match(vm.runInContext('trMatchContextHtml(m)',context),/09:55/);
  context.m=seed.find(m=>m.id==='m9');assert.match(vm.runInContext('trTimingHtml(m)',context),/Verzameltijd volgt/);assert.match(vm.runInContext('trMatchContextHtml(m)',context),/Verzameltijd volgt/);assert.match(vm.runInContext('trCoachCardShell(m)',context),/Verzameltijd volgt/);
  context.m=seed.find(m=>m.id==='m2');assert.match(vm.runInContext('trTimingHtml(m)',context),/Reistijd/);
});
