import test from 'node:test';
import assert from 'node:assert/strict';
import { within48Hours, outstanding, reminder } from '../lib/admin-alerts.mjs';
test('48 hours uses Amsterdam time across winter-time transition and excludes past/info',()=>{
 const now=Date.parse('2026-10-24T10:00:00Z');
 assert.equal(within48Hours({isoDate:'2026-10-26',time:'11:00'},now),true);
 assert.equal(within48Hours({isoDate:'2026-10-26',time:'11:01'},now),false);
 assert.equal(within48Hours({isoDate:'2026-10-24',time:'11:59'},now),false);
 assert.equal(within48Hours({isoDate:'2026-10-25',type:'info'},now),false);
 assert.equal(within48Hours({isoDate:'2026-10-25'},now),true);
 assert.equal(within48Hours({isoDate:'2026-10-23'},now),false);
});
test('only outstanding issues; count families and cars, not seats, accept negative responses',()=>{
 const rows=[{familyKey:'a',present:'Nee',drive:'Nee'},{familyKey:'b',present:null,drive:null}];
 assert.equal(outstanding({home:false},rows,{parentName:null}).length,3);
 assert.equal(outstanding({home:true},rows,{parentName:'Ouder'}).length,1);
 const ready=Array.from({length:4},(_,i)=>({familyKey:String(i),present:'Ja',drive:'Ja'}));
 assert.deepEqual(outstanding({home:false},[...ready,ready[0]],{parentName:'Ouder'}),[]);
 assert.throws(()=>outstanding({},null,{}));
});
test('reminder has details and public link without admin credentials',()=>{
 const text=reminder({teams:'WFHC · Test',date:'Zondag',time:'12:00'},['Fruit ontbreekt.'],'https://teamrit.test/admin.html');
 assert.match(text,/WFHC · Test/);assert.match(text,/12:00/);assert.match(text,/Fruit ontbreekt/);assert.match(text,/https:\/\/teamrit.test\//);assert.doesNotMatch(text,/admin/);
});
