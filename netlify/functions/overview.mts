import type { Context, Config } from "@netlify/functions";

type Parent = { name: string; children: string[] };
type Response_ = { parent_name: string; present: string | null; drive: string | null; seats: string | null };

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
    fetch(`${base}/rest/v1/responses?match_id=eq.${encodeURIComponent(match)}&select=parent_name,present,drive,seats`, { headers }),
  ]);

  if (!parentsRes.ok || !responsesRes.ok) {
    return new Response(JSON.stringify({ error: "Kon teamoverzicht niet ophalen" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const parents: Parent[] = await parentsRes.json();
  const responses: Response_[] = await responsesRes.json();
  const byName = Object.fromEntries(responses.map((r) => [r.parent_name, r]));

  const merged = parents.map((p) => ({
    name: p.name,
    children: p.children,
    present: byName[p.name]?.present ?? null,
    drive: byName[p.name]?.drive ?? null,
    seats: byName[p.name]?.seats ?? null,
  }));

  return new Response(JSON.stringify(merged), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/overview",
};
