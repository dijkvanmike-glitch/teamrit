import type { Config } from '@netlify/functions';
import seed from '../../matches-seed.json' with { type:'json' };
import { mergeMatches } from '../../lib/matches.mjs';

export default async (req: Request) => {
  const headers = { 'content-type':'application/json', 'cache-control':'no-store' };
  if (req.method !== 'GET') return new Response('{}', { status:405, headers:{ ...headers, Allow:'GET' } });
  try {
    const base = Netlify.env.get('SUPABASE_URL');
    const key = Netlify.env.get('SUPABASE_ANON_KEY') || '';
    const res = await fetch(`${base}/rest/v1/matches?select=id,data,revision`, { headers:{ apikey:key, Authorization:`Bearer ${key}` }, signal:AbortSignal.timeout(8000) });
    if (!res.ok) throw Error('storage unavailable');
    return new Response(JSON.stringify(mergeMatches(seed, await res.json())), { headers });
  } catch {
    return new Response(JSON.stringify({ error:'Kon het actuele programma niet ophalen.' }), { status:503, headers });
  }
};
export const config: Config = { path:'/api/matches' };
