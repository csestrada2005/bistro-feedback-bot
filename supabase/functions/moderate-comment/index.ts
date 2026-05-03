import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  comment: z.string().min(1).max(500),
  scores: z
    .object({
      sabor: z.number().int().min(1).max(5).optional(),
      limpieza: z.number().int().min(1).max(5).optional(),
      tendencia: z.string().optional(),
      recomendacion: z.string().optional(),
    })
    .optional(),
});

type Suggestion = {
  suggested_action: "approved" | "archived" | "deleted";
  reasoning: string;
  flags: string[];
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
    return new Response(
      JSON.stringify({ error: "Invalid input", issues: parsed.error.flatten() }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { comment, scores } = parsed.data;
  const ctx = scores
    ? `Contexto de la encuesta — Sabor: ${scores.sabor ?? "?"}/5, Limpieza: ${scores.limpieza ?? "?"}/5, Tendencia: ${scores.tendencia ?? "?"}, Recomienda: ${scores.recomendacion ?? "?"}.`
    : "";

  const systemPrompt = `Eres un moderador de comentarios para un comedor industrial. Decide si aprobar, archivar o borrar un comentario.

Reglas:
- "approved": feedback legítimo (positivo, negativo o neutral) que ayude al operador a mejorar.
- "archived": comentarios sin valor accionable (saludos, ruido, repetidos) que no deberían aparecer en reportes.
- "deleted": ataques personales, profanidad, contenido fuera de tema o spam.

Devuelve SIEMPRE estructurado vía la herramienta moderation_decision.`;

  const userPrompt = `${ctx}\n\nComentario del obrero: """${comment}"""\n\n¿Qué acción recomiendas y por qué?`;

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "moderation_decision",
              description: "Devuelve la decisión de moderación.",
              parameters: {
                type: "object",
                properties: {
                  suggested_action: {
                    type: "string",
                    enum: ["approved", "archived", "deleted"],
                  },
                  reasoning: { type: "string" },
                  flags: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [
                        "profanity",
                        "off_topic",
                        "personal_attack",
                        "legitimate_feedback",
                        "spam",
                        "noise",
                      ],
                    },
                  },
                },
                required: ["suggested_action", "reasoning", "flags"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "moderation_decision" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("ai gateway error", aiResp.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI did not return a structured suggestion" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let suggestion: Suggestion;
    try {
      suggestion = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(suggestion), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-comment error", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
