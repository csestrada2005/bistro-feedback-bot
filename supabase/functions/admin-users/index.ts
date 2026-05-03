import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RoleEnum = z.enum(["cafeteria_admin", "hr_viewer"]);

const ListSchema = z.object({ action: z.literal("list") });
const InviteSchema = z.object({
  action: z.literal("invite"),
  email: z.string().trim().email().max(255),
  role: RoleEnum,
  password: z.string().min(8).max(72),
});
const RemoveSchema = z.object({ action: z.literal("remove"), user_id: z.string().uuid() });
const Body = z.union([ListSchema, InviteSchema, RemoveSchema]);

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const auth = req.headers.get("Authorization");
  if (!auth) return json(401, { error: "Missing auth" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await userClient.auth.getUser();
  const callerId = u?.user?.id;
  if (!callerId) return json(401, { error: "Invalid token" });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "cafeteria_admin")
    .maybeSingle();
  if (!roleRow) return json(403, { error: "Solo cafeteria_admin" });

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
    const { data: roles, error: rErr } = await admin
      .from("user_roles")
      .select("user_id, role, created_at");
    if (rErr) return json(500, { error: rErr.message });
    const ids = Array.from(new Set(roles?.map((r) => r.user_id) ?? []));
    const users: { id: string; email: string }[] = [];
    for (const id of ids) {
      const { data: ur } = await admin.auth.admin.getUserById(id);
      if (ur?.user) users.push({ id: ur.user.id, email: ur.user.email ?? "" });
    }
    const merged = (roles ?? []).map((r) => ({
      user_id: r.user_id,
      role: r.role,
      created_at: r.created_at,
      email: users.find((u) => u.id === r.user_id)?.email ?? "—",
    }));
    return json(200, { users: merged });
  }

  if (action.action === "invite") {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: action.email,
      password: action.password,
      email_confirm: true,
    });
    if (cErr || !created.user) return json(400, { error: cErr?.message ?? "No se pudo crear" });
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: action.role });
    if (roleErr) {
      // rollback
      await admin.auth.admin.deleteUser(created.user.id);
      return json(400, { error: roleErr.message });
    }
    return json(200, { ok: true, user_id: created.user.id });
  }

  if (action.action === "remove") {
    if (action.user_id === callerId) return json(400, { error: "No puedes eliminarte a ti mismo" });
    await admin.from("user_roles").delete().eq("user_id", action.user_id);
    const { error: dErr } = await admin.auth.admin.deleteUser(action.user_id);
    if (dErr) return json(400, { error: dErr.message });
    return json(200, { ok: true });
  }

  return json(400, { error: "Unknown action" });
});