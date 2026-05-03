import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const QuestionStatSchema = z.object({
  text: z.string(),
  average: z.number(),
  changeVsPrev: z.number().nullable().optional(),
});

const BodySchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  totalResponses: z.number().int(),
  validResponses: z.number().int(),
  questions: z.array(QuestionStatSchema).min(1),
  topComments: z
    .array(z.object({ text: z.string(), date: z.string().optional() }))
    .max(40)
    .optional()
    .default([]),
  bottomDays: z
    .array(z.object({ date: z.string(), avgScore: z.number() }))
    .max(10)
    .optional()
    .default([]),
  forceRefresh: z.boolean().optional().default(false),
});

const insightsTool = {
  type: "function",
  function: {
    name: "report_insights",
    description: "Devuelve un análisis estructurado del periodo.",
    parameters: {
      type: "object",
      properties: {
        executive_summary: { type: "string", description: "Un párrafo (máx 120 palabras)." },
        patterns: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: { type: "string" },
        },
        bottlenecks: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              detail: { type: "string" },
            },
            required: ["label", "detail"],
            additionalProperties: false,
          },
        },
        recommendations: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              impact: { type: "string", description: "Por qué importa y costo estimado." },
            },
            required: ["title", "impact"],
            additionalProperties: false,
          },
        },
      },
      required: ["executive_summary", "patterns", "bottlenecks", "recommendations"],
      additionalProperties: false,
    },
  },
};

function cacheKey(payload: z.infer<typeof BodySchema>) {
  const seed = JSON.stringify({
    s: payload.periodStart,
    e: payload.periodEnd,
    n: payload.validResponses,
    q: payload.questions.map((q) => [q.text, Math.round(q.average * 100)]),
    b: payload.bottomDays.map((d) => [d.date, Math.round(d.avgScore * 100)]),
  });
  // simple hash
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return `insights:${payload.periodStart}:${payload.periodEnd}:${h}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid input", issues: parsed.error.flatten() }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const data = parsed.data;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  // Try to identify the calling user (for usage logging)
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    const { data: u } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    }).auth.getUser();
    userId = u?.user?.id ?? null;
  }

  const key = cacheKey(data);

  if (!data.forceRefresh) {
    const { data: cached } = await adminClient
      .from("ai_insights_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached?.payload) {
      return new Response(JSON.stringify({ ...cached.payload, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = `Eres un analista senior de operaciones para un comedor industrial mexicano. Recibes estadísticas agregadas y devuelves un análisis ejecutivo en español, conciso, accionable y orientado a impacto vs costo. Usa siempre la herramienta report_insights.`;

  const userPrompt = `Periodo: ${data.periodStart} a ${data.periodEnd}.
Respuestas totales: ${data.totalResponses}. Válidas: ${data.validResponses}.

Promedios por pregunta:
${data.questions
  .map(
    (q, i) =>
      `${i + 1}. ${q.text} → ${q.average.toFixed(2)}${
        q.changeVsPrev != null ? ` (cambio vs periodo anterior: ${q.changeVsPrev.toFixed(1)}%)` : ""
      }`
  )
  .join("\n")}

Peores días (promedio Q1):
${data.bottomDays.map((d) => `- ${d.date}: ${d.avgScore.toFixed(2)}`).join("\n") || "(sin datos)"}

Comentarios destacados (muestra):
${data.topComments.slice(0, 20).map((c) => `- "${c.text}"`).join("\n") || "(sin comentarios)"}

Genera: resumen ejecutivo (1 párrafo), 3 patrones, 3 cuellos de botella, 3-5 recomendaciones priorizadas por impacto/costo.`;

  const model = "google/gemini-3-flash-preview";

  let aiResp: Response;
  try {
    aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [insightsTool],
        tool_choice: { type: "function", function: { name: "report_insights" } },
      }),
    });
  } catch (e) {
    await adminClient.from("ai_usage").insert({
      user_id: userId,
      function_name: "generate-insights",
      model,
      status: "network_error",
      error: String(e),
    });
    return new Response(JSON.stringify({ error: "AI gateway unreachable" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    await adminClient.from("ai_usage").insert({
      user_id: userId,
      function_name: "generate-insights",
      model,
      status: `http_${aiResp.status}`,
      error: errText.slice(0, 500),
    });
    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit excedido. Intenta más tarde." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "AI gateway error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiJson = await aiResp.json();
  const usage = aiJson.usage ?? {};
  const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
  let result: any = null;
  try {
    result = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
  } catch {
    result = null;
  }

  await adminClient.from("ai_usage").insert({
    user_id: userId,
    function_name: "generate-insights",
    model,
    prompt_tokens: usage.prompt_tokens ?? null,
    completion_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
    status: result ? "ok" : "parse_error",
    error: result ? null : "Could not parse tool call",
  });

  if (!result) {
    return new Response(JSON.stringify({ error: "AI returned no structured result" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // cache for 1 hour
  await adminClient.from("ai_insights_cache").upsert({
    cache_key: key,
    payload: result,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  return new Response(JSON.stringify({ ...result, cached: false }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});