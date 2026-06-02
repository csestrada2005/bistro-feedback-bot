import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

type Tipo = "escala_5" | "si_no" | "texto_abierto" | "texto_multiple_3";
type Pregunta = { id: string; texto: string; tipo: Tipo; orden: number };
type Encuesta = { id: string; fecha: string; comedor_id: string };
type Respuesta = {
  encuesta_id: string;
  pregunta_id: string;
  valor_numerico: number | null;
  valor_booleano: boolean | null;
  valor_texto: string | null;
};

// Rate limit: 1 análisis / 60s por usuario
const calls = new Map<string, number>();

const SYSTEM_PROMPT = `Eres un consultor senior de operaciones de comedores industriales en México. Analizas datos de encuestas de satisfacción de comensales y entregas insights ejecutivos accionables.

Devuelve SIEMPRE JSON estricto (sin markdown, sin texto adicional) con esta estructura EXACTA:

{
  "resumenEjecutivo": "string (3-5 bullets en formato markdown, usa - al inicio de cada línea)",
  "fortalezas": [{ "titulo": "string", "evidencia": "string" }],
  "areasOportunidad": [{ "titulo": "string", "evidencia": "string", "severidad": "alta" | "media" | "baja" }],
  "recomendaciones": [{ "accion": "string", "impactoEsperado": "string", "prioridad": "alta" | "media" | "baja" }],
  "sentimientoComentarios": "positivo" | "neutro" | "negativo" | "mixto",
  "citasDestacadas": ["string"]
}

Reglas:
- Máx 3 fortalezas, máx 5 áreas de oportunidad, máx 5 recomendaciones, máx 3 citas destacadas.
- Las "citasDestacadas" deben ser COMENTARIOS LITERALES tomados de los datos. No inventes.
- Lenguaje claro, español neutro, orientado a acción.
- Si los datos son contradictorios, marca sentimiento como "mixto".`;

