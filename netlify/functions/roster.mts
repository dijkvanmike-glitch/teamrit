import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const base = Netlify.env.get("SUPABASE_URL");
  const key = Netlify.env.get("SUPABASE_ANON_KEY") ?? "";

  const res = await fetch(`${base}/rest/v1/parents?select=name,children&order=name`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Kon rooster niet ophalen" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/roster",
};
