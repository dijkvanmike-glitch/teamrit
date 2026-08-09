import type { Context, Config } from "@netlify/functions";

function supabaseHeaders() {
  const key = Netlify.env.get("SUPABASE_ANON_KEY") ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
}

export default async (req: Request, context: Context) => {
  const base = Netlify.env.get("SUPABASE_URL");

  if (req.method === "GET") {
    const url = new URL(req.url);
    const parent = url.searchParams.get("parent");
    const match = url.searchParams.get("match");
    if (!parent || !match) {
      return new Response(JSON.stringify(null), {
        headers: { "content-type": "application/json" },
      });
    }

    const res = await fetch(
      `${base}/rest/v1/responses?parent_name=eq.${encodeURIComponent(parent)}&match_id=eq.${encodeURIComponent(match)}&select=present,drive,seats,parent_present`,
      { headers: supabaseHeaders() }
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
      ? { present: row.present, drive: row.drive, seats: row.seats, parentPresent: row.parent_present }
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

    const res = await fetch(`${base}/rest/v1/responses`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([
        {
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
