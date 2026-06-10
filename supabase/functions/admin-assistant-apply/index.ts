import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { applyMutation, MUTATION_KINDS, type MutationKind } from "../_shared/admin-assistant-mutations.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

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
  const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
  const userId = userRes?.user?.id ?? null;
  if (userErr || !userId) return json(401, { error: "Sesión inválida" });

  const { data: rolRow } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", userId)
    .maybeSingle();
  if (rolRow?.rol !== "admin") return json(403, { error: "Solo administradores" });

  let body: {
    kind?: string;
    params?: Record<string, unknown>;
    pending?: Array<{ tool_call_id?: string; kind: string; params: Record<string, unknown> }>;
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  // Batch
  if (Array.isArray(body.pending) && body.pending.length > 0) {
    const results: Array<{
      tool_call_id?: string;
      kind: string;
      ok: boolean;
      result?: unknown;
      error?: string;
    }> = [];
    for (const item of body.pending) {
      if (!MUTATION_KINDS.includes(item.kind as MutationKind)) {
        results.push({ tool_call_id: item.tool_call_id, kind: item.kind, ok: false, error: "kind inválido" });
        continue;
      }
      const r = await applyMutation(supabase, item.kind as MutationKind, item.params ?? {});
      await supabase.from("assistant_actions").insert({
        admin_id: userId,
        tool: item.kind,
        params: item.params ?? {},
        result: r.ok ? r.result : null,
        status: r.ok ? "success" : "error",
        error_message: r.ok ? null : r.error,
      });
      results.push(
        r.ok
          ? { tool_call_id: item.tool_call_id, kind: item.kind, ok: true, result: r.result }
          : { tool_call_id: item.tool_call_id, kind: item.kind, ok: false, error: r.error },
      );
    }
    return json(200, { ok: true, results });
  }

  // Singular (compat)
  const kind = body.kind;
  if (!kind || !MUTATION_KINDS.includes(kind as MutationKind)) {
    return json(400, { error: `kind inválido: ${kind}` });
  }
  const params = body.params ?? {};
  const res = await applyMutation(supabase, kind as MutationKind, params);
  await supabase.from("assistant_actions").insert({
    admin_id: userId,
    tool: kind,
    params,
    result: res.ok ? res.result : null,
    status: res.ok ? "success" : "error",
    error_message: res.ok ? null : res.error,
  });
  if (!res.ok) return json(400, { error: res.error });
  return json(200, { ok: true, result: res.result });
});