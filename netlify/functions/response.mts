import type { Context, Config } from "@netlify/functions";

function supabaseHeaders() {
  const key = Netlify.env.get("SUPABASE_ANON_KEY") ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
}

async function familyKeyForParent(base: string, headers: Record<string, string>, name: string): Promise<string | null> {
  const res = await fetch(`${base}/rest/v1/parents?name=eq.${encodeURIComponent(name)}&select=children`, { headers });
  if (!res.ok) return null;
  const rows = await res.json();
  const children: string[] = rows[0]?.children ?? [];
  if (!children.length) return null;
  return [...children].sort().join("|");
}

export default async (req: Request, context: Context) => {
  const base = Netlify.env.get("SUPABASE_URL") ?? "";
  const headers = supabaseHeaders();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const parent = url.searchParams.get("parent");
    const match = url.searchParams.get("match");
    if (!parent || !match) {
      return new Response(JSON.stringify(null), {
        headers: { "content-type": "application/json" },
      });
    }

    const familyKey = await familyKeyForParent(base, headers, parent);
    if (!familyKey) {
      return new Response(JSON.stringify(null), {
        headers: { "content-type": "application/json" },
      });
    }

    const res = await fetch(
      `${base}/rest/v1/responses?family_key=eq.${encodeURIComponent(familyKey)}&match_id=eq.${encodeURIComponent(match)}&select=present,drive,seats,parent_present,parent_name`,
      { headers }
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Kon reactie niet ophalen" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    const rows = await res.json();
    const row = rows[0] ?? null;
    const out = row
      ? { present: row.present, drive: row.drive, seats: row.seats, parentPresent: row.parent_present, respondedBy: row.parent_name }
      : null;
    return new Response(JSON.stringify(out), {
      headers: { "content-type": "application/json" },
    });
  }

  if (req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Ongeldige aanvraag" }), { status: 400 });
    }

    const { name, matchId, present, drive, seats, parentPresent } = body ?? {};
    if (!name || !matchId) {
      return new Response(JSON.stringify({ error: "name en matchId zijn verplicht" }), { status: 400 });
    }

    const familyKey = await familyKeyForParent(base, headers, name);
    if (!familyKey) {
      return new Response(JSON.stringify({ error: "Onbekende ouder" }), { status: 400 });
    }

    const res = await fetch(`${base}/rest/v1/responses`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([
        {
          family_key: familyKey,
          parent_name: name,
          match_id: matchId,
          present: present ?? null,
          drive: drive ?? null,
          seats: seats ?? null,
          parent_present: parentPresent ?? null,
          updated_at: new Date().toISOString(),
        },
      ]),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: text }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/response",
};
