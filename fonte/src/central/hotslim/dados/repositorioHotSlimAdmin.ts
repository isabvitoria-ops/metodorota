import { exigirSupabase } from "@/central/supabase/cliente";

export interface ParticipanteHotSlim {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  data_inicio: string;
  data_fim: string;
  fases_liberadas: number[];
  ativo: boolean;
  criado_em: string;
}

export interface ChecklistResumo {
  dia: string;
  intestino_regulou: boolean;
  sem_gases: boolean;
  dormiu_bem: boolean;
  barriga_desinchada: boolean;
  sem_compulsao: boolean;
  energia_boa: boolean;
  humor_estavel: boolean;
  notas: string | null;
}

const CAMPOS_CHECKLIST = [
  "intestino_regulou",
  "sem_gases",
  "dormiu_bem",
  "barriga_desinchada",
  "sem_compulsao",
  "energia_boa",
  "humor_estavel",
] as const;

export function contarMarcadosChecklist(dia: ChecklistResumo): number {
  return CAMPOS_CHECKLIST.filter((c) => dia[c]).length;
}

export const repositorioHotSlimAdmin = {
  async listarParticipantes(): Promise<ParticipanteHotSlim[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("hotslim_participantes")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ParticipanteHotSlim[];
  },

  async cadastrarParticipante(dados: {
    nome: string;
    email: string;
    telefone?: string;
    data_inicio: string;
    data_fim: string;
  }): Promise<void> {
    const sb = exigirSupabase();
    const emailNorm = dados.email.toLowerCase().trim();

    const { data: perfilExistente, error: erroPerfil } = await sb
      .from("perfis")
      .select("id, papel")
      .eq("email", emailNorm)
      .maybeSingle();
    if (erroPerfil) throw new Error(`Erro ao buscar perfil: ${erroPerfil.message}`);

    let perfilId: string;

    if (perfilExistente) {
      perfilId = perfilExistente.id;
      if (perfilExistente.papel !== "admin") {
        const { error: erroUpdate } = await sb.from("perfis").update({ papel: "hotslim" }).eq("id", perfilId);
        if (erroUpdate) throw new Error(`Erro ao atualizar papel: ${erroUpdate.message}`);
      }
    } else {
      const { error: otpError } = await sb.auth.signInWithOtp({
        email: emailNorm,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/hotslim`,
        },
      });
      if (otpError) throw new Error(`Erro ao enviar convite: ${otpError.message}`);

      let tentativas = 0;
      let perfil = null;
      while (!perfil && tentativas < 5) {
        await new Promise((r) => setTimeout(r, 800));
        const { data } = await sb
          .from("perfis")
          .select("id")
          .eq("email", emailNorm)
          .maybeSingle();
        perfil = data;
        tentativas++;
      }
      if (!perfil) throw new Error("Convite enviado, mas o perfil ainda não foi criado. Tente novamente em alguns segundos.");
      perfilId = perfil.id;
      const { error: erroRol } = await sb.from("perfis").update({ papel: "hotslim", nome: dados.nome }).eq("id", perfilId);
      if (erroRol) throw new Error(`Erro ao definir papel: ${erroRol.message}`);
    }

    const { error } = await sb.from("hotslim_participantes").upsert(
      {
        id: perfilId,
        nome: dados.nome,
        email: emailNorm,
        telefone: dados.telefone?.trim() || null,
        data_inicio: dados.data_inicio,
        data_fim: dados.data_fim,
        fases_liberadas: [],
        ativo: true,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  },

  async alterarParticipante(
    id: string,
    patch: Partial<Pick<ParticipanteHotSlim, "nome" | "telefone" | "data_inicio" | "data_fim" | "ativo" | "fases_liberadas">>,
  ): Promise<void> {
    const sb = exigirSupabase();
    const { error } = await sb.from("hotslim_participantes").update(patch).eq("id", id);
    if (error) throw error;
  },

  async definirFases(id: string, fases: number[]): Promise<void> {
    const sb = exigirSupabase();
    const { error } = await sb
      .from("hotslim_participantes")
      .update({ fases_liberadas: fases })
      .eq("id", id);
    if (error) throw error;
  },

  async carregarChecklist(participanteId: string): Promise<ChecklistResumo[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("hotslim_checklist")
      .select("*")
      .eq("participante_id", participanteId)
      .order("dia", { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data ?? []) as ChecklistResumo[];
  },

  async removerParticipante(id: string): Promise<void> {
    const sb = exigirSupabase();
    const { error } = await sb.from("hotslim_participantes").delete().eq("id", id);
    if (error) throw error;
  },
};
