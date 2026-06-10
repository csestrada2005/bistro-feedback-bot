import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RespuestaSchema = z.object({
  pregunta_id: z.string().uuid(),
  valor_numerico: z.number().int().min(1).max(5).nullable().optional(),
  valor_booleano: z.boolean().nullable().optional(),
  valor_texto: z.string().max(2000).nullable().optional(),
});

const BodySchema = z.object({
  comedor_id: z.string().uuid(),
  respuestas: z.array(RespuestaSchema).min(1).max(50),
});

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Use POST");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Body must be valid JSON");
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "Invalid payload");
  }
  const { comedor_id, respuestas } = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Validar comedor activo
  const { data: comedor, error: cErr } = await supabase
    .from("comedores")
    .select("id, activo")
    .eq("id", comedor_id)
    .maybeSingle();
  if (cErr || !comedor || !comedor.activo) {
    return jsonError(404, "COMEDOR_NOT_FOUND", "Comedor no encontrado o inactivo");
  }

  // Validar que cada pregunta pertenece al comedor y está activa
  const preguntaIds = [...new Set(respuestas.map((r) => r.pregunta_id))];
  const { data: validas, error: pErr } = await supabase
    .from("comedor_preguntas")
    .select("pregunta_id, preguntas!inner(id, activa)")
    .eq("comedor_id", comedor_id)
    .in("pregunta_id", preguntaIds);
  if (pErr) return jsonError(500, "DB_ERROR", "Could not validate questions");
  const validSet = new Set(
    (validas ?? [])
      .filter((r: { preguntas: { activa: boolean } | null }) => r.preguntas?.activa)
      .map((r: { pregunta_id: string }) => r.pregunta_id),
  );
  if (validSet.size !== preguntaIds.length) {
    return jsonError(400, "INVALID_QUESTIONS", "Algunas preguntas no son válidas para este comedor");
  }

  // Crear encuesta
  const { data: enc, error: encErr } = await supabase
    .from("encuestas")
    .insert({ comedor_id })
    .select("id")
    .single();
  if (encErr || !enc) return jsonError(500, "DB_ERROR", "No se pudo crear la encuesta");

  const rows = respuestas.map((r) => ({
    encuesta_id: enc.id,
    pregunta_id: r.pregunta_id,
    valor_numerico: r.valor_numerico ?? null,
    valor_booleano: r.valor_booleano ?? null,
    valor_texto: r.valor_texto ?? null,
  }));
  const { error: rErr } = await supabase.from("respuestas").insert(rows);
  if (rErr) return jsonError(500, "DB_ERROR", "No se pudieron guardar las respuestas");

  return new Response(JSON.stringify({ ok: true, encuesta_id: enc.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});