import {test} from 'node:test';import assert from 'node:assert/strict';
import overview from '../netlify/functions/overview.mts';
import {assignDrivers} from '../lib/transport.mjs';
globalThis.Netlify={env:{get:k=>k==='SUPABASE_URL'?'https://storage.test':'test'}};
const parents=['A','B','C','D','E'].map(k=>({name:'Ouder '+k,children:[k]}));parents.push({name:'Tweede ouder A',children:['A']});
const current=['A','B','C','D','E'].map(k=>({family_key:k,parent_name:'Ouder '+k,drive:'Ja',present:'Ja'}));
const history=[{match_id:'m6',family_key:'A',drive:'Ja'},{match_id:'m7',family_key:'A',drive:'Ja'},{match_id:'m7',family_key:'C',drive:'Ja'}];
let failHistory=false,calls=[];
globalThis.fetch=async(url,opts={})=>{
 const u=new URL(url);calls.push(u);assert.ok(!opts.method||opts.method==='GET');
 if(u.pathname==='/rest/v1/parents')return Response.json(parents);
 if(u.pathname==='/rest/v1/matches')return Response.json([]);
 if(u.searchParams.get('drive')==='eq.Ja')return failHistory?new Response('{}',{status:500}):Response.json(history);
 return Response.json(current);
};
test('live overview groups parents and enriches historical signup counts read-only',async()=>{
 const res=await overview(new Request('https://teamrit.test/api/overview?match=m8'));
 assert.equal(res.status,200);const data=await res.json();assert.equal(data.length,5);
 assert.equal(data.find(p=>p.familyKey==='A').driveHistoryCount,2);
 assert.equal(data.find(p=>p.familyKey==='B').driveHistoryCount,0);
 assert.deepEqual(assignDrivers(data,{id:'m8'}).reserves.map(p=>p.familyKey),['A']);
 assert.equal(res.headers.get('cache-control'),'no-store');
 assert.ok(calls.find(u=>u.searchParams.get('drive')==='eq.Ja'));
});
test('history failure retains attendance and flags selection unavailable',async()=>{
 failHistory=true;
 const data=await(await overview(new Request('https://teamrit.test/api/overview?match=m8'))).json();
 assert.equal(data[0].present,'Ja');assert.equal(data[0].driveHistoryCount,null);assert.equal(assignDrivers(data,{id:'m8'}).unavailable,true);
});
