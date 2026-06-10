import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Sugerencia = {
  texto: string;
  tipo: "escala_5" | "si_no" | "texto_abierto";
  justificacion: string;
};

// In-memory rate limit (best-effort por instancia)
const RATE_LIMIT = 5;
const WINDOW_MS = 60_000;
const calls = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const list = (calls.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= RATE_LIMIT) {
    calls.set(key, list);
    return true;
  }
  list.push(now);
  calls.set(key, list);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: solo administradores autenticados
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
    const userId = claimsRes?.claims?.sub ?? null;
    if (claimsErr || !userId) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: callerRow } = await adminClient
      .from("usuarios")
      .select("rol")
      .eq("id", userId)
      .maybeSingle();
    if (callerRow?.rol !== "admin") {
      return new Response(JSON.stringify({ error: "Solo administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Body inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const comedorNombre = String(body.comedorNombre ?? "").trim();
    const contextoAdicional = String(body.contextoAdicional ?? "").trim();
    const preguntasExistentes: string[] = Array.isArray(body.preguntasExistentes)
      ? body.preguntasExistentes.map((x: unknown) => String(x)).slice(0, 50)
      : [];
    if (!comedorNombre) {
      return new Response(JSON.stringify({ error: "comedorNombre requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit por usuario autenticado
    if (rateLimited(userId)) {
      return new Response(
        JSON.stringify({ error: "Demasiadas solicitudes. Intenta en un minuto." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Eres un experto consultor en operación de comedores industriales en México con 15+ años de experiencia evaluando satisfacción de comensales. Tu trabajo es proponer preguntas de encuesta breves, claras, accionables y en español neutro mexicano.

Reglas:
- Devuelve entre 3 y 6 preguntas NUEVAS, que NO repitan ni reformulen las existentes.
- Cada pregunta debe ser corta (máx 120 caracteres) y entendible por cualquier trabajador.
- "tipo" debe ser uno de: "escala_5" (rating 1-5), "si_no" (sí/no), "texto_abierto" (respuesta libre).
- Prefiere "escala_5" para evaluar atributos (sabor, temperatura, limpieza, etc.).
- Devuelve SOLO JSON válido. Sin markdown, sin texto extra.
- Estructura exacta: {"sugerencias":[{"texto":"...","tipo":"escala_5","justificacion":"..."}]}`;

    const userPrompt = `Comedor: ${comedorNombre}
${contextoAdicional ? `Contexto adicional del administrador: ${contextoAdicional}\n` : ""}
Preguntas existentes (NO repetir):
${preguntasExistentes.length ? preguntasExistentes.map((p, i) => `${i + 1}. ${p}`).join("\n") : "(ninguna)"}

Sugiere entre 3 y 6 preguntas nuevas en JSON estricto.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Lovable AI error", resp.status, errText);
      const status = resp.status === 429 ? 429 : resp.status === 402 ? 402 : 502;
      const msg =
        resp.status === 429
          ? "Demasiadas solicitudes. Intenta en un minuto."
          : resp.status === 402
          ? "Se agotaron los créditos de IA. Recarga en Ajustes de Lovable Cloud."
          : "Error en proveedor de IA";
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    // Extraer JSON aunque venga rodeado de texto
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("Respuesta sin JSON parseable", raw);
      return new Response(JSON.stringify({ error: "Respuesta IA inválida" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: { sugerencias?: Sugerencia[] };
    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      console.error("JSON.parse falló", e, raw);
      return new Response(JSON.stringify({ error: "Respuesta IA inválida" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tiposValidos = new Set(["escala_5", "si_no", "texto_abierto"]);
    const sugerencias: Sugerencia[] = (parsed.sugerencias ?? [])
      .filter(
        (s) =>
          s &&
          typeof s.texto === "string" &&
          s.texto.trim().length > 0 &&
          tiposValidos.has(s.tipo) &&
          typeof s.justificacion === "string"
      )
      .slice(0, 6)
      .map((s) => ({
        texto: s.texto.trim(),
        tipo: s.tipo,
        justificacion: s.justificacion.trim(),
      }));

    if (sugerencias.length < 3) {
      return new Response(JSON.stringify({ error: "La IA no devolvió suficientes sugerencias" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sugerencias }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-questions error", e);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});