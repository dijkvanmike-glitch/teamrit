// Isolated browser-test server. Never connects to Supabase or changes production.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import admin from '../netlify/functions/admin-matches.mts';
import publicMatches from '../netlify/functions/matches.mts';
import timing from '../netlify/functions/admin-timing.mts';
import duties from '../netlify/functions/hall-duties.mts';
import { dutyBlocks } from '../lib/hall-duties.mjs';
const dutyRows=[...dutyBlocks].flatMap(match_id=>['hall','referee'].flatMap(role=>[1,2].map(slot_no=>({match_id,role,slot_no,parent_name:null,revision:0}))));
const root=path.resolve(import.meta.dirname,'..');
const env={TEAMRIT_ADMIN_CODE:'local-test-only-code-12345',SUPABASE_URL:'https://storage.test',SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test'};
globalThis.Netlify={env:{get:key=>env[key]}};
let rows=[];
globalThis.fetch=async(url,init={})=>{
 const u=new URL(url);
 if(u.hostname==='api.pdok.nl')return Response.json({response:{docs:[{weergavenaam:'Olympiaweg 12, 1816MJ Alkmaar',centroide_ll:'POINT(4.71937482 52.63793472)'}]}});
 if(u.hostname==='routing.openstreetmap.de')return Response.json({code:'Ok',routes:[{duration:2040}]});
 if(u.hostname==='storage.test'&&u.pathname==='/rest/v1/hall_duty_slots')return Response.json(dutyRows.filter(r=>'eq.'+r.match_id===u.searchParams.get('match_id')));
 if(u.hostname==='storage.test'&&u.pathname==='/rest/v1/rpc/set_hall_duty'){const b=JSON.parse(init.body);const r=dutyRows.find(r=>r.match_id===b.p_match&&r.role===b.p_role&&r.slot_no===b.p_slot&&r.revision===b.p_revision&&(b.p_claim?r.parent_name===null:r.parent_name===b.p_name));if(!r)return Response.json([]);if(b.p_claim&&dutyRows.some(r=>r.match_id===b.p_match&&r.role===b.p_role&&r.parent_name===b.p_name))return Response.json({code:'23505'},{status:409});r.parent_name=b.p_claim?b.p_name:null;r.revision++;return Response.json([r])}
 if(u.hostname!=='storage.test'||u.pathname!=='/rest/v1/matches')throw Error('Unexpected external request');
 if(!init.method)return Response.json(rows);
 const data=JSON.parse(init.body);
 if(init.method==='POST'){if(rows.some(r=>r.id===data.id))return Response.json([]);rows.push(data);return Response.json([data]);}
 const row=rows.find(r=>'eq.'+r.id===u.searchParams.get('id')&&'eq.'+r.revision===u.searchParams.get('revision'));
 if(!row)return Response.json([]);Object.assign(row,data);return Response.json([row]);
};
http.createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,'http://localhost:8766');
 if(url.pathname.startsWith('/api/')){
 let out;
 if(['/api/matches','/api/admin/matches','/api/admin/timing','/api/hall-duties'].includes(url.pathname)){
 const chunks=[];for await(const c of req)chunks.push(c);
 const request=new Request(url,{method:req.method,headers:req.headers,...(req.method!=='GET'?{body:Buffer.concat(chunks)}:{})});
 out=await (url.pathname==='/api/hall-duties'?duties:url.pathname==='/api/matches'?publicMatches:url.pathname==='/api/admin/timing'?timing:admin)(request);
 }else if(url.pathname==='/api/overview')out=Response.json(url.searchParams.get('match')==='m8'?['A','B','C','D','E','F'].map((k,i)=>({familyKey:k,name:'Ouder '+k,children:['Speler '+k],present:'Ja',drive:'Ja',seats:'3',driveHistoryCount:[3,0,1,2,0,1][i],lastDriveSignupDate:''})):[]);
 else if(url.pathname==='/api/roster')out=Response.json([{name:'Testouder A',children:['Testspeler A']},{name:'Testouder B',children:['Testspeler B']}]);
 else out=Response.json({});
 res.writeHead(out.status,Object.fromEntries(out.headers));res.end(await out.text());return;
 }
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep))throw Error();
 const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream';
 const content=await fs.readFile(file);res.writeHead(200,{'content-type':mime});res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(8766,'127.0.0.1',()=>console.log('Isolated test server: http://localhost:8766'));
