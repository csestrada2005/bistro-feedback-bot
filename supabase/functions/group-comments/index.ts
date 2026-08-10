import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function getVerifiedUserId(authHeader: string, supabaseUrl: string) {
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const issuer = `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;
  let jwks = jwksByUrl.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    jwksByUrl.set(issuer, jwks);
  }
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: "authenticated" });
  return typeof payload.sub === "string" ? payload.sub : null;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Eres un analista que normaliza comentarios de encuestas de comedores industriales en México.

Recibes tres listas de comentarios literales: "incidentes", "mejoras" y "menu".
Agrupa los comentarios de cada lista en categorías cortas, en MAYÚSCULAS, en español, y cuenta cuántos comentarios pertenecen a cada categoría.

Devuelve SIEMPRE JSON estricto (sin markdown) con esta estructura EXACTA:
{
  "incidentes": [{ "categoria": "string", "conteo": number }],
  "mejoras": [{ "categoria": "string", "conteo": number }],
  "menu": [{ "categoria": "string", "conteo": number }]
}

Reglas:
- La suma de los conteos de cada lista no puede superar el número de comentarios recibidos en esa lista.
- Máximo 25 categorías por lista, ordenadas de mayor a menor conteo.
- Categorías cortas (máximo 60 caracteres), sin punto final.
- No inventes categorías que no aparezcan en los comentarios.
- Si una lista viene vacía, devuélvela como [].`;

type Grupo = { categoria: string; conteo: number };

function fallbackGroups(items: string[]): Grupo[] {
  const map = new Map<string, number>();
  for (const raw of items) {
    const key = raw.trim().toUpperCase();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([categoria, conteo]) => ({ categoria, conteo }))
    .sort((a, b) => b.conteo - a.conteo)
    .slice(0, 40);
}

function sanitize(list: unknown, source: string[]): Grupo[] {
  if (!Array.isArray(list)) return fallbackGroups(source);
  const out = list
    .map((g) => {
      const item = g as { categoria?: unknown; conteo?: unknown };
      const categoria = String(item?.categoria ?? "").trim().toUpperCase().slice(0, 60);
      const conteo = Number(item?.conteo);
      if (!categoria || !Number.isFinite(conteo) || conteo <= 0) return null;
      return { categoria, conteo: Math.min(Math.round(conteo), source.length) };
    })
    .filter((g): g is Grupo => g !== null)
    .sort((a, b) => b.conteo - a.conteo)
    .slice(0, 25);
  return out.length ? out : fallbackGroups(source);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "No autorizado" });

    let userId: string | null = null;
    try {
      userId = await getVerifiedUserId(authHeader, supabaseUrl);
    } catch (e) {
      console.error("group-comments JWT verification failed", e);
    }
    if (!userId) return json(401, { error: "Sesión inválida" });

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: caller } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", userId)
      .maybeSingle();
    if (caller?.rol !== "admin") return json(403, { error: "Solo administradores" });

    const body = (await req.json().catch(() => null)) as { reporte_id?: string } | null;
    const reporteId = body?.reporte_id;
    if (!reporteId || typeof reporteId !== "string") return json(400, { error: "reporte_id requerido" });

    const { data: reporte } = await supabase
      .from("reportes")
      .select("id, comedor_id, fecha_desde, fecha_hasta, agrupaciones")
      .eq("id", reporteId)
      .maybeSingle();
    if (!reporte) return json(404, { error: "Reporte no encontrado" });
    if (reporte.agrupaciones) return json(200, { agrupaciones: reporte.agrupaciones, cached: true });

    const desde = new Date(`${reporte.fecha_desde}T00:00:00.000Z`).toISOString();
    const hastaDate = new Date(`${reporte.fecha_hasta}T00:00:00.000Z`);
    hastaDate.setUTCDate(hastaDate.getUTCDate() + 1);

    const { data: encuestas } = await supabase
      .from("encuestas")
      .select("id")
      .eq("comedor_id", reporte.comedor_id)
      .gte("fecha", desde)
      .lt("fecha", hastaDate.toISOString());

    const ids = (encuestas ?? []).map((e) => e.id);
    const { data: preguntas } = await supabase
      .from("preguntas")
      .select("id, texto, tipo");
    const { data: respuestas } = ids.length
      ? await supabase
          .from("respuestas")
          .select("pregunta_id, valor_booleano, valor_texto")
          .in("encuesta_id", ids)
      : { data: [] };

    const pById = new Map((preguntas ?? []).map((p) => [p.id, p]));
    const incidentes: string[] = [];
    const mejoras: string[] = [];
    const menu: string[] = [];

    for (const r of respuestas ?? []) {
      const p = pById.get(r.pregunta_id);
      if (!p) continue;
      const texto = (r.valor_texto ?? "").trim();
      if (!texto) continue;
      if (p.tipo === "si_no") {
        incidentes.push(texto);
        continue;
      }
      if (p.tipo !== "texto_abierto" && p.tipo !== "texto_multiple_3") continue;
      const partes = texto.split("|").map((s) => s.trim()).filter(Boolean);
      const destino = /men[uú]|platillo|plato fuerte/i.test(p.texto) ? menu : mejoras;
      destino.push(...partes);
    }

    let agrupaciones = {
      incidentes: fallbackGroups(incidentes),
      mejoras: fallbackGroups(mejoras),
      menu: fallbackGroups(menu),
      fuente: "textual" as string,
    };

    const hayTexto = incidentes.length + mejoras.length + menu.length > 0;
    if (apiKey && hayTexto) {
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            stream: false,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: JSON.stringify({ incidentes, mejoras, menu }),
              },
            ],
          }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          console.error(`group-comments AI ${resp.status}: ${t}`);
        } else {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content ?? "";
          const match = typeof raw === "string" ? raw.match(/\{[\s\S]*\}/) : null;
          if (match) {
            const parsed = JSON.parse(match[0]);
            agrupaciones = {
              incidentes: sanitize(parsed.incidentes, incidentes),
              mejoras: sanitize(parsed.mejoras, mejoras),
              menu: sanitize(parsed.menu, menu),
              fuente: "ia",
            };
          }
        }
      } catch (e) {
        console.error("group-comments AI failed", e);
      }
    }

    await supabase.from("reportes").update({ agrupaciones }).eq("id", reporteId);

    return json(200, { agrupaciones, cached: false });
  } catch (e) {
    console.error("group-comments error", e);
    return json(500, { error: e instanceof Error ? e.message : "Error inesperado" });
  }
});