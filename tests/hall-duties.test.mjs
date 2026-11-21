import {test,beforeEach} from 'node:test';import assert from 'node:assert/strict';
import handler from '../netlify/functions/hall-duties.mts';
import {dutyBlocks,dutySlotsHtml,dutySummary,validDutyRows} from '../lib/hall-duties.mjs';
const id=[...dutyBlocks][0];let rows,mode,calls;
globalThis.Netlify={env:{get:k=>({SUPABASE_URL:'https://storage.test',SUPABASE_ANON_KEY:'test'})[k]}};
beforeEach(()=>{mode='';calls=[];rows=['hall','referee'].flatMap(role=>[1,2].map(slot_no=>({match_id:id,role,slot_no,parent_name:null,revision:0})));});
globalThis.fetch=async(url,init={})=>{calls.push([String(url),init.method||'GET']);if(mode==='fail')return new Response('{}',{status:500});if(!init.method)return Response.json(mode==='missing'?[]:rows);
 const b=JSON.parse(init.body);if(b.p_claim&&b.p_role==='referee'&&(b.p_slot!==1||rows.some(r=>r.role==='referee'&&r.parent_name)))return Response.json([]);if(b.p_name==='unknown')return Response.json({code:'22023'},{status:400});
 const r=rows.find(r=>r.role===b.p_role&&r.slot_no===b.p_slot&&r.revision===b.p_revision&&(b.p_claim?r.parent_name===null:r.parent_name===b.p_name));if(!r)return Response.json([]);
 if(b.p_claim&&rows.some(r=>r.role===b.p_role&&r.parent_name===b.p_name))return Response.json({code:'23505'},{status:409});
 r.parent_name=b.p_claim?b.p_name:null;r.revision++;return Response.json([r]);};
const req=(b,origin='https://teamrit.test')=>new Request('https://teamrit.test/api/hall-duties',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({matchId:id,role:'hall',slot:1,name:'Parent A',revision:0,claim:true,...b})});
test('preserves all stored slots, only two target blocks; missing storage never appears empty',async()=>{assert.equal(dutyBlocks.size,2);let r=await handler(new Request('https://teamrit.test/api/hall-duties?match='+id));assert.equal(r.status,200);assert.ok(validDutyRows(await r.json(),id));mode='missing';assert.equal((await handler(new Request('https://teamrit.test/api/hall-duties?match='+id))).status,502)});
test('simultaneous claims, double signup, wrong cancellation and stale edits cannot overwrite',async()=>{
 const out=await Promise.all([handler(req({})),handler(req({name:'Parent B'}))]);assert.deepEqual(out.map(r=>r.status),[200,409]);assert.equal(rows[0].parent_name,'Parent A');
 assert.equal((await handler(req({slot:2}))).status,409);
 assert.equal((await handler(req({name:'Parent B',revision:1,claim:false}))).status,409);
 assert.equal((await handler(req({revision:1,claim:false}))).status,200);
 assert.equal((await handler(req({name:'Parent B'}))).status,409);
 assert.equal((await handler(req({name:'Parent B',revision:2}))).status,200);
 assert.ok(calls.every(([u])=>new URL(u).pathname==='/rest/v1/rpc/set_hall_duty'));
});
test('validation and origin prevent unsupported writes; storage errors show failure',async()=>{
 for(const body of [{matchId:'m8'},{role:'other'},{slot:3},{name:''},{revision:-1},{claim:'true'}])assert.equal((await handler(req(body))).status,400);
 assert.equal((await handler(req({},'https://evil.test'))).status,403);assert.equal(calls.length,0);
 assert.equal((await handler(req({name:'unknown'}))).status,400);mode='fail';assert.equal((await handler(req({}))).status,502);
});
test('rendering escapes names, hides other cancellations and prevents own duplicate signup',()=>{
 rows[0].parent_name='<img onerror=bad()>';let html=dutySlotsHtml(rows,'Parent B');assert.ok(!html.includes('<img'));assert.ok(!html.includes('Afmelden'));assert.match(html,/Zaaldienst · 1\/2/);
 html=dutySlotsHtml(rows,'<img onerror=bad()>');assert.equal((html.match(/data-duty-role="hall"/g)||[]).length,1);assert.match(html,/Afmelden/);
});

test('one referee and two hall slots; extra referee claims rejected, legacy signup retained',async()=>{
 assert.equal((dutySlotsHtml(rows,'Parent A').match(/data-duty-role="hall"/g)||[]).length,2);
 assert.equal((dutySlotsHtml(rows,'Parent A').match(/data-duty-role="referee"/g)||[]).length,1);
 assert.match(dutySummary(rows),/Scheidsrechter: 0\/1/);
 assert.equal((await handler(req({role:'referee',slot:2}))).status,400);
 rows.find(r=>r.role==='referee'&&r.slot_no===2).parent_name='Parent A';
 const before=structuredClone(rows);const html=dutySlotsHtml(rows,'Parent A');assert.match(html,/Parent A/);assert.match(html,/Afmelden/);assert.deepEqual(rows,before);
 assert.equal((dutySlotsHtml(rows,'Parent B').match(/data-duty-role="referee"/g)||[]).length,0);
 assert.equal((await handler(req({role:'referee',name:'Parent B'}))).status,409);
 assert.equal((await handler(req({role:'referee',slot:2,claim:false}))).status,200);
 assert.equal((await handler(req({role:'referee',name:'Parent B'}))).status,200);
 assert.equal((await handler(req({role:'referee',name:'Parent C'}))).status,409);
});
