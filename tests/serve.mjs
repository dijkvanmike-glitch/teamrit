// Isolated browser-test server. Never connects to Supabase or changes production.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import admin from '../netlify/functions/admin-matches.mts';
import publicMatches from '../netlify/functions/matches.mts';
import timing from '../netlify/functions/admin-timing.mts';
const root=path.resolve(import.meta.dirname,'..');
const env={TEAMRIT_ADMIN_CODE:'local-test-only-code-12345',SUPABASE_URL:'https://storage.test',SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test'};
globalThis.Netlify={env:{get:key=>env[key]}};
let rows=[];
globalThis.fetch=async(url,init={})=>{
 const u=new URL(url);
 if(u.hostname==='api.pdok.nl')return Response.json({response:{docs:[{weergavenaam:'Olympiaweg 12, 1816MJ Alkmaar',centroide_ll:'POINT(4.71937482 52.63793472)'}]}});
 if(u.hostname==='routing.openstreetmap.de')return Response.json({code:'Ok',routes:[{duration:2040}]});
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
 if(['/api/matches','/api/admin/matches','/api/admin/timing'].includes(url.pathname)){
 const chunks=[];for await(const c of req)chunks.push(c);
 const request=new Request(url,{method:req.method,headers:req.headers,...(req.method!=='GET'?{body:Buffer.concat(chunks)}:{})});
 out=await (url.pathname==='/api/matches'?publicMatches:url.pathname==='/api/admin/timing'?timing:admin)(request);
 }else if(url.pathname==='/api/roster'||url.pathname==='/api/overview')out=Response.json([]);
 else out=Response.json({});
 res.writeHead(out.status,Object.fromEntries(out.headers));res.end(await out.text());return;
 }
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep))throw Error();
 const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream';
 const content=await fs.readFile(file);res.writeHead(200,{'content-type':mime});res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(8766,'127.0.0.1',()=>console.log('Isolated test server: http://localhost:8766'));
