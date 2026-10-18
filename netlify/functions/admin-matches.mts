import type { Config } from '@netlify/functions';
import { createHash, timingSafeEqual } from 'node:crypto';
import seed from '../../matches-seed.json' with { type:'json' };
import { validId, validateFields } from '../../lib/matches.mjs';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers:{ 'content-type':'application/json', 'cache-control':'no-store' } });
export default async (req: Request) => {
  if (!['GET','PUT'].includes(req.method)) return json({ error:'Methode niet toegestaan.' },405);
  // Fail closed until a strong code AND a server-only database key are configured.
  const secret = Netlify.env.get('TEAMRIT_ADMIN_CODE') || '';
  const key = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const base = Netlify.env.get('SUPABASE_URL');
  if (secret.length < 20 || !key || !base) return json({ error:'Beheer is nog niet geactiveerd. Neem contact op met de beheerder.' },503);
  const supplied = req.headers.get('authorization') || '';
  const hash = (s: string) => createHash('sha256').update(s).digest();
  if (!timingSafeEqual(hash(supplied),hash('Bearer '+secret))) return json({ error:'Onjuiste beheercode.' },401);
  // A custom Authorization header prevents cross-site form submissions; also check Origin.
  if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return json({ error:'Ongeldige herkomst.' },403);
  if (req.method === 'GET') return json({ ok:true });
  if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error:'Gebruik JSON.' },415);
  if (Number(req.headers.get('content-length')) > 8192) return json({ error:'Aanvraag te groot.' },413);
  let body: any;
  let data: any;
  try {
    const text = await req.text();
    if (text.length > 8192) return json({ error:'Aanvraag te groot.' },413);
    body = JSON.parse(text);
    if (!validId(body.id) || !Number.isInteger(body.revision) || body.revision < 0 || body.revision >= 2147483647) throw Error('Ongeldig wedstrijd-ID of versienummer.');
    if (seed.some(m => m.id === body.id && m.type === 'info')) throw Error('Dit informatiemoment kan hier niet worden gewijzigd.');
    if (!seed.some(m => m.id === body.id) && !body.id.startsWith('match-')) throw Error('Ongeldig nieuw wedstrijd-ID.');
    data = validateFields(body.data);
  } catch (e) {
    return json({ error:e instanceof Error ? e.message : 'Controleer de velden.' },400);
  }
  const headers = { apikey:key, Authorization:`Bearer ${key}`, 'content-type':'application/json', Prefer:body.revision === 0 ? 'resolution=ignore-duplicates,return=representation' : 'return=representation' };
  try {
    const url = body.revision === 0 ? `${base}/rest/v1/matches?on_conflict=id` : `${base}/rest/v1/matches?id=eq.${encodeURIComponent(body.id)}&revision=eq.${body.revision}`;
    const row = { data, revision:body.revision+1, updated_at:new Date().toISOString() };
    const res = await fetch(url, { method:body.revision===0?'POST':'PATCH', headers, body:JSON.stringify(body.revision===0?{ ...row,id:body.id }:row), signal:AbortSignal.timeout(8000) });
    if (!res.ok) return json({ error:'Opslaan is niet gelukt. Je invoer blijft staan; probeer opnieuw.' },502);
    const rows = await res.json();
    if (!rows.length) return json({ error:'Deze wedstrijd is ondertussen gewijzigd (of je vorige opslag is al gelukt). Herlaad de wedstrijd voordat je opnieuw opslaat.' },409);
    return json({ ok:true, id:body.id, revision:rows[0].revision });
  } catch {
    return json({ error:'Geen bevestiging van de opslag ontvangen. Herlaad het programma om te controleren; je invoer blijft staan.' },502);
  }
};
export const config: Config = { path:'/api/admin/matches', rateLimit:{ windowLimit:20,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit' } };
