import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attendance,validateChildPresence} from '../lib/attendance.mjs';
import config from '../lib/team-config.mjs';
import response from '../netlify/functions/response.mts';
const kids=['Phyllon Olivieira','Maxim Olivieira'];
test('siblings have independent attendance, legacy answers remain readable',()=>{
 assert.deepEqual(validateChildPresence(kids,{[kids[0]]:'Ja',[kids[1]]:'Nee'}),{[kids[0]]:'Ja',[kids[1]]:'Nee'});
 assert.deepEqual(attendance(kids,null,'Ja'),{[kids[0]]:'Ja',[kids[1]]:'Ja'});
 assert.throws(()=>validateChildPresence(kids,{[kids[0]]:'Ja'}));
 assert.throws(()=>validateChildPresence(kids,{[kids[0]]:'Ja',Other:'Nee'}));
});
test('API stores one family response, shares per-child answers and rejects incomplete submissions',async()=>{
 config.environment='zaalvoetbal';globalThis.Netlify={env:{get:k=>k==='SUPABASE_URL'?'https://db.test':'test'}};
 const original=globalThis.fetch;let stored=null;
 globalThis.fetch=async(url,init)=>{
  if(String(url).includes('/parents?'))return Response.json([{children:kids}]);
  if(init?.method==='POST'){stored=JSON.parse(init.body)[0];return new Response(null,{status:201});}
  return Response.json(stored?[stored]:[]);
 };
 try{
  const body={name:'Sherold',matchId:'test',present:'Ja',drive:'Ja',seats:'3',childPresence:{[kids[0]]:'Ja',[kids[1]]:'Nee'}};
  assert.equal((await response(new Request('https://app/api/response',{method:'POST',body:JSON.stringify(body)}),{})).status,200);
  assert.equal(stored.family_key,[...kids].sort().join('|'));assert.equal(stored.seats,'3');assert.deepEqual(stored.child_presence,body.childPresence);
  const other=await (await response(new Request('https://app/api/response?parent=Karijn&match=test'),{})).json();assert.deepEqual(other.childPresence,body.childPresence);
  assert.equal((await response(new Request('https://app/api/response',{method:'POST',body:JSON.stringify({...body,childPresence:{}})}),{})).status,400);
 }finally{globalThis.fetch=original;config.environment='hockey';}
});
