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
    if (!parent) {
      return new Response(JSON.stringify(null), {
        headers: { "content-type": "application/json" },
      });
    }

    const res = await fetch(
      `${base}/rest/v1/responses?parent_name=eq.${encodeURIComponent(parent)}&select=present,drive,seats`,
      { headers: supabaseHeaders() }
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Kon reactie niet ophalen" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    const rows = await res.json();
    return new Response(JSON.stringify(rows[0] ?? null), {
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

    const { name, present, drive, seats } = body ?? {};
    if (!name) {
      return new Response(JSON.stringify({ error: "name is verplicht" }), { status: 400 });
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
          present: present ?? null,
          drive: drive ?? null,
          seats: seats ?? null,
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
