import type { Config } from '@netlify/functions';
import { createHash, timingSafeEqual } from 'node:crypto';
import { drivingEstimate } from '../lib/route.mjs';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export default async (req:Request)=>{
  if(req.method!=='POST')return json({error:'Methode niet toegestaan.'},405);
  const secret=Netlify.env.get('TEAMRIT_ADMIN_CODE')||'';
  if(secret.length<20)return json({error:'Beheer is niet geactiveerd.'},503);
  const hash=(s:string)=>createHash('sha256').update(s).digest();
  if(!timingSafeEqual(hash(req.headers.get('authorization')||''),hash('Bearer '+secret)))return json({error:'Onjuiste beheercode.'},401);
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Ongeldige herkomst.'},403);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'Gebruik JSON.'},415);
  if(Number(req.headers.get('content-length'))>1024)return json({error:'Aanvraag te groot.'},413);
  try{
    const text=await req.text();if(text.length>1024)return json({error:'Aanvraag te groot.'},413);
    const body=JSON.parse(text);
    return json(await drivingEstimate(body.location));
  }catch(e){return json({error:e instanceof Error?e.message:'Berekenen mislukt. Probeer opnieuw of kies handmatig.'},422)}
};
// The public routing service permits at most one request/second; domain-wide cap.
export const config:Config={path:'/api/admin/timing',rateLimit:{windowLimit:1,windowSize:1,aggregateBy:'domain',action:'rate_limit'}};
