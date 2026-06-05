import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RoleEnum = z.enum(["admin", "operador", "cliente"]);

const ListSchema = z.object({ action: z.literal("list") });
const InviteSchema = z.object({
  action: z.literal("invite"),
  email: z.string().trim().email().max(255),
  role: RoleEnum,
  password: z.string().min(8).max(72),
  nombre: z.string().trim().min(1).max(120).optional(),
  comedor_id: z.string().uuid().nullable().optional(),
});
const RemoveSchema = z.object({ action: z.literal("remove"), user_id: z.string().uuid() });
const UpdateSchema = z.object({
  action: z.literal("update"),
  user_id: z.string().uuid(),
  role: RoleEnum.optional(),
  comedor_id: z.string().uuid().nullable().optional(),
  password: z.string().min(8).max(72).optional(),
  nombre: z.string().trim().min(1).max(120).optional(),
});
const Body = z.union([ListSchema, InviteSchema, RemoveSchema, UpdateSchema]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization");
  if (!auth) return json(401, { error: "Missing auth" });

  const admin = createClient(supabaseUrl, serviceKey);

  // Decode caller's JWT (sub) without requiring an active session.
  let callerId: string | null = null;
  try {
    const token = auth.replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    callerId = payload?.sub ?? null;
  } catch (_) {
    callerId = null;
  }
  if (!callerId) return json(401, { error: "Invalid token" });

  const { data: caller } = await admin
    .from("usuarios")
    .select("rol")
    .eq("id", callerId)
    .maybeSingle();
  if (caller?.rol !== "admin") return json(403, { error: "Solo administradores" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return json(400, { error: parsed.error.flatten() });
  const action = parsed.data;

  if (action.action === "list") {
    const { data: rows, error: rErr } = await admin
      .from("usuarios")
      .select("id, nombre, rol, comedor_id, created_at")
      .order("created_at", { ascending: false });
    if (rErr) return json(500, { error: rErr.message });
    const users: { user_id: string; email: string; nombre: string; rol: string; comedor_id: string | null; created_at: string }[] = [];
    for (const r of rows ?? []) {
      const { data: ur } = await admin.auth.admin.getUserById(r.id);
      users.push({
        user_id: r.id,
        email: ur?.user?.email ?? "—",
        nombre: r.nombre ?? "",
        rol: r.rol,
        comedor_id: r.comedor_id,
        created_at: r.created_at,
      });
    }
    return json(200, { users });
  }

  if (action.action === "invite") {
    if (action.role === "cliente" && !action.comedor_id) {
      return json(400, { error: "Los clientes deben tener un comedor asignado" });
    }
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: action.email,
      password: action.password,
      email_confirm: true,
    });
    if (cErr || !created.user) return json(400, { error: cErr?.message ?? "No se pudo crear" });
    const { error: roleErr } = await admin.from("usuarios").insert({
      id: created.user.id,
      nombre: action.nombre ?? action.email.split("@")[0],
      rol: action.role,
      comedor_id: action.role === "cliente" || action.role === "operador" ? action.comedor_id ?? null : null,
    });
    if (roleErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json(400, { error: roleErr.message });
    }
    return json(200, { ok: true, user_id: created.user.id });
  }

  if (action.action === "update") {
    if (action.user_id === callerId && action.role && action.role !== "admin") {
      return json(400, { error: "No puedes cambiar tu propio rol" });
    }
    const patch: Record<string, unknown> = {};
    if (action.role !== undefined) patch.rol = action.role;
    if (action.comedor_id !== undefined) patch.comedor_id = action.comedor_id;
    if (action.nombre !== undefined) patch.nombre = action.nombre;
    if (Object.keys(patch).length) {
      const { error: uErr } = await admin.from("usuarios").update(patch).eq("id", action.user_id);
      if (uErr) return json(400, { error: uErr.message });
    }
    if (action.password) {
      const { error: pErr } = await admin.auth.admin.updateUserById(action.user_id, {
        password: action.password,
      });
      if (pErr) return json(400, { error: pErr.message });
    }
    return json(200, { ok: true });
  }

  if (action.action === "remove") {
    if (action.user_id === callerId) return json(400, { error: "No puedes eliminarte a ti mismo" });
    await admin.from("usuarios").delete().eq("id", action.user_id);
    const { error: dErr } = await admin.auth.admin.deleteUser(action.user_id);
    if (dErr) return json(400, { error: dErr.message });
    return json(200, { ok: true });
  }

  return json(400, { error: "Unknown action" });
});