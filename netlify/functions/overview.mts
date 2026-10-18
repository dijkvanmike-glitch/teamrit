import seed from '../../matches-seed.json' with { type:'json' };
import { mergeMatches } from '../../lib/matches.mjs';
import { drivingHistory } from '../../lib/transport.mjs';
import type { Context, Config } from "@netlify/functions";

type ParentRow = { name: string; children: string[] };
type ResponseRow = {
  family_key: string;
  parent_name: string;
  present: string | null;
  drive: string | null;
  seats: string | null;
  parent_present: string | null;
};

function familyKey(children: string[]): string {
  return [...children].sort().join("|");
}

export default async (req: Request, context: Context) => {
  const base = Netlify.env.get("SUPABASE_URL");
  const key = Netlify.env.get("SUPABASE_ANON_KEY") ?? "";
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const url = new URL(req.url);
  const match = url.searchParams.get("match");
  if (!match) {
    return new Response(JSON.stringify({ error: "match is verplicht" }), {
      status: 400,
      headers: { "content-type": "application/json", "cache-control":"no-store" },
    });
  }

  const [parentsRes, responsesRes] = await Promise.all([
    fetch(`${base}/rest/v1/parents?select=name,children&order=name`, { headers }),
    fetch(`${base}/rest/v1/responses?match_id=eq.${encodeURIComponent(match)}&select=family_key,parent_name,present,drive,seats,parent_present`, { headers }),
  ]);

  if (!parentsRes.ok || !responsesRes.ok) {
    return new Response(JSON.stringify({ error: "Kon teamoverzicht niet ophalen" }), {
      status: 502,
      headers: { "content-type": "application/json", "cache-control":"no-store" },
    });
  }

  const parents: ParentRow[] = await parentsRes.json();
  const responses: ResponseRow[] = await responsesRes.json();
  const byFamily = Object.fromEntries(responses.map((r) => [r.family_key, r]));
  // Enrichment is read-only. Keep attendance available if history is unavailable,
  // but never pretend everyone has zero previous signups after a storage failure.
  let history: Map<string, {count:number;lastDate:string}> | null = null;
  try {
    if(responses.filter(r=>r.drive==='Ja').length<=4)throw Error('no reserve allocation needed');
    const matchesRes=await fetch(`${base}/rest/v1/matches?select=id,data,revision`,{headers,signal:AbortSignal.timeout(8000)});
    if(!matchesRes.ok)throw Error('matches unavailable');
    const matches=mergeMatches(seed,await matchesRes.json());
    const current=matches.find(m=>m.id===match);
    if(current&&current.type!=='info'&&current.home===false){
      const earlierIds=matches.filter(m=>m.type!=='info'&&m.home===false&&m.isoDate<current.isoDate).map(m=>m.id);
      const rows:any[]=[];
      if(earlierIds.length){
        const endpoint=`${base}/rest/v1/responses?match_id=in.(${earlierIds.map(encodeURIComponent).join(',')})&drive=eq.Ja&select=match_id,family_key,drive&order=match_id,family_key`;
        for(let start=0;;start+=1000){
          const res=await fetch(endpoint,{headers:{...headers,Range:`${start}-${start+999}`},signal:AbortSignal.timeout(8000)});
          if(!res.ok)throw Error('history unavailable');
          const page=await res.json();rows.push(...page);
          if(page.length<1000)break;
          if(start>=19000)throw Error('history too large');
        }
      }
      history=drivingHistory(matches,current,rows);
    }
  } catch { history=null; }


  // Groepeer ouders per gezin/speler (op basis van de kinderen-set), zodat een speler
  // met twee gekoppelde ouders/verzorgers maar één keer meetelt in het overzicht.
  const families = new Map<string, { children: string[]; parentNames: string[] }>();
  for (const p of parents) {
    const fk = familyKey(p.children);
    if (!families.has(fk)) families.set(fk, { children: p.children, parentNames: [] });
    families.get(fk)!.parentNames.push(p.name);
  }

  const merged = Array.from(families.entries())
    .map(([fk, fam]) => {
      const r = byFamily[fk];
      return {
        familyKey: fk,
        name: fam.parentNames.join(" & "),
        children: fam.children,
        present: r?.present ?? null,
        drive: r?.drive ?? null,
        seats: r?.seats ?? null,
        parentPresent: r?.parent_present ?? null,
        respondedBy: r?.parent_name ?? null,
        driveHistoryCount: history ? history.get(fk)?.count ?? 0 : null,
        lastDriveSignupDate: history ? history.get(fk)?.lastDate ?? '' : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return new Response(JSON.stringify(merged), {
    headers: { "content-type": "application/json", "cache-control":"no-store" },
  });
};

export const config: Config = {
  path: "/api/overview",
};
