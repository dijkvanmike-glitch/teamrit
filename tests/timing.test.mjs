import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gatheringTime} from '../lib/timing.mjs';
import {validateFields,mergeMatches,displayMatch} from '../lib/matches.mjs';
import {drivingEstimate} from '../netlify/lib/route.mjs';
const base={isoDate:'2026-10-24',home:false,opponent:'Alkmaar JO14-2',time:'14:25',location:'Olympiaweg 12 Alkmaar',note:'Veld 2',gathering:''};
test('agreed away rounding and home hour',()=>{
 assert.equal(gatheringTime('14:25',false,31),'13:05');
 assert.equal(gatheringTime('14:25',false,30),'13:10');
 assert.equal(gatheringTime('09:17',true),'08:17');
 assert.equal(gatheringTime('',false),'');
 assert.throws(()=>gatheringTime('00:30',false,31));
});
test('auto persisted server value is recomputed; manual override and legacy preserved',()=>{
 const m=validateFields({...base,gatheringMode:'auto',travelMinutes:31,travelLocation:base.location,gathering:'14:00'});
 assert.equal(m.gathering,'13:05');assert.equal(m.travelMinutes,31);
 assert.equal(validateFields({...base,gatheringMode:'manual',gathering:'12:50'}).gathering,'12:50');
 assert.equal(validateFields({...base,gathering:'13:05'}).gathering,'13:05');
 assert.throws(()=>validateFields({...base,gatheringMode:'auto',travelMinutes:31,travelLocation:'Ander adres'}));
 assert.throws(()=>validateFields({...base,gatheringMode:'auto',travelMinutes:NaN,travelLocation:base.location}));
});
test('missing input never reuses seed travel time or invents gathering',()=>{
 const m=validateFields({...base,location:'',gatheringMode:'auto'});
 assert.equal(m.gathering,'');assert.equal(m.travelMinutes,null);
 const list=mergeMatches([{...base,id:'m2',travelMinutes:31}], [{id:'m2',data:m,revision:1}]);
 assert.equal(list[0].travelMinutes,null);assert.equal(displayMatch(list[0]).departOverride,undefined);
 assert.equal(validateFields({...base,time:'',gatheringMode:'auto'}).gathering,'');
 assert.equal(validateFields({...base,home:true,gatheringMode:'auto'}).gathering,'13:25');
});
function mocked(docs,route={code:'Ok',routes:[{duration:1860}]}){
 const calls=[];return {calls,fetcher:async(url,opts)=>{calls.push(String(url));assert.match(opts.headers['User-Agent'],/TeamRit/);return Response.json(calls.length===1?{response:{docs}}:route);}};
}
test('PDOK exact matching never silently uses a different house number',async()=>{
 const mock=mocked([{weergavenaam:'Olympiaweg 1B, 1816MJ Alkmaar',centroide_ll:'POINT(4.72 52.63)'}]);
 await assert.rejects(drivingEstimate(base.location,mock.fetcher),/niet eenduidig/);assert.equal(mock.calls.length,1);
});
test('routing duration rounded up, postal and punctuation handled',async()=>{
 const mock=mocked([{weergavenaam:'Olympiaweg 12, 1816MJ Alkmaar',centroide_ll:'POINT(4.71937482 52.63793472)'}],{code:'Ok',routes:[{duration:1861}]});
 const result=await drivingEstimate('Olympiaweg 12, 1816 MJ Alkmaar',mock.fetcher);
 assert.equal(result.travelMinutes,32);assert.equal(mock.calls.length,2);assert.match(mock.calls[1],/5.03922359,52.66048687/);
});
test('failed routing has no made-up duration',async()=>{
 const mock=mocked([{weergavenaam:'Olympiaweg 12, 1816MJ Alkmaar',centroide_ll:'POINT(4.71937482 52.63793472)'}],{code:'NoRoute'});
 await assert.rejects(drivingEstimate(base.location,mock.fetcher),/Geen bruikbare/);
});
test('route API rejects unauthorised requests before external address lookup',async()=>{
 const {default:handler,config}=await import('../netlify/functions/admin-timing.mts');
 globalThis.Netlify={env:{get:()=> 'test-admin-code-long-enough'}};
 const r=await handler(new Request('https://teamrit.test/api/admin/timing',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({location:base.location})}));
 assert.equal(r.status,401);assert.equal(config.rateLimit.windowLimit,1);assert.equal(config.rateLimit.aggregateBy,'domain');
});
