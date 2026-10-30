import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeMatches,displayMatch,validateFields} from '../lib/matches.mjs';
test('training retains end time through storage and renders without a fictitious opponent',()=>{
 const data={isoDate:'2026-11-08',home:true,opponent:'Training',time:'10:00',endTime:'11:00',type:'training',gatheringMode:'manual',location:'Sporthal De Vredehof'};
 const [m]=mergeMatches([],[{id:'match-12345678-1234-1234-1234-123456789abc',revision:1,data}]);
 assert.equal(m.type,'training');assert.equal(m.endTime,'11:00');assert.match(displayMatch(m).teams,/^Training ·/);assert.match(displayMatch(m).meta,/10:00–11:00/);
 assert.throws(()=>validateFields({...data,endTime:'09:00'}));
});

test('training can have a start time with an unknown end time',()=>{
 const data=validateFields({isoDate:'2026-12-21',home:true,opponent:'Training met Stefan Dol',time:'13:00',type:'training'});
 assert.equal(data.endTime,undefined);
 const shown=displayMatch(data);
 assert.ok(shown.meta.includes('13:00'));
 assert.ok(!shown.meta.includes('undefined'));
});
