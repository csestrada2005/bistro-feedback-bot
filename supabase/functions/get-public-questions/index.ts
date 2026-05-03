import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from("questions")
    .select("id, order_num, question_text, question_type")
    .eq("is_active", true)
    .order("order_num", { ascending: true });

  if (error) {
    console.error("questions fetch error", error);
    return new Response(
      JSON.stringify({ error: { code: "DB_ERROR", message: "Could not load questions" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ questions: data ?? [] }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
