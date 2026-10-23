import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectTo } = await req.json();
    if (!email || typeof email !== "string") {
      return resp({ error: "email obrigatório" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return resp({ error: "não autenticado" }, 401);

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return resp({ error: "não autenticado" }, 401);

    const { data: perfil, error: perfilErr } = await admin
      .from("perfis")
      .select("papel")
      .eq("id", user.id)
      .single();

    if (perfilErr) {
      console.error("Erro ao buscar perfil:", perfilErr.message);
      return resp({ error: "erro ao verificar permissão" }, 500);
    }

    if (!perfil || perfil.papel !== "admin") {
      return resp({ error: "acesso restrito" }, 403);
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase().trim(),
      options: {
        redirectTo: redirectTo || undefined,
      },
    });

    if (error) return resp({ error: error.message }, 400);

    return resp({ link: data.properties.action_link });
  } catch (e) {
    console.error("Erro na edge function:", e);
    return resp(
      { error: e instanceof Error ? e.message : "erro interno" },
      500,
    );
  }
});

function resp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