async function callLovableAI(apiKey: string, userPrompt: string) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    const err = new Error(`Lovable AI ${resp.status}: ${t}`) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Sin JSON parseable");
  return JSON.parse(match[0]);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit 1/60s
    const last = calls.get(userId) ?? 0;
    if (Date.now() - last < 60_000) {
      return new Response(
        JSON.stringify({ error: "Espera un momento antes de re-analizar (máx 1 por minuto)." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    calls.set(userId, Date.now());

    const body = await req.json().catch(() => null);
    if (!body?.comedorId || !body?.fechaDesde || !body?.fechaHasta) {
      return new Response(JSON.stringify({ error: "Parámetros faltantes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { comedorId, fechaDesde, fechaHasta } = body as {
      comedorId: string;
      fechaDesde: string;
      fechaHasta: string;
    };

    // Traer datos
    const [pQ, eQ, cQ] = await Promise.all([
      supabase.from("preguntas").select("id, texto, tipo, orden").order("orden"),
      supabase
        .from("encuestas")
        .select("id, fecha, comedor_id")
        .eq("comedor_id", comedorId)
        .gte("fecha", fechaDesde)
        .lte("fecha", fechaHasta),
      supabase.from("comedores").select("nombre").eq("id", comedorId).maybeSingle(),
    ]);

    if (pQ.error || eQ.error) {
      return new Response(JSON.stringify({ error: "Error consultando datos" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const preguntas = (pQ.data ?? []) as Pregunta[];
    const encuestas = (eQ.data ?? []) as Encuesta[];
    const comedorNombre = (cQ.data as { nombre?: string } | null)?.nombre ?? "Comedor";

    const MIN_ENCUESTAS = 3;
    if (encuestas.length < MIN_ENCUESTAS) {
      return new Response(
        JSON.stringify({
          error: `Aún no hay suficientes encuestas en el rango seleccionado para generar un análisis (${encuestas.length}/${MIN_ENCUESTAS}). Amplía las fechas o espera a recibir más respuestas.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ids = encuestas.map((e) => e.id);
    const { data: rData } = await supabase.from("respuestas").select("*").in("encuesta_id", ids);
    const respuestas = (rData ?? []) as Respuesta[];
    const pregById = new Map(preguntas.map((p) => [p.id, p]));

    // Stats
    const escala = preguntas.filter((p) => p.tipo === "escala_5");
    const promediosPorPregunta = escala
      .map((p) => {
        const vals = respuestas
          .filter((r) => r.pregunta_id === p.id && r.valor_numerico != null)
          .map((r) => r.valor_numerico as number);
        const n = vals.length;
        const prom = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
        return { pregunta: p.texto, n, promedio: Number(prom.toFixed(2)) };
      })
      .filter((x) => x.n > 0);
    const promedioGeneral = promediosPorPregunta.length
      ? Number(
          (
            promediosPorPregunta.reduce((a, b) => a + b.promedio, 0) /
            promediosPorPregunta.length
          ).toFixed(2)
        )
      : null;

    const incidenteQ = preguntas.find((p) => p.tipo === "si_no");
    const incidentes: string[] = [];
    let pctIncidentes: number | null = null;
    if (incidenteQ) {
      const incR = respuestas.filter((r) => r.pregunta_id === incidenteQ.id);
      const yes = incR.filter((r) => r.valor_booleano === true);
      pctIncidentes = incR.length ? Number(((yes.length / incR.length) * 100).toFixed(1)) : null;
      yes.forEach((r) => {
        if (r.valor_texto?.trim()) incidentes.push(r.valor_texto.trim());
      });
    }

    const mejoras: string[] = [];
    const menus: string[] = [];
    respuestas.forEach((r) => {
      const p = pregById.get(r.pregunta_id);
      if (!p) return;
      if (p.tipo !== "texto_multiple_3" && p.tipo !== "texto_abierto") return;
      const partes = (r.valor_texto ?? "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      const esMenu = /men[uú]/i.test(p.texto);
      partes.forEach((t) => (esMenu ? menus : mejoras).push(t));
    });

    const payload = {
      comedor: comedorNombre,
      rango: { desde: fechaDesde, hasta: fechaHasta },
      stats: {
        totalEncuestas: encuestas.length,
        promedioGeneral,
        pctIncidentes,
        totalPropuestasMejora: mejoras.length,
        totalPropuestasMenu: menus.length,
      },
      promediosPorPregunta,
      comentariosIncidentes: incidentes.slice(0, 50),
      propuestasMejora: mejoras.slice(0, 50),
      propuestasMenu: menus.slice(0, 50),
    };

    const userPrompt = `Analiza estos datos de encuestas y devuelve el JSON estructurado:\n\n${JSON.stringify(
      payload,
      null,
      2
    )}`;

    // Llamar IA con 1 retry si JSON viene mal
    let analisis;
    try {
      analisis = await callLovableAI(apiKey, userPrompt);
    } catch (e) {
      console.error("Primer intento IA falló", e);
      const status = (e as { status?: number })?.status;
      if (status === 429 || status === 402) {
        const msg =
          status === 429
            ? "Demasiadas solicitudes a la IA. Intenta en un minuto."
            : "Se agotaron los créditos de IA. Recarga en Ajustes de Lovable Cloud.";
        return new Response(JSON.stringify({ error: msg }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        analisis = await callLovableAI(apiKey, userPrompt);
      } catch (e2) {
        console.error("Segundo intento IA falló", e2);
        return new Response(JSON.stringify({ error: "La IA no pudo generar el análisis" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validación mínima de estructura
    const ok =
      analisis &&
      typeof analisis.resumenEjecutivo === "string" &&
      Array.isArray(analisis.fortalezas) &&
      Array.isArray(analisis.areasOportunidad) &&
      Array.isArray(analisis.recomendaciones) &&
      Array.isArray(analisis.citasDestacadas);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Respuesta IA inválida" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guardar reporte (sin pdf todavía)
    const { data: reporte, error: repErr } = await supabase
      .from("reportes")
      .insert({
        comedor_id: comedorId,
        fecha_desde: fechaDesde.slice(0, 10),
        fecha_hasta: fechaHasta.slice(0, 10),
        analisis_ia: analisis,
        generado_por: userId,
      })
      .select("id")
      .single();

    if (repErr) {
      console.error("Error guardando reporte", repErr);
      // Devolvemos análisis igual aunque falle el guardado
    }

    return new Response(
      JSON.stringify({ analisis, reporteId: reporte?.id ?? null, stats: payload.stats }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-responses error", e);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});