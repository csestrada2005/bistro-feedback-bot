import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_HOURS = [{ label: "Comida", start_h: 12, start_m: 0, end_h: 15, end_m: 0 }];
const DEFAULT_COOLDOWN_H = 4;
const DEFAULT_MIN_MS = 3000;
const TZ = "America/Mexico_City";

const BodySchema = z.object({
  q1: z.number().int().min(1).max(5),
  q2: z.number().int().min(1).max(5),
  q3: z.enum(["peor", "igual", "mejor"]),
  q4: z.enum(["no", "tal_vez", "si"]),
  comment: z.string().max(200).optional().nullable(),
  response_time_ms: z.number().int().min(0),
  device_fingerprint: z.string().min(8).max(128),
});

function nowInMx() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  };
}

function jsonError(status: number, code: string, message: string, meta: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ error: { code, message, ...meta } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
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
    return jsonError(400, "INVALID_INPUT", "Invalid survey payload", {
      issues: parsed.error.flatten().fieldErrors,
    });
  }
  const data = parsed.data;

  // Hours check
  const mx = nowInMx();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: settings } = await supabase
    .from("app_settings")
    .select("service_hours, cooldown_hours, min_response_ms")
    .eq("id", 1)
    .maybeSingle();

  const hours: Array<{ start_h: number; start_m: number; end_h: number; end_m: number }> =
    (settings?.service_hours as any) ?? DEFAULT_HOURS;
  const cooldownMs = ((settings?.cooldown_hours as number) ?? DEFAULT_COOLDOWN_H) * 60 * 60 * 1000;
  const minResponseMs = (settings?.min_response_ms as number) ?? DEFAULT_MIN_MS;

  const nowMin = mx.hour * 60 + mx.minute;
  const isOpen = hours.some((h) => {
    const s = h.start_h * 60 + (h.start_m ?? 0);
    const e = h.end_h * 60 + (h.end_m ?? 0);
    return nowMin >= s && nowMin < e;
  });
  if (!isOpen) {
    return jsonError(403, "OUTSIDE_HOURS", "El comedor está cerrado en este momento", { hours });
  }

  // Cooldown check
  const since = new Date(Date.now() - cooldownMs).toISOString();
  const { data: recent, error: recentErr } = await supabase
    .from("surveys")
    .select("created_at")
    .eq("device_fingerprint", data.device_fingerprint)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentErr) {
    console.error("cooldown lookup error", recentErr);
    return jsonError(500, "DB_ERROR", "Could not validate cooldown");
  }
  if (recent) {
    const lastMs = new Date(recent.created_at as string).getTime();
    const retryAfterSec = Math.max(
      1,
      Math.ceil((cooldownMs - (Date.now() - lastMs)) / 1000)
    );
    return jsonError(429, "COOLDOWN_ACTIVE", "Ya registramos tu opinión recientemente", {
      retry_after_seconds: retryAfterSec,
    });
  }

  // Today's menu
  const { data: menu } = await supabase
    .from("daily_menus")
    .select("id")
    .eq("date", mx.date)
    .maybeSingle();

  // Flag suspicious
  const allMin =
    data.q1 === 1 && data.q2 === 1 && data.q3 === "peor" && data.q4 === "no";
  const allMax =
    data.q1 === 5 && data.q2 === 5 && data.q3 === "mejor" && data.q4 === "si";
  const isFlagged = data.response_time_ms < minResponseMs || allMin || allMax;

  const comment = data.comment?.trim() ? data.comment.trim() : null;

  const { data: inserted, error: insErr } = await supabase
    .from("surveys")
    .insert({
      question_1_score: data.q1,
      question_2_score: data.q2,
      question_3_trend: data.q3,
      question_4_recommend: data.q4,
      comment,
      comment_status: "pending",
      response_time_ms: data.response_time_ms,
      device_fingerprint: data.device_fingerprint,
      daily_menu_id: menu?.id ?? null,
      is_flagged: isFlagged,
    })
    .select("id")
    .single();

  if (insErr) {
    console.error("insert error", insErr);
    return jsonError(500, "DB_ERROR", "Could not save survey");
  }

  return new Response(
    JSON.stringify({ ok: true, id: inserted.id, is_flagged: isFlagged }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
