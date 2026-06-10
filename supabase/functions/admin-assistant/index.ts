import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { MUTATION_KINDS } from "../_shared/admin-assistant-mutations.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Eres el asistente IA del panel administrador de Main Catering, una plataforma de encuestas de satisfacción para comedores industriales en México.

Tu rol: ayudar al admin a gestionar preguntas, comedores, reportes y usuarios mediante conversación natural en español.

REGLAS IMPORTANTES:
- Antes de proponer cualquier mutación, asegúrate de tener IDs reales (usa las tools de lectura primero).
- Para CUALQUIER acción que modifique datos (crear, editar, borrar, asignar, publicar, etc.), DEBES llamar la tool 'execute_mutation' — NUNCA inventes que ya lo hiciste. El sistema mostrará una tarjeta de aprobación al admin antes de aplicar.
- En 'execute_mutation' incluye un 'summary' claro en español que describa exactamente lo que pasará si el admin aprueba (ej: "Apagar 3 preguntas en el comedor Planta Norte").
- Cuando una mutación quede pendiente de aprobación, dile al usuario en lenguaje natural qué propusiste y que la tarjeta de aprobación está abajo. NO repitas la lista de IDs crudos.
- Si el usuario hace una pregunta analítica, usa 'resumen_comedor' o 'top_problemas' y responde con bullets concisos.
- Formato de salida: markdown ligero (bullets, negritas). Sin tablas gigantes.`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "list_preguntas",
      description:
        "Lista preguntas de la encuesta con sus comedores asignados. Filtra por comedor o estado.",
      parameters: {
        type: "object",
        properties: {
          filtro_comedor_id: { type: "string", description: "UUID del comedor (opcional)" },
          activa: { type: "boolean", description: "Filtrar por estado activa/inactiva (opcional)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_comedores",
      description: "Lista todos los comedores.",
      parameters: {
        type: "object",
        properties: { activo: { type: "boolean" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listar_reportes",
      description: "Lista reportes generados, opcionalmente filtrados.",
      parameters: {
        type: "object",
        properties: {
          comedor_id: { type: "string" },
          estado: { type: "string", enum: ["borrador", "publicado"] },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listar_usuarios",
      description: "Lista usuarios del sistema.",
      parameters: {
        type: "object",
        properties: { rol: { type: "string", enum: ["admin", "cliente"] } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "resumen_comedor",
      description:
        "Resumen estadístico de un comedor en los últimos N días: total encuestas, promedio general, % incidentes.",
      parameters: {
        type: "object",
        properties: {
          comedor_id: { type: "string" },
          dias: { type: "number", default: 14 },
        },
        required: ["comedor_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "top_problemas",
      description: "Top N preguntas peor evaluadas en un comedor en los últimos N días.",
      parameters: {
        type: "object",
        properties: {
          comedor_id: { type: "string" },
          dias: { type: "number", default: 14 },
          n: { type: "number", default: 5 },
        },
        required: ["comedor_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "execute_mutation",
      description:
        "PROPONE una mutación al admin. NO se ejecuta automáticamente — el sistema muestra una tarjeta de aprobación. Devuelve { requires_approval: true } siempre.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: MUTATION_KINDS },
          params: { type: "object", description: "Parámetros específicos del tipo de mutación" },
          summary: { type: "string", description: "Resumen claro en español de lo que se hará" },
        },
        required: ["kind", "params", "summary"],
      },
    },
  },
];

async function executeReadTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "list_preguntas": {
      let q = supabase.from("preguntas").select("id, texto, tipo, activa, orden").order("orden");
      if (typeof args.activa === "boolean") q = q.eq("activa", args.activa);
      const { data: preguntas } = await q;
      const { data: asignaciones } = await supabase
        .from("comedor_preguntas")
        .select("pregunta_id, comedor_id");
      const map: Record<string, string[]> = {};
      for (const r of asignaciones ?? []) {
        (map[r.pregunta_id as string] ??= []).push(r.comedor_id as string);
      }
      let result = (preguntas ?? []).map((p) => ({ ...p, comedor_ids: map[p.id as string] ?? [] }));
      if (typeof args.filtro_comedor_id === "string") {
        result = result.filter((p) => p.comedor_ids.includes(args.filtro_comedor_id as string));
      }
      return result.slice(0, 100);
    }
    case "list_comedores": {
      let q = supabase.from("comedores").select("id, nombre, slug, empresa_cliente, activo");
      if (typeof args.activo === "boolean") q = q.eq("activo", args.activo);
      const { data } = await q.order("nombre");
      return data ?? [];
    }
    case "listar_reportes": {
      let q = supabase
        .from("reportes")
        .select("id, comedor_id, titulo, estado, fecha_desde, fecha_hasta, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (typeof args.comedor_id === "string") q = q.eq("comedor_id", args.comedor_id);
      if (typeof args.estado === "string") q = q.eq("estado", args.estado);
      const { data } = await q;
      return data ?? [];
    }
    case "listar_usuarios": {
      let q = supabase.from("usuarios").select("id, nombre, email, rol");
      if (typeof args.rol === "string") q = q.eq("rol", args.rol);
      const { data } = await q.limit(100);
      return data ?? [];
    }
    case "resumen_comedor": {
      const comedorId = String(args.comedor_id);
      const dias = Number(args.dias ?? 14);
      const since = new Date(Date.now() - dias * 86_400_000).toISOString();
      const { data: enc } = await supabase
        .from("encuestas")
        .select("id")
        .eq("comedor_id", comedorId)
        .gte("fecha", since);
      const ids = (enc ?? []).map((e) => e.id as string);
      if (ids.length === 0) {
        return { total_encuestas: 0, promedio: null, pct_incidentes: null };
      }
      const { data: resp } = await supabase
        .from("respuestas")
        .select("valor_numerico, valor_booleano, pregunta_id")
        .in("encuesta_id", ids);
      const escala = (resp ?? []).filter((r) => r.valor_numerico != null);
      const promedio = escala.length
        ? +(escala.reduce((a, b) => a + (b.valor_numerico as number), 0) / escala.length).toFixed(2)
        : null;
      const bool = (resp ?? []).filter((r) => r.valor_booleano != null);
      const yes = bool.filter((r) => r.valor_booleano === true).length;
      const pct = bool.length ? +((yes / bool.length) * 100).toFixed(1) : null;
      return { total_encuestas: ids.length, promedio, pct_incidentes: pct, dias };
    }
    case "top_problemas": {
      const comedorId = String(args.comedor_id);
      const dias = Number(args.dias ?? 14);
      const n = Number(args.n ?? 5);
      const since = new Date(Date.now() - dias * 86_400_000).toISOString();
      const { data: enc } = await supabase
        .from("encuestas")
        .select("id")
        .eq("comedor_id", comedorId)
        .gte("fecha", since);
      const ids = (enc ?? []).map((e) => e.id as string);
      if (ids.length === 0) return [];
      const { data: resp } = await supabase
        .from("respuestas")
        .select("pregunta_id, valor_numerico")
        .in("encuesta_id", ids)
        .not("valor_numerico", "is", null);
      const byP: Record<string, number[]> = {};
      for (const r of resp ?? []) {
        (byP[r.pregunta_id as string] ??= []).push(r.valor_numerico as number);
      }
      const { data: preguntas } = await supabase
        .from("preguntas")
        .select("id, texto")
        .in("id", Object.keys(byP));
      const txt: Record<string, string> = {};
      for (const p of preguntas ?? []) txt[p.id as string] = p.texto as string;
      const ranked = Object.entries(byP)
        .map(([id, vals]) => ({
          pregunta_id: id,
          texto: txt[id] ?? "(?)",
          n: vals.length,
          promedio: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
        }))
        .sort((a, b) => a.promedio - b.promedio)
        .slice(0, n);
      return ranked;
    }
    default:
      return { error: `tool desconocida: ${name}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json(500, { error: "LOVABLE_API_KEY no configurada" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "No autorizado" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
  const userId = claimsRes?.claims?.sub ?? null;
  if (claimsErr || !userId) return json(401, { error: "Sesión inválida" });

  const { data: rolRow } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", userId)
    .maybeSingle();
  if (rolRow?.rol !== "admin") return json(403, { error: "Solo administradores" });

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "JSON inválido" });
  }
  const incoming = Array.isArray(body.messages) ? body.messages : [];

  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...incoming];

  // Loop hasta 6 iteraciones
  for (let i = 0; i < 6; i++) {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    if (resp.status === 429) return json(429, { error: "Demasiadas solicitudes a la IA. Intenta en un minuto." });
    if (resp.status === 402) return json(402, { error: "Créditos de IA agotados. Recarga en Lovable Cloud." });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("AI error", resp.status, txt);
      return json(502, { error: "Error de la IA" });
    }
    const data = await resp.json();
    const choice = data?.choices?.[0]?.message as ChatMessage | undefined;
    if (!choice) return json(502, { error: "Respuesta IA vacía" });

    messages.push({
      role: "assistant",
      content: choice.content ?? null,
      tool_calls: choice.tool_calls,
    });

    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      // Respuesta final
      return json(200, {
        status: "done",
        messages: messages.slice(1), // sin system
      });
    }

    let pending: {
      tool_call_id: string;
      kind: string;
      params: Record<string, unknown>;
      summary: string;
    } | null = null;

    for (const call of toolCalls) {
      const name = call.function?.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function?.arguments ?? "{}");
      } catch {
        args = {};
      }
      if (name === "execute_mutation") {
        // No ejecutar. Marcar pendiente y devolver al cliente.
        pending = {
          tool_call_id: call.id,
          kind: String(args.kind ?? ""),
          params: (args.params ?? {}) as Record<string, unknown>,
          summary: String(args.summary ?? ""),
        };
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            requires_approval: true,
            summary: pending.summary,
            kind: pending.kind,
          }),
        });
      } else {
        const result = await executeReadTool(supabase, name, args);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 12_000),
        });
      }
    }

    if (pending) {
      // Si el assistant message anterior no tiene contenido natural, pedir uno breve
      const lastAssistant = messages[messages.length - 2];
      const noNaturalText =
        !lastAssistant?.content || (typeof lastAssistant.content === "string" && !lastAssistant.content.trim());
      if (noNaturalText) {
        const followResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
        });
        if (followResp.ok) {
          const fd = await followResp.json();
          const fmsg = fd?.choices?.[0]?.message;
          if (fmsg?.content) messages.push({ role: "assistant", content: fmsg.content });
        }
      }
      return json(200, {
        status: "pending_approval",
        pending,
        messages: messages.slice(1),
      });
    }
  }

  return json(200, { status: "done", messages: messages.slice(1) });
});