import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityVisible,clubInstant} from '../lib/activity-visibility.mjs';
import {teamCoaches} from '../netlify/lib/team-coaches.mjs';
test('training disappears exactly four hours after scheduled end in Dutch winter and summer time',()=>{
 for(const isoDate of ['2026-10-25','2027-06-06']){
  const m={isoDate,time:'10:00',endTime:'11:00'};const cutoff=clubInstant(isoDate,'15:00');
  assert.equal(activityVisible(m,cutoff-1),true);assert.equal(activityVisible(m,cutoff),false);
 }
 assert.equal(clubInstant('2026-10-25','15:00'),Date.parse('2026-10-25T14:00Z'));
 assert.equal(clubInstant('2027-06-06','15:00'),Date.parse('2027-06-06T13:00Z'));
});
test('matches without end use 90 minutes, unknown times kept through day plus four hours',()=>{
 assert.equal(activityVisible({isoDate:'2026-11-01',time:'10:00'},clubInstant('2026-11-01','15:30')),false);
 assert.equal(activityVisible({isoDate:'2026-11-01'},clubInstant('2026-11-02','02:00')),true);
});
test('coaches can separately respond without overwriting one another',async()=>{
 const names=['Sherold','Colin'];const rows=[];
 const fetcher=async(url,init)=>{if(init?.method==='POST'){const row=JSON.parse(init.body)[0];rows.push(row);return new Response(null,{status:201});}return Response.json(rows);};
 for(const [coachName,present] of [['Sherold','Ja'],['Colin','Nee']])assert.equal((await teamCoaches(new Request('https://app/api/coach',{method:'POST',body:JSON.stringify({matchId:'m1',coachName,present})}),'https://db',{},names,fetcher)).status,200);
 const result=await (await teamCoaches(new Request('https://app/api/coach?match=m1'),'https://db',{},names,fetcher)).json();
 assert.deepEqual(result.coaches,{Sherold:'Ja',Colin:'Nee'});assert.equal(result.present,'Ja');assert.notEqual(rows[0].match_id,rows[1].match_id);
 assert.equal((await teamCoaches(new Request('https://app/api/coach',{method:'POST',body:JSON.stringify({matchId:'m1',coachName:'Other',present:'Ja'})}),'https://db',{},names,fetcher)).status,400);
});
