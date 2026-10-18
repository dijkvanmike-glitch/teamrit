import {test} from 'node:test';import assert from 'node:assert/strict';
import {drivingHistory,assignDrivers,transportHtml} from '../lib/transport.mjs';
const current={id:'now',isoDate:'2026-10-24',home:false};
const matches=[current,{id:'old',isoDate:'2026-09-01',home:false},{id:'home',isoDate:'2026-09-02',home:true},{id:'info',isoDate:'2026-09-03',type:'info'},{id:'future',isoDate:'2026-11-01',home:false}];
const family=(key,count,date='')=>({familyKey:key,name:key,drive:'Ja',driveHistoryCount:count,lastDriveSignupDate:date});
test('history counts each family once per earlier away match; excludes home, future, current and no',()=>{
 const row=(id,drive='Ja')=>({match_id:id,family_key:'A',drive});
 const h=drivingHistory(matches,current,[row('old'),row('old'),row('home'),row('info'),row('future'),row('now'),{...row('old','Nee'),family_key:'B'}]);
 assert.deepEqual(h.get('A'),{count:1,lastDate:'2026-09-01'});assert.equal(h.has('B'),false);
});
test('six volunteers: four with lowest history, rest named reserve',()=>{
 const list=[family('A',3),family('B',0),family('C',1),family('D',2),family('E',0),family('F',1)];
 const a=assignDrivers(list,current);assert.deepEqual(a.selected.map(p=>p.familyKey),['B','E','C','F']);assert.deepEqual(a.reserves.map(p=>p.familyKey),['D','A']);
 assert.match(transportHtml(list,current),/Reserve:<\/strong> D · A/);
});
test('ties use oldest signup then stable family key, independent of response order',()=>{
 const list=[family('C',1,'2026-09-10'),family('B',1,'2026-09-01'),family('A',1,'2026-09-01'),family('D',0),family('E',0)];
 assert.deepEqual(assignDrivers(list,current).selected.map(p=>p.familyKey),['D','E','A','B']);
 assert.deepEqual(assignDrivers([...list].reverse(),current).selected,assignDrivers(list,current).selected);
});
test('manual allocation preserved, withdrawn drivers not silently replaced',()=>{
 const list=['A','B','C','D','E'].map(k=>family(k,0));list[0].drive='Nee';
 const a=assignDrivers(list,{...current,selectedDriverKeys:['A','B','C','D']});assert.deepEqual(a.selected.map(p=>p.familyKey),['B','C','D']);assert.deepEqual(a.reserves.map(p=>p.familyKey),['E']);assert.equal(a.manual,true);
});
test('up to four all ride; families deduplicated; absent history never invented',()=>{
 assert.equal(assignDrivers([family('A',null),family('A',null)],current).selected.length,1);
 assert.equal(assignDrivers(['A','B','C','D'].map(k=>family(k,null)),current).reserves.length,0);
 assert.equal(assignDrivers(['A','B','C','D','E'].map(k=>family(k,null)),current).unavailable,true);
 assert.match(transportHtml(['A','B','C','D','E'].map(k=>family(k,null)),current),/indeling nog niet beschikbaar/);
});
test('parent names escaped and no input responses changed',()=>{
 const list=[family('<img onerror=alert(1)>',0)];const before=JSON.stringify(list);assert.ok(!transportHtml(list,current).includes('<img'));assert.equal(JSON.stringify(list),before);
});
