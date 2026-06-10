import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const QSchema = z.object({
  text: z.string(),
  average: z.number(),
  changeVsPrev: z.number().nullable().optional(),
});

const BodySchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  totalResponses: z.number().int(),
  validResponses: z.number().int(),
  questions: z.array(QSchema).min(1),
  bottomDays: z.array(z.object({ date: z.string(), avgScore: z.number() })).max(10).optional().default([]),
  comments: z
    .array(z.object({ id: z.string().optional(), date: z.string(), text: z.string() }))
    .max(60)
    .optional()
    .default([]),
});

const tool = {
  type: "function",
  function: {
    name: "pdf_insights",
    description: "Devuelve contenido para PDF y comentarios puntuados.",
    parameters: {
      type: "object",
      properties: {
        executive_summary: { type: "string" },
        patterns: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
        bottlenecks: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            properties: { label: { type: "string" }, detail: { type: "string" } },
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
            properties: { title: { type: "string" }, impact: { type: "string" } },
            required: ["title", "impact"],
            additionalProperties: false,
          },
        },
        comment_scores: {
          type: "array",
          description: "Puntaje 0-100 por relevancia para cada comentario, en el mismo orden recibido.",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              text: { type: "string" },
              relevance: { type: "number" },
            },
            required: ["date", "text", "relevance"],
            additionalProperties: false,
          },
        },
      },
      required: ["executive_summary", "patterns", "bottlenecks", "recommendations", "comment_scores"],
      additionalProperties: false,
    },
  },
};

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
    return new Response(JSON.stringify({ error: "Invalid input", issues: parsed.error.flatten() }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const data = parsed.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  // Require authenticated admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: u, error: uErr } = await createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  ).auth.getUser(token);
  const userId = u?.user?.id ?? null;
  if (uErr || !userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: callerRow } = await adminClient
    .from("usuarios")
    .select("rol")
    .eq("id", userId)
    .maybeSingle();
  if (callerRow?.rol !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = `Eres un analista para reporte ejecutivo de comedor industrial mexicano. Devuelves contenido conciso para un PDF formal, en español. Usa siempre la herramienta pdf_insights. Para comment_scores asigna 0-100 según valor accionable (ignora ruido y groserías).`;

  const userPrompt = `Periodo: ${data.periodStart} a ${data.periodEnd}.
Respuestas: total ${data.totalResponses} / válidas ${data.validResponses}.

Promedios:
${data.questions
  .map(
    (q, i) =>
      `${i + 1}. ${q.text}: ${q.average.toFixed(2)}${
        q.changeVsPrev != null ? ` (cambio ${q.changeVsPrev.toFixed(1)}%)` : ""
      }`
  )
  .join("\n")}

Peores días: ${data.bottomDays.map((d) => `${d.date}=${d.avgScore.toFixed(2)}`).join(", ") || "—"}

Comentarios (puntua TODOS, mismo orden):
${data.comments.map((c, i) => `[${i + 1}] (${c.date}) ${c.text}`).join("\n") || "(ninguno)"}`;

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
        tools: [tool],
        tool_choice: { type: "function", function: { name: "pdf_insights" } },
      }),
    });
  } catch (e) {
    await adminClient.from("ai_usage").insert({
      user_id: userId,
      function_name: "pdf-insights",
      model,
      status: "network_error",
      error: String(e),
    });
    return new Response(JSON.stringify({ error: "AI gateway unreachable", fallback: true }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    await adminClient.from("ai_usage").insert({
      user_id: userId,
      function_name: "pdf-insights",
      model,
      status: `http_${aiResp.status}`,
      error: errText.slice(0, 500),
    });
    return new Response(JSON.stringify({ error: "AI gateway error", status: aiResp.status, fallback: true }), {
      status: aiResp.status === 402 || aiResp.status === 429 ? aiResp.status : 502,
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
    function_name: "pdf-insights",
    model,
    prompt_tokens: usage.prompt_tokens ?? null,
    completion_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
    status: result ? "ok" : "parse_error",
    error: result ? null : "Could not parse tool call",
  });

  if (!result) {
    return new Response(JSON.stringify({ error: "AI returned no structured result", fallback: true }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});