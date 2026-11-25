// Acesso por código (0110). Quem chama é a paciente, ainda sem conta ou sem
// senha: chega só com a chave pública do app (verify_jwt = true aceita a
// chave anônima, que é um JWT), sem login, e esta função confere tudo
// sozinha. Ela recebe o código que a nutricionista gerou, o e-mail que a
// paciente escolheu e a senha nova; confere o código no banco, cria a conta
// (ou acerta a senha da conta que já é dela), liga a conta à ficha e gasta o
// código. Nenhum e-mail é enviado.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MENSAGENS: Record<string, string> = {
  codigo: "Código inválido, vencido ou já usado. Peça um código novo para a sua nutricionista.",
  muitas_tentativas: "Muitas tentativas seguidas. Espere 15 minutos e tente de novo.",
  email_invalido: "Esse e-mail não parece certo. Confira e tente de novo.",
  email_de_outra: "Esse e-mail já é de outra conta. Use outro e-mail.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return resp({ error: "Use POST." }, 405);

  try {
    const corpo = await req.json().catch(() => null);
    const codigo = typeof corpo?.codigo === "string" ? corpo.codigo.trim() : "";
    const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";
    const senha = typeof corpo?.senha === "string" ? corpo.senha : "";

    if (!codigo || !email || !senha) return resp({ error: "Preencha o código, o e-mail e a senha." }, 400);
    if (senha.length < 6) return resp({ error: "A senha precisa ter pelo menos 6 caracteres." }, 400);
    if (codigo.length > 40 || email.length > 254 || senha.length > 200) return resp({ error: "Dados grandes demais." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: conferido, error: erroConferir } = await admin.rpc("conferir_codigo_de_acesso", {
      p_codigo: codigo,
      p_email: email,
    });
    if (erroConferir) {
      console.error("conferir_codigo_de_acesso:", erroConferir.message);
      return resp({ error: "Não consegui conferir o código agora. Tente de novo em instantes." }, 500);
    }
    if (!conferido?.ok) {
      const motivo = String(conferido?.motivo ?? "codigo");
      return resp({ error: MENSAGENS[motivo] ?? MENSAGENS.codigo }, motivo === "muitas_tentativas" ? 429 : 400);
    }

    let perfilId: string | null = conferido.usuarioId ?? null;
    if (perfilId) {
      // A conta já existe e não é de outra ficha: acerta a senha.
      const { error } = await admin.auth.admin.updateUserById(perfilId, { password: senha, email_confirm: true });
      if (error) return resp({ error: traduzir(error.message) }, 400);
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
      if (error || !data?.user) return resp({ error: traduzir(error?.message ?? "") }, 400);
      perfilId = data.user.id;
    }

    const { error: erroConcluir } = await admin.rpc("concluir_codigo_de_acesso", {
      p_codigo: codigo,
      p_perfil: perfilId,
      p_email: email,
    });
    if (erroConcluir) {
      console.error("concluir_codigo_de_acesso:", erroConcluir.message);
      return resp({ error: "Não consegui terminar. Tente de novo com o mesmo código." }, 500);
    }

    return resp({ ok: true });
  } catch (e) {
    console.error("entrar-com-codigo:", e);
    return resp({ error: "Não consegui terminar. Tente de novo com o mesmo código." }, 500);
  }
});

function traduzir(msg: string): string {
  const t = msg.toLowerCase();
  if (t.includes("password")) return "Essa senha não foi aceita. Use pelo menos 6 caracteres, misturando letras e números.";
  if (t.includes("already") || t.includes("registered")) return MENSAGENS.email_de_outra;
  return "Não consegui criar o acesso. Tente de novo com o mesmo código.";
}

function resp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
