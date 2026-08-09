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
      headers: { "content-type": "application/json" },
    });
  }

  const [parentsRes, responsesRes] = await Promise.all([
    fetch(`${base}/rest/v1/parents?select=name,children&order=name`, { headers }),
    fetch(`${base}/rest/v1/responses?match_id=eq.${encodeURIComponent(match)}&select=family_key,parent_name,present,drive,seats,parent_present`, { headers }),
  ]);

  if (!parentsRes.ok || !responsesRes.ok) {
    return new Response(JSON.stringify({ error: "Kon teamoverzicht niet ophalen" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const parents: ParentRow[] = await parentsRes.json();
  const responses: ResponseRow[] = await responsesRes.json();
  const byFamily = Object.fromEntries(responses.map((r) => [r.family_key, r]));

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
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return new Response(JSON.stringify(merged), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/overview",
};
